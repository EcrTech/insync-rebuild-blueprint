import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendInboundPayload {
  messageId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  }>;
  threadId?: string;
  inReplyTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = getSupabaseClient();

    const payload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Check if this is a Resend webhook event (has 'type' field)
    if (payload.type) {
      console.log(`Received Resend webhook event: ${payload.type}`);
      // These are delivery status events, not inbound emails - acknowledge and ignore
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook event acknowledged' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no 'type' field, this is an inbound email forwarding event
    const inboundEmail: ResendInboundPayload = payload;
    console.log('Processing inbound email from:', inboundEmail.from);

    // Extract domain from recipient email (inboundEmail.to)
    const recipientEmail = inboundEmail.to;
    const recipientDomain = recipientEmail.split('@')[1];
    console.log('Recipient domain:', recipientDomain);

    // Find organization by matching sending domain
    const { data: emailSettings } = await supabaseClient
      .from('email_settings')
      .select('org_id, verification_status, is_active')
      .eq('sending_domain', recipientDomain)
      .eq('is_active', true)
      .limit(1);

    if (!emailSettings || emailSettings.length === 0) {
      console.log('No active email settings found for domain:', recipientDomain);
      return new Response(
        JSON.stringify({ success: false, message: 'Email sent to unverified domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = emailSettings[0].org_id;
    console.log('Found organization:', orgId);

    // Find existing contact by email and org_id
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('id')
      .eq('email', inboundEmail.from)
      .eq('org_id', orgId)
      .limit(1);

    let contactId = contacts?.[0]?.id;

    // If contact doesn't exist, create new contact
    if (!contactId) {
      console.log('Contact not found, creating new contact for:', inboundEmail.from);
      
      // Parse name from inboundEmail
      let firstName = '';
      let lastName = '';
      
      if (inboundEmail.fromName) {
        const nameParts = inboundEmail.fromName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        // Extract name from email (before @)
        firstName = inboundEmail.from.split('@')[0];
      }

      // Create new contact
      const { data: newContact, error: createError } = await supabaseClient
        .from('contacts')
        .insert({
          org_id: orgId,
          email: inboundEmail.from,
          first_name: firstName,
          last_name: lastName || null,
          source: 'email_inbound',
          status: 'new',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating contact:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create contact: ' + createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      contactId = newContact.id;
      console.log('Created new contact:', contactId);
    }

    // Generate conversation ID from thread or create new
    const conversationId = inboundEmail.threadId || crypto.randomUUID();

    // Store inbound email
    const { error: insertError } = await supabaseClient
      .from('email_conversations')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        conversation_id: conversationId,
        thread_id: inboundEmail.threadId,
        direction: 'inbound',
        from_email: inboundEmail.from,
        from_name: inboundEmail.fromName,
        to_email: inboundEmail.to,
        subject: inboundEmail.subject,
        email_content: inboundEmail.text,
        html_content: inboundEmail.html,
        has_attachments: (inboundEmail.attachments?.length ?? 0) > 0,
        attachments: inboundEmail.attachments ? JSON.stringify(inboundEmail.attachments) : null,
        provider_message_id: inboundEmail.messageId,
        status: 'received',
        is_read: false,
        received_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error inserting inbound email:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Stored inbound email from:', inboundEmail.from);

    return new Response(
      JSON.stringify({ success: true, message: 'Inbound email stored' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing inbound email webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

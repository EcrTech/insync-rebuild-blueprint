import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload: ResendInboundPayload = await req.json();
    console.log('Received inbound email:', JSON.stringify(payload, null, 2));

    // Extract domain from recipient email (payload.to)
    const recipientEmail = payload.to;
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
      .eq('email', payload.from)
      .eq('org_id', orgId)
      .limit(1);

    let contactId = contacts?.[0]?.id;

    // If contact doesn't exist, create new contact
    if (!contactId) {
      console.log('Contact not found, creating new contact for:', payload.from);
      
      // Parse name from payload
      let firstName = '';
      let lastName = '';
      
      if (payload.fromName) {
        const nameParts = payload.fromName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        // Extract name from email (before @)
        firstName = payload.from.split('@')[0];
      }

      // Create new contact
      const { data: newContact, error: createError } = await supabaseClient
        .from('contacts')
        .insert({
          org_id: orgId,
          email: payload.from,
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
    const conversationId = payload.threadId || crypto.randomUUID();

    // Store inbound email
    const { error: insertError } = await supabaseClient
      .from('email_conversations')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        conversation_id: conversationId,
        thread_id: payload.threadId,
        direction: 'inbound',
        from_email: payload.from,
        from_name: payload.fromName,
        to_email: payload.to,
        subject: payload.subject,
        email_content: payload.text,
        html_content: payload.html,
        has_attachments: (payload.attachments?.length ?? 0) > 0,
        attachments: payload.attachments ? JSON.stringify(payload.attachments) : null,
        provider_message_id: payload.messageId,
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

    console.log('Stored inbound email from:', payload.from);

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

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

    // Find contact by email
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('id, org_id')
      .eq('email', payload.from)
      .limit(1);

    let contactId = contacts?.[0]?.id;
    let orgId = contacts?.[0]?.org_id;

    if (!contactId || !orgId) {
      console.log('Contact not found for email:', payload.from);
      return new Response(
        JSON.stringify({ success: true, message: 'Contact not found, email ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

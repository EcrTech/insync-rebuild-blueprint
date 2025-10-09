import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GupshupWebhookPayload {
  type: string;
  payload: {
    id: string;
    gsId: string;
    mobile: string;
    status: string;
    timestamp: number;
    type: string;
  };
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

    const payload: GupshupWebhookPayload = await req.json();
    
    console.log('Received Gupshup webhook:', JSON.stringify(payload, null, 2));

    // Extract status information
    const { type, payload: webhookData } = payload;
    
    if (type === 'message-event' && webhookData.gsId) {
      const messageStatus = webhookData.status.toLowerCase();
      const timestamp = new Date(webhookData.timestamp);

      // Find the message by gupshup_message_id
      const { data: message, error: fetchError } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('gupshup_message_id', webhookData.gsId)
        .single();

      if (fetchError || !message) {
        console.error('Message not found:', webhookData.gsId, fetchError);
        return new Response(
          JSON.stringify({ error: 'Message not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Prepare update data based on status
      const updateData: any = { status: messageStatus };

      if (messageStatus === 'delivered' || messageStatus === 'sent') {
        updateData.delivered_at = timestamp.toISOString();
      } else if (messageStatus === 'read') {
        updateData.read_at = timestamp.toISOString();
        if (!message.delivered_at) {
          updateData.delivered_at = timestamp.toISOString();
        }
      } else if (messageStatus === 'failed') {
        updateData.error_message = webhookData.type || 'Message delivery failed';
      }

      // Update the message status
      const { error: updateError } = await supabaseClient
        .from('whatsapp_messages')
        .update(updateData)
        .eq('id', message.id);

      if (updateError) {
        console.error('Error updating message:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`Updated message ${message.id} to status: ${messageStatus}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Status updated' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For other webhook types, just acknowledge
    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WEBHOOKS_PER_MINUTE = 100;

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

// Rate limiting for webhook calls (IP-based)
async function checkWebhookRateLimit(supabaseClient: any, ipAddress: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  
  const { count } = await supabaseClient
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .eq('operation', 'webhook_whatsapp')
    .gte('created_at', oneMinuteAgo);
  
  return (count || 0) < RATE_LIMIT_WEBHOOKS_PER_MINUTE;
}

// Validate webhook payload structure
function validateWebhookPayload(payload: any): payload is GupshupWebhookPayload {
  return (
    payload &&
    typeof payload.type === 'string' &&
    payload.payload &&
    typeof payload.payload.gsId === 'string' &&
    typeof payload.payload.status === 'string'
  );
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

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limit
    const withinLimit = await checkWebhookRateLimit(supabaseClient, clientIp);
    if (!withinLimit) {
      console.error('Webhook rate limit exceeded from IP:', clientIp);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: any = await req.json();
    
    // Validate payload structure
    if (!validateWebhookPayload(payload)) {
      console.error('Invalid webhook payload structure:', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log rate limit
    await supabaseClient
      .from('rate_limit_log')
      .insert({
        org_id: null,
        operation: 'webhook_whatsapp',
        ip_address: clientIp,
      });
    
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

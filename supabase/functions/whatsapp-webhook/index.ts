import { getSupabaseClient } from '../_shared/supabaseClient.ts';

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
    text?: string;
    caption?: string;
    name?: string;
    url?: string;
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
    const supabaseClient = getSupabaseClient();

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

    // Extract information
    const { type, payload: webhookData } = payload;
    
    // Handle inbound messages (new messages from customers)
    if (type === 'message' && webhookData.text) {
      console.log('Received inbound message:', webhookData);
      
      // Find existing contact by phone number
      const { data: contacts } = await supabaseClient
        .from('contacts')
        .select('id, org_id')
        .eq('phone', webhookData.mobile)
        .limit(1);
      
      let contactId = contacts?.[0]?.id;
      let orgId = contacts?.[0]?.org_id;
      
      // If contact doesn't exist, try to auto-create
      if (!contactId || !orgId) {
        console.log('Contact not found for phone:', webhookData.mobile);
        
        // Get active WhatsApp settings to determine org
        const { data: whatsappSettings } = await supabaseClient
          .from('whatsapp_settings')
          .select('org_id')
          .eq('is_active', true)
          .limit(1);
        
        if (!whatsappSettings || whatsappSettings.length === 0) {
          console.log('No active WhatsApp settings found');
          return new Response(
            JSON.stringify({ success: true, message: 'No active WhatsApp org found, message ignored' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        orgId = whatsappSettings[0].org_id;
        console.log('Creating new contact for phone:', webhookData.mobile, 'in org:', orgId);
        
        // Parse name from webhook
        let firstName = '';
        let lastName = '';
        
        if (webhookData.name) {
          const nameParts = webhookData.name.trim().split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        } else {
          // Use phone number as name if no name provided
          firstName = webhookData.mobile;
        }
        
        // Create new contact
        const { data: newContact, error: createError } = await supabaseClient
          .from('contacts')
          .insert({
            org_id: orgId,
            phone: webhookData.mobile,
            first_name: firstName,
            last_name: lastName || null,
            source: 'whatsapp_inbound',
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
      
      // Store inbound message
      const { error: insertError } = await supabaseClient
        .from('whatsapp_messages')
        .insert({
          org_id: orgId,
          contact_id: contactId,
          conversation_id: webhookData.mobile,
          direction: 'inbound',
          message_content: webhookData.text || webhookData.caption || '',
          sender_name: webhookData.name,
          phone_number: webhookData.mobile,
          media_url: webhookData.url,
          media_type: webhookData.type,
          gupshup_message_id: webhookData.id,
          status: 'received',
          sent_at: new Date(webhookData.timestamp),
        });
      
      if (insertError) {
        console.error('Error inserting inbound message:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Stored inbound message from:', webhookData.mobile);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Inbound message stored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle status updates for outbound messages
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

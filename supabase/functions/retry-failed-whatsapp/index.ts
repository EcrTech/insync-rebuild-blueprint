import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting retry job for failed WhatsApp messages');

    // Find recipients that need retry
    const { data: recipients, error: recipientsError } = await supabaseClient
      .from('whatsapp_campaign_recipients')
      .select(`
        *,
        campaign:whatsapp_bulk_campaigns!inner(
          *,
          whatsapp_settings!inner(gupshup_api_key, whatsapp_source_number, app_name)
        )
      `)
      .in('status', ['failed', 'retrying'])
      .lt('retry_count', supabaseClient.rpc('max_retries'))
      .lte('next_retry_at', new Date().toISOString())
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours
      .limit(500); // Process max 500 at a time

    if (recipientsError || !recipients || recipients.length === 0) {
      console.log('No recipients to retry');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients to retry' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${recipients.length} recipients to retry`);

    let totalRetried = 0;
    let totalFailed = 0;

    // Process retries
    for (const recipient of recipients) {
      try {
        const campaign = recipient.campaign;
        
        // Format phone number
        const phoneNumber = recipient.phone_number.replace(/[^\d]/g, '');
        
        // Prepare Gupshup payload
        const gupshupPayload = new URLSearchParams({
          channel: 'whatsapp',
          source: campaign.whatsapp_settings.whatsapp_source_number,
          destination: phoneNumber,
          message: JSON.stringify({
            type: 'text',
            text: campaign.message_content,
          }),
          'src.name': campaign.whatsapp_settings.app_name,
        });

        // Send to Gupshup
        const gupshupResponse = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': campaign.whatsapp_settings.gupshup_api_key,
          },
          body: gupshupPayload.toString(),
        });

        const responseData = await gupshupResponse.json();
        console.log('Retry response for recipient', recipient.id, ':', responseData);

        if (gupshupResponse.ok && responseData.status === 'submitted') {
          // Insert message record
          const { data: message } = await supabaseClient
            .from('whatsapp_messages')
            .insert({
              org_id: campaign.org_id,
              contact_id: recipient.contact_id,
              phone_number: recipient.phone_number,
              message_content: campaign.message_content,
              template_id: campaign.template_id,
              sent_by: campaign.created_by,
              status: 'sent',
              gupshup_message_id: responseData.messageId,
            })
            .select()
            .single();

          // Update recipient status to sent
          await supabaseClient
            .from('whatsapp_campaign_recipients')
            .update({
              status: 'sent',
              message_id: message?.id,
            })
            .eq('id', recipient.id);

          // Update campaign stats
          await supabaseClient.rpc('increment_campaign_stats', {
            p_campaign_id: campaign.id,
            p_sent_increment: 1,
            p_failed_increment: -1,
          });

          // Log activity
          if (recipient.contact_id) {
            await supabaseClient.from('contact_activities').insert({
              contact_id: recipient.contact_id,
              org_id: campaign.org_id,
              activity_type: 'whatsapp_sent',
              subject: 'WhatsApp Message Sent (Retry)',
              description: `Bulk campaign: ${campaign.name} (Retry ${recipient.retry_count + 1})`,
              created_by: campaign.created_by,
            });
          }

          totalRetried++;
        } else {
          throw new Error(responseData.message || 'Failed to send message');
        }
      } catch (error: any) {
        console.error('Retry failed for recipient', recipient.id, ':', error);
        
        const retryCount = recipient.retry_count + 1;
        const isLastRetry = retryCount >= recipient.max_retries;
        const backoffMinutes = [5, 30, 120][Math.min(retryCount - 1, 2)];
        const nextRetryAt = !isLastRetry 
          ? new Date(Date.now() + backoffMinutes * 60 * 1000) 
          : null;

        // Update recipient with failure
        await supabaseClient
          .from('whatsapp_campaign_recipients')
          .update({
            status: isLastRetry ? 'permanently_failed' : 'failed',
            error_message: error.message,
            retry_count: retryCount,
            last_retry_at: new Date().toISOString(),
            next_retry_at: nextRetryAt?.toISOString(),
          })
          .eq('id', recipient.id);

        totalFailed++;
      }
    }

    console.log(`Retry job complete: ${totalRetried} retried successfully, ${totalFailed} failed again`);

    return new Response(
      JSON.stringify({
        success: true,
        totalRetried,
        totalFailed,
        totalProcessed: recipients.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in retry job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

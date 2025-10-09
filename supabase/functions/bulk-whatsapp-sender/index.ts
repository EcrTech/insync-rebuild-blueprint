import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RECIPIENTS_PER_CAMPAIGN = 50000;
const MAX_BATCH_SIZE = 500;
const RATE_LIMIT_CAMPAIGNS_PER_HOUR = 10;

interface SendMessageRequest {
  campaignId: string;
  batchSize?: number;
  delayMs?: number;
}

// Rate limiting check
async function checkRateLimit(supabaseClient: any, orgId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count } = await supabaseClient
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('operation', 'bulk_whatsapp_send')
    .gte('created_at', oneHourAgo);
  
  return (count || 0) < RATE_LIMIT_CAMPAIGNS_PER_HOUR;
}

// Log rate limit attempt
async function logRateLimit(supabaseClient: any, orgId: string, userId?: string) {
  await supabaseClient
    .from('rate_limit_log')
    .insert({
      org_id: orgId,
      user_id: userId,
      operation: 'bulk_whatsapp_send',
    });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaignId, batchSize = 500, delayMs = 1000, skip_rate_limit = false } = body as SendMessageRequest & { skip_rate_limit?: boolean };

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate input
    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate batch size
    if (batchSize > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({ error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting bulk WhatsApp sender for campaign:', campaignId);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('whatsapp_bulk_campaigns')
      .select('*, whatsapp_settings!inner(gupshup_api_key, whatsapp_source_number, app_name)')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    // Check rate limit (skip if called from queue processor)
    if (!skip_rate_limit) {
      const withinLimit = await checkRateLimit(supabaseClient, campaign.org_id);
      if (!withinLimit) {
        console.log('Rate limit exceeded, queuing campaign');
        
        // Calculate next available slot
        const { data: nextSlot } = await supabaseClient
          .rpc('calculate_next_slot', {
            p_user_id: campaign.created_by,
            p_org_id: campaign.org_id,
            p_operation: 'bulk_whatsapp_send',
            p_window_minutes: 60,
            p_max_operations: RATE_LIMIT_CAMPAIGNS_PER_HOUR
          });

        // Queue the operation
        const { data: queuedJob, error: queueError } = await supabaseClient
          .from('operation_queue')
          .insert({
            org_id: campaign.org_id,
            user_id: campaign.created_by,
            operation_type: 'bulk_whatsapp_send',
            payload: { campaign_id: campaignId },
            scheduled_for: nextSlot,
            priority: 5
          })
          .select()
          .single();

        if (queueError) throw queueError;

        // Update campaign status to queued
        await supabaseClient
          .from('whatsapp_bulk_campaigns')
          .update({ status: 'queued' })
          .eq('id', campaignId);

        // Get queue position
        const { data: position } = await supabaseClient
          .rpc('get_queue_position', { p_job_id: queuedJob.id });

        const estimatedWaitMinutes = Math.ceil(
          (new Date(nextSlot).getTime() - Date.now()) / (60 * 1000)
        );

        return new Response(
          JSON.stringify({
            status: 'queued',
            job_id: queuedJob.id,
            campaign_id: campaignId,
            message: `Campaign queued for processing at ${new Date(nextSlot).toLocaleTimeString()}`,
            estimated_wait_minutes: estimatedWaitMinutes,
            position_in_queue: position,
            scheduled_for: nextSlot
          }),
          {
            status: 202,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Log rate limit attempt
    await logRateLimit(supabaseClient, campaign.org_id, campaign.created_by);

    // Validate recipient count
    if (campaign.total_recipients > MAX_RECIPIENTS_PER_CAMPAIGN) {
      await supabaseClient
        .from('whatsapp_bulk_campaigns')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ error: `Campaign exceeds maximum of ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update campaign status to processing
    await supabaseClient
      .from('whatsapp_bulk_campaigns')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', campaignId);

    // Get pending recipients
    const { data: recipients, error: recipientsError } = await supabaseClient
      .from('whatsapp_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'retrying'])
      .order('created_at');

    if (recipientsError || !recipients || recipients.length === 0) {
      console.log('No recipients to process');
      await supabaseClient
        .from('whatsapp_bulk_campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);
      return new Response(JSON.stringify({ success: true, message: 'No recipients to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${recipients.length} recipients in batches of ${batchSize}`);

    let totalSent = 0;
    let totalFailed = 0;

    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`);

      // Send messages in parallel within the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
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
            console.log('Gupshup response for recipient', recipient.id, ':', responseData);

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

              // Update recipient status
              await supabaseClient
                .from('whatsapp_campaign_recipients')
                .update({
                  status: 'sent',
                  message_id: message?.id,
                })
                .eq('id', recipient.id);

              // Log activity
              if (recipient.contact_id) {
                await supabaseClient.from('contact_activities').insert({
                  contact_id: recipient.contact_id,
                  org_id: campaign.org_id,
                  activity_type: 'whatsapp_sent',
                  subject: 'WhatsApp Message Sent',
                  description: `Bulk campaign: ${campaign.name}`,
                  created_by: campaign.created_by,
                });
              }

              return { success: true, recipientId: recipient.id };
            } else {
              throw new Error(responseData.message || 'Failed to send message');
            }
          } catch (error: any) {
            console.error('Error sending to recipient', recipient.id, ':', error);
            
            // Calculate next retry time with exponential backoff
            const retryCount = recipient.retry_count + 1;
            const backoffMinutes = [5, 30, 120][Math.min(retryCount - 1, 2)]; // 5min, 30min, 2hr
            const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

            // Update recipient with failure
            await supabaseClient
              .from('whatsapp_campaign_recipients')
              .update({
                status: retryCount < recipient.max_retries ? 'failed' : 'permanently_failed',
                error_message: error.message,
                retry_count: retryCount,
                last_retry_at: new Date().toISOString(),
                next_retry_at: retryCount < recipient.max_retries ? nextRetryAt.toISOString() : null,
              })
              .eq('id', recipient.id);

            return { success: false, recipientId: recipient.id, error: error.message };
          }
        })
      );

      // Count results
      const batchSent = batchResults.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const batchFailed = batchResults.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      totalSent += batchSent;
      totalFailed += batchFailed;

      console.log(`Batch complete: ${batchSent} sent, ${batchFailed} failed`);

      // Update campaign stats
      await supabaseClient
        .from('whatsapp_bulk_campaigns')
        .update({
          sent_count: totalSent,
          failed_count: totalFailed,
          pending_count: recipients.length - totalSent - totalFailed,
        })
        .eq('id', campaignId);

      // Delay between batches (except for last batch)
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Mark campaign as completed
    await supabaseClient
      .from('whatsapp_bulk_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    console.log(`Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSent,
        totalFailed,
        totalProcessed: recipients.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in bulk WhatsApp sender:', error);
    
    // Try to mark campaign as failed
    try {
      const body = await req.clone().json();
      if (body.campaignId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseClient
          .from('whatsapp_bulk_campaigns')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', body.campaignId);
      }
    } catch (e) {
      console.error('Failed to mark campaign as failed:', e);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

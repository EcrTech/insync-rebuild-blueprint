import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active Exotel settings
    const { data: allSettings } = await supabaseClient
      .from('exotel_settings')
      .select('*')
      .eq('is_active', true);

    if (!allSettings || allSettings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active Exotel configurations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const settings of allSettings) {
      try {
        // Get calls from last 7 days
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        
        const exotelUrl = `https://${settings.subdomain}/v1/Accounts/${settings.account_sid}/Calls.json`;
        const auth = btoa(`${settings.api_key}:${settings.api_token}`);

        const response = await fetch(
          `${exotelUrl}?StartTime>=${fromDate.toISOString()}&PageSize=100`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          }
        );

        if (!response.ok) {
          console.error(`Failed to fetch calls for org ${settings.org_id}`);
          results.push({ org_id: settings.org_id, status: 'error', error: await response.text() });
          continue;
        }

        const data = await response.json();
        const calls = data.Calls || [];

        let syncedCount = 0;

        for (const call of calls) {
          // Check if call already exists
          const { data: existingLog } = await supabaseClient
            .from('call_logs')
            .select('id')
            .eq('exotel_call_sid', call.Sid)
            .single();

          if (existingLog) {
            // Update existing log
            await supabaseClient
              .from('call_logs')
              .update({
                status: call.Status?.toLowerCase(),
                call_duration: call.Duration ? parseInt(call.Duration) : null,
                conversation_duration: call.ConversationDuration ? parseInt(call.ConversationDuration) : null,
                recording_url: call.RecordingUrl,
                exotel_raw_data: call,
              })
              .eq('id', existingLog.id);
          } else {
            // Try to match contact by phone number
            const { data: contact } = await supabaseClient
              .from('contacts')
              .select('id')
              .eq('org_id', settings.org_id)
              .eq('phone', call.To || call.From)
              .single();

            // Create new log
            await supabaseClient
              .from('call_logs')
              .insert({
                org_id: settings.org_id,
                exotel_call_sid: call.Sid,
                exotel_conversation_uuid: call.ConversationUuid,
                call_type: call.Direction?.includes('incoming') ? 'inbound' : 'outbound',
                from_number: call.From,
                to_number: call.To,
                direction: call.Direction,
                status: call.Status?.toLowerCase(),
                call_duration: call.Duration ? parseInt(call.Duration) : null,
                conversation_duration: call.ConversationDuration ? parseInt(call.ConversationDuration) : null,
                started_at: call.StartTime ? new Date(call.StartTime).toISOString() : null,
                answered_at: call.AnswerTime ? new Date(call.AnswerTime).toISOString() : null,
                ended_at: call.EndTime ? new Date(call.EndTime).toISOString() : null,
                recording_url: call.RecordingUrl,
                contact_id: contact?.id,
                exotel_raw_data: call,
              });
          }
          syncedCount++;
        }

        results.push({ 
          org_id: settings.org_id, 
          status: 'success', 
          synced_count: syncedCount 
        });
      } catch (error) {
        console.error(`Error syncing calls for org ${settings.org_id}:`, error);
        results.push({ org_id: settings.org_id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in exotel-sync-call-logs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

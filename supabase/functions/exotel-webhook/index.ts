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

    const formData = await req.formData();
    const webhookData: any = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value;
    }

    console.log('Exotel webhook received:', webhookData);

    const callSid = webhookData.CallSid;
    if (!callSid) {
      return new Response(JSON.stringify({ error: 'Missing CallSid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find existing call log
    const { data: callLog } = await supabaseClient
      .from('call_logs')
      .select('*')
      .eq('exotel_call_sid', callSid)
      .single();

    if (!callLog) {
      console.error('Call log not found for CallSid:', callSid);
      return new Response(JSON.stringify({ error: 'Call log not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const status = webhookData.CallStatus?.toLowerCase() || 'unknown';
    const updateData: any = {
      status,
      exotel_raw_data: webhookData,
    };

    // Update timestamps based on status
    if (webhookData.StartTime) {
      updateData.started_at = new Date(webhookData.StartTime).toISOString();
    }
    if (webhookData.AnswerTime) {
      updateData.answered_at = new Date(webhookData.AnswerTime).toISOString();
    }
    if (webhookData.EndTime) {
      updateData.ended_at = new Date(webhookData.EndTime).toISOString();
    }

    // Update durations
    if (webhookData.Duration) {
      updateData.call_duration = parseInt(webhookData.Duration);
    }
    if (webhookData.ConversationDuration) {
      updateData.conversation_duration = parseInt(webhookData.ConversationDuration);
    }
    if (webhookData.RingDuration) {
      updateData.ring_duration = parseInt(webhookData.RingDuration);
    }

    // Update recording URL if available
    if (webhookData.RecordingUrl) {
      updateData.recording_url = webhookData.RecordingUrl;
      if (webhookData.RecordingDuration) {
        updateData.recording_duration = parseInt(webhookData.RecordingDuration);
      }
    }

    // Update call log
    await supabaseClient
      .from('call_logs')
      .update(updateData)
      .eq('id', callLog.id);

    // If call ended, create activity and clear session
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
      // Create contact activity
      if (callLog.contact_id) {
        const { data: activity } = await supabaseClient
          .from('contact_activities')
          .insert({
            org_id: callLog.org_id,
            contact_id: callLog.contact_id,
            activity_type: 'call',
            subject: `${callLog.call_type === 'outbound' ? 'Outbound' : 'Inbound'} call - ${status}`,
            description: `Call duration: ${updateData.conversation_duration || 0} seconds`,
            created_by: callLog.agent_id,
            completed_at: updateData.ended_at || new Date().toISOString(),
            call_duration: updateData.conversation_duration,
          })
          .select()
          .single();

        // Link activity to call log
        if (activity) {
          await supabaseClient
            .from('call_logs')
            .update({ activity_id: activity.id })
            .eq('id', callLog.id);
        }
      }

      // Clear agent session
      await supabaseClient
        .from('agent_call_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString() 
        })
        .eq('exotel_call_sid', callSid);
    } else {
      // Update session status for ongoing call
      const sessionStatus = 
        status === 'ringing' ? 'ringing' :
        status === 'in-progress' ? 'connected' :
        'initiating';

      await supabaseClient
        .from('agent_call_sessions')
        .update({ status: sessionStatus })
        .eq('exotel_call_sid', callSid);
    }

    return new Response(
      JSON.stringify({ success: true, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in exotel-webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

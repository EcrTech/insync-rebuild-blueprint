import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const callLogId = url.searchParams.get('callLogId');

    if (!callLogId) {
      return new Response(JSON.stringify({ error: 'Missing callLogId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's org
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    // Get call log and verify access
    const { data: callLog } = await supabaseClient
      .from('call_logs')
      .select('org_id, recording_url')
      .eq('id', callLogId)
      .single();

    if (!callLog) {
      return new Response(JSON.stringify({ error: 'Call log not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (callLog.org_id !== profile?.org_id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!callLog.recording_url) {
      return new Response(JSON.stringify({ error: 'Recording not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Exotel settings
    const { data: exotelSettings } = await supabaseClient
      .from('exotel_settings')
      .select('api_key, api_token')
      .eq('org_id', profile?.org_id)
      .single();

    if (!exotelSettings) {
      return new Response(JSON.stringify({ error: 'Exotel settings not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recording from Exotel
    const auth = btoa(`${exotelSettings.api_key}:${exotelSettings.api_token}`);
    const recordingResponse = await fetch(callLog.recording_url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!recordingResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch recording' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream recording to client
    const audioBlob = await recordingResponse.blob();
    return new Response(audioBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="call-recording-${callLogId}.mp3"`,
      },
    });
  } catch (error) {
    console.error('Error in exotel-get-recording:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

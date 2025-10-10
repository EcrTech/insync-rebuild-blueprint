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

    // Check if user has calling enabled
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('calling_enabled, org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.calling_enabled) {
      return new Response(JSON.stringify({ error: 'Calling not enabled for this user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contactId, agentPhoneNumber } = await req.json();

    // Get contact details
    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('phone, first_name, last_name')
      .eq('id', contactId)
      .single();

    if (!contact?.phone) {
      return new Response(JSON.stringify({ error: 'Contact phone number not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Exotel settings
    const { data: exotelSettings } = await supabaseClient
      .from('exotel_settings')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .single();

    if (!exotelSettings) {
      return new Response(JSON.stringify({ error: 'Exotel not configured for this organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Make Exotel API call
    const exotelUrl = `https://${exotelSettings.subdomain}/v1/Accounts/${exotelSettings.account_sid}/Calls/connect.json`;
    const auth = btoa(`${exotelSettings.api_key}:${exotelSettings.api_token}`);

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/exotel-webhook`;

    const params = new URLSearchParams({
      From: agentPhoneNumber,
      To: contact.phone,
      CallerId: exotelSettings.caller_id,
      CallType: 'trans',
      Record: exotelSettings.call_recording_enabled ? 'true' : 'false',
      StatusCallback: webhookUrl,
    });
    
    // Add StatusCallbackEvents
    params.append('StatusCallbackEvents[]', 'initiated');
    params.append('StatusCallbackEvents[]', 'answered');
    params.append('StatusCallbackEvents[]', 'completed');
    
    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!exotelResponse.ok) {
      const errorText = await exotelResponse.text();
      console.error('Exotel API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to initiate call', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exotelData = await exotelResponse.json();
    console.log('Exotel call initiated:', exotelData);

    // Create call log entry
    const { data: callLog, error: callLogError } = await supabaseClient
      .from('call_logs')
      .insert({
        org_id: profile.org_id,
        contact_id: contactId,
        agent_id: user.id,
        exotel_call_sid: exotelData.Call.Sid,
        exotel_conversation_uuid: exotelData.Call.ConversationUuid,
        call_type: 'outbound',
        from_number: agentPhoneNumber,
        to_number: contact.phone,
        direction: 'outgoing-api',
        status: 'initiated',
        exotel_raw_data: exotelData,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (callLogError) {
      console.error('Error creating call log:', callLogError);
      return new Response(JSON.stringify({ error: 'Failed to create call log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create agent call session
    await supabaseClient
      .from('agent_call_sessions')
      .upsert({
        agent_id: user.id,
        org_id: profile.org_id,
        contact_id: contactId,
        exotel_call_sid: exotelData.Call.Sid,
        status: 'initiating',
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        callLog,
        exotelCallSid: exotelData.Call.Sid 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in exotel-make-call:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

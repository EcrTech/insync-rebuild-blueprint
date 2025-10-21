import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  contactId: string;
  phoneNumber: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== send-whatsapp-message Request Started ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());

    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth Header Status:', {
      present: !!authHeader,
      preview: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING',
      length: authHeader?.length || 0
    });

    if (!authHeader) {
      throw new Error('No Authorization header provided');
    }

    // Extract JWT token (remove "Bearer " prefix)
    const token = authHeader.replace('Bearer ', '');
    console.log('Extracted JWT token (length):', token.length);

    // Create Supabase client
    console.log('Creating Supabase client with ANON_KEY...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );
    console.log('✓ Supabase client created successfully');

    // Authenticate user by passing token directly to getUser()
    console.log('Attempting user authentication with JWT token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    console.log('User Auth Result:', {
      success: !!user,
      userId: user?.id || 'N/A',
      userEmail: user?.email || 'N/A',
      hasError: !!userError,
      errorCode: userError?.code || 'N/A',
      errorMessage: userError?.message || 'N/A',
      errorStatus: userError?.status || 'N/A',
    });

    if (userError) {
      console.error('Auth Error Details:', JSON.stringify(userError, null, 2));
      throw new Error(`Authentication failed: ${userError.message}`);
    }

    if (!user) {
      throw new Error('No user found in session');
    }

    console.log('✓ User authenticated:', user.email);

    const body: SendMessageRequest = await req.json();
    const { contactId, phoneNumber, templateId, templateVariables, message } = body;

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    console.log('Profile Lookup Result:', {
      found: !!profile,
      orgId: profile?.org_id || 'N/A',
      hasError: !!profileError,
      errorMessage: profileError?.message || 'N/A'
    });

    if (profileError) {
      console.error('Profile Error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile?.org_id) {
      throw new Error('Organization not found');
    }

    console.log('✓ Organization verified:', profile.org_id);

    // Get WhatsApp settings
    const { data: whatsappSettings } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .single();

    if (!whatsappSettings) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured for this organization' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageContent = message || '';
    let templateData = null;

    // If using a template, fetch it and prepare message
    if (templateId) {
      const { data: template } = await supabaseClient
        .from('communication_templates')
        .select('*')
        .eq('id', templateId)
        .eq('org_id', profile.org_id)
        .single();

      if (!template) {
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      messageContent = template.content;
      
      // Replace variables in template
      if (templateVariables) {
        Object.entries(templateVariables).forEach(([key, value]) => {
          messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
      }

      templateData = {
        id: template.template_id,
        params: templateVariables ? Object.values(templateVariables) : [],
      };
    }

    // Format phone number (remove + if present, ensure it starts with country code)
    const formattedPhone = phoneNumber.replace(/\+/g, '');

    // Send message via Gupshup
    const gupshupPayload: any = {
      channel: 'whatsapp',
      source: whatsappSettings.whatsapp_source_number,
      destination: formattedPhone,
      'src.name': whatsappSettings.app_name,
    };

    if (templateData) {
      // Template message
      gupshupPayload.message = JSON.stringify({
        type: 'template',
        template: templateData,
      });
    } else {
      // Simple text message
      gupshupPayload.message = JSON.stringify({
        type: 'text',
        text: messageContent,
      });
    }

    console.log('Sending WhatsApp message:', gupshupPayload);

    const gupshupResponse = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
      method: 'POST',
      headers: {
        'apikey': whatsappSettings.gupshup_api_key,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(gupshupPayload).toString(),
    });

    const gupshupResult = await gupshupResponse.json();
    console.log('Gupshup response:', gupshupResult);

    if (!gupshupResponse.ok || gupshupResult.status === 'error') {
      // Log failed message
      await supabaseClient.from('whatsapp_messages').insert({
        org_id: profile.org_id,
        contact_id: contactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: formattedPhone,
        message_content: messageContent,
        template_variables: templateVariables || null,
        status: 'failed',
        error_message: gupshupResult.message || 'Failed to send message',
      });

      return new Response(
        JSON.stringify({ error: gupshupResult.message || 'Failed to send message' }),
        {
          status: gupshupResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log successful message
    const { data: messageRecord } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        org_id: profile.org_id,
        contact_id: contactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: formattedPhone,
        message_content: messageContent,
        template_variables: templateVariables || null,
        gupshup_message_id: gupshupResult.messageId,
        status: 'sent',
      })
      .select()
      .single();

    // Use shared service role client for wallet deduction
    const supabaseServiceClient = getSupabaseClient();

    // Deduct WhatsApp cost from wallet
    const { data: deductResult, error: deductError } = await supabaseServiceClient.rpc('deduct_from_wallet', {
      _org_id: profile.org_id,
      _amount: 1.00,
      _service_type: 'whatsapp',
      _reference_id: messageRecord?.id,
      _quantity: 1,
      _unit_cost: 1.00,
      _user_id: user.id
    });

    if (deductError || !deductResult?.success) {
      console.warn('Wallet deduction failed:', deductError || deductResult);
      // Message was sent, but wallet deduction failed - log but don't fail the request
    }

    // Log activity
    await supabaseClient.from('contact_activities').insert({
      org_id: profile.org_id,
      contact_id: contactId,
      activity_type: 'whatsapp',
      subject: 'WhatsApp Message Sent',
      description: messageContent,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: gupshupResult.messageId,
        message: messageRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const err = error as Error;
    console.error('=== send-whatsapp-message Error ===');
    console.error('Error Type:', err.constructor.name);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: err.message?.includes('Unauthorized') || err.message?.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
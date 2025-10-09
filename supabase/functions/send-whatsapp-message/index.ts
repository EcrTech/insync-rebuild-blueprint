import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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

    const body: SendMessageRequest = await req.json();
    const { contactId, phoneNumber, templateId, templateVariables, message } = body;

    // Get user's org_id
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    console.error('Error sending WhatsApp message:', error);
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
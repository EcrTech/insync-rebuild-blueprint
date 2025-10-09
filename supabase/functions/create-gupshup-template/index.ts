import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface CreateTemplateRequest {
  template_name: string;
  category: string;
  language: string;
  header_type?: string;
  header_content?: string;
  body_content: string;
  footer_text?: string;
  buttons?: any[];
  sample_values?: any;
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

    const { data: whatsappSettings } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', profile.org_id)
      .single();

    if (!whatsappSettings) {
      return new Response(JSON.stringify({ error: 'WhatsApp settings not configured' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templateData: CreateTemplateRequest = await req.json();

    // Build Gupshup template components
    const components: TemplateComponent[] = [];

    // Add header if provided
    if (templateData.header_type && templateData.header_content) {
      const headerComponent: TemplateComponent = {
        type: 'HEADER',
      };

      if (templateData.header_type === 'text') {
        headerComponent.format = 'TEXT';
        headerComponent.text = templateData.header_content;
        
        // Add example if header has variables
        const headerVars = templateData.header_content.match(/{{(\d+)}}/g);
        if (headerVars && templateData.sample_values?.header) {
          headerComponent.example = {
            header_text: templateData.sample_values.header
          };
        }
      } else {
        headerComponent.format = templateData.header_type.toUpperCase();
        headerComponent.example = {
          header_text: [templateData.header_content] // URL for media
        };
      }

      components.push(headerComponent);
    }

    // Add body (required)
    const bodyComponent: TemplateComponent = {
      type: 'BODY',
      text: templateData.body_content,
    };

    // Extract variables from body and add examples
    const bodyVariables = templateData.body_content.match(/{{(\d+)}}/g);
    if (bodyVariables && templateData.sample_values?.body) {
      bodyComponent.example = {
        body_text: [templateData.sample_values.body]
      };
    }

    components.push(bodyComponent);

    // Add footer if provided
    if (templateData.footer_text) {
      components.push({
        type: 'FOOTER',
        text: templateData.footer_text,
      });
    }

    // Add buttons if provided
    if (templateData.buttons && templateData.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: templateData.buttons.map((btn: any) => ({
          type: btn.type,
          text: btn.text,
          ...(btn.url && { url: btn.url }),
          ...(btn.phone_number && { phone_number: btn.phone_number }),
        })),
      });
    }

    // Submit to Gupshup
    const gupshupPayload = {
      elementName: templateData.template_name,
      languageCode: templateData.language,
      category: templateData.category.toUpperCase(),
      vertical: 'general',
      components: components,
    };

    console.log('Submitting template to Gupshup:', JSON.stringify(gupshupPayload, null, 2));

    const gupshupResponse = await fetch(
      `https://api.gupshup.io/sm/api/v1/template`,
      {
        method: 'POST',
        headers: {
          'apikey': whatsappSettings.gupshup_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gupshupPayload),
      }
    );

    const gupshupData = await gupshupResponse.json();
    console.log('Gupshup response:', JSON.stringify(gupshupData, null, 2));

    if (!gupshupResponse.ok) {
      console.error('Gupshup API error:', gupshupData);
      
      // Store as draft with rejection reason
      const { error: dbError } = await supabaseClient
        .from('communication_templates')
        .insert({
          org_id: profile.org_id,
          template_name: templateData.template_name,
          template_type: 'whatsapp',
          category: templateData.category,
          language: templateData.language,
          content: templateData.body_content,
          header_type: templateData.header_type,
          header_content: templateData.header_content,
          footer_text: templateData.footer_text,
          buttons: templateData.buttons || [],
          sample_values: templateData.sample_values || {},
          submission_status: 'rejected',
          rejection_reason: gupshupData.message || 'Failed to submit to Gupshup',
          submitted_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('Database error:', dbError);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to submit template to Gupshup',
          details: gupshupData.message || 'Unknown error'
        }),
        {
          status: gupshupResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract variables from content
    const allVariables: any[] = [];
    let varIndex = 1;
    
    if (templateData.header_type === 'text' && templateData.header_content) {
      const headerVars = templateData.header_content.match(/{{(\d+)}}/g) || [];
      headerVars.forEach(() => {
        allVariables.push({ index: varIndex++, name: `header_var${varIndex}`, location: 'header' });
      });
    }
    
    const bodyVars = templateData.body_content.match(/{{(\d+)}}/g) || [];
    bodyVars.forEach(() => {
      allVariables.push({ index: varIndex++, name: `body_var${varIndex}`, location: 'body' });
    });

    // Store template in database
    const { data: newTemplate, error: insertError } = await supabaseClient
      .from('communication_templates')
      .insert({
        org_id: profile.org_id,
        template_id: gupshupData.templateId || `pending_${Date.now()}`,
        template_name: templateData.template_name,
        template_type: 'whatsapp',
        category: templateData.category,
        language: templateData.language,
        content: templateData.body_content,
        variables: allVariables,
        header_type: templateData.header_type,
        header_content: templateData.header_content,
        footer_text: templateData.footer_text,
        buttons: templateData.buttons || [],
        sample_values: templateData.sample_values || {},
        submission_status: 'pending_submission',
        status: 'pending',
        submitted_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Template submitted successfully:', newTemplate);

    return new Response(
      JSON.stringify({
        success: true,
        template: newTemplate,
        gupshup_response: gupshupData,
        message: 'Template submitted to WhatsApp for approval. This usually takes 24-48 hours.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating template:', error);
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

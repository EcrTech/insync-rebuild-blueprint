import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEMPLATE_NAME_LENGTH = 100;
const MAX_BODY_LENGTH = 1024;
const MAX_HEADER_LENGTH = 60;
const MAX_FOOTER_LENGTH = 60;
const RATE_LIMIT_TEMPLATES_PER_HOUR = 5;

// Rate limiting check
async function checkTemplateRateLimit(supabaseClient: any, orgId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count } = await supabaseClient
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('operation', 'create_template')
    .gte('created_at', oneHourAgo);
  
  return (count || 0) < RATE_LIMIT_TEMPLATES_PER_HOUR;
}

// Validate template input
function validateTemplateInput(data: CreateTemplateRequest): string | null {
  if (!data.template_name || data.template_name.length > MAX_TEMPLATE_NAME_LENGTH) {
    return `Template name is required and must be less than ${MAX_TEMPLATE_NAME_LENGTH} characters`;
  }
  
  if (!/^[a-z0-9_]+$/.test(data.template_name)) {
    return 'Template name can only contain lowercase letters, numbers, and underscores';
  }
  
  if (!data.body_content || data.body_content.length > MAX_BODY_LENGTH) {
    return `Body content is required and must be less than ${MAX_BODY_LENGTH} characters`;
  }
  
  if (data.header_content && data.header_content.length > MAX_HEADER_LENGTH) {
    return `Header content must be less than ${MAX_HEADER_LENGTH} characters`;
  }
  
  if (data.footer_text && data.footer_text.length > MAX_FOOTER_LENGTH) {
    return `Footer text must be less than ${MAX_FOOTER_LENGTH} characters`;
  }
  
  return null;
}

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
    console.log('=== create-gupshup-template Request Started ===');
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

    // Validate input
    const validationError = validateTemplateInput(templateData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const withinLimit = await checkTemplateRateLimit(supabaseClient, profile.org_id);
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_TEMPLATES_PER_HOUR} templates per hour.` }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log rate limit attempt
    await supabaseClient
      .from('rate_limit_log')
      .insert({
        org_id: profile.org_id,
        user_id: user.id,
        operation: 'create_template',
      });

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
    const err = error as Error;
    console.error('=== create-gupshup-template Error ===');
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GupshupTemplate {
  id: string;
  elementName: string;
  category: string;
  languageCode: string;
  content: string;
  status: string;
  data?: string;
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

    // Get WhatsApp settings for the org
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

    // Fetch templates from Gupshup
    const gupshupResponse = await fetch(
      `https://api.gupshup.io/sm/api/v1/template/list/${whatsappSettings.app_name}`,
      {
        method: 'GET',
        headers: {
          'apikey': whatsappSettings.gupshup_api_key,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!gupshupResponse.ok) {
      console.error('Gupshup API error:', await gupshupResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch templates from Gupshup' }),
        {
          status: gupshupResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const gupshupData = await gupshupResponse.json();
    const templates: GupshupTemplate[] = gupshupData.templates || [];

    console.log(`Fetched ${templates.length} templates from Gupshup`);

    // Upsert templates into database
    const templatesToUpsert = templates.map((template) => {
      // Extract variables from template content
      const variableMatches = template.content.match(/{{(\d+)}}/g) || [];
      const variables = variableMatches.map((match) => {
        const index = match.replace(/{{|}}/g, '');
        return { index: parseInt(index), name: `var${index}` };
      });

      return {
        org_id: profile.org_id,
        template_id: template.id,
        template_name: template.elementName,
        template_type: 'whatsapp',
        category: template.category,
        language: template.languageCode,
        content: template.content,
        variables: variables,
        status: template.status.toLowerCase(),
        last_synced_at: new Date().toISOString(),
      };
    });

    const { data: upsertedTemplates, error: upsertError } = await supabaseClient
      .from('communication_templates')
      .upsert(templatesToUpsert, {
        onConflict: 'org_id,template_id,template_type',
      })
      .select();

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Synced ${upsertedTemplates?.length || 0} templates`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: upsertedTemplates?.length || 0,
        templates: upsertedTemplates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing templates:', error);
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
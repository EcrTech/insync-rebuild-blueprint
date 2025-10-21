import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

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
    const body = await req.json().catch(() => ({}));
    const skipRateLimit = body.skip_rate_limit === true;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      skipRateLimit ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' : Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    // Rate limit check: 3 syncs per hour per org
    if (!skipRateLimit) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { count } = await supabaseClient
        .from('rate_limit_log')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('operation', 'template_sync')
        .gte('created_at', oneHourAgo);
      
      if ((count || 0) >= 3) {
        console.log('Rate limit exceeded, queuing template sync');
        
        // Calculate next available slot
    const serviceClient = getSupabaseClient();

        const { data: nextSlot } = await serviceClient
          .rpc('calculate_next_slot', {
            p_user_id: user.id,
            p_org_id: profile.org_id,
            p_operation: 'template_sync',
            p_window_minutes: 60,
            p_max_operations: 3
          });

        // Queue the operation
        const { data: queuedJob, error: queueError } = await serviceClient
          .from('operation_queue')
          .insert({
            org_id: profile.org_id,
            user_id: user.id,
            operation_type: 'template_sync',
            payload: {},
            scheduled_for: nextSlot,
            priority: 5
          })
          .select()
          .single();

        if (queueError) throw queueError;

        // Get queue position
        const { data: position } = await serviceClient
          .rpc('get_queue_position', { p_job_id: queuedJob.id });

        const estimatedWaitMinutes = Math.ceil(
          (new Date(nextSlot).getTime() - Date.now()) / (60 * 1000)
        );

        return new Response(
          JSON.stringify({
            status: 'queued',
            job_id: queuedJob.id,
            message: `Template sync queued. Will process at ${new Date(nextSlot).toLocaleTimeString()}`,
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

      // Log rate limit attempt
      await supabaseClient
        .from('rate_limit_log')
        .insert({
          org_id: profile.org_id,
          user_id: user.id,
          operation: 'template_sync',
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
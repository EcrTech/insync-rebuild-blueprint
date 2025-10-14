import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[INIT] Starting bulk import trigger function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH] Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('[AUTH] User authenticated:', user.id);

    const { importJobId } = await req.json();
    
    if (!importJobId) {
      return new Response(JSON.stringify({ error: 'Missing importJobId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[JOB] Processing import job:', importJobId);

    // Fetch import job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single();

    if (jobError || !importJob) {
      console.error('[DB] Import job not found:', jobError);
      return new Response(JSON.stringify({ error: 'Import job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[DB] Import job found:', importJob.file_name);

    // Update job status to processing
    const { error: updateError } = await supabase
      .from('import_jobs')
      .update({
        status: 'processing',
        current_stage: 'downloading',
        started_at: new Date().toISOString(),
        stage_details: { message: 'Starting import...' }
      })
      .eq('id', importJobId);

    if (updateError) {
      console.error('[DB] Failed to update job status:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update job status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fire-and-forget: Trigger background processing
    console.log('[TRIGGER] Invoking background processor');
    fetch(`${supabaseUrl}/functions/v1/process-bulk-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ importJobId })
    }).catch(error => {
      console.error('[TRIGGER] Failed to invoke processing function:', error);
    });

    console.log('[SUCCESS] Import started in background');
    return new Response(JSON.stringify({
      success: true,
      message: 'Import started in background',
      jobId: importJobId
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ERROR] Trigger function failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
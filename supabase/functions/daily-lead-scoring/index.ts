import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting daily lead scoring job...');

    // Get all contacts with pipeline stage info
    const { data: allContacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        org_id,
        first_name,
        last_name,
        email,
        phone,
        company,
        job_title,
        status,
        source,
        city,
        state,
        country,
        website,
        notes,
        created_at,
        pipeline_stage_id,
        pipeline_stages!inner(
          id,
          name,
          stage_order,
          probability
        )
      `)
      .limit(100); // Process 100 contacts per run to avoid timeouts

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      throw contactsError;
    }

    // Get existing scores
    const { data: existingScores, error: scoresError } = await supabase
      .from('contact_lead_scores')
      .select('contact_id, last_calculated');

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      throw scoresError;
    }

    // Filter contacts that need scoring - TEMPORARILY PROCESS ALL
    const contacts = allContacts || [];

    console.log(`Found ${contacts.length} contacts to score`);

    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No contacts need scoring', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    // Process each contact
    for (const contact of contacts) {
      try {
        console.log(`Scoring contact: ${contact.first_name} ${contact.last_name} (${contact.id})`);

        // Get recent activities for this contact
        const { data: activities } = await supabase
          .from('contact_activities')
          .select('activity_type, created_at, completed_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);

        // Calculate engagement metrics
        const now = new Date();
        const lastActivity = activities?.[0]?.created_at 
          ? new Date(activities[0].created_at) 
          : null;
        const daysSinceLastActivity = lastActivity 
          ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const activityCounts = activities?.reduce((acc: any, act: any) => {
          acc[act.activity_type] = (acc[act.activity_type] || 0) + 1;
          return acc;
        }, {}) || {};

        // Call the analyze-lead function with enriched data
        const { data: scoreData, error: scoreError } = await supabase.functions.invoke('analyze-lead', {
          body: {
            contact: {
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              company: contact.company,
              job_title: contact.job_title,
              status: contact.status,
              source: contact.source,
              city: contact.city,
              state: contact.state,
              country: contact.country,
              website: contact.website,
              notes: contact.notes,
              created_at: contact.created_at,
              pipeline_stage: contact.pipeline_stages,
              engagement_metrics: {
                total_activities: activities?.length || 0,
                last_activity_date: lastActivity?.toISOString(),
                days_since_last_activity: daysSinceLastActivity,
                meetings_count: activityCounts['meeting'] || 0,
                calls_count: activityCounts['call'] || 0,
                emails_count: activityCounts['email'] || 0,
              }
            }
          }
        });

        if (scoreError) {
          console.error(`Error scoring contact ${contact.id}:`, scoreError);
          failed++;
          continue;
        }

        if (!scoreData?.score) {
          console.error(`Invalid score data for contact ${contact.id}`);
          failed++;
          continue;
        }

        // Save the score to the database
        const { error: upsertError } = await supabase
          .from('contact_lead_scores')
          .upsert({
            contact_id: contact.id,
            org_id: contact.org_id,
            score: scoreData.score,
            score_category: scoreData.category?.toLowerCase() || 'cold',
            score_breakdown: scoreData.breakdown || {},
            last_calculated: new Date().toISOString(),
          }, {
            onConflict: 'contact_id'
          });

        if (upsertError) {
          console.error(`Error saving score for contact ${contact.id}:`, upsertError);
          failed++;
        } else {
          processed++;
          console.log(`Successfully scored contact ${contact.id}: ${scoreData.score}/100 (${scoreData.category})`);
        }

      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error);
        failed++;
      }
    }

    console.log(`Daily lead scoring complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        message: 'Daily lead scoring complete',
        processed,
        failed,
        total: contacts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily-lead-scoring function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

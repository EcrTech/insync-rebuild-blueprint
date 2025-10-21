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

    // Get all contacts (we'll filter in code for simplicity)
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
        created_at
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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const scoreMap = new Map(existingScores?.map(s => [s.contact_id, new Date(s.last_calculated)]) || []);

    // Filter contacts that need scoring
    const contacts = allContacts?.filter(contact => {
      const lastScored = scoreMap.get(contact.id);
      return !lastScored || lastScored < twentyFourHoursAgo;
    }) || [];

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

        // Call the analyze-lead function
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
            }
          }
        });

        if (scoreError) {
          console.error(`Error scoring contact ${contact.id}:`, scoreError);
          failed++;
          continue;
        }

        // Save the score to the database
        const scoreBreakdown = {
          businessProfile: scoreData.breakdown?.businessProfile || {},
          financialCapability: scoreData.breakdown?.financialCapability || {},
          engagement: scoreData.breakdown?.engagement || {},
          relationship: scoreData.breakdown?.relationship || {},
        };

        const { error: upsertError } = await supabase
          .from('contact_lead_scores')
          .upsert({
            contact_id: contact.id,
            org_id: contact.org_id,
            score: scoreData.finalScore || 0,
            score_category: scoreData.temperature?.toLowerCase() || 'cold',
            score_breakdown: scoreBreakdown,
            last_calculated: new Date().toISOString(),
          }, {
            onConflict: 'contact_id'
          });

        if (upsertError) {
          console.error(`Error saving score for contact ${contact.id}:`, upsertError);
          failed++;
        } else {
          processed++;
          console.log(`Successfully scored contact ${contact.id}: ${scoreData.finalScore}/100 (${scoreData.temperature})`);
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

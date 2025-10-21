import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) throw orgsError;

    for (const org of orgs || []) {
      // Fetch pipeline stages
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('org_id', org.id)
        .order('stage_order');

      if (!stages || stages.length === 0) continue;

      // Fetch contacts with their stages
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, pipeline_stage_id, lead_score, updated_at, created_at')
        .eq('org_id', org.id);

      // Fetch recent pipeline movements (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: movements } = await supabase
        .from('pipeline_movement_history')
        .select('*, from_stage:pipeline_stages!from_stage_id(name), to_stage:pipeline_stages!to_stage_id(name)')
        .eq('org_id', org.id)
        .gte('moved_at', thirtyDaysAgo.toISOString());

      // Fetch lead scores
      const { data: leadScores } = await supabase
        .from('contact_lead_scores')
        .select('contact_id, total_score, score_category, updated_at')
        .eq('org_id', org.id);

      const scoreMap = new Map(leadScores?.map(s => [s.contact_id, s]) || []);

      // Calculate pipeline metrics
      const stageMetrics = new Map();
      
      for (const stage of stages) {
        const stageContacts = contacts?.filter(c => c.pipeline_stage_id === stage.id) || [];
        const stageMovements = movements?.filter(m => m.from_stage_id === stage.id) || [];
        
        // Calculate average days in stage
        const avgDaysInStage = stageMovements.length > 0
          ? stageMovements.reduce((sum, m) => sum + (m.days_in_previous_stage || 0), 0) / stageMovements.length
          : 0;

        // Find contacts stuck too long (>2x average)
        const stuckContacts = stageContacts.filter(c => {
          const daysInStage = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          return avgDaysInStage > 0 && daysInStage > avgDaysInStage * 2;
        });

        // Calculate conversion rate to next stage
        const movedToNext = movements?.filter(m => 
          m.from_stage_id === stage.id && 
          m.to_stage_id === stages[stages.indexOf(stage) + 1]?.id
        ).length || 0;
        
        const totalMoved = stageMovements.length || 1;
        const conversionRate = (movedToNext / totalMoved) * 100;

        // Lead score analysis for this stage
        const stageScores = stageContacts
          .map(c => scoreMap.get(c.id)?.total_score)
          .filter(s => s !== undefined) as number[];
        
        const avgLeadScore = stageScores.length > 0
          ? stageScores.reduce((sum, s) => sum + s, 0) / stageScores.length
          : 0;

        stageMetrics.set(stage.id, {
          stageName: stage.name,
          stageOrder: stage.stage_order,
          probability: stage.probability,
          contactCount: stageContacts.length,
          avgDaysInStage: Math.round(avgDaysInStage),
          stuckCount: stuckContacts.length,
          conversionRate: Math.round(conversionRate),
          avgLeadScore: Math.round(avgLeadScore),
        });
      }

      // Build AI analysis prompt
      const metricsArray = Array.from(stageMetrics.values());
      const prompt = `Analyze this sales pipeline performance and provide actionable insights:

PIPELINE OVERVIEW:
${metricsArray.map(m => `
${m.stageName} (${m.probability}% probability):
- ${m.contactCount} contacts currently
- Avg. ${m.avgDaysInStage} days in stage
- ${m.stuckCount} contacts stuck (>2x average)
- ${m.conversionRate}% conversion to next stage
- Avg. lead score: ${m.avgLeadScore}/100
`).join('\n')}

RECENT ACTIVITY (Last 30 days):
- Total movements: ${movements?.length || 0}
- Most common path: ${movements?.[0]?.from_stage?.name || 'N/A'} → ${movements?.[0]?.to_stage?.name || 'N/A'}

Identify pipeline issues and opportunities:
1. BOTTLENECKS: Stages with high stuck count or low conversion
2. AT-RISK DEALS: High-probability stages (>70%) with contacts stuck >14 days
3. OPTIMIZATION: Lead scoring patterns that predict success
4. VELOCITY: Stage-specific recommendations to speed up pipeline

Respond ONLY with valid JSON in this exact format:
{
  "priority": "high|medium|low",
  "insight_type": "bottleneck|at_risk_deals|velocity_issue|optimization",
  "title": "Clear action statement (max 60 chars)",
  "description": "Why this matters (1 sentence)",
  "impact": "Expected result (e.g., 'Close 5 deals faster')",
  "supportingData": {
    "stage": "stage name",
    "metric": "specific number"
  },
  "analysis": "Your reasoning (2-3 sentences)",
  "suggestedAction": "Specific action to take"
}`;

      // Call Lovable AI
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are an expert sales operations analyst. Always respond with valid JSON only.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error for org ${org.id}:`, await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const responseText = aiData.choices[0].message.content;
        
        // Extract JSON from response
        let insights;
        try {
          insights = JSON.parse(responseText);
        } catch {
          const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            insights = JSON.parse(jsonMatch[1]);
          } else {
            console.error(`Failed to parse AI response for org ${org.id}`);
            continue;
          }
        }

        // Store high and medium priority pipeline insights
        if (insights.priority === 'high' || insights.priority === 'medium') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const { error: insertError } = await supabase
            .from('campaign_insights')
            .insert({
              org_id: org.id,
              campaign_id: null, // Pipeline insights don't have campaign_id
              priority: insights.priority,
              insight_type: insights.insight_type,
              title: insights.title,
              description: insights.description,
              impact: insights.impact,
              supporting_data: insights.supportingData,
              analysis: insights.analysis,
              suggested_action: insights.suggestedAction,
              expires_at: expiresAt.toISOString(),
            });

          if (insertError) {
            console.error(`Error inserting pipeline insight for org ${org.id}:`, insertError);
          }
        }

        // Update pipeline benchmarks
        for (const [stageId, metrics] of stageMetrics.entries()) {
          const periodStart = new Date(thirtyDaysAgo);
          const periodEnd = new Date();

          await supabase
            .from('pipeline_benchmarks')
            .upsert({
              org_id: org.id,
              stage_id: stageId,
              avg_days_in_stage: metrics.avgDaysInStage,
              conversion_rate: metrics.conversionRate,
              total_contacts_processed: metrics.contactCount,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              calculated_at: new Date().toISOString(),
            }, {
              onConflict: 'org_id,stage_id,period_start,period_end'
            });
        }

      } catch (aiError) {
        console.error(`AI analysis error for org ${org.id}:`, aiError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pipeline analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

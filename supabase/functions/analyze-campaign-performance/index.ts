import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Starting campaign performance analysis');

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) throw orgsError;

    for (const org of orgs || []) {
      console.log(`Analyzing campaigns for org: ${org.id}`);

      // Fetch last 30 days of analytics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: analytics, error: analyticsError } = await supabase
        .from('campaign_analytics')
        .select('*')
        .eq('org_id', org.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (analyticsError) {
        console.error(`Error fetching analytics for org ${org.id}:`, analyticsError);
        continue;
      }

      if (!analytics || analytics.length === 0) {
        console.log(`No analytics data for org ${org.id}`);
        continue;
      }

      // Group by campaign
      const campaignMap = new Map<string, any[]>();
      analytics.forEach(record => {
        const key = `${record.campaign_id}-${record.campaign_type}`;
        if (!campaignMap.has(key)) {
          campaignMap.set(key, []);
        }
        campaignMap.get(key)!.push(record);
      });

      // Analyze each campaign
      for (const [campaignKey, metrics] of campaignMap.entries()) {
        const [campaignId, campaignType] = campaignKey.split('-');

        // Calculate aggregate metrics
        const totalSpend = metrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
        const totalConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
        const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.revenue || 0), 0);
        const avgRoas = totalRevenue / (totalSpend || 1);
        const avgCpa = totalSpend / (totalConversions || 1);

        // Get campaign name
        const tableName = campaignType === 'email' ? 'email_bulk_campaigns' : 'whatsapp_bulk_campaigns';
        const { data: campaign } = await supabase
          .from(tableName)
          .select('name, status')
          .eq('id', campaignId)
          .single();

        if (!campaign) continue;

        // Build AI analysis prompt
        const prompt = `Analyze this ${campaignType} campaign performance and provide actionable insights:

Campaign: ${campaign.name}
Status: ${campaign.status}
Period: Last 30 days

Metrics:
- Total Spend: $${totalSpend.toFixed(2)}
- ROAS: ${avgRoas.toFixed(2)}x (target: 2.5x)
- Conversions: ${totalConversions}
- CPA: $${avgCpa.toFixed(2)} (target: $60)
- Total Opens: ${metrics.reduce((sum, m) => sum + (m.open_count || 0), 0)}
- Total Clicks: ${metrics.reduce((sum, m) => sum + (m.click_count || 0), 0)}
- Bounces: ${metrics.reduce((sum, m) => sum + (m.bounce_count || 0), 0)}

Recent trend (last 7 days):
${metrics.slice(0, 7).map(m => `${m.date}: ${m.conversions} conversions, $${m.spend} spend`).join('\n')}

Identify:
1. Performance issues (low ROAS, high CPA, declining trends)
2. Opportunities (strong performers to scale, audience insights)
3. Specific actionable recommendations with expected impact

Respond ONLY with valid JSON in this exact format:
{
  "priority": "high|medium|low",
  "insight_type": "performance_drop|opportunity|optimization",
  "title": "Clear action statement (max 60 chars)",
  "description": "Why this matters (1 sentence)",
  "impact": "Quantified result (e.g., 'Save $500/week')",
  "supportingData": {
    "metric1": "value1",
    "metric2": "value2"
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
                { role: 'system', content: 'You are an expert marketing analyst. Always respond with valid JSON only.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI API error for campaign ${campaignId}:`, await aiResponse.text());
            continue;
          }

          const aiData = await aiResponse.json();
          const responseText = aiData.choices[0].message.content;
          
          // Extract JSON from response
          let insights;
          try {
            // Try to parse directly first
            insights = JSON.parse(responseText);
          } catch {
            // If that fails, try to extract JSON from markdown code blocks
            const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
              insights = JSON.parse(jsonMatch[1]);
            } else {
              console.error(`Failed to parse AI response for campaign ${campaignId}`);
              continue;
            }
          }

          // Only store medium and high priority insights
          if (insights.priority === 'high' || insights.priority === 'medium') {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

            const { error: insertError } = await supabase
              .from('campaign_insights')
              .insert({
                org_id: org.id,
                campaign_id: campaignId,
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
              console.error(`Error inserting insight for campaign ${campaignId}:`, insertError);
            } else {
              console.log(`Created ${insights.priority} priority insight for campaign ${campaignId}`);
            }
          }
        } catch (aiError) {
          console.error(`AI analysis error for campaign ${campaignId}:`, aiError);
        }
      }
    }

    console.log('Campaign analysis complete');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Campaign analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

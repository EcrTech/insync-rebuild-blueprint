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
    const { query, orgId } = await req.json();

    if (!query || !orgId) {
      throw new Error('Missing required parameters: query and orgId');
    }

    const supabase = getSupabaseClient();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch recent campaign data
    const { data: emailCampaigns } = await supabase
      .from('email_bulk_campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: whatsappCampaigns } = await supabase
      .from('whatsapp_bulk_campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analytics } = await supabase
      .from('campaign_analytics')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(100);

    // Fetch active insights
    const { data: insights } = await supabase
      .from('campaign_insights')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('priority', { ascending: true })
      .limit(10);

    // Build context summary
    const emailSummary = emailCampaigns?.map(c => 
      `${c.name}: ${c.status}, ${c.sent_count} sent, ${c.failed_count} failed`
    ).join('\n') || 'No email campaigns';

    const whatsappSummary = whatsappCampaigns?.map(c => 
      `${c.name}: ${c.status}, ${c.sent_count} sent, ${c.failed_count} failed`
    ).join('\n') || 'No WhatsApp campaigns';

    const analyticsSummary = analytics 
      ? `Total campaigns tracked: ${new Set(analytics.map(a => a.campaign_id)).size}, Total conversions: ${analytics.reduce((sum, a) => sum + (a.conversions || 0), 0)}`
      : 'No analytics data';

    const insightsSummary = insights?.map(i => 
      `${i.priority.toUpperCase()}: ${i.title}`
    ).join('\n') || 'No active insights';

    const context = `You are a helpful campaign analytics assistant for an organization.

CURRENT CAMPAIGNS:

Email Campaigns (last 10):
${emailSummary}

WhatsApp Campaigns (last 10):
${whatsappSummary}

ANALYTICS SUMMARY (Last 30 days):
${analyticsSummary}

ACTIVE INSIGHTS:
${insightsSummary}

Provide helpful, data-driven answers about campaign performance, trends, and recommendations.
Be conversational but precise. Use specific numbers when available.
If the user asks about specific campaigns, reference the data above.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices[0].message.content;

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

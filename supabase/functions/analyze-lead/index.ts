import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchQuery, contacts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `# AI-Driven Lead Filter System

You are an expert lead qualification assistant. Your task is to analyze leads and filter them based on search criteria using these qualification dimensions:

## Lead Qualification Criteria

### 1. Fit Score (0-40 points)
- Company Size: Employee count match with target range
- Industry: Primary or secondary target industries
- Budget Indicators: Signs of adequate budget
- Technology Stack: Compatible or complementary technologies

### 2. Intent Score (0-30 points)
- Engagement Level: Website visits, content downloads, demo requests
- Pain Points: Explicitly mentioned challenges we can solve
- Timeline: Stated or implied urgency for solution
- Competition: Currently evaluating alternatives

### 3. Authority Score (0-20 points)
- Job Title/Role: Decision-maker, influencer, or end-user
- Seniority: C-level, VP, Director, Manager, Individual Contributor
- Buying Committee: Can introduce us to other stakeholders

### 4. Engagement Quality (0-10 points)
- Information Provided: Completeness and accuracy of data
- Communication: Quality of questions or comments
- Channel: How they discovered us

## Scoring Classification
- 80-100: Hot Lead
- 60-79: Warm Lead
- 40-59: Nurture Lead
- 20-39: Cold Lead
- 0-19: Disqualified

## Red Flags
- Generic/role email addresses (info@, hello@)
- Free email domains for B2B leads
- Competitor company domains
- Obvious spam patterns
- Students/academic institutions (unless B2C)

## Your Task
When given a search query and a list of leads, return ONLY a JSON array of contact IDs that match the search criteria. Analyze the leads based on the qualification criteria above and filter them according to the user's search intent.

Return format:
{
  "filteredContactIds": ["id1", "id2", "id3"]
}`;

    const contactsSummary = contacts.map((c: any) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name || ''}`.trim(),
      email: c.email,
      company: c.company,
      job_title: c.job_title,
      source: c.source,
      status: c.status,
      phone: c.phone,
      website: c.website,
      notes: c.notes
    }));

    const userPrompt = `Search Query: "${searchQuery}"

Analyze these leads and return the IDs of leads that match the search criteria:

${JSON.stringify(contactsSummary, null, 2)}

Return only the JSON response with filteredContactIds array.`;

    console.log('Processing AI search with query:', searchQuery);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Failed to analyze leads');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    let filteredContactIds = [];
    try {
      const parsed = JSON.parse(aiResponse);
      filteredContactIds = parsed.filteredContactIds || [];
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      filteredContactIds = [];
    }

    return new Response(
      JSON.stringify({ filteredContactIds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-lead function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
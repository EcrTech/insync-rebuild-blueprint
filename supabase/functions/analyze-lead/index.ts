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
    const { contact, searchQuery, contacts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Handle search query - filter contacts based on criteria
    if (searchQuery && contacts) {
      const searchSystemPrompt = `You are a CRM search assistant. Your task is to filter contacts based on natural language search queries that map to CRM fields.

Available CRM fields:
- first_name, last_name: Contact name
- company: Company name
- job_title: Job title/designation
- email, phone: Contact information
- source: Lead source
- status: Contact status
- city, state, country: Location information
- website: Company website
- notes: Additional notes
- created_at: Creation date

Return ONLY a JSON object with this structure:
{
  "filteredContactIds": ["id1", "id2", "id3"]
}

Include contact IDs that match the search criteria. Be intelligent about matching - understand synonyms, partial matches, and combined criteria.

Examples:
- "designation Manager" -> Match job_title containing "Manager"
- "company in Mumbai" -> Match city = "Mumbai"
- "designation Manager, company in Mumbai" -> Match both conditions
- "age 30-40" -> You cannot filter by age as it's not a CRM field, return empty array
- "source LinkedIn" -> Match source = "LinkedIn"`;

      const contactsSummary = contacts.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        company: c.company,
        job_title: c.job_title,
        source: c.source,
        status: c.status,
        city: c.city,
        state: c.state,
        country: c.country,
        email: c.email,
        phone: c.phone
      }));

      const searchUserPrompt = `Search Query: "${searchQuery}"

Contacts to filter:
${JSON.stringify(contactsSummary, null, 2)}

Return the IDs of contacts that match the search criteria.`;

      console.log('Filtering contacts with query:', searchQuery);

      const searchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: searchSystemPrompt },
            { role: 'user', content: searchUserPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to process search query');
      }

      const searchData = await searchResponse.json();
      const searchResult = JSON.parse(searchData.choices[0].message.content);
      
      console.log('Search result:', searchResult);

      return new Response(
        JSON.stringify(searchResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle single contact scoring
    if (!contact) {
      throw new Error('Either contact or searchQuery with contacts must be provided');
    }

    const systemPrompt = `You are a B2B lead scoring AI that evaluates contacts based on their pipeline position and engagement level.

SCORING FRAMEWORK (Total: 100 points)

1. PIPELINE STAGE SCORE (0-40 points) - PRIMARY INDICATOR
   Based on pipeline_stage.stage_order and name:
   - Won/Closed Won: 40 points
   - Negotiation/Contract Discussion: 35 points
   - Proposal Sent: 30 points
   - Demo/Presentation Completed: 25 points
   - Qualified/Interested: 20 points
   - Contacted/Initial Discussion: 15 points
   - New/Uncontacted: 5 points
   - Lost/Disqualified: 0 points

2. ACTIVITY ENGAGEMENT (0-25 points)
   Recent Activity Bonus (0-10 points):
   - Activity within 7 days: +10 points
   - Activity within 14 days: +7 points
   - Activity within 30 days: +4 points
   - No activity in 30+ days: -5 points
   
   Meeting/Demo Completion (0-10 points):
   - 3+ meetings completed: 10 points
   - 2 meetings: 7 points
   - 1 meeting: 5 points
   - Demo scheduled but not completed: 3 points
   - No meetings: 0 points
   
   Communication Volume (0-5 points):
   - 10+ total activities: 5 points
   - 5-9 activities: 3 points
   - 1-4 activities: 1 point
   - No activities: 0 points

3. BUSINESS PROFILE (0-20 points)
   Company Size & Revenue (0-10 points):
   - Large enterprise (500+ employees, 100Cr+ revenue): 10 points
   - Mid-sized (100-500 employees, 10-100Cr revenue): 7 points
   - Small business (10-100 employees, 1-10Cr revenue): 4 points
   - Startup/Very small (<10 employees, <1Cr revenue): 2 points
   
   Decision-Making Level (0-10 points):
   - C-Suite (CEO, CFO, CTO, etc.): 10 points
   - VP/Director level: 7 points
   - Manager level: 4 points
   - Other roles: 2 points

4. FINANCIAL CAPABILITY (0-10 points)
   - 100Cr+ annual revenue: 10 points
   - 10-100Cr: 7 points
   - 1-10Cr: 4 points
   - <1Cr or unknown: 2 points

5. DATA QUALITY (0-5 points)
   - Lead Source + Information Completeness: 0-5 points

CATEGORY ASSIGNMENT:
- 85-100: hot (In negotiation/won stages, highly engaged)
- 70-84: warm (In proposal/demo stages, actively progressing)
- 55-69: cool (In contacted/qualified stages, some engagement)
- 40-54: cold (In early stages or limited activity)
- 0-39: unqualified (No engagement, lost, or very poor fit)

CRITICAL RULES:
- Pipeline stage is the PRIMARY factor
- A contact in "Won" stage MUST score 85+
- A contact in "Demo" stage MUST score at least 65+
- Recent activity (meetings, demos) significantly boosts score
- Stagnant leads (30+ days no activity) get penalized

Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "category": "<hot|warm|cool|cold|unqualified>",
  "breakdown": {
    "Pipeline Stage": <points>,
    "Activity Engagement": <points>,
    "Business Profile": <points>,
    "Financial Capability": <points>,
    "Data Quality": <points>
  },
  "reasoning": "<brief explanation>"
}`;

    const contactData = {
      name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      company_name: contact.company_name,
      job_title: contact.job_title,
      email: contact.email,
      phone: contact.phone,
      industry: contact.industry,
      company_size: contact.company_size,
      annual_revenue: contact.annual_revenue,
      lead_source: contact.lead_source,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      website: contact.website,
      notes: contact.notes,
      created_at: contact.created_at,
      pipeline_stage: {
        name: contact.pipeline_stage?.name || 'Not set',
        stage_order: contact.pipeline_stage?.stage_order || 0,
        probability: contact.pipeline_stage?.probability || 0
      },
      engagement_metrics: {
        total_activities: contact.engagement_metrics?.total_activities || 0,
        last_activity_date: contact.engagement_metrics?.last_activity_date || 'Never',
        days_since_last_activity: contact.engagement_metrics?.days_since_last_activity || 999,
        meetings_count: contact.engagement_metrics?.meetings_count || 0,
        calls_count: contact.engagement_metrics?.calls_count || 0,
        emails_count: contact.engagement_metrics?.emails_count || 0
      }
    };

    const userPrompt = `Analyze this B2B contact and provide a lead score:

${JSON.stringify(contactData, null, 2)}

Focus heavily on the pipeline_stage (especially stage_order) and engagement_metrics when scoring. Return JSON as specified.`;

    console.log('Scoring lead:', contactData.name);

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
      throw new Error('Failed to score lead');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    try {
      const scoreReport = JSON.parse(aiResponse);
      return new Response(
        JSON.stringify(scoreReport),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Invalid AI response format');
    }
  } catch (error) {
    console.error('Error in analyze-lead function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
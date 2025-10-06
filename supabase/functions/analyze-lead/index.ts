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

    const systemPrompt = `You are a CRM search assistant that filters contacts based on field criteria specified in natural language queries.

## Available Contact Fields:
- **job_title** (also referred to as designation, position, role)
- **company** (organization name)
- **first_name** and **last_name** (contact name)
- **email** (email address)
- **phone** (phone number)
- **source** (how they found us: Website, Referral, Cold Call, etc.)
- **status** (lead status: new, contacted, qualified, etc.)
- **city**, **state**, **country** (location)
- **website** (company website)
- **notes** (additional information)

## Your Task:
Parse the user's natural language search query and identify which contacts match the specified criteria. Look for:

### Examples of Queries:
1. "Get me VPs from tech companies" 
   → Filter: job_title contains "VP", company contains "tech"

2. "Contacts from California in the technology industry"
   → Filter: state = "California", company/notes contains "technology"

3. "Leads with designation Manager from Website source"
   → Filter: job_title contains "Manager", source = "Website"

4. "Show me contacts from companies in New York"
   → Filter: city/state contains "New York" OR company location mentions New York

5. "Find all directors and VPs"
   → Filter: job_title contains "Director" OR job_title contains "VP"

## Matching Rules:
- Use case-insensitive partial matching for text fields
- For job_title/designation: match common titles (CEO, VP, Director, Manager, etc.)
- For locations: check city, state, and country fields
- For company: check company name field
- For source: exact or partial match (Website, Referral, etc.)
- Return contacts that match ALL specified criteria (AND logic by default)
- If multiple options for same field are given, use OR logic for that field

## Response Format:
Return ONLY a JSON object with an array of contact IDs that match the criteria:

{
  "filteredContactIds": ["id1", "id2", "id3"]
}

If no contacts match, return an empty array.`;

    const contactsSummary = contacts.map((c: any) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      job_title: c.job_title,
      source: c.source,
      status: c.status,
      city: c.city,
      state: c.state,
      country: c.country,
      website: c.website,
      notes: c.notes
    }));

    const userPrompt = `Search Query: "${searchQuery}"

Filter these contacts based on the query criteria:

${JSON.stringify(contactsSummary, null, 2)}

Return only the JSON response with filteredContactIds array containing IDs of contacts that match the search criteria.`;

    console.log('Processing field-based AI search with query:', searchQuery);

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
      throw new Error('Failed to search contacts');
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

    console.log(`Filtered ${filteredContactIds.length} contacts from ${contacts.length} total`);

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
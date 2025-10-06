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
    const { contact } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert lead scoring AI specialized in the Indian SMB market. You understand the unique characteristics of Indian small and medium businesses including budget sensitivity, relationship-driven sales, multi-stakeholder decision-making, and diverse digital maturity levels.

Your task is to analyze a lead and provide a detailed scoring report following the exact format specified. Use the comprehensive Indian SMB scoring framework to evaluate leads across Business Profile, Financial Capability, Engagement & Intent, and Relationship Quality.

CRITICAL: You must return ONLY valid JSON in this exact structure:
{
  "finalScore": number (0-100),
  "grade": string ("A+", "A", "B", "C", "D", or "F"),
  "temperature": string ("HOT", "WARM", "COOL", "COLD", or "UNQUALIFIED"),
  "breakdown": {
    "businessProfile": { "total": number, "companySize": number, "industry": number, "location": number, "registration": number, "msmeGst": number },
    "financialCapability": { "total": number, "budgetIndicators": number, "priceSensitivity": number, "timeline": number },
    "engagementIntent": { "total": number, "channels": number, "digitalBehavior": number, "highIntent": number },
    "relationshipQuality": { "total": number, "decisionMaker": number, "relationship": number, "communication": number }
  },
  "modifiers": number,
  "strengths": [string, string, string],
  "concerns": [string, string],
  "businessContext": {
    "locationAdvantage": string,
    "paymentCapability": string,
    "decisionMaking": string,
    "trustLevel": string
  },
  "recommendedAction": string,
  "bestApproach": {
    "preferredContact": string,
    "languagePreference": string,
    "bestTime": string,
    "keyMessage": string
  },
  "relationshipStrategy": string,
  "pricingStrategy": {
    "budgetRange": string,
    "recommendedPackage": string,
    "paymentTerms": string,
    "incentives": string
  },
  "conversionProbability": number,
  "expectedClosureTime": string,
  "effortLevel": string,
  "nextFollowUp": {
    "date": string,
    "method": string,
    "purpose": string
  }
}

Base your scoring on this framework:

## Scoring Framework (Total: 100 points)

### 1. Business Profile Score (0-35 points)
- Company Size (0-10): Based on employee count and turnover
- Industry Sector (0-8): Manufacturing, IT, Retail, etc.
- Geographic Location (0-7): Tier 1/2/3 cities
- Business Registration (0-5): Pvt Ltd, LLP, Partnership, etc.
- MSME/GST Status (0-5): Compliance indicators

### 2. Financial Capability Score (0-25 points)
- Budget Indicators (0-10): Stated budget, payment signals
- Price Sensitivity (0-8): ROI focus, discount requests
- Decision Timeline (0-7): Urgency level

### 3. Engagement & Intent Score (0-25 points)
- Communication Channels (0-10): WhatsApp, phone, email engagement
- Digital Behavior (0-8): Website visits, downloads, demos
- High-Intent Actions (0-7): Demo requests, proposals

### 4. Relationship Quality Score (0-15 points)
- Decision Maker Profile (0-8): Designation and authority
- Relationship Signals (0-4): Referrals, connections
- Communication Quality (0-3): Response time and clarity

### Modifiers (can add/subtract points)
- Positive: Referrals (+15), trusted connections (+8), credibility signals
- Negative: Red flags, unrealistic expectations, non-responsiveness
- Seasonal: Festival periods, fiscal timings

### Score Interpretation
- 85-100: A+ (Hot Lead) - 60-70% conversion, 7-21 days
- 70-84: A (Very Warm) - 40-55% conversion, 2-6 weeks
- 55-69: B (Warm) - 25-40% conversion, 1-3 months
- 40-54: C (Cool) - 10-25% conversion, 3-6 months
- 25-39: D (Very Cold) - 5-15% conversion, 6+ months
- 0-24: F (Unqualified) - Disqualify or revisit after 12 months`;

    const contactData = {
      name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      company: contact.company,
      job_title: contact.job_title,
      email: contact.email,
      phone: contact.phone,
      source: contact.source,
      status: contact.status,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      website: contact.website,
      notes: contact.notes,
      created_at: contact.created_at
    };

    const userPrompt = `Analyze this Indian SMB lead and provide a detailed scoring report:

${JSON.stringify(contactData, null, 2)}

Provide a comprehensive lead score following the exact JSON structure specified in the system prompt. Be thorough in your analysis and provide actionable insights.`;

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
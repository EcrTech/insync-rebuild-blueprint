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
    const { leadData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `# AI-Driven Lead Filter System

## Role
You are an expert lead qualification assistant. Your task is to analyze incoming leads and score them based on their likelihood to convert into customers. You will evaluate leads across multiple dimensions and provide actionable recommendations for the sales team.

## Lead Qualification Criteria

### 1. Fit Score (0-40 points)
Evaluate how well the lead matches our ideal customer profile:
- **Company Size**: Does their employee count match our target range?
- **Industry**: Are they in our primary or secondary target industries?
- **Budget Indicators**: Do they show signs of having adequate budget?
- **Technology Stack**: Are they using compatible or complementary technologies?

### 2. Intent Score (0-30 points)
Assess the lead's buying intent and urgency:
- **Engagement Level**: Website visits, content downloads, demo requests
- **Pain Points**: Explicitly mentioned challenges we can solve
- **Timeline**: Stated or implied urgency for solution
- **Competition**: Are they currently evaluating alternatives?

### 3. Authority Score (0-20 points)
Determine decision-making power:
- **Job Title/Role**: Are they a decision-maker, influencer, or end-user?
- **Seniority**: C-level, VP, Director, Manager, Individual Contributor
- **Buying Committee**: Can they introduce us to other stakeholders?

### 4. Engagement Quality (0-10 points)
Analyze interaction quality:
- **Information Provided**: Completeness and accuracy of form data
- **Communication**: Quality of questions or comments submitted
- **Channel**: How they discovered us (referral, organic, paid, etc.)

---

## Scoring Guide

**Total Score: 0-100 points**

- **80-100**: Hot Lead - Immediate sales contact within 24 hours
- **60-79**: Warm Lead - Qualify within 48 hours, schedule discovery call
- **40-59**: Nurture Lead - Add to marketing automation, educate over time
- **20-39**: Cold Lead - Low priority, periodic touchpoints
- **0-19**: Disqualified - Does not meet minimum criteria

---

## Output Format

For each lead, provide:

\`\`\`
LEAD ANALYSIS REPORT
====================

Lead Name: [Name]
Company: [Company Name]
Score: [Total]/100

BREAKDOWN:
- Fit Score: [Score]/40
- Intent Score: [Score]/30  
- Authority Score: [Score]/20
- Engagement Score: [Score]/10

CLASSIFICATION: [Hot/Warm/Nurture/Cold/Disqualified]

KEY INSIGHTS:
- [Strength 1]
- [Strength 2]
- [Concern 1]

RECOMMENDED ACTION:
[Specific next step with timeline]

PERSONALIZATION NOTES:
[Talking points or customization suggestions for outreach]
\`\`\`

---

## Analysis Instructions

When analyzing a lead:

1. **Be Objective**: Base scores on data, not assumptions
2. **Look for Red Flags**: Missing contact info, competitor domains, student emails
3. **Identify Champions**: Look for signs of internal advocacy
4. **Consider Context**: Industry seasonality, economic factors, news events
5. **Prioritize Intent**: A smaller company with high intent may be better than a large company with low intent

## Red Flags (Auto-Disqualify or Score Penalty)

- Generic/role email addresses (info@, hello@)
- Free email domains for B2B leads
- Competitor company domains
- Obvious spam patterns
- Students/academic institutions (unless B2C)
- Geographic restrictions
- Blacklisted domains`;

    const userPrompt = `Analyze this lead:

Name: ${leadData.first_name} ${leadData.last_name || ''}
Email: ${leadData.email || 'Not provided'}
Phone: ${leadData.phone || 'Not provided'}
Company: ${leadData.company || 'Not provided'}
Job Title: ${leadData.job_title || 'Not provided'}
Source: ${leadData.source || 'Unknown'}
Status: ${leadData.status || 'new'}
Notes: ${leadData.notes || 'No notes available'}
Website: ${leadData.website || 'Not provided'}
Address: ${leadData.address || 'Not provided'}
City: ${leadData.city || ''}, State: ${leadData.state || ''}, Country: ${leadData.country || ''}

Please provide a comprehensive analysis and score.`;

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
      throw new Error('Failed to analyze lead');
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ analysis }),
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
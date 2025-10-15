import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface RequestContext {
  apiKey: string;
  orgId: string;
  apiKeyId: string;
  startTime: number;
}

// Rate limiting: track requests per API key
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate request
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return errorResponse('Missing API key', 401, requestId);
    }

    // Verify API key
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('id, org_id, permissions, is_active, expires_at')
      .eq('api_key', apiKey)
      .single();

    if (keyError || !keyData) {
      await logUsage(supabaseAdmin, null, null, req, 401, Date.now() - startTime, 'Invalid API key');
      return errorResponse('Invalid API key', 401, requestId);
    }

    if (!keyData.is_active) {
      await logUsage(supabaseAdmin, keyData.id, keyData.org_id, req, 403, Date.now() - startTime, 'API key is inactive');
      return errorResponse('API key is inactive', 403, requestId);
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      await logUsage(supabaseAdmin, keyData.id, keyData.org_id, req, 403, Date.now() - startTime, 'API key has expired');
      return errorResponse('API key has expired', 403, requestId);
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit(apiKey);
    if (!rateLimitCheck.allowed) {
      await logUsage(supabaseAdmin, keyData.id, keyData.org_id, req, 429, Date.now() - startTime, 'Rate limit exceeded');
      return errorResponse('Rate limit exceeded', 429, requestId);
    }

    const context: RequestContext = {
      apiKey,
      orgId: keyData.org_id,
      apiKeyId: keyData.id,
      startTime
    };

    // Update last_used_at
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    // Route to appropriate handler
    const url = new URL(req.url);
    const path = url.pathname.replace('/crm-bridge-api', '');
    const method = req.method;

    // Debug logging
    console.log('Request details:', {
      fullUrl: req.url,
      pathname: url.pathname,
      extractedPath: path,
      method: method
    });

    let response: Response;

    if (path === '/contacts' && method === 'GET') {
      response = await handleListContacts(supabaseAdmin, context, url);
    } else if (path.match(/^\/contacts\/[^/]+$/) && method === 'GET') {
      const contactId = path.split('/')[2];
      response = await handleGetContact(supabaseAdmin, context, contactId);
    } else if (path === '/contacts' && method === 'POST') {
      response = await handleCreateContact(supabaseAdmin, context, req);
    } else if (path.match(/^\/contacts\/[^/]+$/) && method === 'PATCH') {
      const contactId = path.split('/')[2];
      response = await handleUpdateContact(supabaseAdmin, context, req, contactId);
    } else if (path.match(/^\/contacts\/[^/]+\/activities$/) && method === 'GET') {
      const contactId = path.split('/')[2];
      response = await handleGetContactActivities(supabaseAdmin, context, contactId);
    } else if (path.match(/^\/contacts\/[^/]+\/activities$/) && method === 'POST') {
      const contactId = path.split('/')[2];
      response = await handleCreateActivity(supabaseAdmin, context, req, contactId);
    } else if (path === '/pipeline-stages' && method === 'GET') {
      response = await handleGetPipelineStages(supabaseAdmin, context);
    } else if (path === '/custom-fields' && method === 'GET') {
      response = await handleGetCustomFields(supabaseAdmin, context);
    } else {
      response = errorResponse('Endpoint not found', 404, requestId);
    }

    // Extract status from response
    const responseStatus = response.status;
    const responseTime = Date.now() - startTime;

    // Log the request
    await logUsage(supabaseAdmin, context.apiKeyId, context.orgId, req, responseStatus, responseTime);

    return response;

  } catch (error) {
    console.error('CRM Bridge API error:', error);
    const responseTime = Date.now() - startTime;
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500, requestId);
  }
});

// Rate limiting: 100 requests per minute
function checkRateLimit(apiKey: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(apiKey);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(apiKey, { count: 1, resetTime: now + 60000 });
    return { allowed: true };
  }

  if (limit.count >= 100) {
    return { allowed: false, resetIn: Math.ceil((limit.resetTime - now) / 1000) };
  }

  limit.count++;
  return { allowed: true };
}

async function logUsage(
  supabase: any,
  apiKeyId: string | null,
  orgId: string | null,
  req: Request,
  statusCode: number,
  responseTime: number,
  errorMessage?: string
) {
  if (!apiKeyId || !orgId) return;

  const url = new URL(req.url);
  const endpoint = url.pathname.replace('/crm-bridge-api', '');

  try {
    await supabase.from('api_key_usage_logs').insert({
      api_key_id: apiKeyId,
      org_id: orgId,
      endpoint,
      method: req.method,
      status_code: statusCode,
      response_time_ms: responseTime,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
      error_message: errorMessage
    });
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}

function successResponse(data: any, requestId: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId
      }
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

function errorResponse(message: string, status: number, requestId: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: getErrorCode(status),
        message
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId
      }
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

function getErrorCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_SERVER_ERROR'
  };
  return codes[status] || 'UNKNOWN_ERROR';
}

// Handler functions

async function handleListContacts(supabase: any, context: RequestContext, url: URL) {
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status');
  const assignedTo = url.searchParams.get('assigned_to');
  const createdAfter = url.searchParams.get('created_after');
  const search = url.searchParams.get('search');

  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, company, job_title, status, source, created_at, updated_at', { count: 'exact' })
    .eq('org_id', context.orgId)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);
  if (createdAfter) query = query.gte('created_at', createdAfter);
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error.message, 500, crypto.randomUUID());
  }

  return successResponse({
    contacts: data,
    pagination: {
      total: count,
      limit,
      offset,
      has_more: count ? offset + limit < count : false
    }
  }, crypto.randomUUID());
}

async function handleGetContact(supabase: any, context: RequestContext, contactId: string) {
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*, contact_emails(*), contact_phones(*)')
    .eq('org_id', context.orgId)
    .eq('id', contactId)
    .single();

  if (error) {
    return errorResponse('Contact not found', 404, crypto.randomUUID());
  }

  return successResponse(contact, crypto.randomUUID());
}

async function handleCreateContact(supabase: any, context: RequestContext, req: Request) {
  const body = await req.json();

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      org_id: context.orgId,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      job_title: body.job_title,
      status: body.status || 'new',
      source: body.source || 'api',
      address: body.address,
      city: body.city,
      state: body.state,
      country: body.country,
      postal_code: body.postal_code,
      website: body.website,
      linkedin_url: body.linkedin_url,
      notes: body.notes
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 400, crypto.randomUUID());
  }

  return successResponse(data, crypto.randomUUID(), 201);
}

async function handleUpdateContact(supabase: any, context: RequestContext, req: Request, contactId: string) {
  const body = await req.json();

  const { data, error } = await supabase
    .from('contacts')
    .update(body)
    .eq('org_id', context.orgId)
    .eq('id', contactId)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 400, crypto.randomUUID());
  }

  return successResponse(data, crypto.randomUUID());
}

async function handleGetContactActivities(supabase: any, context: RequestContext, contactId: string) {
  const { data, error } = await supabase
    .from('contact_activities')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(error.message, 500, crypto.randomUUID());
  }

  return successResponse({ activities: data }, crypto.randomUUID());
}

async function handleCreateActivity(supabase: any, context: RequestContext, req: Request, contactId: string) {
  const body = await req.json();

  const { data, error } = await supabase
    .from('contact_activities')
    .insert({
      org_id: context.orgId,
      contact_id: contactId,
      activity_type: body.activity_type,
      subject: body.subject,
      description: body.description,
      scheduled_at: body.scheduled_at,
      completed_at: body.completed_at
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 400, crypto.randomUUID());
  }

  return successResponse(data, crypto.randomUUID(), 201);
}

async function handleGetPipelineStages(supabase: any, context: RequestContext) {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('org_id', context.orgId)
    .order('stage_order', { ascending: true });

  if (error) {
    return errorResponse(error.message, 500, crypto.randomUUID());
  }

  return successResponse({ stages: data }, crypto.randomUUID());
}

async function handleGetCustomFields(supabase: any, context: RequestContext) {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('is_active', true)
    .order('field_order', { ascending: true });

  if (error) {
    return errorResponse(error.message, 500, crypto.randomUUID());
  }

  return successResponse({ custom_fields: data }, crypto.randomUUID());
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  orgId: string;
  triggerEvent: string;
  triggerData: any;
}

interface OutboundWebhook {
  id: string;
  org_id: string;
  name: string;
  webhook_url: string;
  trigger_event: string;
  http_method: string;
  headers: any;
  payload_template: any;
  filter_conditions: any;
  authentication_type: string | null;
  authentication_config: any;
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload: WebhookPayload = await req.json();
    console.log('[OutboundWebhook] Received trigger:', payload.triggerEvent, 'for org:', payload.orgId);

    // Get all active webhooks for this org and trigger event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('org_id', payload.orgId)
      .eq('trigger_event', payload.triggerEvent)
      .eq('is_active', true);

    if (webhooksError) {
      console.error('[OutboundWebhook] Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('[OutboundWebhook] No active webhooks found for event:', payload.triggerEvent);
      return new Response(
        JSON.stringify({ message: 'No active webhooks found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[OutboundWebhook] Found ${webhooks.length} active webhook(s)`);

    // Process each webhook
    const results = await Promise.allSettled(
      webhooks.map(webhook => processWebhook(webhook, payload, supabase))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`[OutboundWebhook] Processed ${webhooks.length} webhooks: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Webhooks processed',
        total: webhooks.length,
        success: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[OutboundWebhook] Handler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processWebhook(
  webhook: OutboundWebhook,
  payload: WebhookPayload,
  supabase: any
): Promise<void> {
  const startTime = Date.now();
  const logId = crypto.randomUUID();

  try {
    console.log(`[OutboundWebhook] Processing webhook: ${webhook.name} (${webhook.id})`);

    // Evaluate filter conditions
    if (webhook.filter_conditions && Object.keys(webhook.filter_conditions).length > 0) {
      const passesFilter = evaluateFilters(webhook.filter_conditions, payload.triggerData);
      if (!passesFilter) {
        console.log(`[OutboundWebhook] Webhook ${webhook.name} skipped: filter conditions not met`);
        return;
      }
    }

    // Transform payload using template
    const transformedPayload = transformPayload(webhook.payload_template, payload.triggerData);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Lovable-CRM-Webhook/1.0',
      ...webhook.headers,
    };

    // Add authentication
    if (webhook.authentication_type && webhook.authentication_config) {
      addAuthentication(headers, webhook.authentication_type, webhook.authentication_config);
    }

    // Execute webhook with retry logic
    const result = await executeWithRetry(
      webhook.webhook_url,
      webhook.http_method,
      headers,
      transformedPayload,
      webhook.retry_count,
      webhook.timeout_seconds
    );

    const duration = Date.now() - startTime;

    // Log success
    await supabase.from('outbound_webhook_logs').insert({
      id: logId,
      webhook_id: webhook.id,
      org_id: webhook.org_id,
      trigger_event: payload.triggerEvent,
      request_payload: transformedPayload,
      response_status: result.status,
      response_body: result.body,
      execution_time_ms: duration,
      attempt_count: result.attempts,
      status: 'success',
    });

    console.log(`[OutboundWebhook] Webhook ${webhook.name} executed successfully in ${duration}ms`);

    // Update success stats
    await supabase.rpc('increment', {
      table_name: 'outbound_webhooks',
      id: webhook.id,
      column_name: 'total_executions',
    }).catch(() => {
      // Fallback: direct update
      supabase
        .from('outbound_webhooks')
        .update({
          total_executions: (webhook as any).total_executions + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq('id', webhook.id);
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[OutboundWebhook] Webhook ${webhook.name} failed:`, error.message);

    // Log failure
    await supabase.from('outbound_webhook_logs').insert({
      id: logId,
      webhook_id: webhook.id,
      org_id: webhook.org_id,
      trigger_event: payload.triggerEvent,
      request_payload: payload.triggerData,
      response_status: error.status || null,
      response_body: error.message,
      execution_time_ms: duration,
      attempt_count: error.attempts || 1,
      status: 'failed',
      error_message: error.message,
    });

    // Update failure stats
    await supabase
      .from('outbound_webhooks')
      .update({
        total_failures: ((webhook as any).total_failures || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', webhook.id);

    throw error;
  }
}

function evaluateFilters(filters: any, data: any): boolean {
  // Simple filter evaluation - can be expanded
  if (!filters || typeof filters !== 'object') return true;

  for (const [key, condition] of Object.entries(filters)) {
    const value = getNestedValue(data, key);
    
    if (typeof condition === 'object' && condition !== null) {
      const { operator, value: filterValue } = condition as any;
      
      switch (operator) {
        case 'equals':
          if (value !== filterValue) return false;
          break;
        case 'not_equals':
          if (value === filterValue) return false;
          break;
        case 'contains':
          if (!String(value).includes(filterValue)) return false;
          break;
        case 'not_contains':
          if (String(value).includes(filterValue)) return false;
          break;
        case 'greater_than':
          if (!(value > filterValue)) return false;
          break;
        case 'less_than':
          if (!(value < filterValue)) return false;
          break;
        case 'is_empty':
          if (value !== null && value !== undefined && value !== '') return false;
          break;
        case 'is_not_empty':
          if (value === null || value === undefined || value === '') return false;
          break;
      }
    } else {
      // Direct equality check
      if (value !== condition) return false;
    }
  }

  return true;
}

function transformPayload(template: any, data: any): any {
  if (!template) return data;

  const transform = (obj: any): any => {
    if (typeof obj === 'string') {
      // Replace {{variable}} with actual values
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getNestedValue(data, path.trim());
        return value !== undefined ? value : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(transform);
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = transform(value);
      }
      return result;
    }

    return obj;
  };

  return transform(template);
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function addAuthentication(
  headers: Record<string, string>,
  authType: string,
  authConfig: any
): void {
  switch (authType) {
    case 'bearer':
      if (authConfig.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
      break;
    case 'api_key':
      if (authConfig.header_name && authConfig.api_key) {
        headers[authConfig.header_name] = authConfig.api_key;
      }
      break;
    case 'basic':
      if (authConfig.username && authConfig.password) {
        const credentials = btoa(`${authConfig.username}:${authConfig.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
  }
}

async function executeWithRetry(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  maxRetries: number,
  timeoutSeconds: number
): Promise<{ status: number; body: any; attempts: number }> {
  let lastError: any;
  const attempts = maxRetries + 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`[OutboundWebhook] Attempt ${attempt}/${attempts} to ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let responseBody: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          body: responseBody,
          attempts: attempt,
        };
      }

      return {
        status: response.status,
        body: responseBody,
        attempts: attempt,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`[OutboundWebhook] Attempt ${attempt} failed:`, error.message);

      if (attempt < attempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[OutboundWebhook] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

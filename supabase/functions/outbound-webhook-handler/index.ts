import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  orgId: string;
  triggerEvent: string;
  triggerData: any;
  tableName?: string;
  operation?: string;
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
  retry_config: {
    max_retries: number;
    retry_delay_seconds: number;
    timeout_seconds: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  try {
    const payload: WebhookPayload = await req.json();
    console.log('[OutboundWebhook] Received trigger:', payload.triggerEvent, 'for org:', payload.orgId, 'table:', payload.tableName || 'unknown');

    // Get all active webhooks for this org, table, and trigger event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('org_id', payload.orgId)
      .eq('target_table', payload.tableName || 'contacts')
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
    console.log(`[OutboundWebhook] Executing webhook ${webhook.name}:`, {
      url: webhook.webhook_url,
      method: webhook.http_method,
      hasAuth: !!webhook.authentication_type,
      payloadSize: JSON.stringify(transformedPayload).length,
      maxRetries: webhook.retry_config?.max_retries || 3,
      timeout: webhook.retry_config?.timeout_seconds || 30,
    });
    
    const result = await executeWithRetry(
      webhook.webhook_url,
      webhook.http_method,
      headers,
      transformedPayload,
      webhook.retry_config?.max_retries || 3,
      webhook.retry_config?.timeout_seconds || 30
    );

    const duration = Date.now() - startTime;

    // Log success
    await supabase.from('outbound_webhook_logs').insert({
      id: logId,
      webhook_id: webhook.id,
      org_id: webhook.org_id,
      trigger_event: payload.triggerEvent,
      trigger_data: payload.triggerData,
      payload_sent: transformedPayload,
      response_status: result.status,
      response_body: JSON.stringify(result.body),
      execution_time_ms: duration,
      retry_count: result.attempts - 1,
      succeeded: true,
    });

    console.log(`[OutboundWebhook] Webhook ${webhook.name} executed successfully in ${duration}ms`);

    // Update success stats
    await supabase
      .from('outbound_webhooks')
      .update({
        total_executions: ((webhook as any).total_executions || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', webhook.id);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Determine error type and details
    let errorType = 'unknown';
    let errorDetails = error.message || 'Unknown error';
    
    if (error.name === 'AbortError' || errorDetails.includes('aborted')) {
      errorType = 'timeout';
      errorDetails = `Request timeout after ${webhook.retry_config?.timeout_seconds || 30} seconds`;
    } else if (errorDetails.includes('ECONNREFUSED') || errorDetails.includes('Connection refused')) {
      errorType = 'connection_refused';
      errorDetails = 'Connection refused - target server not reachable or not accepting connections';
    } else if (errorDetails.includes('ENOTFOUND') || errorDetails.includes('getaddrinfo')) {
      errorType = 'dns_error';
      errorDetails = 'DNS resolution failed - hostname not found';
    } else if (errorDetails.includes('ETIMEDOUT')) {
      errorType = 'connection_timeout';
      errorDetails = 'Connection timeout - target server did not respond in time';
    } else if (errorDetails.includes('ECONNRESET')) {
      errorType = 'connection_reset';
      errorDetails = 'Connection reset by target server';
    } else if (error.status >= 400 && error.status < 500) {
      errorType = 'client_error';
      errorDetails = `HTTP ${error.status}: ${error.message}`;
    } else if (error.status >= 500) {
      errorType = 'server_error';
      errorDetails = `HTTP ${error.status}: ${error.message}`;
    }

    console.error(`[OutboundWebhook] Webhook ${webhook.name} failed:`, {
      errorType,
      errorDetails,
      url: webhook.webhook_url,
      method: webhook.http_method,
      attempts: error.attempts || 1,
      duration: `${duration}ms`,
      fullError: error,
    });

    // Transform payload for logging
    const transformedPayload = transformPayload(webhook.payload_template, payload.triggerData);

    // Log failure with detailed information
    await supabase.from('outbound_webhook_logs').insert({
      id: logId,
      webhook_id: webhook.id,
      org_id: webhook.org_id,
      trigger_event: payload.triggerEvent,
      trigger_data: payload.triggerData,
      payload_sent: transformedPayload,
      response_status: error.status || null,
      response_body: error.body ? JSON.stringify(error.body) : errorDetails,
      error_message: `[${errorType}] ${errorDetails}`,
      execution_time_ms: duration,
      retry_count: error.attempts || 1,
      succeeded: false,
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
      // Enhanced error information
      const errorInfo: any = {
        message: error.message || 'Unknown error',
        name: error.name,
        attempts: attempt,
      };

      // Categorize error for better debugging
      if (error.name === 'AbortError') {
        errorInfo.type = 'timeout';
        errorInfo.message = `Request timed out after ${timeoutSeconds} seconds`;
      } else if (error.message?.includes('fetch')) {
        errorInfo.type = 'network';
        errorInfo.details = 'Network request failed - check if URL is accessible from internet';
      }

      lastError = errorInfo;
      
      console.error(`[OutboundWebhook] Attempt ${attempt} failed:`, {
        url,
        method,
        error: errorInfo,
        timestamp: new Date().toISOString(),
      });

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

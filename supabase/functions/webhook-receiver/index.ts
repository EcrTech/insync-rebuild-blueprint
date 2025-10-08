import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  [key: string]: any;
}

interface FormWithConfig {
  id: string;
  name: string;
  org_id: string;
  connector_type: string;
  webhook_token: string;
  webhook_config: {
    source_name?: string;
    field_mappings?: Record<string, string>;
  };
  rate_limit_per_minute: number;
  form_fields: Array<{
    custom_field_id: string;
    custom_fields: {
      id: string;
      field_name: string;
      field_label: string;
      field_type: string;
      is_required: boolean;
    };
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract webhook token from URL path
    const url = new URL(req.url);
    const webhookToken = url.pathname.split('/').pop();

    if (!webhookToken) {
      return errorResponse(400, 'Missing webhook token in URL');
    }

    // Create Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const requestId = `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Parse request body
    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch (e) {
      return errorResponse(400, 'Invalid JSON payload', requestId);
    }

    // Step 1: Get form/connector by webhook token
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select(`
        *,
        form_fields (
          custom_field_id,
          custom_fields (
            id,
            field_name,
            field_label,
            field_type,
            is_required
          )
        )
      `)
      .eq('webhook_token', webhookToken)
      .eq('is_active', true)
      .single();

    if (formError || !form) {
      await logWebhook(supabase, null, null, requestId, 'error', 404, payload, 'Webhook endpoint not found', clientIp);
      return errorResponse(404, 'Webhook endpoint not found', requestId);
    }

    const typedForm = form as unknown as FormWithConfig;

    // Step 2: Check rate limit
    const { data: rateLimitOk } = await supabase
      .rpc('check_connector_rate_limit', {
        _form_id: typedForm.id,
        _limit: typedForm.rate_limit_per_minute || 60
      });

    if (!rateLimitOk) {
      await logWebhook(supabase, typedForm.id, typedForm.org_id, requestId, 'error', 429, payload, 'Rate limit exceeded', clientIp);
      return errorResponse(429, 'Rate limit exceeded. Maximum ' + (typedForm.rate_limit_per_minute || 60) + ' requests per minute', requestId);
    }

    // Step 3: Map fields using webhook_config
    const mappedContact = mapFields(payload, typedForm.webhook_config?.field_mappings || {});

    // Step 4: Validate required fields
    const errors = validateContact(mappedContact);
    if (errors.length > 0) {
      await logWebhook(supabase, typedForm.id, typedForm.org_id, requestId, 'error', 400, payload, `Validation failed: ${errors.join(', ')}`, clientIp);
      return errorResponse(400, 'Validation failed', requestId, errors);
    }

    // Step 5: Check for duplicate by phone
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('org_id', typedForm.org_id)
      .eq('phone', mappedContact.phone)
      .maybeSingle();

    let contactId: string;
    let isDuplicate = false;
    let responseData: any;

    if (existingContact) {
      // Update existing contact
      isDuplicate = true;
      contactId = existingContact.id;

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          first_name: mappedContact.first_name,
          last_name: mappedContact.last_name || null,
          email: mappedContact.email,
          company: mappedContact.company || null,
          notes: mappedContact.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (updateError) {
        throw updateError;
      }

      responseData = {
        success: true,
        message: 'Lead updated (duplicate phone number)',
        contact_id: contactId,
        status: 'duplicate',
        duplicate_field: 'phone',
        duplicate_value: mappedContact.phone,
        request_id: requestId,
        timestamp: new Date().toISOString()
      };

    } else {
      // Get default pipeline stage
      const { data: defaultStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('org_id', typedForm.org_id)
        .eq('name', 'New')
        .eq('is_active', true)
        .maybeSingle();

      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          org_id: typedForm.org_id,
          first_name: mappedContact.first_name,
          last_name: mappedContact.last_name || null,
          email: mappedContact.email,
          phone: mappedContact.phone,
          company: mappedContact.company || null,
          notes: mappedContact.notes || null,
          source: typedForm.webhook_config?.source_name || typedForm.name,
          status: 'new',
          pipeline_stage_id: defaultStage?.id || null
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      contactId = newContact.id;

      // Insert custom field values if any
      if (mappedContact.custom_fields && Object.keys(mappedContact.custom_fields).length > 0) {
        const customFieldInserts = [];
        
        for (const [fieldName, fieldValue] of Object.entries(mappedContact.custom_fields)) {
          // Find the custom field ID from form_fields
          const formField = typedForm.form_fields?.find(
            ff => ff.custom_fields?.field_name === fieldName
          );
          
          if (formField && fieldValue) {
            customFieldInserts.push({
              contact_id: contactId,
              custom_field_id: formField.custom_field_id,
              field_value: String(fieldValue)
            });
          }
        }

        if (customFieldInserts.length > 0) {
          await supabase
            .from('contact_custom_fields')
            .insert(customFieldInserts);
        }
      }

      // Log activity
      await supabase
        .from('contact_activities')
        .insert({
          contact_id: contactId,
          org_id: typedForm.org_id,
          activity_type: 'note',
          subject: `Webhook Lead: ${typedForm.name}`,
          description: `Lead received from ${typedForm.webhook_config?.source_name || typedForm.name} via webhook\n\nOriginal payload:\n${JSON.stringify(payload, null, 2)}`,
          completed_at: new Date().toISOString()
        });

      responseData = {
        success: true,
        message: 'Lead created successfully',
        contact_id: contactId,
        status: 'created',
        request_id: requestId,
        timestamp: new Date().toISOString()
      };
    }

    // Step 6: Log success
    await logWebhook(
      supabase,
      typedForm.id,
      typedForm.org_id,
      requestId,
      isDuplicate ? 'duplicate' : 'success',
      200,
      payload,
      null,
      clientIp,
      contactId,
      responseData
    );

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, 'Internal server error: ' + errorMessage);
  }
});

// Helper Functions

function mapFields(payload: WebhookPayload, fieldMappings: Record<string, string>): any {
  const mapped: any = {
    custom_fields: {}
  };

  // Apply field mappings from webhook_config
  for (const [incomingField, targetField] of Object.entries(fieldMappings)) {
    const value = payload[incomingField];
    if (value !== undefined && value !== null) {
      // Check if it's a custom field or standard field
      if (['first_name', 'last_name', 'email', 'phone', 'company', 'notes'].includes(targetField)) {
        mapped[targetField] = String(value).trim();
      } else {
        // It's a custom field
        mapped.custom_fields[targetField] = value;
      }
    }
  }

  // Default mappings for common fields if not already mapped
  if (!mapped.first_name && payload.name) {
    const nameParts = String(payload.name).trim().split(' ');
    mapped.first_name = nameParts[0];
    mapped.last_name = nameParts.slice(1).join(' ') || null;
  }
  if (!mapped.first_name && payload.first_name) {
    mapped.first_name = String(payload.first_name).trim();
  }
  if (!mapped.last_name && payload.last_name) {
    mapped.last_name = String(payload.last_name).trim();
  }
  if (!mapped.email && payload.email) {
    mapped.email = String(payload.email).trim().toLowerCase();
  }
  if (!mapped.phone && payload.phone) {
    mapped.phone = String(payload.phone).trim();
  }
  if (!mapped.phone && payload.mobile) {
    mapped.phone = String(payload.mobile).trim();
  }
  if (!mapped.company && payload.company) {
    mapped.company = String(payload.company).trim();
  }
  if (!mapped.company && payload.company_name) {
    mapped.company = String(payload.company_name).trim();
  }

  return mapped;
}

function validateContact(contact: any): string[] {
  const errors: string[] = [];

  // Required fields
  if (!contact.first_name || contact.first_name.trim() === '') {
    errors.push('name/first_name is required');
  }
  if (!contact.email || contact.email.trim() === '') {
    errors.push('email is required');
  }
  if (!contact.phone || contact.phone.trim() === '') {
    errors.push('phone is required');
  }

  // Email format
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('invalid email format');
  }

  // Phone format (should have at least 10 digits)
  if (contact.phone) {
    const digits = contact.phone.replace(/\D/g, '');
    if (digits.length < 10) {
      errors.push('phone number must have at least 10 digits');
    }
  }

  return errors;
}

async function logWebhook(
  supabase: any,
  formId: string | null,
  orgId: string | null,
  requestId: string,
  status: string,
  httpCode: number,
  request: any,
  errorMsg: string | null = null,
  ipAddress: string = 'unknown',
  contactId: string | null = null,
  response: any = null
) {
  if (!formId || !orgId) return; // Skip logging if we don't have required IDs

  try {
    await supabase.from('connector_logs').insert({
      form_id: formId,
      org_id: orgId,
      request_id: requestId,
      status,
      http_status_code: httpCode,
      request_payload: request,
      response_payload: response || {},
      error_message: errorMsg,
      contact_id: contactId,
      ip_address: ipAddress
    });
  } catch (e) {
    console.error('Failed to log webhook:', e);
  }
}

function errorResponse(status: number, message: string, requestId?: string, errors?: string[]) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      errors: errors,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

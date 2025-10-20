import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Automation email sender started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find scheduled executions that are due
    const now = new Date().toISOString();
    const { data: executions, error: fetchError } = await supabase
      .from('email_automation_executions')
      .select(`
        *,
        email_automation_rules(*),
        contacts(*)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(100);

    if (fetchError) throw fetchError;

    if (!executions || executions.length === 0) {
      console.log('No scheduled emails to send');
      return new Response(
        JSON.stringify({ message: 'No scheduled emails', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Processing ${executions.length} scheduled emails`);

    let sentCount = 0;
    let failedCount = 0;

    for (const execution of executions) {
      try {
        const rule = execution.email_automation_rules;
        const contact = execution.contacts;

        if (!contact?.email) {
          throw new Error('Contact has no email address');
        }

        // Get organization settings for daily limit
        const { data: orgSettings } = await supabase
          .from('organizations')
          .select('max_automation_emails_per_day')
          .eq('id', contact.org_id)
          .single();

        const maxPerDay = orgSettings?.max_automation_emails_per_day || 3;

        // 1. Check daily email limit
        const { data: canSend } = await supabase.rpc('check_and_increment_daily_limit', {
          _org_id: contact.org_id,
          _contact_id: contact.id,
          _max_per_day: maxPerDay
        });

        if (!canSend) {
          console.log(`Daily limit reached for contact ${contact.id} (${maxPerDay} emails)`);
          await supabase.from('email_automation_executions').update({ 
            status: 'failed', 
            error_message: `Daily email limit reached (${maxPerDay} emails per day)` 
          }).eq('id', execution.id);
          failedCount++;
          continue;
        }

        // 2. Check if email is unsubscribed
        const { data: isUnsubscribed } = await supabase.rpc('is_email_unsubscribed', {
          _org_id: contact.org_id,
          _email: contact.email
        });

        if (isUnsubscribed) {
          console.log(`Email ${contact.email} has unsubscribed, skipping`);
          await supabase.from('email_automation_executions').update({ 
            status: 'failed', 
            error_message: 'Recipient has unsubscribed from automation emails' 
          }).eq('id', execution.id);
          failedCount++;
          continue;
        }

        // 3. Check suppression list
        const { data: isSuppressed } = await supabase.rpc('is_email_suppressed', {
          _org_id: contact.org_id,
          _email: contact.email
        });

        if (isSuppressed) {
          console.log(`Email ${contact.email} is suppressed, skipping`);
          await supabase.from('email_automation_executions').update({ 
            status: 'failed', 
            error_message: 'Email is on suppression list' 
          }).eq('id', execution.id);
          failedCount++;
          continue;
        }

        // 4. Check business hours if enforcement enabled
        if (rule.enforce_business_hours) {
          const { data: withinHours } = await supabase.rpc('is_within_business_hours', {
            _org_id: contact.org_id,
            _check_time: new Date().toISOString()
          });

          if (!withinHours) {
            console.log(`Outside business hours, rescheduling`);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            
            await supabase.from('email_automation_executions').update({ 
              status: 'scheduled',
              scheduled_for: tomorrow.toISOString()
            }).eq('id', execution.id);
            continue;
          }
        }

        // Mark as processing
        await supabase.from('email_automation_executions').update({ status: 'pending' }).eq('id', execution.id);

        // 5. Handle A/B testing
        let templateId = execution.email_template_id;
        let subjectOverride = null;

        if (rule.ab_test_enabled) {
          const { data: abTest } = await supabase
            .from('automation_ab_tests')
            .select('*')
            .eq('rule_id', rule.id)
            .eq('status', 'active')
            .single();

          if (abTest) {
            const variants = abTest.variants as any[];
            const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
            const random = Math.random() * totalWeight;
            
            let cumulativeWeight = 0;
            for (const variant of variants) {
              cumulativeWeight += variant.weight || 0;
              if (random <= cumulativeWeight) {
                templateId = variant.template_id;
                subjectOverride = variant.subject;
                
                await supabase.from('email_automation_executions').update({
                  ab_test_id: abTest.id,
                  ab_variant_name: variant.name
                }).eq('id', execution.id);
                break;
              }
            }
          }
        }

        // Get template
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) {
          await supabase.from('email_automation_executions').update({ 
            status: 'failed', 
            error_message: 'Template not found' 
          }).eq('id', execution.id);
          failedCount++;
          continue;
        }

        // Replace variables
        const subjectTemplate = subjectOverride || template.subject;
        const personalizedSubject = await replaceVariables(
          subjectTemplate, 
          contact, 
          execution.trigger_data,
          supabase
        );
        
        // Generate unique IDs for tracking and unsubscribe
        const trackingPixelId = `${execution.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const unsubscribeToken = crypto.randomUUID();
        
        let personalizedHtml = await replaceVariables(
          template.html_content, 
          contact, 
          execution.trigger_data,
          supabase
        );

        // Add unsubscribe link (before tracking pixel)
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${unsubscribeToken}`;
        const unsubscribeLink = `
          <div style="margin: 40px 0 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
              You're receiving this email because of your interaction with our platform.<br>
              <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from automated emails
            </p>
          </div>
        `;
        personalizedHtml = personalizedHtml.replace('</body>', `${unsubscribeLink}</body>`);

        // Add tracking pixel
        const trackingPixel = `<img src="${supabaseUrl}/functions/v1/email-tracking/open?id=${trackingPixelId}" width="1" height="1" style="display:none" alt="" />`;
        personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`);
        
        // Wrap links with tracking
        personalizedHtml = personalizedHtml.replace(
          /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
          (match, attrs, url) => {
            if (url.includes('unsubscribe')) return match; // Don't track unsubscribe link
            const trackedUrl = `${supabaseUrl}/functions/v1/email-tracking/click?id=${trackingPixelId}&url=${encodeURIComponent(url)}`;
            return `<a ${attrs.replace(url, trackedUrl)}>`;
          }
        );

        // Send email via send-email function
        const { error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            to: contact.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            contactId: execution.contact_id,
            trackingPixelId: trackingPixelId,
            unsubscribeToken: unsubscribeToken,
          }
        });

        if (sendError) throw sendError;

        // Update execution status
        await supabase.from('email_automation_executions').update({ 
          status: 'sent', 
          sent_at: new Date().toISOString(),
          email_subject: personalizedSubject
        }).eq('id', execution.id);

        // Update rule stats
        await supabase.rpc('increment_automation_rule_stats', {
          _rule_id: execution.rule_id,
          _stat_type: 'sent',
        });

        // Record cooldown using atomic function
        await supabase.rpc('increment_automation_cooldown', {
          _rule_id: execution.rule_id,
          _contact_id: execution.contact_id,
          _org_id: contact.org_id
        });

        sentCount++;
        console.log(`Successfully sent email for execution ${execution.id}`);

      } catch (error: any) {
        console.error(`Failed to send email for execution ${execution.id}:`, error);
        
        // Implement retry logic
        const retryCount = execution.retry_count || 0;
        const maxRetries = execution.max_retries || 3;

        if (retryCount < maxRetries) {
          // Exponential backoff: 5min, 30min, 2hours
          const backoffMinutes = Math.pow(6, retryCount) * 5;
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);
          
          await supabase.from('email_automation_executions').update({
            status: 'scheduled',
            retry_count: retryCount + 1,
            next_retry_at: nextRetry.toISOString(),
            scheduled_for: nextRetry.toISOString(),
            error_message: `${error.message} (retry ${retryCount + 1}/${maxRetries})`
          }).eq('id', execution.id);
          
          console.log(`Scheduled retry ${retryCount + 1} at ${nextRetry}`);
        } else {
          // Max retries reached
          await supabase.from('email_automation_executions').update({ 
            status: 'failed', 
            error_message: `${error.message} (failed after ${retryCount} retries)` 
          }).eq('id', execution.id);

          await supabase.rpc('increment_automation_rule_stats', {
            _rule_id: execution.rule_id,
            _stat_type: 'failed',
          });

          failedCount++;
        }
      }
    }

    console.log(`Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        message: 'Scheduled emails processed', 
        sent: sentCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Automation email sender error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function replaceVariables(
  template: string, 
  contact: any, 
  triggerData: any,
  supabase: any
): Promise<string> {
  let result = template;
  
  // Standard contact variables
  result = result.replace(/{{first_name}}/g, contact.first_name || '');
  result = result.replace(/{{last_name}}/g, contact.last_name || '');
  result = result.replace(/{{full_name}}/g, `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there');
  result = result.replace(/{{email}}/g, contact.email || '');
  result = result.replace(/{{phone}}/g, contact.phone || '');
  result = result.replace(/{{company}}/g, contact.company || '');
  result = result.replace(/{{job_title}}/g, contact.job_title || '');
  result = result.replace(/{{city}}/g, contact.city || '');
  result = result.replace(/{{state}}/g, contact.state || '');
  result = result.replace(/{{country}}/g, contact.country || '');
  
  // Contact status and metadata
  result = result.replace(/{{status}}/g, contact.status || '');
  result = result.replace(/{{source}}/g, contact.source || '');
  
  // Dates
  if (contact.created_at) {
    const createdDate = new Date(contact.created_at);
    result = result.replace(/{{created_date}}/g, createdDate.toLocaleDateString());
    result = result.replace(/{{created_date_long}}/g, createdDate.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    }));
  }
  
  // Days since last contact
  if (contact.updated_at) {
    const daysSince = Math.floor((Date.now() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    result = result.replace(/{{days_since_last_contact}}/g, String(daysSince));
  }
  
  // Fetch and replace pipeline stage name
  if (contact.pipeline_stage_id) {
    try {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('name')
        .eq('id', contact.pipeline_stage_id)
        .single();
      result = result.replace(/{{pipeline_stage}}/g, stage?.name || '');
    } catch (e) {
      console.error('Error fetching stage:', e);
    }
  }
  
  // Fetch and replace assigned user name
  if (contact.assigned_to) {
    try {
      const { data: assignedUser } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', contact.assigned_to)
        .single();
      
      if (assignedUser) {
        result = result.replace(/{{assigned_to_name}}/g, `${assignedUser.first_name} ${assignedUser.last_name}`.trim());
        result = result.replace(/{{assigned_to_email}}/g, assignedUser.email || '');
      }
    } catch (e) {
      console.error('Error fetching assigned user:', e);
    }
  }
  
  // Fetch and replace custom fields
  try {
    const { data: customFields } = await supabase
      .from('contact_custom_fields')
      .select('custom_field_id, field_value, custom_fields(field_name)')
      .eq('contact_id', contact.id);
    
    if (customFields) {
      customFields.forEach((cf: any) => {
        const fieldName = cf.custom_fields?.field_name;
        if (fieldName) {
          const regex = new RegExp(`{{custom_field\\.${fieldName}}}`, 'g');
          result = result.replace(regex, cf.field_value || '');
        }
      });
    }
  } catch (e) {
    console.error('Error fetching custom fields:', e);
  }
  
  // Trigger-specific variables
  if (triggerData) {
    Object.keys(triggerData).forEach(key => {
      const regex = new RegExp(`{{trigger\\.${key}}}`, 'g');
      result = result.replace(regex, String(triggerData[key] || ''));
    });
    
    // Stage change specific
    if (triggerData.from_stage_id || triggerData.to_stage_id) {
      try {
        if (triggerData.from_stage_id) {
          const { data: fromStage } = await supabase
            .from('pipeline_stages')
            .select('name')
            .eq('id', triggerData.from_stage_id)
            .single();
          result = result.replace(/{{trigger\.old_stage}}/g, fromStage?.name || '');
          result = result.replace(/{{trigger\.from_stage}}/g, fromStage?.name || '');
        }
        
        if (triggerData.to_stage_id) {
          const { data: toStage } = await supabase
            .from('pipeline_stages')
            .select('name')
            .eq('id', triggerData.to_stage_id)
            .single();
          result = result.replace(/{{trigger\.new_stage}}/g, toStage?.name || '');
          result = result.replace(/{{trigger\.to_stage}}/g, toStage?.name || '');
        }
      } catch (e) {
        console.error('Error fetching stages:', e);
      }
    }
    
    // Disposition specific
    if (triggerData.disposition_id) {
      try {
        const { data: disposition } = await supabase
          .from('call_dispositions')
          .select('name, description')
          .eq('id', triggerData.disposition_id)
          .single();
        result = result.replace(/{{trigger\.disposition}}/g, disposition?.name || '');
        result = result.replace(/{{trigger\.disposition_description}}/g, disposition?.description || '');
      } catch (e) {
        console.error('Error fetching disposition:', e);
      }
    }
    
    // Activity specific
    if (triggerData.activity_type) {
      result = result.replace(/{{trigger\.activity_type}}/g, triggerData.activity_type);
    }
    
    if (triggerData.call_duration) {
      const minutes = Math.floor(triggerData.call_duration / 60);
      const seconds = triggerData.call_duration % 60;
      result = result.replace(/{{trigger\.call_duration}}/g, `${minutes}m ${seconds}s`);
      result = result.replace(/{{trigger\.call_duration_minutes}}/g, String(minutes));
    }
  }
  
  // Conditional blocks
  const ifRegex = /{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g;
  result = result.replace(ifRegex, (match, condition, content) => {
    let conditionValue = false;
    
    if (condition === 'company' && contact.company) conditionValue = true;
    else if (condition === 'job_title' && contact.job_title) conditionValue = true;
    else if (condition === 'phone' && contact.phone) conditionValue = true;
    else if (condition === 'city' && contact.city) conditionValue = true;
    
    const eqMatch = condition.match(/(\w+)\s*==\s*"([^"]+)"/);
    if (eqMatch) {
      const [, field, value] = eqMatch;
      conditionValue = contact[field] === value;
    }
    
    return conditionValue ? content : '';
  });
  
  // Handle {{else}} blocks
  const ifElseRegex = /{{#if\s+([^}]+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g;
  result = result.replace(ifElseRegex, (match, condition, trueContent, falseContent) => {
    let conditionValue = false;
    
    if (condition === 'company' && contact.company) conditionValue = true;
    else if (condition === 'job_title' && contact.job_title) conditionValue = true;
    else if (condition === 'phone' && contact.phone) conditionValue = true;
    
    const eqMatch = condition.match(/(\w+)\s*==\s*"([^"]+)"/);
    if (eqMatch) {
      const [, field, value] = eqMatch;
      conditionValue = contact[field] === value;
    }
    
    return conditionValue ? trueContent : falseContent;
  });
  
  return result;
}

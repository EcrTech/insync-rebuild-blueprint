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
        contacts(email, first_name, last_name, org_id)
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

        // 1. Check suppression list
        const { data: isSuppressed } = await supabase.rpc('is_email_suppressed', {
          _org_id: contact.org_id,
          _email: contact.email
        });

        if (isSuppressed) {
          console.log(`Email ${contact.email} is suppressed, skipping`);
          await supabase
            .from('email_automation_executions')
            .update({ 
              status: 'failed', 
              error_message: 'Email is on suppression list' 
            })
            .eq('id', execution.id);
          failedCount++;
          continue;
        }

        // 2. Check business hours if enforcement enabled
        if (rule.enforce_business_hours) {
          const { data: withinHours } = await supabase.rpc('is_within_business_hours', {
            _org_id: contact.org_id,
            _check_time: new Date().toISOString()
          });

          if (!withinHours) {
            console.log(`Outside business hours, rescheduling`);
            // Reschedule for next business day at 9 AM
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            
            await supabase
              .from('email_automation_executions')
              .update({ 
                status: 'scheduled',
                scheduled_for: tomorrow.toISOString()
              })
              .eq('id', execution.id);
            continue;
          }
        }

        // Mark as processing
        await supabase
          .from('email_automation_executions')
          .update({ status: 'pending' })
          .eq('id', execution.id);

        // 3. Handle A/B testing
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
            // Select variant based on weights
            const variants = abTest.variants as any[];
            const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
            const random = Math.random() * totalWeight;
            
            let cumulativeWeight = 0;
            for (const variant of variants) {
              cumulativeWeight += variant.weight || 0;
              if (random <= cumulativeWeight) {
                templateId = variant.template_id;
                subjectOverride = variant.subject;
                
                // Update execution with A/B test info
                await supabase
                  .from('email_automation_executions')
                  .update({
                    ab_test_id: abTest.id,
                    ab_variant_name: variant.name
                  })
                  .eq('id', execution.id);
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
          await supabase
            .from('email_automation_executions')
            .update({ 
              status: 'failed', 
              error_message: 'Template not found' 
            })
            .eq('id', execution.id);
          failedCount++;
          continue;
        }

        // Replace variables with enhanced system
        const subjectTemplate = subjectOverride || template.subject;
        const personalizedSubject = await replaceVariables(
          subjectTemplate, 
          contact, 
          execution.trigger_data,
          supabase
        );
        
        // Generate tracking ID
        const trackingPixelId = `${execution.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let personalizedHtml = await replaceVariables(
          template.html_content, 
          contact, 
          execution.trigger_data,
          supabase
        );

        // Add tracking pixel to HTML
        const trackingPixel = `<img src="${supabaseUrl}/functions/v1/email-tracking/open?id=${trackingPixelId}" width="1" height="1" style="display:none" alt="" />`;
        personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`);
        
        // Wrap links with tracking
        personalizedHtml = personalizedHtml.replace(
          /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
          (match, attrs, url) => {
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
          }
        });

        if (sendError) throw sendError;

        // Update execution status
        await supabase
          .from('email_automation_executions')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            email_subject: personalizedSubject
          })
          .eq('id', execution.id);

        // Update rule stats
        await supabase.rpc('increment_automation_rule_stats', {
          _rule_id: execution.rule_id,
          _stat_type: 'sent',
        });

        // Record/update cooldown
        const { data: existingCooldown } = await supabase
          .from('email_automation_cooldowns')
          .select('*')
          .eq('rule_id', execution.rule_id)
          .eq('contact_id', execution.contact_id)
          .single();

        if (existingCooldown) {
          await supabase
            .from('email_automation_cooldowns')
            .update({
              last_sent_at: new Date().toISOString(),
              send_count: existingCooldown.send_count + 1,
            })
            .eq('id', existingCooldown.id);
        } else {
          await supabase
            .from('email_automation_cooldowns')
            .insert({
              org_id: execution.contacts.org_id,
              rule_id: execution.rule_id,
              contact_id: execution.contact_id,
              last_sent_at: new Date().toISOString(),
              send_count: 1,
            });
        }

        sentCount++;
        console.log(`Successfully sent email for execution ${execution.id}`);

      } catch (error: any) {
        console.error(`Failed to send email for execution ${execution.id}:`, error);
        
        await supabase
          .from('email_automation_executions')
          .update({ 
            status: 'failed', 
            error_message: error.message 
          })
          .eq('id', execution.id);

        await supabase.rpc('increment_automation_rule_stats', {
          _rule_id: execution.rule_id,
          _stat_type: 'failed',
        });

        failedCount++;
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
    // Basic trigger data
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
  
  // Conditional blocks - {{#if variable}}content{{/if}}
  const ifRegex = /{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g;
  result = result.replace(ifRegex, (match, condition, content) => {
    let conditionValue = false;
    
    // Check contact fields
    if (condition === 'company' && contact.company) conditionValue = true;
    else if (condition === 'job_title' && contact.job_title) conditionValue = true;
    else if (condition === 'phone' && contact.phone) conditionValue = true;
    else if (condition === 'city' && contact.city) conditionValue = true;
    
    // Check for equality conditions (e.g., status == "active")
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

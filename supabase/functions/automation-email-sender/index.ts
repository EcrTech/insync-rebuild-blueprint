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
        // Mark as processing
        await supabase
          .from('email_automation_executions')
          .update({ status: 'pending' })
          .eq('id', execution.id);

        // Get template
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('id', execution.email_template_id)
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

        // Replace variables
        const personalizedSubject = replaceVariables(
          template.subject, 
          execution.contacts, 
          execution.trigger_data
        );
        const personalizedHtml = replaceVariables(
          template.html_content, 
          execution.contacts, 
          execution.trigger_data
        );

        // Send email via send-email function
        const { error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            to: execution.contacts.email,
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

function replaceVariables(template: string, contact: any, triggerData: any): string {
  let result = template;
  
  // Contact variables
  result = result.replace(/{{first_name}}/g, contact.first_name || '');
  result = result.replace(/{{last_name}}/g, contact.last_name || '');
  result = result.replace(/{{email}}/g, contact.email || '');
  
  // Trigger data variables
  if (triggerData) {
    Object.keys(triggerData).forEach(key => {
      const regex = new RegExp(`{{trigger\\.${key}}}`, 'g');
      result = result.replace(regex, triggerData[key] || '');
    });
  }
  
  return result;
}

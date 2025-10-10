import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string, fromEmail: string, fromName: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  return response.json();
};

interface RecipientData {
  id: string;
  campaign_id: string;
  contact_id: string;
  email: string;
  status: string;
  contacts: {
    first_name: string;
    last_name: string;
    company: string;
    phone: string;
  };
}

const replaceVariables = (
  html: string,
  contact: RecipientData["contacts"] | null,
  email: string,
  customData: any = {},
  variableMappings: any = null
) => {
  let result = html;
  
  if (variableMappings) {
    for (const [variable, mapping] of Object.entries(variableMappings)) {
      const mappingObj = mapping as any;
      let value = '';
      if (mappingObj.source === 'crm' && contact) {
        value = (contact as any)[mappingObj.field] || '';
      } else if (mappingObj.source === 'csv') {
        value = customData?.[mappingObj.field] || '';
      } else if (mappingObj.source === 'static') {
        value = mappingObj.value || '';
      }
      result = result.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
  } else {
    // Fallback to old method
    result = result
      .replace(/\{\{first_name\}\}/g, contact?.first_name || "")
      .replace(/\{\{last_name\}\}/g, contact?.last_name || "")
      .replace(/\{\{email\}\}/g, email || "")
      .replace(/\{\{company\}\}/g, contact?.company || "")
      .replace(/\{\{phone\}\}/g, contact?.phone || "");
  }
  
  return result;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId } = await req.json();

    console.log("Starting bulk email send for campaign:", campaignId);

    // Fetch campaign details with variable mappings
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("email_bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    console.log("Processing campaign:", campaign.name);

    // Get email settings and verify domain
    const { data: emailSettings, error: settingsError } = await supabaseClient
      .from("email_settings")
      .select("sending_domain, verification_status, is_active")
      .eq("org_id", campaign.org_id)
      .maybeSingle();

    if (!emailSettings || !emailSettings.is_active) {
      await supabaseClient
        .from("email_bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaignId);
      throw new Error("Email sending is not configured. Please set up your sending domain in Email Settings.");
    }

    if (emailSettings.verification_status !== "verified") {
      await supabaseClient
        .from("email_bulk_campaigns")
        .update({ status: "failed" })
        .eq("id", campaignId);
      throw new Error("Email domain is not verified. Please verify your domain in Email Settings before sending emails.");
    }

    // Get organization name
    const { data: org } = await supabaseClient
      .from("organizations")
      .select("name")
      .eq("id", campaign.org_id)
      .maybeSingle();

    const fromEmail = `noreply@${emailSettings.sending_domain}`;
    const fromName = org?.name || "Your Organization";

    console.log("Sending emails from:", fromEmail);

    // Fetch pending recipients
    const { data: recipients, error: recipientsError } = await supabaseClient
      .from("email_campaign_recipients")
      .select(`
        *,
        contacts (
          first_name,
          last_name,
          company,
          phone
        )
      `)
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .limit(100); // Process in batches of 100

    if (recipientsError) {
      throw recipientsError;
    }

    console.log(`Found ${recipients?.length || 0} pending recipients`);

    let sentCount = 0;
    let failedCount = 0;

    // Send emails
    for (const recipient of recipients || []) {
      try {
        const personalizedHtml = replaceVariables(
          campaign.html_content,
          recipient.contacts,
          recipient.email,
          recipient.custom_data || {},
          campaign.variable_mappings
        );

        const emailResult = await sendEmail(
          recipient.email,
          campaign.subject,
          personalizedHtml,
          fromEmail,
          fromName
        );

        // Log to email_conversations
        await supabaseClient.from("email_conversations").insert({
          org_id: campaign.org_id,
          contact_id: recipient.contact_id,
          conversation_id: emailResult?.id || crypto.randomUUID(),
          from_email: fromEmail,
          from_name: fromName,
          to_email: recipient.email,
          subject: campaign.subject,
          email_content: personalizedHtml,
          html_content: personalizedHtml,
          direction: "outbound",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Update recipient status to sent
        await supabaseClient
          .from("email_campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        sentCount++;
        console.log(`Email sent successfully to: ${recipient.email}`);
      } catch (error: any) {
        console.error(`Failed to send email to ${recipient.email}:`, error);

        // Update recipient status to failed
        await supabaseClient
          .from("email_campaign_recipients")
          .update({
            status: "failed",
            error_message: error.message || "Unknown error",
          })
          .eq("id", recipient.id);

        failedCount++;
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update campaign stats
    await supabaseClient.rpc("increment_email_campaign_stats", {
      p_campaign_id: campaignId,
      p_sent_increment: sentCount,
      p_failed_increment: failedCount,
      p_pending_increment: -(sentCount + failedCount),
    });

    // Check if campaign is complete
    const { data: updatedCampaign } = await supabaseClient
      .from("email_bulk_campaigns")
      .select("pending_count")
      .eq("id", campaignId)
      .single();

    if (updatedCampaign && updatedCampaign.pending_count === 0) {
      await supabaseClient
        .from("email_bulk_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    console.log(`Batch complete. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { replaceVariables } from "../_shared/templateVariables.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const BATCH_SIZE = 50; // Process 50 emails in parallel

const sendEmail = async (to: string, subject: string, html: string, fromEmail: string, fromName: string, unsubscribeUrl: string) => {
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
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = getSupabaseClient();
    const { campaignId } = await req.json();

    console.log('[send-bulk-email] ===== START =====');
    console.log('[send-bulk-email] Campaign ID:', campaignId);
    console.log('[send-bulk-email] Timestamp:', new Date().toISOString());

    // Fetch campaign details with variable mappings
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("email_bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    console.log('[send-bulk-email] Campaign:', campaign.campaign_name || campaign.name);
    console.log('[send-bulk-email] Status:', campaign.status);

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

    console.log('[send-bulk-email] From:', fromEmail);
    console.log('[send-bulk-email] From Name:', fromName);

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

    console.log(`[send-bulk-email] Found ${recipients?.length || 0} pending recipients`);

    let sentCount = 0;
    let failedCount = 0;

    // Process emails in batches for better performance
    console.log(`[send-bulk-email] Processing ${recipients?.length || 0} recipients in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < (recipients?.length || 0); i += BATCH_SIZE) {
      const batch = recipients!.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(recipients!.length / BATCH_SIZE);
      console.log(`[send-bulk-email] === Batch ${batchNum}/${totalBatches} ===`);

      // Process batch in parallel using Promise.allSettled
      const batchResults = await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            // Add attachments first if present
            let attachmentsHtml = '';
            if (campaign.attachments && campaign.attachments.length > 0) {
              attachmentsHtml = campaign.attachments.map((att: any) => {
                if (att.type === 'image') {
                  return `<div style="margin: 20px 0;"><img src="${att.url}" alt="${att.name}" style="max-width: 100%; height: auto; display: block; border-radius: 8px;" /></div>`;
                } else if (att.type === 'video') {
                  return `<div style="margin: 20px 0;"><video controls style="max-width: 100%; display: block; border-radius: 8px;"><source src="${att.url}" type="video/mp4" /></video></div>`;
                }
                return '';
              }).join('');
            }

            // Use body_content if available (new templates), otherwise fall back to html_content (old templates)
            const templateContent = campaign.body_content || campaign.html_content;
            let personalizedHtml = await replaceVariables(
              templateContent,
              recipient.contacts,
              recipient.custom_data || {},
              supabaseClient,
              campaign.variable_mappings
            );

            // Add CTA buttons if present
            if (campaign.buttons && campaign.buttons.length > 0) {
              // Generate tracking pixel ID for this recipient
              const trackingPixelId = `${recipient.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const supabaseUrl = Deno.env.get('SUPABASE_URL');
              
              const buttonsHtml = await Promise.all(campaign.buttons.map(async (btn: any) => {
                const buttonUrl = await replaceVariables(
                  btn.url,
                  recipient.contacts,
                  recipient.custom_data || {},
                  supabaseClient,
                  campaign.variable_mappings
                );
                
                // Wrap CTA button URL through tracking endpoint
                const trackedUrl = `${supabaseUrl}/functions/v1/email-tracking/cta-click?id=${trackingPixelId}&button_id=${btn.id}&button_text=${encodeURIComponent(btn.text)}&url=${encodeURIComponent(buttonUrl)}`;
                
                const styles: Record<string, string> = {
                  primary: 'background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; font-weight: 500;',
                  secondary: 'background: #6b7280; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; font-weight: 500;',
                  outline: 'background: transparent; color: #2563eb; border: 2px solid #2563eb; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 5px; font-weight: 500;'
                };
                const btnStyle = styles[btn.style] || styles.primary;
                return `
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 20px auto;">
                    <tr>
                      <td style="border-radius: 6px; text-align: center;">
                        <a href="${trackedUrl}" style="${btnStyle}">
                          ${btn.text}
                        </a>
                      </td>
                    </tr>
                  </table>
                `;
              }));
              personalizedHtml += buttonsHtml.join('');
              
              // Store tracking pixel ID for later use in email_conversations
              (recipient as any).trackingPixelId = trackingPixelId;
            }

            // Prepend attachments before content
            personalizedHtml = attachmentsHtml + personalizedHtml;

            // Generate unique unsubscribe token for this recipient
            const unsubscribeToken = crypto.randomUUID();
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${unsubscribeToken}`;

            // Add unsubscribe footer
            const unsubscribeFooter = `
              <div style="margin: 40px 0 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                  You're receiving this email as part of a campaign.<br>
                  <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from marketing emails
                </p>
              </div>
            `;

            // Wrap in email template
            personalizedHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${personalizedHtml}
                  ${unsubscribeFooter}
                </body>
              </html>
            `;

            // Replace variables in subject line
            const personalizedSubject = await replaceVariables(
              campaign.subject,
              recipient.contacts,
              recipient.custom_data || {},
              supabaseClient,
              campaign.variable_mappings
            );

            const emailResult = await sendEmail(
              recipient.email,
              personalizedSubject,
              personalizedHtml,
              fromEmail,
              fromName,
              unsubscribeUrl
            );

            return {
              success: true,
              recipientId: recipient.id,
              contactId: recipient.contact_id,
              email: recipient.email,
              subject: personalizedSubject,
              html: personalizedHtml,
              emailResult,
              unsubscribeToken,
              trackingPixelId: (recipient as any).trackingPixelId
            };
          } catch (error: any) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
            return {
              success: false,
              recipientId: recipient.id,
              email: recipient.email,
              error: error.message || "Unknown error"
            };
          }
        })
      );

      // Separate successful and failed results
      const successfulResults = batchResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value);
      
      const failedResults = batchResults
        .filter((r): r is PromiseFulfilledResult<any> | PromiseRejectedResult => 
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
        )
        .map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason });

      // Bulk insert to email_conversations for successful sends
      if (successfulResults.length > 0) {
        const conversationsToInsert = successfulResults.map(result => ({
          org_id: campaign.org_id,
          contact_id: result.contactId,
          conversation_id: result.emailResult?.id || crypto.randomUUID(),
          from_email: fromEmail,
          from_name: fromName,
          to_email: result.email,
          subject: result.subject,
          email_content: result.html,
          html_content: result.html,
          direction: "outbound",
          status: "sent",
          sent_at: new Date().toISOString(),
          unsubscribe_token: result.unsubscribeToken,
          tracking_pixel_id: result.trackingPixelId,
        }));

        const { error: conversationsError } = await supabaseClient
          .from("email_conversations")
          .insert(conversationsToInsert);

        if (conversationsError) {
          console.error('[send-bulk-email] Error inserting email conversations:', conversationsError);
        } else {
          console.log(`[send-bulk-email] Inserted ${conversationsToInsert.length} email conversation records`);
        }
      }

      // Bulk update recipient statuses
      const statusUpdates = [
        ...successfulResults.map(r => ({
          id: r.recipientId,
          status: "sent",
          sent_at: new Date().toISOString(),
        })),
        ...failedResults.map((r: any) => ({
          id: r.recipientId,
          status: "failed",
          error_message: r.error,
        }))
      ];

      if (statusUpdates.length > 0) {
        const { error: upsertError } = await supabaseClient
          .from("email_campaign_recipients")
          .upsert(statusUpdates, { onConflict: 'id' });
        
        if (upsertError) {
          console.error('[send-bulk-email] Error updating recipient statuses:', upsertError);
          console.error('[send-bulk-email] Failed updates:', JSON.stringify(statusUpdates, null, 2));
        } else {
          console.log(`[send-bulk-email] Updated ${statusUpdates.length} recipient statuses (${successfulResults.length} sent, ${failedResults.length} failed)`);
        }
      }

      sentCount += successfulResults.length;
      failedCount += failedResults.length;

      console.log(`[send-bulk-email] Batch complete. Sent: ${successfulResults.length}, Failed: ${failedResults.length}`);
    }

    // Update campaign stats
    console.log(`[send-bulk-email] Updating campaign stats: sent=${sentCount}, failed=${failedCount}, pending=${-(sentCount + failedCount)}`);
    const { error: rpcError } = await supabaseClient.rpc("increment_email_campaign_stats", {
      p_campaign_id: campaignId,
      p_sent_increment: sentCount,
      p_failed_increment: failedCount,
      p_pending_increment: -(sentCount + failedCount),
    });

    if (rpcError) {
      console.error('[send-bulk-email] Error updating campaign stats:', rpcError);
    } else {
      console.log('[send-bulk-email] Campaign stats updated successfully');
    }

    // Check if campaign is complete
    const { data: updatedCampaign } = await supabaseClient
      .from("email_bulk_campaigns")
      .select("pending_count")
      .eq("id", campaignId)
      .single();

    if (updatedCampaign && updatedCampaign.pending_count === 0) {
      console.log('[send-bulk-email] All recipients processed, marking campaign as completed');
      const { error: completeError } = await supabaseClient
        .from("email_bulk_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      
      if (completeError) {
        console.error('[send-bulk-email] Error marking campaign complete:', completeError);
      }
    } else {
      console.log(`[send-bulk-email] Campaign has ${updatedCampaign?.pending_count || 0} recipients still pending`);
    }

    console.log('[send-bulk-email] ===== COMPLETE =====');
    console.log(`[send-bulk-email] Total Sent: ${sentCount}, Total Failed: ${failedCount}`);

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

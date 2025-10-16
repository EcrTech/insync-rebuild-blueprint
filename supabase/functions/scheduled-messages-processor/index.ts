import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting scheduled messages processor...');

    // Find due email campaigns
    const { data: emailCampaigns, error: emailCampaignsError } = await supabaseClient
      .from('email_bulk_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (emailCampaignsError) {
      console.error('Error fetching email campaigns:', emailCampaignsError);
    } else if (emailCampaigns && emailCampaigns.length > 0) {
      console.log(`Found ${emailCampaigns.length} due email campaigns`);
      
      for (const campaign of emailCampaigns) {
        console.log(`Processing email campaign: ${campaign.id}`);
        
        // Update status to sending
        await supabaseClient
          .from('email_bulk_campaigns')
          .update({ 
            status: 'sending', 
            started_at: new Date().toISOString() 
          })
          .eq('id', campaign.id);

        // Invoke send-bulk-email function
        const { error: invokeError } = await supabaseClient.functions.invoke('send-bulk-email', {
          body: { campaignId: campaign.id },
        });

        if (invokeError) {
          console.error(`Error invoking send-bulk-email for campaign ${campaign.id}:`, invokeError);
        } else {
          console.log(`Successfully triggered send-bulk-email for campaign ${campaign.id}`);
        }
      }
    }

    // Find due WhatsApp campaigns
    const { data: whatsappCampaigns, error: whatsappCampaignsError } = await supabaseClient
      .from('whatsapp_bulk_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (whatsappCampaignsError) {
      console.error('Error fetching WhatsApp campaigns:', whatsappCampaignsError);
    } else if (whatsappCampaigns && whatsappCampaigns.length > 0) {
      console.log(`Found ${whatsappCampaigns.length} due WhatsApp campaigns`);
      
      for (const campaign of whatsappCampaigns) {
        console.log(`Processing WhatsApp campaign: ${campaign.id}`);
        
        // Update status to processing
        await supabaseClient
          .from('whatsapp_bulk_campaigns')
          .update({ 
            status: 'processing', 
            started_at: new Date().toISOString() 
          })
          .eq('id', campaign.id);

        // Invoke bulk-whatsapp-sender function
        const { error: invokeError } = await supabaseClient.functions.invoke('bulk-whatsapp-sender', {
          body: { campaignId: campaign.id, skip_rate_limit: true },
        });

        if (invokeError) {
          console.error(`Error invoking bulk-whatsapp-sender for campaign ${campaign.id}:`, invokeError);
        } else {
          console.log(`Successfully triggered bulk-whatsapp-sender for campaign ${campaign.id}`);
        }
      }
    }

    // Find due individual email conversations
    const { data: emailConversations, error: emailConversationsError } = await supabaseClient
      .from('email_conversations')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (emailConversationsError) {
      console.error('Error fetching email conversations:', emailConversationsError);
    } else if (emailConversations && emailConversations.length > 0) {
      console.log(`Found ${emailConversations.length} due email conversations`);
      
      for (const email of emailConversations) {
        console.log(`Processing scheduled email: ${email.id}`);
        
        // Update status to pending
        await supabaseClient
          .from('email_conversations')
          .update({ status: 'pending' })
          .eq('id', email.id);

        // Invoke send-email function
        const { error: invokeError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: email.to_email,
            subject: email.subject,
            htmlContent: email.html_content || email.email_content,
            contactId: email.contact_id,
          },
        });

        if (invokeError) {
          console.error(`Error sending scheduled email ${email.id}:`, invokeError);
          // Mark as failed
          await supabaseClient
            .from('email_conversations')
            .update({ status: 'failed' })
            .eq('id', email.id);
        } else {
          console.log(`Successfully sent scheduled email ${email.id}`);
        }
      }
    }

    // Find due individual WhatsApp messages
    const { data: whatsappMessages, error: whatsappMessagesError } = await supabaseClient
      .from('whatsapp_messages')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (whatsappMessagesError) {
      console.error('Error fetching WhatsApp messages:', whatsappMessagesError);
    } else if (whatsappMessages && whatsappMessages.length > 0) {
      console.log(`Found ${whatsappMessages.length} due WhatsApp messages`);
      
      for (const message of whatsappMessages) {
        console.log(`Processing scheduled WhatsApp message: ${message.id}`);
        
        // Update status to pending
        await supabaseClient
          .from('whatsapp_messages')
          .update({ status: 'pending' })
          .eq('id', message.id);

        // Invoke send-whatsapp-message function
        const payload: any = {
          contactId: message.contact_id,
          phoneNumber: message.phone_number.replace(/[^\d]/g, ''),
        };

        if (message.template_id) {
          payload.templateId = message.template_id;
          payload.templateVariables = {};
        } else {
          payload.message = message.message_content;
        }

        const { error: invokeError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
          body: payload,
        });

        if (invokeError) {
          console.error(`Error sending scheduled WhatsApp message ${message.id}:`, invokeError);
          // Mark as failed
          await supabaseClient
            .from('whatsapp_messages')
            .update({ status: 'failed' })
            .eq('id', message.id);
        } else {
          console.log(`Successfully sent scheduled WhatsApp message ${message.id}`);
        }
      }
    }

    console.log('Scheduled messages processor completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        processed: {
          emailCampaigns: emailCampaigns?.length || 0,
          whatsappCampaigns: whatsappCampaigns?.length || 0,
          emailConversations: emailConversations?.length || 0,
          whatsappMessages: whatsappMessages?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in scheduled-messages-processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

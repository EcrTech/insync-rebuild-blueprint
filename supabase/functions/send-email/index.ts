import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string, fromEmail: string, fromName: string, replyToEmail?: string) => {
  const emailPayload: any = {
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: subject,
    html: html,
  };
  
  // Add reply_to if provided and different from sender
  if (replyToEmail && replyToEmail !== fromEmail) {
    emailPayload.reply_to = [replyToEmail];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  return response.json();
};

interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent?: string;
  html?: string;
  contactId?: string;
  conversationId?: string;
  trackingPixelId?: string;
  unsubscribeToken?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== send-email Request Started ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());

    // Check for Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log('Auth Header Status:', {
      present: !!authHeader,
      preview: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING',
      length: authHeader?.length || 0
    });

    if (!authHeader) {
      throw new Error('No Authorization header provided');
    }

    // Extract JWT token (remove "Bearer " prefix)
    const token = authHeader.replace('Bearer ', '');
    console.log('Extracted JWT token (length):', token.length);

    // Create Supabase client
    console.log('Creating Supabase client with ANON_KEY...');
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );
    console.log('✓ Supabase client created successfully');

    // Authenticate user by passing token directly to getUser()
    console.log('Attempting user authentication with JWT token...');
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    console.log('User Auth Result:', {
      success: !!user,
      userId: user?.id || 'N/A',
      userEmail: user?.email || 'N/A',
      hasError: !!authError,
      errorCode: authError?.code || 'N/A',
      errorMessage: authError?.message || 'N/A',
      errorStatus: authError?.status || 'N/A',
    });

    if (authError) {
      console.error('Auth Error Details:', JSON.stringify(authError, null, 2));
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      throw new Error('No user found in session');
    }

    console.log('✓ User authenticated:', user.email);

    const { 
      to, 
      subject, 
      htmlContent, 
      html, 
      contactId, 
      conversationId,
      trackingPixelId,
      unsubscribeToken 
    }: SendEmailRequest = await req.json();

    const emailHtml = htmlContent || html || '';

    if (!emailHtml) {
      throw new Error('Email content is required');
    }

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("org_id, first_name, last_name")
      .eq("id", user.id)
      .single();

    console.log('Profile Lookup Result:', {
      found: !!profile,
      orgId: profile?.org_id || 'N/A',
      hasError: !!profileError,
      errorMessage: profileError?.message || 'N/A'
    });

    if (profileError) {
      console.error('Profile Error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile?.org_id) {
      throw new Error("User organization not found");
    }

    console.log('✓ Organization verified:', profile.org_id);

    // Get email settings and verify domain
    const { data: emailSettings, error: settingsError } = await supabaseClient
      .from("email_settings")
      .select("sending_domain, verification_status, is_active, resend_domain_id")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    if (!emailSettings || !emailSettings.is_active) {
      throw new Error("Email sending is not configured. Please set up your sending domain in Email Settings.");
    }

    if (emailSettings.verification_status !== "verified") {
      throw new Error("Email domain verification pending. Please go to Email Settings and click 'Verify Domain' to complete verification.");
    }

    // Double-check domain status with Resend API to avoid stale data issues
    console.log('Checking domain status with Resend API...');
    const domainCheckResponse = await fetch(
      `https://api.resend.com/domains/${emailSettings.resend_domain_id}`,
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
      }
    );

    if (domainCheckResponse.ok) {
      const domainStatus = await domainCheckResponse.json();
      console.log('Current Resend domain status:', domainStatus.status);
      
      if (domainStatus.status !== 'verified') {
        // Update database with actual status
        await supabaseClient
          .from('email_settings')
          .update({ verification_status: 'pending' })
          .eq('org_id', profile.org_id);
        
        throw new Error(`Domain verification incomplete. Status: ${domainStatus.status}. Please verify all DNS records in Email Settings.`);
      }
    }

    // Use verified domain as sender, user's email as reply-to
    const fromEmail = `noreply@${emailSettings.sending_domain}`;
    const replyToEmail = user.email || fromEmail;
    const fromName = profile.first_name 
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : (user.email || "User");

    console.log("Sending email to:", to, "from:", fromEmail, "reply-to:", replyToEmail);

    // Send email via Resend
    const emailData = await sendEmail(to, subject, emailHtml, fromEmail, fromName, replyToEmail);

    console.log("Email sent successfully:", emailData);

    // Use shared service role client for wallet deduction
    const supabaseServiceClient = getSupabaseClient();

    // Deduct email cost from wallet
    const { data: deductResult, error: deductError } = await supabaseServiceClient.rpc('deduct_from_wallet', {
      _org_id: profile.org_id,
      _amount: 0.10, // Get from pricing
      _service_type: 'email',
      _reference_id: null, // Will be updated after logging
      _quantity: 1,
      _unit_cost: 0.10,
      _user_id: user.id
    });

    if (deductError || !deductResult?.success) {
      console.warn('Wallet deduction failed:', deductError || deductResult);
      // Email was sent, but wallet deduction failed - log but don't fail the request
    }

    // Log email to email_conversations table
    const { error: logError } = await supabaseClient
      .from("email_conversations")
      .insert({
        org_id: profile.org_id,
        contact_id: contactId,
        conversation_id: conversationId || emailData?.id || crypto.randomUUID(),
        from_email: fromEmail,
        from_name: fromName,
        to_email: to,
        reply_to_email: replyToEmail,
        subject: subject,
        email_content: emailHtml,
        html_content: emailHtml,
        direction: "outbound",
        sent_by: user.id,
        status: "sent",
        sent_at: new Date().toISOString(),
        tracking_pixel_id: trackingPixelId,
        unsubscribe_token: unsubscribeToken,
      });

    if (logError) {
      console.error("Error logging email:", logError);
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData?.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('=== send-email Error ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: error.message.includes('Unauthorized') || error.message.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

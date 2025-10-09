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

interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  contactId?: string;
  conversationId?: string;
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
          persistSession: false, // Critical for edge functions
        },
      }
    );
    console.log('✓ Supabase client created successfully');

    // Authenticate user
    console.log('Attempting user authentication...');
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

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

    const { to, subject, htmlContent, contactId, conversationId }: SendEmailRequest = await req.json();

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("org_id")
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
      .select("sending_domain, verification_status, is_active")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    if (!emailSettings || !emailSettings.is_active) {
      throw new Error("Email sending is not configured. Please set up your sending domain in Email Settings.");
    }

    if (emailSettings.verification_status !== "verified") {
      throw new Error("Email domain is not verified. Please verify your domain in Email Settings before sending emails.");
    }

    // Get organization name
    const { data: org } = await supabaseClient
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle();

    const fromEmail = `noreply@${emailSettings.sending_domain}`;
    const fromName = org?.name || "Your Organization";

    console.log("Sending email to:", to, "from:", fromEmail);

    // Send email via Resend
    const emailData = await sendEmail(to, subject, htmlContent, fromEmail, fromName);

    console.log("Email sent successfully:", emailData);

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
        subject: subject,
        email_content: htmlContent,
        html_content: htmlContent,
        direction: "outbound",
        sent_by: user.id,
        status: "sent",
        sent_at: new Date().toISOString(),
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

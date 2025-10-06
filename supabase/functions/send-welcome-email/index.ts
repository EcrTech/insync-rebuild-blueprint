import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Welcome email function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, password, role }: WelcomeEmailRequest = await req.json();
    console.log("Sending welcome email to:", email);

    const emailResponse = await resend.emails.send({
      from: "In-Sync <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to In-Sync - Your Account Details",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #01B8AA 0%, #168980 100%);
                color: white;
                padding: 30px;
                border-radius: 8px 8px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-top: none;
                border-radius: 0 0 8px 8px;
              }
              .credentials-box {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
              }
              .credential-item {
                margin: 10px 0;
              }
              .credential-label {
                font-weight: 600;
                color: #6b7280;
                font-size: 14px;
              }
              .credential-value {
                font-size: 16px;
                color: #111827;
                font-family: 'Courier New', monospace;
                background: white;
                padding: 8px 12px;
                border-radius: 4px;
                margin-top: 4px;
                display: inline-block;
              }
              .cta-button {
                display: inline-block;
                background: #01B8AA;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                color: #6b7280;
                font-size: 14px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
              }
              .warning {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 32px;">Welcome to In-Sync!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.95;">Your CRM account is ready</p>
            </div>
            
            <div class="content">
              <h2>Hello ${firstName} ${lastName},</h2>
              
              <p>Your In-Sync CRM account has been created successfully! You have been assigned the role of <strong>${role.replace('_', ' ')}</strong>.</p>
              
              <div class="credentials-box">
                <h3 style="margin-top: 0;">Your Login Credentials</h3>
                
                <div class="credential-item">
                  <div class="credential-label">Email Address</div>
                  <div class="credential-value">${email}</div>
                </div>
                
                <div class="credential-item">
                  <div class="credential-label">Temporary Password</div>
                  <div class="credential-value">${password}</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> For security reasons, please change your password after your first login.
              </div>
              
              <div style="text-align: center;">
                <a href="${Deno.env.get('VITE_SUPABASE_URL')?.replace('/supabase', '')}/login" class="cta-button">
                  Sign In to In-Sync
                </a>
              </div>
              
              <h3>Getting Started</h3>
              <ul>
                <li>Sign in using your credentials above</li>
                <li>Complete your profile information</li>
                <li>Explore the dashboard and features</li>
                <li>Change your password in settings</li>
              </ul>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact your administrator.</p>
              
              <div class="footer">
                <p>© 2025 In-Sync. All rights reserved.</p>
                <p style="margin-top: 10px; font-size: 12px;">
                  This email contains sensitive information. Please keep it secure.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

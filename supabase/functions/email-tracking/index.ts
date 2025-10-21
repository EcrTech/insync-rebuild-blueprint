import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent pixel
const TRACKING_PIXEL = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
), (c) => c.charCodeAt(0));

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");
  const action = url.pathname.includes("/click") ? "click" : "open";

  if (!trackingId) {
    return new Response("Invalid tracking ID", { status: 400 });
  }

  try {
    // Look up the email conversation
    const { data: conversation, error: lookupError } = await supabase
      .from("email_conversations")
      .select("id, open_count, click_count, opened_at, first_clicked_at")
      .eq("tracking_pixel_id", trackingId)
      .single();

    if (lookupError || !conversation) {
      console.error("Tracking lookup error:", lookupError);
      // Still return the pixel/redirect to avoid broken images
      if (action === "open") {
        return new Response(TRACKING_PIXEL, {
          headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
        });
      }
      return new Response(null, { status: 302, headers: { Location: "/" } });
    }

    // Update tracking data
    if (action === "open") {
      const updates: any = {
        open_count: (conversation.open_count || 0) + 1,
      };

      if (!conversation.opened_at) {
        updates.opened_at = new Date().toISOString();
      }

      await supabase
        .from("email_conversations")
        .update(updates)
        .eq("id", conversation.id);

      // Return tracking pixel
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
      });
    } else if (action === "click") {
      const targetUrl = url.searchParams.get("url") || "/";
      
      const updates: any = {
        click_count: (conversation.click_count || 0) + 1,
      };

      if (!conversation.first_clicked_at) {
        updates.first_clicked_at = new Date().toISOString();
      }

      await supabase
        .from("email_conversations")
        .update(updates)
        .eq("id", conversation.id);

      // Redirect to target URL
      return new Response(null, {
        status: 302,
        headers: { Location: decodeURIComponent(targetUrl) },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Tracking error:", error);
    
    // Return pixel/redirect even on error to avoid broken images/links
    if (action === "open") {
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
      });
    }
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }
});

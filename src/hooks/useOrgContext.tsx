import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOrgContext() {
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const loadOrgContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's actual org
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id, is_platform_admin")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserOrgId(profile.org_id);
        setIsPlatformAdmin(profile.is_platform_admin || false);

        // Check for impersonation
        const impersonationData = sessionStorage.getItem("platform_admin_impersonation");
        if (impersonationData && profile.is_platform_admin) {
          const { org_id } = JSON.parse(impersonationData);
          setEffectiveOrgId(org_id);
          setIsImpersonating(true);
        } else {
          setEffectiveOrgId(profile.org_id);
          setIsImpersonating(false);
        }
      }
    };

    loadOrgContext();

    // Listen for storage changes (when impersonation changes)
    const handleStorageChange = () => {
      loadOrgContext();
    };

    window.addEventListener("storage", handleStorageChange);
    // Also check periodically for same-tab changes
    const interval = setInterval(loadOrgContext, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return {
    userOrgId,
    effectiveOrgId,
    isPlatformAdmin,
    isImpersonating,
  };
}

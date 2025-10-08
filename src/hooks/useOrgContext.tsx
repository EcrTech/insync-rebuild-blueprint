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

    // Listen for custom events for org context changes
    const handleOrgContextChange = () => {
      loadOrgContext();
    };

    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "platform_admin_impersonation") {
        loadOrgContext();
      }
    };

    window.addEventListener("orgContextChange", handleOrgContextChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("orgContextChange", handleOrgContextChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return {
    userOrgId,
    effectiveOrgId,
    isPlatformAdmin,
    isImpersonating,
  };
}

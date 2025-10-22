import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ORG_CONTEXT_CACHE_KEY = "org_context_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedOrgContext {
  userOrgId: string;
  isPlatformAdmin: boolean;
  timestamp: number;
}

/**
 * Organization context hook for multi-tenant applications
 * 
 * Manages user's organization context, platform admin status, and impersonation.
 * Automatically listens for context changes via storage and custom events.
 * Uses localStorage caching with 1-hour TTL to reduce database queries.
 * 
 * @returns Organization context state
 * @property {string | null} userOrgId - User's actual organization ID
 * @property {string | null} effectiveOrgId - Active org ID (considers impersonation)
 * @property {boolean | null} isPlatformAdmin - Whether user has platform admin privileges
 * @property {boolean} isImpersonating - Whether admin is impersonating another org
 * @property {boolean} isLoading - Loading state during context initialization
 * 
 * @example
 * ```tsx
 * const { effectiveOrgId, isPlatformAdmin } = useOrgContext();
 * if (!effectiveOrgId) return <LoadingState />;
 * ```
 * 
 * @see {@link setImpersonation} For admin impersonation
 * @see {@link clearImpersonation} To exit impersonation mode
 */
export function useOrgContext() {
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrgContext = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Try to get cached org context
      let profile: { org_id: string; is_platform_admin: boolean } | null = null;
      const cached = localStorage.getItem(ORG_CONTEXT_CACHE_KEY);
      
      if (cached) {
        try {
          const cachedData: CachedOrgContext = JSON.parse(cached);
          const now = Date.now();
          
          // Use cache if it's still valid (within TTL)
          if (now - cachedData.timestamp < CACHE_TTL) {
            profile = {
              org_id: cachedData.userOrgId,
              is_platform_admin: cachedData.isPlatformAdmin
            };
          }
        } catch (e) {
          // Invalid cache, will fetch from database
          localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        }
      }

      // Fetch from database if no valid cache
      if (!profile) {
        const { data } = await supabase
          .from("profiles")
          .select("org_id, is_platform_admin")
          .eq("id", user.id)
          .single();
        
        profile = data;
        
        // Cache the result
        if (profile) {
          const cacheData: CachedOrgContext = {
            userOrgId: profile.org_id,
            isPlatformAdmin: profile.is_platform_admin || false,
            timestamp: Date.now()
          };
          localStorage.setItem(ORG_CONTEXT_CACHE_KEY, JSON.stringify(cacheData));
        }
      }

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
      setIsLoading(false);
    };

    loadOrgContext();

    // Listen for custom events for org context changes
    const handleOrgContextChange = () => {
      // Clear cache on context change
      localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
      loadOrgContext();
    };

    // Listen for storage changes (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "platform_admin_impersonation") {
        loadOrgContext();
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Clear cache on login/token refresh
        localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        loadOrgContext();
      } else if (event === 'SIGNED_OUT') {
        // Clear cache on logout
        localStorage.removeItem(ORG_CONTEXT_CACHE_KEY);
        setUserOrgId(null);
        setEffectiveOrgId(null);
        setIsPlatformAdmin(null);
        setIsImpersonating(false);
      }
    });

    window.addEventListener("orgContextChange", handleOrgContextChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("orgContextChange", handleOrgContextChange);
      window.removeEventListener("storage", handleStorageChange);
      subscription.unsubscribe();
    };
  }, []);

  return {
    userOrgId,
    effectiveOrgId,
    isPlatformAdmin,
    isImpersonating,
    isLoading,
  };
}

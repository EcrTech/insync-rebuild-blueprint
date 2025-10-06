import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "admin" | "sales_manager" | "sales_agent" | "support_manager" | "support_agent" | "analyst";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log("ProtectedRoute - Initial session check:", session ? "Session exists" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
      setInitialCheckDone(true);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        console.log("ProtectedRoute - Auth state change:", event, session ? "Session exists" : "No session");
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Don't check access until initial session check is complete
    if (!initialCheckDone) {
      return;
    }

    const checkAccess = async () => {
      // Check session instead of user to avoid timing issues
      if (!session?.user) {
        console.log("ProtectedRoute - No session user, access denied");
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      console.log("ProtectedRoute - User exists:", currentUser.id, "Required role:", requiredRole);

      if (!requiredRole) {
        console.log("ProtectedRoute - No role required, access granted");
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Check if user has required role
      console.log("ProtectedRoute - Checking user role...");
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      console.log("ProtectedRoute - Role check result:", { data, error });

      if (error) {
        console.error("ProtectedRoute - Error checking role:", error);
        setHasAccess(false);
      } else if (!data) {
        console.log("ProtectedRoute - No role found for user, access denied");
        setHasAccess(false);
      } else {
        // Super admin has access to everything
        if (data.role === "super_admin") {
          console.log("ProtectedRoute - Super admin access granted");
          setHasAccess(true);
        } else {
          const hasRole = data.role === requiredRole;
          console.log("ProtectedRoute - Role check:", data.role, "vs", requiredRole, "=", hasRole);
          setHasAccess(hasRole);
        }
      }
      setLoading(false);
    };

    checkAccess();
  }, [session, requiredRole, initialCheckDone]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session || !user) {
    console.log("ProtectedRoute - Redirecting to login");
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasAccess) {
    console.log("ProtectedRoute - Access denied, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  console.log("ProtectedRoute - Access granted, rendering children");

  return <>{children}</>;
}

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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("ProtectedRoute - Auth state change:", event, session ? "Session exists" : "No session");
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("ProtectedRoute - Initial session check:", session ? "Session exists" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
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
        .single();

      console.log("ProtectedRoute - Role check result:", { data, error });

      if (error || !data) {
        console.log("ProtectedRoute - No role found or error, access denied");
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
  }, [session, requiredRole]);

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

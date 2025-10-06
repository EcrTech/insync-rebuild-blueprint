import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setUserName(`${profileData.first_name} ${profileData.last_name}`);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out",
    });
    navigate("/login");
  };

  const isAdmin = userRole === "admin" || userRole === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">In-Sync</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X /> : <Menu />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 bg-card border-r border-border
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-border">
              <h1 className="text-2xl font-bold text-primary">In-Sync</h1>
              <p className="text-sm text-muted-foreground mt-1">{userName}</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/contacts"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <Users size={20} />
                <span>Contacts</span>
              </Link>

              <Link
                to="/pipeline"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <LayoutDashboard size={20} />
                <span>Pipeline</span>
              </Link>

              {(userRole === "admin" || userRole === "super_admin" || userRole === "sales_manager" || userRole === "support_manager") && (
                <>
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Management
                    </p>
                  </div>
                  <Link
                    to="/users"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Users size={20} />
                    <span>Users</span>
                  </Link>
                  <Link
                    to="/teams"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Users size={20} />
                    <span>Teams</span>
                  </Link>
                </>
              )}

              {isAdmin && (
                <>
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Admin
                    </p>
                  </div>
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Settings size={20} />
                    <span>Organization Settings</span>
                  </Link>
                  <Link
                    to="/admin/pipeline-stages"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Settings size={20} />
                    <span>Pipeline Stages</span>
                  </Link>
                  <Link
                    to="/admin/call-dispositions"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Settings size={20} />
                    <span>Call Dispositions</span>
                  </Link>
                </>
              )}
            </nav>

            {/* Sign out */}
            <div className="p-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut size={20} className="mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// Also export as named export for compatibility
export { DashboardLayout };

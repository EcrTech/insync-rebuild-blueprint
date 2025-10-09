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
  Contact,
  GitBranch,
  BarChart3,
  Network,
  UserCog,
  TrendingUp,
  Lightbulb,
  UsersRound,
  Layers,
  PhoneCall,
  CheckSquare,
  Award,
  FileText,
  List,
  Sliders,
  ShieldCheck,
  Building2,
  Webhook,
  MessageSquare,
  Mail,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformAdminBanner } from "@/components/PlatformAdminBanner";
import { OnboardingDialog } from "@/components/Onboarding/OnboardingDialog";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [orgLogo, setOrgLogo] = useState<string>("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // PERFORMANCE: Batch all queries together
      const [roleRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("first_name, last_name, org_id, is_platform_admin, onboarding_completed")
          .eq("id", user.id)
          .single()
      ]);

      if (roleRes.data) {
        setUserRole(roleRes.data.role);
      }

      if (profileRes.data) {
        setUserName(`${profileRes.data.first_name} ${profileRes.data.last_name}`);
        setIsPlatformAdmin(profileRes.data.is_platform_admin || false);
        
        // Check if user needs onboarding
        if (!profileRes.data.onboarding_completed && roleRes.data?.role) {
          setShowOnboarding(true);
        }
        setOnboardingChecked(true);
        
        // Get organization logo (only if org_id exists)
        if (profileRes.data.org_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("logo_url")
            .eq("id", profileRes.data.org_id)
            .single();
          
          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }
        }
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
        {orgLogo ? (
          <img src={orgLogo} alt="Organization Logo" className="h-12 object-contain" />
        ) : (
          <h1 className="text-xl font-bold text-primary">In-Sync</h1>
        )}
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
            <div className="p-6 border-b border-border flex flex-col items-center bg-gradient-to-br from-primary/5 to-transparent">
              {orgLogo ? (
                <img src={orgLogo} alt="Organization Logo" className="h-16 object-contain mb-3" />
              ) : (
                <h1 className="text-2xl font-bold gradient-text-primary">In-Sync</h1>
              )}
              <p className="text-sm text-muted-foreground text-center">{userName}</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {/* Dashboards & Reports Section */}
              <div className="pb-2 section-accent-teal pl-4">
                <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                  Dashboards & Reports
                </p>
              </div>
              <Link
                to="/dashboard"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <LayoutDashboard size={20} className="text-primary" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/reports"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <BarChart3 size={20} className="text-primary" />
                <span>Reports</span>
              </Link>

              <Link
                to="/calling-dashboard"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <PhoneCall size={20} className="text-primary" />
                <span>Calling Dashboard</span>
              </Link>

              <Link
                to="/campaigns/overview"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <TrendingUp size={20} className="text-primary" />
                <span>Campaign Overview</span>
              </Link>

              <Link
                to="/campaigns/insights"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <Lightbulb size={20} className="text-primary" />
                <span>AI Insights</span>
              </Link>

              {isPlatformAdmin && (
                <Link
                  to="/platform-admin"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ShieldCheck size={20} />
                  <span>Platform Dashboard</span>
                </Link>
              )}

              {/* Operations Section */}
              <div className="pt-4 pb-2 section-accent-coral pl-4">
                <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                  Operations
                </p>
              </div>
              <Link
                to="/communications"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <MessageSquare size={20} className="text-accent" />
                <span>Communications</span>
              </Link>
              <Link
                to="/bulk-email"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <Send size={20} className="text-accent" />
                <span>Bulk Email</span>
              </Link>
              <Link
                to="/email-campaigns"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <Mail size={20} className="text-accent" />
                <span>Email Campaigns</span>
              </Link>
              <Link
                to="/contacts"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <Contact size={20} className="text-accent" />
                <span>Contacts</span>
              </Link>

              <Link
                to="/pipeline"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <GitBranch size={20} className="text-accent" />
                <span>Pipeline</span>
              </Link>

              <Link
                to="/call-logs"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <List size={20} className="text-accent" />
                <span>Call Logs</span>
              </Link>

              <Link
                to="/org-chart"
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-accent/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                onClick={() => setSidebarOpen(false)}
              >
                <Network size={20} className="text-accent" />
                <span>Org Chart</span>
              </Link>

              {(userRole === "admin" || userRole === "super_admin" || userRole === "sales_manager" || userRole === "support_manager") && (
                <>
                  <div className="pt-4 pb-2 section-accent-purple pl-4">
                    <p className="px-4 text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-secondary to-secondary/70 bg-clip-text text-transparent">
                      Management
                    </p>
                  </div>
                  <Link
                    to="/users"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-secondary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <UserCog size={20} className="text-secondary" />
                    <span>Users</span>
                  </Link>
                  <Link
                    to="/teams"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-secondary/10 hover:to-transparent transition-all duration-200 hover:shadow-md hover:translate-x-1"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <UsersRound size={20} className="text-secondary" />
                    <span>Teams</span>
                  </Link>
                </>
              )}


              {isAdmin && (
                <>
                  <div className="pt-4 pb-2 section-accent-teal pl-4">
                    <p className="px-4 text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                      Admin
                    </p>
                  </div>
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Building2 size={20} />
                    <span>Organization Settings</span>
                  </Link>
                  <Link
                    to="/admin/pipeline-stages"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Layers size={20} />
                    <span>Pipeline Stages</span>
                  </Link>
                  <Link
                    to="/admin/call-dispositions"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <PhoneCall size={20} />
                    <span>Call Dispositions</span>
                  </Link>
                  <Link
                    to="/admin/approval-matrix"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <CheckSquare size={20} />
                    <span>Approval Matrix</span>
                  </Link>
                  <Link
                    to="/admin/designations"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Award size={20} />
                    <span>Designations</span>
                  </Link>
                  <Link
                    to="/admin/custom-fields"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Sliders size={20} />
                    <span>Custom Fields</span>
                  </Link>
                  <Link
                    to="/admin/forms"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FileText size={20} />
                    <span>Forms</span>
                  </Link>
                  
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Communication
                    </p>
                  </div>
                  <Link
                    to="/admin/whatsapp-settings"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <MessageSquare size={20} />
                    <span>WhatsApp Settings</span>
                  </Link>
                  <Link
                    to="/admin/email-settings"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Mail size={20} />
                    <span>Email Settings</span>
                  </Link>
                  <Link
                    to="/templates"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <FileText size={20} />
                    <span>Templates</span>
                  </Link>
                  <Link
                    to="/whatsapp-messages"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <MessageSquare size={20} />
                    <span>Message History</span>
                  </Link>
                  
                  <div className="pt-4 pb-2">
                    <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Connectors
                    </p>
                  </div>
                  <Link
                    to="/admin/connectors"
                    className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Webhook size={20} />
                    <span>Webhook Connectors</span>
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
        <main className="flex-1">
          <PlatformAdminBanner />
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Onboarding Dialog */}
      {onboardingChecked && showOnboarding && userRole && (
        <OnboardingDialog
          open={showOnboarding}
          userRole={userRole}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

export default DashboardLayout;
export { DashboardLayout };

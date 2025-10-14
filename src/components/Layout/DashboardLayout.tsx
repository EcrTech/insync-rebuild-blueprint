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
  Package,
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
  Database,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformAdminBanner } from "@/components/PlatformAdminBanner";
import { OnboardingDialog } from "@/components/Onboarding/OnboardingDialog";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

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
  const [orgName, setOrgName] = useState<string>("");
  const { canAccessFeature, loading: featureAccessLoading } = useFeatureAccess();

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
        
        // Get organization logo and name (only if org_id exists)
        if (profileRes.data.org_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("logo_url, name")
            .eq("id", profileRes.data.org_id)
            .single();
          
          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }
          if (orgData?.name) {
            setOrgName(orgData.name);
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
  const isManager = userRole === "admin" || userRole === "super_admin" || userRole === "sales_manager" || userRole === "support_manager";

  // Check if sections should be visible
  const showDashboardsSection = canAccessFeature("analytics") || canAccessFeature("calling") || 
    canAccessFeature("campaigns_email") || canAccessFeature("campaigns_whatsapp") || canAccessFeature("ai_insights");
  
  const showOperationsSection = canAccessFeature("campaigns_email") || canAccessFeature("contacts") || 
    canAccessFeature("pipeline") || canAccessFeature("calling");
  
  const showAdminCommunicationSection = isAdmin && (canAccessFeature("campaigns_whatsapp") || 
    canAccessFeature("calling") || canAccessFeature("templates"));
  
  const showAdminMainSection = isAdmin && (canAccessFeature("pipeline") || canAccessFeature("calling") || 
    canAccessFeature("designations") || canAccessFeature("custom_fields") || canAccessFeature("forms"));

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
              {showDashboardsSection && (
                <div className="pb-2 section-accent-teal pl-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-primary">
                    Dashboards & Reports
                  </p>
                </div>
              )}
              
              {canAccessFeature("dashboard") && (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </Link>
              )}

              {canAccessFeature("analytics") && (
                <Link
                  to="/reports"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <BarChart3 size={20} />
                  <span>Reports</span>
                </Link>
              )}

              {canAccessFeature("calling") && (
                <Link
                  to="/calling-dashboard"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <PhoneCall size={20} />
                  <span>Calling Dashboard</span>
                </Link>
              )}

              {(canAccessFeature("campaigns_email") || canAccessFeature("campaigns_whatsapp")) && (
                <Link
                  to="/campaigns/overview"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <TrendingUp size={20} />
                  <span>Campaign Overview</span>
                </Link>
              )}

              {canAccessFeature("ai_insights") && (
                <Link
                  to="/campaigns/insights"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Lightbulb size={20} />
                  <span>AI Insights</span>
                </Link>
              )}

              {canAccessFeature("documentation") && (
                <Link
                  to="/documentation"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText size={20} />
                  <span>Documentation</span>
                </Link>
              )}

              {canAccessFeature("redefine_data_repository") && orgName === "Redefine" && (
                <Link
                  to="/redefine-repository"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Database size={20} />
                  <span>Data Repository</span>
                </Link>
              )}

              {isPlatformAdmin && canAccessFeature("platform_admin") && (
                <Link
                  to="/platform-admin"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ShieldCheck size={20} />
                  <span>Platform Dashboard</span>
                </Link>
              )}

              {/* Operations Section */}
              {showOperationsSection && (
                <div className="pt-4 pb-2 section-accent-coral pl-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                    Operations
                  </p>
                </div>
              )}
              
              {canAccessFeature("communications") && (
                <Link
                  to="/communications"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <MessageSquare size={20} />
                  <span>Communications</span>
                </Link>
              )}
              
              {canAccessFeature("campaigns_email") && (
                <Link
                  to="/email-campaigns"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Mail size={20} />
                  <span>Email Campaigns</span>
                </Link>
              )}
              
              {canAccessFeature("contacts") && (
                <Link
                  to="/contacts"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Contact size={20} />
                  <span>Contacts</span>
                </Link>
              )}

              {canAccessFeature("pipeline") && (
                <Link
                  to="/pipeline"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <GitBranch size={20} />
                  <span>Pipeline</span>
                </Link>
              )}

              {canAccessFeature("calling") && (
                <Link
                  to="/call-logs"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <List size={20} />
                  <span>Call Logs</span>
                </Link>
              )}

              {canAccessFeature("inventory") && orgName === "C.Parekh & Co" && (
                <Link
                  to="/inventory"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Package size={20} />
                  <span>Inventory</span>
                </Link>
              )}

              {canAccessFeature("org_chart") && (
                <Link
                  to="/org-chart"
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Network size={20} />
                  <span>Org Chart</span>
                </Link>
              )}

              {isManager && (
                <>
                  <div className="pt-4 pb-2 section-accent-purple pl-4">
                    <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                      Management
                    </p>
                  </div>
                  {canAccessFeature("users") && (
                    <Link
                      to="/users"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UserCog size={20} />
                      <span>Users</span>
                    </Link>
                  )}
                  {canAccessFeature("teams") && (
                    <Link
                      to="/teams"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <UsersRound size={20} />
                      <span>Teams</span>
                    </Link>
                  )}
                </>
              )}


              {isAdmin && (
                <>
                  {showAdminMainSection && (
                    <div className="pt-4 pb-2 section-accent-teal pl-4">
                      <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                        Admin
                      </p>
                    </div>
                  )}
                  
                  {canAccessFeature("organization_settings") && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Building2 size={20} />
                      <span>Organization Settings</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("pipeline") && (
                    <Link
                      to="/admin/pipeline-stages"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Layers size={20} />
                      <span>Pipeline Stages</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("calling") && (
                    <Link
                      to="/admin/call-dispositions"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <PhoneCall size={20} />
                      <span>Call Dispositions</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("approval_matrix") && (
                    <Link
                      to="/admin/approval-matrix"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <CheckSquare size={20} />
                      <span>Approval Matrix</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("designations") && (
                    <Link
                      to="/admin/designations"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Award size={20} />
                      <span>Designations</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("custom_fields") && (
                    <Link
                      to="/admin/custom-fields"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Sliders size={20} />
                      <span>Custom Fields</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("forms") && (
                    <Link
                      to="/admin/forms"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <FileText size={20} />
                      <span>Forms</span>
                    </Link>
                  )}
                  
                  {showAdminCommunicationSection && (
                    <div className="pt-4 pb-2 section-accent-accent pl-4">
                      <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                        Communication
                      </p>
                    </div>
                  )}
                  
                  {canAccessFeature("campaigns_whatsapp") && (
                    <Link
                      to="/admin/whatsapp-settings"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <MessageSquare size={20} />
                      <span>WhatsApp Settings</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("email_settings") && (
                    <Link
                      to="/admin/email-settings"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Mail size={20} />
                      <span>Email Settings</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("calling") && (
                    <Link
                      to="/admin/exotel-settings"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <PhoneCall size={20} />
                      <span>Exotel Settings</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("templates") && (
                    <Link
                      to="/templates"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <FileText size={20} />
                      <span>Templates</span>
                    </Link>
                  )}
                  
                  {canAccessFeature("campaigns_whatsapp") && (
                    <Link
                      to="/whatsapp-messages"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <MessageSquare size={20} />
                      <span>Message History</span>
                    </Link>
                  )}
                  
                  <div className="pt-4 pb-2 section-accent-purple pl-4">
                    <p className="px-4 text-xs font-semibold uppercase tracking-wider gradient-text-accent">
                      Connectors
                    </p>
                  </div>
                  {canAccessFeature("connectors") && (
                    <Link
                      to="/admin/connectors"
                      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Webhook size={20} />
                      <span>Webhook Connectors</span>
                    </Link>
                  )}
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

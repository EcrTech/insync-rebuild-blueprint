import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Activity, MoreVertical, Eye, Ban, CheckCircle, LogIn, PhoneCall, Mail, UserCheck, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  settings: any;
  usage_limits: any;
  primary_color: string;
  userCount?: number;
  contactCount?: number;
  is_active?: boolean;
  usersActive1Day?: number;
  usersActive7Days?: number;
  usersActive30Days?: number;
  callVolume?: number;
  emailVolume?: number;
}

interface ErrorLog {
  id: string;
  org_id: string;
  user_id: string | null;
  error_type: string;
  error_message: string;
  error_details: any;
  page_url: string | null;
  created_at: string;
  organization?: { name: string };
  profile?: { first_name: string; last_name: string };
}

interface OrgStats {
  totalOrgs: number;
  activeOrgs: number;
  totalUsers: number;
  totalContacts: number;
  usersLast1Day: number;
  usersLast7Days: number;
  usersLast30Days: number;
  callVolume: number;
  emailVolume: number;
}

export default function PlatformAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<OrgStats>({
    totalOrgs: 0,
    activeOrgs: 0,
    totalUsers: 0,
    totalContacts: 0,
    usersLast1Day: 0,
    usersLast7Days: 0,
    usersLast30Days: 0,
    callVolume: 0,
    emailVolume: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkPlatformAdmin();
  }, []);

  const checkPlatformAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_platform_admin) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have platform admin privileges",
        });
        navigate("/dashboard");
        return;
      }

      fetchOrganizations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);

      // Calculate time thresholds once
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all data in parallel for better performance
      const [
        { data: orgs, error: orgsError },
        { data: userCounts },
        { data: contactCounts },
        { data: profilesData },
        { data: activityData }
      ] = await Promise.all([
        supabase.from("organizations").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("org_id"),
        supabase.from("contacts").select("org_id"),
        supabase.from("profiles").select("org_id, updated_at"),
        supabase.from("contact_activities").select("org_id, activity_type")
      ]);

      if (orgsError) throw orgsError;

      // Initialize default counts structure
      const getDefaultCounts = () => ({ 
        users: 0, 
        contacts: 0,
        usersActive1Day: 0,
        usersActive7Days: 0,
        usersActive30Days: 0,
        calls: 0,
        emails: 0
      });

      // Build counts map efficiently in a single pass per data type
      const orgCountsMap = new Map();
      
      userCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || getDefaultCounts();
        current.users++;
        orgCountsMap.set(org_id, current);
      });
      
      contactCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || getDefaultCounts();
        current.contacts++;
        orgCountsMap.set(org_id, current);
      });

      // Process profiles - count users and active users in one pass
      let totalUsersActive1Day = 0;
      let totalUsersActive7Days = 0;
      let totalUsersActive30Days = 0;

      profilesData?.forEach(({ org_id, updated_at }) => {
        const current = orgCountsMap.get(org_id) || getDefaultCounts();
        const updatedDate = new Date(updated_at);
        
        if (updatedDate > oneDayAgo) {
          current.usersActive1Day++;
          totalUsersActive1Day++;
        }
        if (updatedDate > sevenDaysAgo) {
          current.usersActive7Days++;
          totalUsersActive7Days++;
        }
        if (updatedDate > thirtyDaysAgo) {
          current.usersActive30Days++;
          totalUsersActive30Days++;
        }
        
        orgCountsMap.set(org_id, current);
      });

      // Process activities - calls and emails in one pass
      let totalCalls = 0;
      let totalEmails = 0;

      activityData?.forEach(({ org_id, activity_type }) => {
        const current = orgCountsMap.get(org_id) || getDefaultCounts();
        
        if (activity_type === "call") {
          current.calls++;
          totalCalls++;
        } else if (activity_type === "email") {
          current.emails++;
          totalEmails++;
        }
        
        orgCountsMap.set(org_id, current);
      });

      // Enrich organizations with counts
      const enrichedOrgs = orgs?.map(org => {
        const counts = orgCountsMap.get(org.id) || getDefaultCounts();
        return {
          ...org,
          userCount: counts.users,
          contactCount: counts.contacts,
          usersActive1Day: counts.usersActive1Day,
          usersActive7Days: counts.usersActive7Days,
          usersActive30Days: counts.usersActive30Days,
          callVolume: counts.calls,
          emailVolume: counts.emails,
          is_active: (org.settings as any)?.is_active !== false,
        };
      }) || [];

      setOrganizations(enrichedOrgs);

      // Set stats - all data already calculated
      setStats({
        totalOrgs: enrichedOrgs.length,
        activeOrgs: enrichedOrgs.filter(o => o.is_active).length,
        totalUsers: userCounts?.length || 0,
        totalContacts: contactCounts?.length || 0,
        usersLast1Day: totalUsersActive1Day,
        usersLast7Days: totalUsersActive7Days,
        usersLast30Days: totalUsersActive30Days,
        callVolume: totalCalls,
        emailVolume: totalEmails,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading organizations",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const viewOrgDetails = async (org: Organization) => {
    try {
      setSelectedOrg(org);

      // Fetch detailed info
      const { data: users } = await supabase
        .from("user_roles")
        .select(`
          id,
          role,
          created_at,
          profiles:user_id (
            first_name,
            last_name,
            phone
          )
        `)
        .eq("org_id", org.id);

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, created_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setOrgDetails({ users, contacts });
      setIsDetailsOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const accessOrganization = (org: Organization) => {
    // Store impersonation data in session storage
    sessionStorage.setItem("platform_admin_impersonation", JSON.stringify({
      org_id: org.id,
      org_name: org.name,
      timestamp: new Date().toISOString(),
    }));

    toast({
      title: "Switched to organization",
      description: `You are now accessing ${org.name}`,
    });

    // Redirect to dashboard
    navigate("/dashboard");
  };

  const toggleOrgStatus = async (org: Organization, disable: boolean) => {
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            ...org.settings,
            is_active: !disable,
          }
        })
        .eq("id", org.id);

      if (error) throw error;

      // Log the action
      await supabase.from("platform_admin_audit_log").insert([{
        action: disable ? "disable_organization" : "enable_organization",
        target_org_id: org.id,
        details: { org_name: org.name } as any,
      }] as any);

      toast({
        title: "Success",
        description: `Organization ${disable ? "disabled" : "enabled"} successfully`,
      });

      fetchOrganizations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const fetchErrorLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("error_logs")
        .select(`
          *,
          organizations!error_logs_org_id_fkey(name),
          profiles!error_logs_user_id_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedLogs = data?.map(log => ({
        ...log,
        organization: log.organizations,
        profile: log.profiles
      })) as ErrorLog[];

      setErrorLogs(formattedLogs || []);
      setShowErrorLogs(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading logs",
        description: error.message,
      });
    }
  };

  const getErrorTypeBadgeVariant = (type: string) => {
    switch (type.toLowerCase()) {
      case "critical":
      case "fatal":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Administration</h1>
          <p className="text-muted-foreground">Manage all organizations on the In-Sync platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrgs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeOrgs} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Across all organizations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Call Volume</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.callVolume}</div>
              <p className="text-xs text-muted-foreground">
                Total calls logged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Volume</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.emailVolume}</div>
              <p className="text-xs text-muted-foreground">
                Total emails sent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* User Activity Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Last 24 Hours</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersLast1Day}</div>
              <p className="text-xs text-muted-foreground">
                Users active today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Last 7 Days</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersLast7Days}</div>
              <p className="text-xs text-muted-foreground">
                Users this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Last 30 Days</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersLast30Days}</div>
              <p className="text-xs text-muted-foreground">
                Users this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>Manage and monitor all organizations on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead className="text-center">Active 1d</TableHead>
                    <TableHead className="text-center">Active 7d</TableHead>
                    <TableHead className="text-center">Active 30d</TableHead>
                    <TableHead className="text-center">Calls</TableHead>
                    <TableHead className="text-center">Emails</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="font-mono text-sm">{org.slug}</TableCell>
                      <TableCell>{org.userCount}</TableCell>
                      <TableCell>{org.contactCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{org.usersActive1Day}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{org.usersActive7Days}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{org.usersActive30Days}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{org.callVolume}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{org.emailVolume}</Badge>
                      </TableCell>
                      <TableCell>
                        {org.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => accessOrganization(org)}>
                              <LogIn className="mr-2 h-4 w-4" />
                              Access Organization
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => viewOrgDetails(org)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {org.is_active ? (
                              <DropdownMenuItem
                                onClick={() => toggleOrgStatus(org, true)}
                                className="text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Disable Organization
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleOrgStatus(org, false)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Enable Organization
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Error Logs Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Error Logs</CardTitle>
                <CardDescription>System-wide error tracking across all organizations</CardDescription>
              </div>
              <Button onClick={fetchErrorLogs} variant="outline">
                <AlertTriangle className="mr-2 h-4 w-4" />
                {showErrorLogs ? "Refresh Logs" : "Load Error Logs"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showErrorLogs && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Error Message</TableHead>
                    <TableHead>Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No error logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    errorLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.organization?.name || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.profile
                            ? `${log.profile.first_name} ${log.profile.last_name}`
                            : "Anonymous"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getErrorTypeBadgeVariant(log.error_type)}>
                            {log.error_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {log.error_message}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.page_url || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Organization Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedOrg?.name} - Details</DialogTitle>
            </DialogHeader>
            {orgDetails && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Organization Info</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Slug:</span>{" "}
                      <span className="font-mono">{selectedOrg?.slug}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      {new Date(selectedOrg?.created_at || "").toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Users:</span>{" "}
                      {orgDetails.users?.length || 0}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Contacts:</span>{" "}
                      {selectedOrg?.contactCount || 0}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Users</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgDetails.users?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            {user.profiles?.first_name} {user.profiles?.last_name}
                          </TableCell>
                          <TableCell>
                            <Badge>{user.role.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

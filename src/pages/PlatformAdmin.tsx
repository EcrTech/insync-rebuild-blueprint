import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Activity, MoreVertical, Eye, Ban, CheckCircle, LogIn, PhoneCall, Mail, UserCheck } from "lucide-react";
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

      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (orgsError) throw orgsError;

      // Calculate time thresholds
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch user counts for each org
      const { data: userCounts } = await supabase
        .from("user_roles")
        .select("org_id");

      // Fetch contact counts for each org
      const { data: contactCounts } = await supabase
        .from("contacts")
        .select("org_id");

      // Fetch profiles with activity for each org
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("org_id, updated_at");

      // Fetch call activities per org
      const { data: callActivities } = await supabase
        .from("contact_activities")
        .select("org_id")
        .eq("activity_type", "call");

      // Fetch email activities per org
      const { data: emailActivities } = await supabase
        .from("contact_activities")
        .select("org_id")
        .eq("activity_type", "email");

      // Calculate counts per org
      const orgCountsMap = new Map();
      
      // User counts
      userCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { 
          users: 0, 
          contacts: 0,
          usersActive1Day: 0,
          usersActive7Days: 0,
          usersActive30Days: 0,
          calls: 0,
          emails: 0
        };
        orgCountsMap.set(org_id, { ...current, users: current.users + 1 });
      });
      
      // Contact counts
      contactCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { 
          users: 0, 
          contacts: 0,
          usersActive1Day: 0,
          usersActive7Days: 0,
          usersActive30Days: 0,
          calls: 0,
          emails: 0
        };
        orgCountsMap.set(org_id, { ...current, contacts: current.contacts + 1 });
      });

      // Active user counts
      profilesData?.forEach(({ org_id, updated_at }) => {
        const current = orgCountsMap.get(org_id) || { 
          users: 0, 
          contacts: 0,
          usersActive1Day: 0,
          usersActive7Days: 0,
          usersActive30Days: 0,
          calls: 0,
          emails: 0
        };
        
        const updatedDate = new Date(updated_at);
        if (updatedDate > oneDayAgo) {
          current.usersActive1Day++;
        }
        if (updatedDate > sevenDaysAgo) {
          current.usersActive7Days++;
        }
        if (updatedDate > thirtyDaysAgo) {
          current.usersActive30Days++;
        }
        
        orgCountsMap.set(org_id, current);
      });

      // Call volume per org
      callActivities?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { 
          users: 0, 
          contacts: 0,
          usersActive1Day: 0,
          usersActive7Days: 0,
          usersActive30Days: 0,
          calls: 0,
          emails: 0
        };
        orgCountsMap.set(org_id, { ...current, calls: current.calls + 1 });
      });

      // Email volume per org
      emailActivities?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { 
          users: 0, 
          contacts: 0,
          usersActive1Day: 0,
          usersActive7Days: 0,
          usersActive30Days: 0,
          calls: 0,
          emails: 0
        };
        orgCountsMap.set(org_id, { ...current, emails: current.emails + 1 });
      });

      const enrichedOrgs = orgs?.map(org => ({
        ...org,
        userCount: orgCountsMap.get(org.id)?.users || 0,
        contactCount: orgCountsMap.get(org.id)?.contacts || 0,
        usersActive1Day: orgCountsMap.get(org.id)?.usersActive1Day || 0,
        usersActive7Days: orgCountsMap.get(org.id)?.usersActive7Days || 0,
        usersActive30Days: orgCountsMap.get(org.id)?.usersActive30Days || 0,
        callVolume: orgCountsMap.get(org.id)?.calls || 0,
        emailVolume: orgCountsMap.get(org.id)?.emails || 0,
        is_active: (org.settings as any)?.is_active !== false,
      })) || [];

      setOrganizations(enrichedOrgs);

      // Get user login stats - we'll need to query profiles with last activity
      // Since Supabase auth.users is not accessible, we'll use profiles updated_at as a proxy
      const { data: recentProfiles } = await supabase
        .from("profiles")
        .select("updated_at");

      const usersLast1Day = recentProfiles?.filter(
        p => new Date(p.updated_at) > oneDayAgo
      ).length || 0;

      const usersLast7Days = recentProfiles?.filter(
        p => new Date(p.updated_at) > sevenDaysAgo
      ).length || 0;

      const usersLast30Days = recentProfiles?.filter(
        p => new Date(p.updated_at) > thirtyDaysAgo
      ).length || 0;

      // Get call volume
      const { data: calls } = await supabase
        .from("contact_activities")
        .select("id")
        .eq("activity_type", "call");

      // Get email volume
      const { data: emails } = await supabase
        .from("contact_activities")
        .select("id")
        .eq("activity_type", "email");

      // Calculate stats
      setStats({
        totalOrgs: enrichedOrgs.length,
        activeOrgs: enrichedOrgs.filter(o => o.is_active).length,
        totalUsers: userCounts?.length || 0,
        totalContacts: contactCounts?.length || 0,
        usersLast1Day,
        usersLast7Days,
        usersLast30Days,
        callVolume: calls?.length || 0,
        emailVolume: emails?.length || 0,
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

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Activity, MoreVertical, Eye, Ban, CheckCircle, LogIn } from "lucide-react";
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
}

interface OrgStats {
  totalOrgs: number;
  activeOrgs: number;
  totalUsers: number;
  totalContacts: number;
}

export default function PlatformAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<OrgStats>({
    totalOrgs: 0,
    activeOrgs: 0,
    totalUsers: 0,
    totalContacts: 0,
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

      // Fetch user counts for each org
      const { data: userCounts } = await supabase
        .from("user_roles")
        .select("org_id");

      // Fetch contact counts for each org
      const { data: contactCounts } = await supabase
        .from("contacts")
        .select("org_id");

      // Calculate counts per org
      const orgCountsMap = new Map();
      userCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { users: 0, contacts: 0 };
        orgCountsMap.set(org_id, { ...current, users: current.users + 1 });
      });
      contactCounts?.forEach(({ org_id }) => {
        const current = orgCountsMap.get(org_id) || { users: 0, contacts: 0 };
        orgCountsMap.set(org_id, { ...current, contacts: current.contacts + 1 });
      });

      const enrichedOrgs = orgs?.map(org => ({
        ...org,
        userCount: orgCountsMap.get(org.id)?.users || 0,
        contactCount: orgCountsMap.get(org.id)?.contacts || 0,
        is_active: (org.settings as any)?.is_active !== false,
      })) || [];

      setOrganizations(enrichedOrgs);

      // Calculate stats
      setStats({
        totalOrgs: enrichedOrgs.length,
        activeOrgs: enrichedOrgs.filter(o => o.is_active).length,
        totalUsers: userCounts?.length || 0,
        totalContacts: contactCounts?.length || 0,
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeOrgs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
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

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Mail, Phone, MessageSquare, PhoneCall } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  calling_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: Profile;
}

export default function Users() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: "admin" | "analyst" | "sales_agent" | "sales_manager" | "super_admin" | "support_agent" | "support_manager";
    calling_enabled: boolean;
    whatsapp_enabled: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
  }>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "sales_agent",
    calling_enabled: false,
    whatsapp_enabled: false,
    email_enabled: false,
    sms_enabled: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = data?.map(ur => ur.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, avatar_url, calling_enabled, whatsapp_enabled, email_enabled, sms_enabled")
        .in("id", userIds);

      // Combine the data
      const usersWithProfiles = data?.map(ur => ({
        ...ur,
        profiles: profilesData?.find(p => p.id === ur.user_id) || {
          id: ur.user_id,
          first_name: "",
          last_name: "",
          phone: null,
          avatar_url: null,
          calling_enabled: false,
          whatsapp_enabled: false,
          email_enabled: false,
          sms_enabled: false
        }
      })) || [];

      setUsers(usersWithProfiles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading users",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        // Update existing user role
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: formData.role })
          .eq("id", editingUser.id);

        if (roleError) throw roleError;

        // Update profile
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            calling_enabled: formData.calling_enabled,
            whatsapp_enabled: formData.whatsapp_enabled,
            email_enabled: formData.email_enabled,
            sms_enabled: formData.sms_enabled,
          })
          .eq("id", editingUser.user_id);

        if (profileError) throw profileError;

        toast({
          title: "User updated",
          description: "User has been updated successfully",
        });
      } else {
        // Create new user
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.first_name,
              last_name: formData.last_name,
            },
          },
        });

        if (signUpError) throw signUpError;
        if (!user) throw new Error("User creation failed");

        // Get current user's org_id
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", currentUser?.id)
          .single();

        // Update new user's profile with org_id and communication settings
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            org_id: currentProfile?.org_id,
            phone: formData.phone,
            calling_enabled: formData.calling_enabled,
            whatsapp_enabled: formData.whatsapp_enabled,
            email_enabled: formData.email_enabled,
            sms_enabled: formData.sms_enabled,
          })
          .eq("id", user.id);

        if (profileError) throw profileError;

        // Create user role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: user.id,
            org_id: currentProfile?.org_id,
            role: formData.role,
          });

        if (roleError) throw roleError;

        toast({
          title: "User created",
          description: "User has been created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, roleId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast({
        title: "User deleted",
        description: "User has been removed successfully",
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting user",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone: "",
      role: "sales_agent",
      calling_enabled: false,
      whatsapp_enabled: false,
      email_enabled: false,
      sms_enabled: false,
    });
    setEditingUser(null);
  };

  const openEditDialog = (user: UserRole) => {
    setEditingUser(user);
    setFormData({
      email: "",
      password: "",
      first_name: user.profiles.first_name || "",
      last_name: user.profiles.last_name || "",
      phone: user.profiles.phone || "",
      role: user.role as any,
      calling_enabled: user.profiles.calling_enabled || false,
      whatsapp_enabled: user.profiles.whatsapp_enabled || false,
      email_enabled: user.profiles.email_enabled || false,
      sms_enabled: user.profiles.sms_enabled || false,
    });
    setIsDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-purple-500",
      admin: "bg-red-500",
      sales_manager: "bg-blue-500",
      sales_agent: "bg-green-500",
      support_manager: "bg-yellow-500",
      support_agent: "bg-orange-500",
      analyst: "bg-gray-500",
    };
    return colors[role] || "bg-gray-500";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage your organization's users and roles</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales_agent">Sales Agent</SelectItem>
                      <SelectItem value="sales_manager">Sales Manager</SelectItem>
                      <SelectItem value="support_agent">Support Agent</SelectItem>
                      <SelectItem value="support_manager">Support Manager</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Communication Enablement</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="calling_enabled"
                        checked={formData.calling_enabled}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, calling_enabled: checked as boolean })
                        }
                      />
                      <label
                        htmlFor="calling_enabled"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <PhoneCall className="h-4 w-4" />
                        Calling
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="whatsapp_enabled"
                        checked={formData.whatsapp_enabled}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, whatsapp_enabled: checked as boolean })
                        }
                      />
                      <label
                        htmlFor="whatsapp_enabled"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="email_enabled"
                        checked={formData.email_enabled}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, email_enabled: checked as boolean })
                        }
                      />
                      <label
                        htmlFor="email_enabled"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sms_enabled"
                        checked={formData.sms_enabled}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, sms_enabled: checked as boolean })
                        }
                      />
                      <label
                        htmlFor="sms_enabled"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        SMS
                      </label>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {editingUser ? "Update User" : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
            <CardDescription>All users in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Communication</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.profiles.first_name} {user.profiles.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {user.profiles.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.profiles.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.profiles.calling_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <PhoneCall className="h-3 w-3 mr-1" />
                              Call
                            </Badge>
                          )}
                          {user.profiles.whatsapp_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              WA
                            </Badge>
                          )}
                          {user.profiles.email_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          {user.profiles.sms_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              SMS
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.user_id, user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

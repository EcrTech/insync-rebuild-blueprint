import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Users } from "lucide-react";

interface Designation {
  id: string;
  name: string;
  description: string;
  role: string;
  is_active: boolean;
  employee_count?: number;
}

interface ReportingRelation {
  id: string;
  designation_id: string;
  reports_to_designation_id: string | null;
}

const ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "support_rep", label: "Support Rep" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "support_manager", label: "Support Manager" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export default function Designations() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [reporting, setReporting] = useState<ReportingRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    role: "",
    reports_to: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) return;

      const [designationsRes, reportingRes, profilesRes] = await Promise.all([
        supabase
          .from("designations" as any)
          .select("*")
          .eq("org_id", profile.org_id)
          .order("name"),
        supabase
          .from("reporting_hierarchy" as any)
          .select("*")
          .eq("org_id", profile.org_id),
        supabase
          .from("profiles")
          .select("designation_id")
          .eq("org_id", profile.org_id)
          .not("designation_id", "is", null),
      ]);

      if (designationsRes.data) {
        const designationsWithCounts = (designationsRes.data as any[]).map(des => ({
          ...des,
          employee_count: (profilesRes.data as any[] || []).filter(p => p.designation_id === des.id).length,
        }));
        setDesignations(designationsWithCounts);
      }
      if (reportingRes.data) setReporting(reportingRes.data as any);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load designations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) return;

      const designationPayload = {
        org_id: profile.org_id,
        name: formData.name,
        description: formData.description,
        role: formData.role,
        is_active: true,
      };

      let designationId: string;

      if (editingDesignation) {
        const { error } = await supabase
          .from("designations" as any)
          .update(designationPayload)
          .eq("id", editingDesignation.id);

        if (error) throw error;
        designationId = editingDesignation.id;
        toast.success("Designation updated successfully");
      } else {
        const { data, error } = await supabase
          .from("designations" as any)
          .insert(designationPayload)
          .select()
          .single();

        if (error) throw error;
        designationId = (data as any).id;
        toast.success("Designation created successfully");
      }

      // Handle reporting relationship
      if (formData.reports_to) {
        const { error: hierError } = await supabase
          .from("reporting_hierarchy" as any)
          .upsert({
            org_id: profile.org_id,
            designation_id: designationId,
            reports_to_designation_id: formData.reports_to,
          });

        if (hierError) throw hierError;
      } else if (editingDesignation) {
        // Remove reporting relationship if cleared
        await supabase
          .from("reporting_hierarchy" as any)
          .delete()
          .eq("designation_id", designationId);
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving designation:", error);
      toast.error("Failed to save designation");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this designation?")) return;

    try {
      const { error } = await supabase
        .from("designations" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Designation deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting designation:", error);
      toast.error("Failed to delete designation");
    }
  };

  const handleEdit = (designation: Designation) => {
    setEditingDesignation(designation);
    const reportsTo = reporting.find(r => r.designation_id === designation.id);
    setFormData({
      name: designation.name,
      description: designation.description || "",
      role: designation.role,
      reports_to: reportsTo?.reports_to_designation_id || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      role: "",
      reports_to: "",
    });
    setEditingDesignation(null);
  };

  const getReportsToName = (designationId: string) => {
    const relation = reporting.find(r => r.designation_id === designationId);
    if (!relation?.reports_to_designation_id) return null;
    const parentDesignation = designations.find(d => d.id === relation.reports_to_designation_id);
    return parentDesignation?.name || null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Designations</h1>
            <p className="text-muted-foreground">Manage organizational designations and reporting structure</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Designation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDesignation ? "Edit Designation" : "Create Designation"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Designation Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Senior Sales Manager"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reports_to">Reports To</Label>
                  <Select
                    value={formData.reports_to}
                    onValueChange={(value) => setFormData({ ...formData, reports_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No direct report" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Top Level)</SelectItem>
                      {designations
                        .filter(d => d.id !== editingDesignation?.id)
                        .map((des) => (
                          <SelectItem key={des.id} value={des.id}>
                            {des.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this designation"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingDesignation ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {designations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No designations configured yet. Click "Add Designation" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            designations.map((designation) => {
              const reportsTo = getReportsToName(designation.id);
              return (
                <Card key={designation.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{designation.name}</CardTitle>
                        <CardDescription>
                          <Badge variant="secondary" className="mr-2">
                            {ROLES.find(r => r.value === designation.role)?.label}
                          </Badge>
                          {reportsTo && (
                            <span className="text-sm">Reports to: {reportsTo}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(designation)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(designation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {designation.description && (
                      <p className="text-sm text-muted-foreground mb-3">{designation.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{designation.employee_count || 0} employee{(designation.employee_count || 0) !== 1 ? 's' : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

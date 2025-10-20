import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useDialogState } from "@/hooks/useDialogState";
import { useNotification } from "@/hooks/useNotification";
import { useCRUD } from "@/hooks/useCRUD";
import { useOrgData } from "@/hooks/useOrgData";

interface Team {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  created_at: string;
  team_members: { count: number }[];
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

export default function Teams() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { effectiveOrgId, isLoading: isOrgLoading } = useOrgContext();
  
  const dialog = useDialogState({
    name: "",
    description: "",
    manager_id: ""
  });
  
  const { data: teams = [], isLoading } = useOrgData<Team>("teams", {
    select: "*, team_members(count)",
    orderBy: { column: "created_at", ascending: false }
  });
  
  const { data: managers = [] } = useOrgData<Profile>("profiles", {
    select: "id, first_name, last_name"
  });
  
  const crud = useCRUD("teams", {
    onSuccess: () => dialog.closeDialog(),
    successMessage: {
      create: "Team created successfully",
      update: "Team updated successfully",
      delete: "Team deleted successfully"
    }
  });

  useEffect(() => {
    if (!isOrgLoading && !effectiveOrgId) {
      navigate('/');
    }
  }, [effectiveOrgId, isOrgLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!effectiveOrgId) {
      notify.error("Error", "Organization context is required");
      return;
    }

    if (!dialog.formData.name.trim()) {
      notify.error("Error", "Team name is required");
      return;
    }

    const teamData = {
      org_id: effectiveOrgId,
      name: dialog.formData.name,
      description: dialog.formData.description || null,
      manager_id: dialog.formData.manager_id || null,
    };

    if (dialog.isEditing) {
      crud.update({ id: dialog.editingItem.id, data: teamData });
    } else {
      crud.create(teamData);
    }
  };

  const handleDelete = async (id: string) => {
    if (!notify.confirm("Are you sure you want to delete this team?")) {
      return;
    }
    crud.delete(id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">Organize your workforce into teams</p>
          </div>
          <Dialog open={dialog.isOpen} onOpenChange={dialog.closeDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => dialog.openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dialog.isEditing ? "Edit Team" : "Create New Team"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name *</Label>
                  <Input
                    id="name"
                    value={dialog.formData.name}
                    onChange={(e) => dialog.updateFormData({ name: e.target.value })}
                    placeholder="e.g., Sales Team A"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={dialog.formData.description}
                    onChange={(e) => dialog.updateFormData({ description: e.target.value })}
                    placeholder="Brief description of the team"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager">Team Manager</Label>
                  <Select 
                    value={dialog.formData.manager_id || "none"} 
                    onValueChange={(value) => dialog.updateFormData({ manager_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.first_name} {manager.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={crud.isLoading}>
                  {dialog.isEditing ? "Update Team" : "Create Team"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full text-center py-8">Loading...</div>
          ) : teams.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center">
                <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No teams yet. Create your first team to get started.</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {team.name}
                    <Badge variant="secondary">
                      {team.team_members[0]?.count || 0} members
                    </Badge>
                  </CardTitle>
                  {team.description && (
                    <CardDescription>{team.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dialog.openDialog(team)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(team.id)}
                      disabled={crud.isLoading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

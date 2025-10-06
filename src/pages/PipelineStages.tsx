import { useEffect, useState } from "react";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Check, X } from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  probability: number;
  color: string;
  is_active: boolean;
}

export default function PipelineStages() {
  const { toast } = useToast();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStage, setNewStage] = useState({
    name: "",
    description: "",
    probability: 50,
    color: "#01B8AA",
  });

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .order("stage_order", { ascending: true });

      if (error) throw error;
      setStages(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load stages",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = async () => {
    if (!newStage.name) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a stage name",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("No organization found");

      const maxOrder = Math.max(...stages.map(s => s.stage_order), 0);

      const { error } = await supabase
        .from("pipeline_stages")
        .insert({
          org_id: profile.org_id,
          name: newStage.name,
          description: newStage.description,
          stage_order: maxOrder + 1,
          probability: newStage.probability,
          color: newStage.color,
        });

      if (error) throw error;

      toast({
        title: "Stage added",
        description: "Pipeline stage has been created",
      });

      setNewStage({
        name: "",
        description: "",
        probability: 50,
        color: "#01B8AA",
      });

      fetchStages();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add stage",
        description: error.message,
      });
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stage?")) return;

    try {
      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Stage deleted",
        description: "Pipeline stage has been removed",
      });

      fetchStages();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete stage",
        description: error.message,
      });
    }
  };

  const handleUpdateStage = async (stage: PipelineStage) => {
    try {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({
          name: stage.name,
          description: stage.description,
          probability: stage.probability,
          color: stage.color,
        })
        .eq("id", stage.id);

      if (error) throw error;

      toast({
        title: "Stage updated",
        description: "Pipeline stage has been updated",
      });

      setEditingId(null);
      fetchStages();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update stage",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline Stages</h1>
          <p className="text-muted-foreground mt-1">Manage your sales pipeline stages</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add New Stage</CardTitle>
            <CardDescription>Create a new pipeline stage for your sales process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Stage Name</Label>
                <Input
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  placeholder="e.g., Qualified"
                />
              </div>

              <div className="space-y-2">
                <Label>Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newStage.probability}
                  onChange={(e) => setNewStage({ ...newStage, probability: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newStage.description}
                onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={newStage.color}
                  onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={newStage.color}
                  onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <Button onClick={handleAddStage}>
              <Plus className="mr-2 h-4 w-4" />
              Add Stage
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Pipeline Stages</CardTitle>
            <CardDescription>
              {stages.length} stage{stages.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  
                  {editingId === stage.id ? (
                    <>
                      <div className="flex-1 grid gap-2 md:grid-cols-3">
                        <Input
                          value={stage.name}
                          onChange={(e) => setStages(stages.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s))}
                        />
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={stage.probability}
                          onChange={(e) => setStages(stages.map(s => s.id === stage.id ? { ...s, probability: parseInt(e.target.value) } : s))}
                          placeholder="Probability %"
                        />
                        <Input
                          type="color"
                          value={stage.color}
                          onChange={(e) => setStages(stages.map(s => s.id === stage.id ? { ...s, color: e.target.value } : s))}
                        />
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateStage(stage)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingId(null);
                        fetchStages();
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="font-medium">{stage.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {stage.probability}% probability
                          {stage.description && ` • ${stage.description}`}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(stage.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteStage(stage.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
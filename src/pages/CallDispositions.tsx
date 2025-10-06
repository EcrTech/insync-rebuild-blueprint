import { useEffect, useState } from "react";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface CallDisposition {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  sub_dispositions?: CallSubDisposition[];
}

interface CallSubDisposition {
  id: string;
  disposition_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function CallDispositions() {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newDisposition, setNewDisposition] = useState({
    name: "",
    description: "",
    category: "neutral",
  });
  const [newSubDisposition, setNewSubDisposition] = useState({
    dispositionId: "",
    name: "",
    description: "",
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchDispositions();
    }
  }, [effectiveOrgId]);

  const fetchDispositions = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data: dispositionsData, error: dispError } = await supabase
        .from("call_dispositions")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("name");

      if (dispError) throw dispError;

      const { data: subDispositionsData, error: subError } = await supabase
        .from("call_sub_dispositions")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("name");

      if (subError) throw subError;

      const dispositionsWithSubs = (dispositionsData || []).map(disp => ({
        ...disp,
        sub_dispositions: (subDispositionsData || []).filter(sub => sub.disposition_id === disp.id),
      }));

      setDispositions(dispositionsWithSubs);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load dispositions",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDisposition = async () => {
    if (!newDisposition.name) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a disposition name",
      });
      return;
    }

    if (!effectiveOrgId) return;

    try {
      const { error } = await supabase
        .from("call_dispositions")
        .insert({
          org_id: effectiveOrgId,
          name: newDisposition.name,
          description: newDisposition.description,
          category: newDisposition.category,
        });

      if (error) throw error;

      toast({
        title: "Disposition added",
        description: "Call disposition has been created",
      });

      setNewDisposition({
        name: "",
        description: "",
        category: "neutral",
      });

      fetchDispositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add disposition",
        description: error.message,
      });
    }
  };

  const handleAddSubDisposition = async () => {
    if (!newSubDisposition.name || !newSubDisposition.dispositionId) {
      toast({
        variant: "destructive",
        title: "Information required",
        description: "Please select a disposition and enter a name",
      });
      return;
    }

    if (!effectiveOrgId) return;

    try {
      const { error } = await supabase
        .from("call_sub_dispositions")
        .insert({
          org_id: effectiveOrgId,
          disposition_id: newSubDisposition.dispositionId,
          name: newSubDisposition.name,
          description: newSubDisposition.description,
        });

      if (error) throw error;

      toast({
        title: "Sub-disposition added",
        description: "Call sub-disposition has been created",
      });

      setNewSubDisposition({
        dispositionId: "",
        name: "",
        description: "",
      });

      fetchDispositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add sub-disposition",
        description: error.message,
      });
    }
  };

  const handleDeleteDisposition = async (id: string) => {
    if (!confirm("Are you sure? This will also delete all related sub-dispositions.")) return;

    try {
      const { error } = await supabase
        .from("call_dispositions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Disposition deleted",
        description: "Call disposition has been removed",
      });

      fetchDispositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete disposition",
        description: error.message,
      });
    }
  };

  const handleDeleteSubDisposition = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sub-disposition?")) return;

    try {
      const { error } = await supabase
        .from("call_sub_dispositions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sub-disposition deleted",
        description: "Call sub-disposition has been removed",
      });

      fetchDispositions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete sub-disposition",
        description: error.message,
      });
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "positive": return "text-green-600 bg-green-50";
      case "negative": return "text-red-600 bg-red-50";
      case "follow_up": return "text-yellow-600 bg-yellow-50";
      default: return "text-gray-600 bg-gray-50";
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
          <h1 className="text-3xl font-bold text-foreground">Call Dispositions</h1>
          <p className="text-muted-foreground mt-1">Manage call outcomes and sub-dispositions</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add Disposition</CardTitle>
              <CardDescription>Create a new call disposition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Disposition Name</Label>
                <Input
                  value={newDisposition.name}
                  onChange={(e) => setNewDisposition({ ...newDisposition, name: e.target.value })}
                  placeholder="e.g., Interested"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newDisposition.category}
                  onValueChange={(value) => setNewDisposition({ ...newDisposition, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newDisposition.description}
                  onChange={(e) => setNewDisposition({ ...newDisposition, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <Button onClick={handleAddDisposition}>
                <Plus className="mr-2 h-4 w-4" />
                Add Disposition
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Sub-Disposition</CardTitle>
              <CardDescription>Create a new sub-disposition under an existing disposition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Parent Disposition</Label>
                <Select
                  value={newSubDisposition.dispositionId}
                  onValueChange={(value) => setNewSubDisposition({ ...newSubDisposition, dispositionId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions.map(disp => (
                      <SelectItem key={disp.id} value={disp.id}>
                        {disp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sub-Disposition Name</Label>
                <Input
                  value={newSubDisposition.name}
                  onChange={(e) => setNewSubDisposition({ ...newSubDisposition, name: e.target.value })}
                  placeholder="e.g., Ready to Buy"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newSubDisposition.description}
                  onChange={(e) => setNewSubDisposition({ ...newSubDisposition, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <Button onClick={handleAddSubDisposition}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sub-Disposition
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Dispositions</CardTitle>
            <CardDescription>
              {dispositions.length} disposition{dispositions.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dispositions.map((disposition) => (
                <div key={disposition.id} className="border rounded-lg">
                  <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpanded(disposition.id)}
                      className="p-0 h-6 w-6"
                    >
                      {expandedIds.has(disposition.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{disposition.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(disposition.category)}`}>
                          {disposition.category || "neutral"}
                        </span>
                      </div>
                      {disposition.description && (
                        <div className="text-sm text-muted-foreground">{disposition.description}</div>
                      )}
                      {disposition.sub_dispositions && disposition.sub_dispositions.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {disposition.sub_dispositions.length} sub-disposition{disposition.sub_dispositions.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteDisposition(disposition.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {expandedIds.has(disposition.id) && disposition.sub_dispositions && disposition.sub_dispositions.length > 0 && (
                    <div className="px-4 pb-4 space-y-2 pl-16">
                      {disposition.sub_dispositions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-4 p-3 border rounded bg-muted/30"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{sub.name}</div>
                            {sub.description && (
                              <div className="text-xs text-muted-foreground">{sub.description}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSubDisposition(sub.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
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
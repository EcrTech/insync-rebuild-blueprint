import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, RefreshCw, Plus } from "lucide-react";
import { format } from "date-fns";

interface Template {
  id: string;
  template_id: string;
  template_name: string;
  template_type: string;
  category: string;
  language: string;
  content: string;
  variables: Array<{ index: number; name: string }> | null;
  status: string;
  last_synced_at: string;
}

const Templates = () => {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (effectiveOrgId) {
      fetchTemplates();
    }
  }, [effectiveOrgId]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("template_name");

      if (error) throw error;
      setTemplates((data || []) as unknown as Template[]);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-gupshup-templates");

      if (error) throw error;

      toast({
        title: "Success",
        description: `Synced ${data.synced} templates from Gupshup`,
      });

      fetchTemplates();
    } catch (error: any) {
      console.error("Error syncing templates:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync templates",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "default";
      case "pending":
      case "pending_submission":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground mt-2">
              Manage your WhatsApp, Email, and SMS templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.location.href = '/templates/create'} variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Templates
                </>
              )}
            </Button>
          </div>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground text-center mb-4">
                Configure your WhatsApp settings and sync templates from Gupshup
              </p>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Sync Templates"
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    <Badge variant={getStatusColor(template.status)}>
                      {template.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {template.category} • {template.language}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {template.content}
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Variables:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((v: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {`{{${v.index}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Last synced: {format(new Date(template.last_synced_at), "PPp")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Templates;
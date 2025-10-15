import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Webhook, Activity, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { WebhookConfig } from "@/components/Forms/WebhookConfig";
import { ConnectorLogs } from "@/components/Forms/ConnectorLogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_active: boolean;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  webhook_token?: string;
  webhook_config?: {
    http_method?: 'GET' | 'POST';
    target_table?: 'contacts' | 'redefine_data_repository' | 'inventory_items';
    source_name?: string;
    field_mappings?: Record<string, string>;
  };
  rate_limit_per_minute: number;
  log_count?: number;
  success_count?: number;
  error_count?: number;
}

export default function Connectors() {
  const { effectiveOrgId } = useOrgContext();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [selectedConnectorLogs, setSelectedConnectorLogs] = useState<Connector | null>(null);
  const [activeView, setActiveView] = useState<"list" | "logs">("list");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    webhook_config: {
      http_method: 'POST' as 'GET' | 'POST',
      target_table: 'contacts' as 'contacts' | 'redefine_data_repository' | 'inventory_items',
      source_name: "" as string | undefined,
      field_mappings: {} as Record<string, string> | undefined,
    },
    rate_limit_per_minute: 60,
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchConnectors();
      fetchCustomFields();
    }
  }, [effectiveOrgId]);

  const fetchConnectors = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data: connectorsData, error: connectorsError } = await supabase
        .from("forms")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .eq("connector_type", "webhook")
        .order("created_at", { ascending: false });

      if (connectorsError) throw connectorsError;

      const connectorsWithStats = await Promise.all(
        (connectorsData || []).map(async (connector) => {
          const { count: totalLogs } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id);

          const { count: successCount } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id)
            .eq("status", "success");

          const { count: errorCount } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id)
            .eq("status", "error");

          return {
            ...connector,
            log_count: totalLogs || 0,
            success_count: successCount || 0,
            error_count: errorCount || 0,
          };
        })
      );

      setConnectors(connectorsWithStats as any);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading connectors",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, field_name, field_label, field_type, is_active")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("field_order");

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading fields",
        description: error.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveOrgId) return;

    setLoading(true);

    try {
      if (editingConnector) {
        const { error: updateError } = await supabase
          .from("forms")
          .update({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
            webhook_config: formData.webhook_config,
            rate_limit_per_minute: formData.rate_limit_per_minute,
          })
          .eq("id", editingConnector.id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("forms")
          .insert([{
            org_id: effectiveOrgId,
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
            connector_type: "webhook",
            webhook_config: formData.webhook_config,
            rate_limit_per_minute: formData.rate_limit_per_minute,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        
        console.log("Created webhook connector:", data);
      }

      toast({
        title: editingConnector ? "Connector updated" : "Connector created",
        description: `Webhook connector has been ${editingConnector ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      resetForm();
      fetchConnectors();
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the connector and all its logs.")) return;

    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Connector deleted",
        description: "Webhook connector has been removed successfully",
      });
      fetchConnectors();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting connector",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
      webhook_config: {
        http_method: 'POST',
        target_table: 'contacts',
        source_name: "",
        field_mappings: {},
      },
      rate_limit_per_minute: 60,
    });
    setEditingConnector(null);
  };

  const openEditDialog = (connector: Connector) => {
    setEditingConnector(connector);
    setFormData({
      name: connector.name,
      description: connector.description || "",
      is_active: connector.is_active,
      webhook_config: {
        http_method: connector.webhook_config?.http_method || 'POST',
        target_table: connector.webhook_config?.target_table || 'contacts',
        source_name: connector.webhook_config?.source_name || "",
        field_mappings: connector.webhook_config?.field_mappings || {},
      },
      rate_limit_per_minute: connector.rate_limit_per_minute || 60,
    });
    setIsDialogOpen(true);
  };

  const getWebhookUrl = (token?: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/webhook-receiver/${token || '{webhook_token}'}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Webhook Connectors</h1>
            <p className="text-muted-foreground">Manage webhook integrations for automated lead capture</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActiveView("list");
                setSelectedConnectorLogs(null);
              }}
            >
              <Webhook className="mr-2 h-4 w-4" />
              View Connectors
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Connector
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingConnector ? "Edit Connector" : "Create New Webhook Connector"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Connector Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., IndiaMART Webhook"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this connector"
                      rows={3}
                    />
                  </div>

                  <WebhookConfig
                    webhookToken={editingConnector?.webhook_token}
                    webhookUrl={getWebhookUrl(editingConnector?.webhook_token)}
                    sourceName={formData.webhook_config.source_name || ""}
                    rateLimit={formData.rate_limit_per_minute}
                    httpMethod={formData.webhook_config.http_method || 'POST'}
                    targetTable={formData.webhook_config.target_table || 'contacts'}
                    fieldMappings={formData.webhook_config.field_mappings || {}}
                    onSourceNameChange={(value) => setFormData({
                      ...formData,
                      webhook_config: { ...formData.webhook_config, source_name: value }
                    })}
                    onRateLimitChange={(value) => setFormData({
                      ...formData,
                      rate_limit_per_minute: value
                    })}
                    onHttpMethodChange={(value) => setFormData({
                      ...formData,
                      webhook_config: { ...formData.webhook_config, http_method: value }
                    })}
                    onTargetTableChange={(value) => setFormData({
                      ...formData,
                      webhook_config: { ...formData.webhook_config, target_table: value }
                    })}
                    onFieldMappingChange={(mappings) => setFormData({
                      ...formData,
                      webhook_config: { ...formData.webhook_config, field_mappings: mappings }
                    })}
                    customFields={customFields}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? "Saving..." : editingConnector ? "Update Connector" : "Create Connector"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {selectedConnectorLogs ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Connector Logs - {selectedConnectorLogs.name}</CardTitle>
                <Button variant="outline" onClick={() => setSelectedConnectorLogs(null)}>
                  Back to Connectors
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ConnectorLogs
                formId={selectedConnectorLogs.id}
                formName={selectedConnectorLogs.name}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">Loading connectors...</p>
                </CardContent>
              </Card>
            ) : connectors.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No webhook connectors created yet. Click "Create Connector" to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              connectors.map((connector) => (
                <Card key={connector.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Webhook className="h-5 w-5 text-muted-foreground mt-1" />
                        <div className="space-y-2 flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {connector.name}
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Webhook className="h-3 w-3" />
                              Webhook
                            </Badge>
                            {!connector.is_active && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            <div className="mb-2">{connector.description || "No description"}</div>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="text-primary">{connector.log_count || 0} requests</span>
                              <span>•</span>
                              <span className="text-green-600">{connector.success_count || 0} success</span>
                              {connector.error_count && connector.error_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-destructive">{connector.error_count} errors</span>
                                </>
                              )}
                              {connector.webhook_config?.source_name && (
                                <>
                                  <span>•</span>
                                  <span>Source: {connector.webhook_config.source_name}</span>
                                </>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedConnectorLogs(connector)}
                          title="View webhook logs"
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(connector)}
                          title="Edit connector"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(connector.id)}
                          title="Delete connector"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

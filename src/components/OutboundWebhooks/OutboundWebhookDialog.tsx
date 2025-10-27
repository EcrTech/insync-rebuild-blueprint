import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayloadTemplateBuilder } from "./PayloadTemplateBuilder";
import { FilterConditionsBuilder } from "./FilterConditionsBuilder";

interface OutboundWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: any;
}

export const OutboundWebhookDialog = ({
  open,
  onOpenChange,
  webhook,
}: OutboundWebhookDialogProps) => {
  const { effectiveOrgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [targetTable, setTargetTable] = useState("contacts");
  const [targetOperation, setTargetOperation] = useState("INSERT");
  const [httpMethod, setHttpMethod] = useState("POST");
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [payloadTemplate, setPayloadTemplate] = useState<any>({});
  const [filterConditions, setFilterConditions] = useState<any>({});
  const [authType, setAuthType] = useState<string>("none");
  const [authConfig, setAuthConfig] = useState<any>({});
  const [retryConfig, setRetryConfig] = useState({ 
    max_retries: 3, 
    retry_delay_seconds: 2, 
    timeout_seconds: 30 
  });

  useEffect(() => {
    if (webhook) {
      setName(webhook.name || "");
      setDescription(webhook.description || "");
      setWebhookUrl(webhook.webhook_url || "");
      setTargetTable(webhook.target_table || "contacts");
      setTargetOperation(webhook.target_operation || "INSERT");
      setHttpMethod(webhook.http_method || "POST");
      setHeaders(webhook.headers || {});
      setPayloadTemplate(webhook.payload_template || {});
      setFilterConditions(webhook.filter_conditions || {});
      setAuthType(webhook.authentication_type || "none");
      setAuthConfig(webhook.authentication_config || {});
      setRetryConfig(webhook.retry_config || { 
        max_retries: 3, 
        retry_delay_seconds: 2, 
        timeout_seconds: 30 
      });
    } else {
      resetForm();
    }
  }, [webhook, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setWebhookUrl("");
    setTargetTable("contacts");
    setTargetOperation("INSERT");
    setHttpMethod("POST");
    setHeaders({});
    setPayloadTemplate({});
    setFilterConditions({});
    setAuthType("none");
    setAuthConfig({});
    setRetryConfig({ 
      max_retries: 3, 
      retry_delay_seconds: 2, 
      timeout_seconds: 30 
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        org_id: effectiveOrgId,
        name,
        description,
        webhook_url: webhookUrl,
        target_table: targetTable,
        target_operation: targetOperation,
        trigger_event: `${targetTable}_${targetOperation.toLowerCase() === 'insert' ? 'created' : targetOperation.toLowerCase() === 'delete' ? 'deleted' : 'updated'}`,
        http_method: httpMethod,
        headers,
        payload_template: payloadTemplate,
        filter_conditions: filterConditions,
        authentication_type: authType === "none" ? null : authType,
        authentication_config: authType === "none" ? null : authConfig,
        retry_config: retryConfig,
        is_active: true,
      };

      if (webhook) {
        const { error } = await supabase
          .from("outbound_webhooks")
          .update(data)
          .eq("id", webhook.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("outbound_webhooks").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      // Create database trigger for the webhook
      try {
        await supabase.rpc('manage_webhook_trigger', {
          p_table_name: targetTable,
          p_operation: targetOperation,
          p_action: 'create'
        });
      } catch (error) {
        console.error("Failed to create trigger:", error);
      }
      
      queryClient.invalidateQueries({ queryKey: ["outbound-webhooks"] });
      notify.success(webhook ? "Webhook updated" : "Webhook created");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      notify.error(`Failed to save webhook: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!name || !webhookUrl) {
      notify.error("Name and URL are required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{webhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
          <DialogDescription>
            Configure an outbound webhook to send data to external systems
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My n8n Integration"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Send new contacts to n8n for processing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Webhook URL *</Label>
              <Input
                id="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="http://20.118.234.14:5678/webhook/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="table">Target Table *</Label>
              <Select value={targetTable} onValueChange={setTargetTable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="contact_activities">Contact Activities</SelectItem>
                  <SelectItem value="email_bulk_campaigns">Email Campaigns</SelectItem>
                  <SelectItem value="blog_posts">Blog Posts</SelectItem>
                  <SelectItem value="whatsapp_bulk_campaigns">WhatsApp Campaigns</SelectItem>
                  <SelectItem value="call_logs">Call Logs</SelectItem>
                  <SelectItem value="email_conversations">Email Conversations</SelectItem>
                  <SelectItem value="whatsapp_messages">WhatsApp Messages</SelectItem>
                  <SelectItem value="pipeline_stages">Pipeline Stages</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                  <SelectItem value="profiles">Users/Profiles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operation">Operation *</Label>
                <Select value={targetOperation} onValueChange={setTargetOperation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSERT">Create (INSERT)</SelectItem>
                    <SelectItem value="UPDATE">Update (UPDATE)</SelectItem>
                    <SelectItem value="DELETE">Delete (DELETE)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">HTTP Method</Label>
                <Select value={httpMethod} onValueChange={setHttpMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payload">
            <PayloadTemplateBuilder
              template={payloadTemplate}
              onChange={setPayloadTemplate}
              targetTable={targetTable}
              targetOperation={targetOperation}
            />
          </TabsContent>

          <TabsContent value="filters">
            <FilterConditionsBuilder
              conditions={filterConditions}
              onChange={setFilterConditions}
              targetTable={targetTable}
              targetOperation={targetOperation}
            />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth">Authentication</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType === "bearer" && (
              <div className="space-y-2">
                <Label htmlFor="token">Bearer Token</Label>
                <Input
                  id="token"
                  type="password"
                  value={authConfig.token || ""}
                  onChange={(e) =>
                    setAuthConfig({ ...authConfig, token: e.target.value })
                  }
                />
              </div>
            )}

            {authType === "api_key" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="header">Header Name</Label>
                  <Input
                    id="header"
                    value={authConfig.header_name || ""}
                    onChange={(e) =>
                      setAuthConfig({ ...authConfig, header_name: e.target.value })
                    }
                    placeholder="X-API-Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={authConfig.api_key || ""}
                    onChange={(e) =>
                      setAuthConfig({ ...authConfig, api_key: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            {authType === "basic" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={authConfig.username || ""}
                    onChange={(e) =>
                      setAuthConfig({ ...authConfig, username: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={authConfig.password || ""}
                    onChange={(e) =>
                      setAuthConfig({ ...authConfig, password: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retry">Retry Attempts</Label>
                <Input
                  id="retry"
                  type="number"
                  min="0"
                  max="5"
                  value={retryConfig.max_retries}
                  onChange={(e) => setRetryConfig({...retryConfig, max_retries: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="5"
                  max="300"
                  value={retryConfig.timeout_seconds}
                  onChange={(e) => setRetryConfig({...retryConfig, timeout_seconds: parseInt(e.target.value)})}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : webhook ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

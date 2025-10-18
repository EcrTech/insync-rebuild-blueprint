import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, RefreshCw, Plus, Mail } from "lucide-react";
import { format } from "date-fns";
import { StandardEmailTemplateDialog } from "@/components/Templates/StandardEmailTemplateDialog";

interface WhatsAppTemplate {
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

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  design_json: any;
  html_content: string;
  created_at: string;
  updated_at: string;
}

const Templates = () => {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (effectiveOrgId) {
      fetchTemplates();
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    if (!queuedJobId) return;

    // Subscribe to queue updates
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'operation_queue',
          filter: `id=eq.${queuedJobId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          setQueueStatus(newStatus);

          if (newStatus === 'completed') {
            toast({
              title: "Sync Complete",
              description: "Templates have been synced successfully",
            });
            setQueuedJobId(null);
            setQueueStatus(null);
            setSyncing(false);
            fetchWhatsAppTemplates();
          } else if (newStatus === 'failed') {
            toast({
              title: "Sync Failed",
              description: payload.new.error_message || "Failed to sync templates",
              variant: "destructive",
            });
            setQueuedJobId(null);
            setQueueStatus(null);
            setSyncing(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queuedJobId, toast]);

  const fetchTemplates = async () => {
    setLoading(true);
    await Promise.all([fetchWhatsAppTemplates(), fetchEmailTemplates()]);
    setLoading(false);
  };

  const fetchWhatsAppTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("template_name");

      if (error) throw error;
      setWhatsappTemplates((data || []) as unknown as WhatsAppTemplate[]);
    } catch (error: any) {
      console.error("Error fetching WhatsApp templates:", error);
      toast({
        title: "Error",
        description: "Failed to load WhatsApp templates",
        variant: "destructive",
      });
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching email templates:", error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke("sync-gupshup-templates");

      if (response.error) throw response.error;

      // Check if queued
      if (response.data?.status === 'queued') {
        setQueuedJobId(response.data.job_id);
        setQueueStatus('queued');
        
        toast({
          title: "Sync Queued",
          description: `Your template sync has been queued. Estimated wait: ${response.data.estimated_wait_minutes} minutes. Position: ${response.data.position_in_queue}`,
        });
      } else {
        // Immediate sync
        toast({
          title: "Success",
          description: `Synced ${response.data.synced} templates from Gupshup`,
        });
        setSyncing(false);
        fetchWhatsAppTemplates();
      }
    } catch (error: any) {
      console.error("Error syncing templates:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync templates",
        variant: "destructive",
      });
      setSyncing(false);
    }
  };

  const handleCreateEmail = () => {
    setSelectedEmailTemplate(null);
    setEmailDialogOpen(true);
  };

  const handleEditEmail = (template: EmailTemplate) => {
    setSelectedEmailTemplate(template);
    setEmailDialogOpen(true);
  };

  const handleDeleteEmail = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: false })
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      fetchEmailTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
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
        {queueStatus === 'queued' && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Template Sync Queued</p>
                  <p className="text-sm text-muted-foreground">
                    Your sync request is in the queue and will be processed shortly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground mt-2">
              Manage your WhatsApp, Email, and SMS templates
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === "whatsapp" ? (
              <>
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
              </>
            ) : (
              <Button onClick={handleCreateEmail} variant="default">
                <Plus className="mr-2 h-4 w-4" />
                Create Email Template
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp ({whatsappTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email ({emailTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-6">
            {whatsappTemplates.length === 0 ? (
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
                {whatsappTemplates.map((template) => (
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
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            {emailTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No email templates found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first email template with our drag-and-drop editor
                  </p>
                  <Button onClick={handleCreateEmail}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Email Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {emailTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="default">Email</Badge>
                      </div>
                      <CardDescription>{template.subject}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 bg-muted rounded-md text-sm max-h-32 overflow-hidden">
                        <div dangerouslySetInnerHTML={{ __html: (template as any).body_content || template.html_content }} />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        <span>Updated: {format(new Date(template.updated_at), "PPp")}</span>
                        {(template as any).buttons && (template as any).buttons.length > 0 && (
                          <span className="font-medium">
                            {(template as any).buttons.length} button{(template as any).buttons.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {(template as any).attachments && (template as any).attachments.length > 0 && (
                          <span className="font-medium">
                            {(template as any).attachments.length} attachment{(template as any).attachments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditEmail(template)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEmail(template.id)}
                          className="flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <StandardEmailTemplateDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        template={selectedEmailTemplate}
        onSuccess={fetchEmailTemplates}
      />
    </DashboardLayout>
  );
};

export default Templates;

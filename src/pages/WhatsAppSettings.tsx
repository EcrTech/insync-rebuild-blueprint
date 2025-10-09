import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle2 } from "lucide-react";

interface WhatsAppSettings {
  id?: string;
  gupshup_api_key: string;
  whatsapp_source_number: string;
  app_name: string;
  is_active: boolean;
}

const WhatsAppSettings = () => {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings>({
    gupshup_api_key: "",
    whatsapp_source_number: "",
    app_name: "",
    is_active: true,
  });
  const [templateCount, setTemplateCount] = useState(0);

  useEffect(() => {
    if (effectiveOrgId) {
      fetchSettings();
      fetchTemplateCount();
    }
  }, [effectiveOrgId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load WhatsApp settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateCount = async () => {
    try {
      const { count } = await supabase
        .from("communication_templates")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId)
        .eq("template_type", "whatsapp");

      setTemplateCount(count || 0);
    } catch (error) {
      console.error("Error fetching template count:", error);
    }
  };

  const handleSave = async () => {
    if (!settings.gupshup_api_key || !settings.whatsapp_source_number || !settings.app_name) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_settings")
        .upsert({
          ...settings,
          org_id: effectiveOrgId,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "WhatsApp settings saved successfully",
      });

      fetchSettings();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncTemplates = async () => {
    if (!settings.id) {
      toast({
        title: "Info",
        description: "Please save your settings first before syncing templates",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-gupshup-templates");

      if (error) throw error;

      toast({
        title: "Success",
        description: `Synced ${data.synced} templates from Gupshup`,
      });

      fetchTemplateCount();
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
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure your Gupshup WhatsApp Business API credentials
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                API Credentials
              </CardTitle>
              <CardDescription>
                Enter your Gupshup API credentials to enable WhatsApp messaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">Gupshup API Key *</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Gupshup API key"
                  value={settings.gupshup_api_key}
                  onChange={(e) =>
                    setSettings({ ...settings, gupshup_api_key: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-number">WhatsApp Source Number *</Label>
                <Input
                  id="source-number"
                  type="text"
                  placeholder="917738919680"
                  value={settings.whatsapp_source_number}
                  onChange={(e) =>
                    setSettings({ ...settings, whatsapp_source_number: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Enter the phone number without + symbol
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-name">App Name *</Label>
                <Input
                  id="app-name"
                  type="text"
                  placeholder="InSync"
                  value={settings.app_name}
                  onChange={(e) =>
                    setSettings({ ...settings, app_name: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Enable WhatsApp</Label>
                <Switch
                  id="is-active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, is_active: checked })
                  }
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Templates
              </CardTitle>
              <CardDescription>
                Sync and manage your WhatsApp message templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Synced Templates
                </div>
                <div className="text-3xl font-bold">{templateCount}</div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleSyncTemplates}
                  disabled={syncing || !settings.id}
                  variant="outline"
                  className="w-full"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Sync Templates from Gupshup"
                  )}
                </Button>

                <Button
                  onClick={() => navigate("/templates")}
                  variant="secondary"
                  className="w-full"
                >
                  View All Templates
                </Button>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Quick Guide:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create templates in Gupshup dashboard</li>
                  <li>Wait for WhatsApp approval</li>
                  <li>Click "Sync Templates" to import</li>
                  <li>Use templates when messaging contacts</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppSettings;
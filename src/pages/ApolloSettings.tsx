import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { LoadingState } from "@/components/common/LoadingState";
import { toast } from "sonner";
import { Save, Key, Shield, Zap } from "lucide-react";

interface ApolloConfig {
  auto_enrich_enabled: boolean;
  enrich_on_create: boolean;
  enrich_on_email_change: boolean;
  reveal_phone_by_default: boolean;
  reveal_email_by_default: boolean;
}

export default function ApolloSettings() {
  const { effectiveOrgId } = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ApolloConfig>({
    auto_enrich_enabled: false,
    enrich_on_create: false,
    enrich_on_email_change: false,
    reveal_phone_by_default: false,
    reveal_email_by_default: false
  });

  useEffect(() => {
    fetchSettings();
  }, [effectiveOrgId]);

  const fetchSettings = async () => {
    if (!effectiveOrgId) return;

    setLoading(true);
    try {
      // Fetch org settings
      const { data: orgData } = await supabase
        .from("organizations")
        .select("apollo_config")
        .eq("id", effectiveOrgId)
        .single();

      if (orgData?.apollo_config) {
        const configData = orgData.apollo_config as unknown as ApolloConfig;
        setConfig(configData);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveOrgId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ apollo_config: config as any })
        .eq("id", effectiveOrgId);

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Apollo Settings</h1>
          <p className="text-muted-foreground">
            Configure Apollo.io data enrichment preferences
          </p>
        </div>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Your Apollo.io API credentials are securely stored
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">API Key Status</p>
                <p className="text-sm text-muted-foreground">
                  API key is configured via secrets
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                Active
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Enrichment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Auto-Enrichment
            </CardTitle>
            <CardDescription>
              Automatically enrich contacts when certain events occur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-enrich">Enable Auto-Enrichment</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically trigger enrichment based on rules below
                </p>
              </div>
              <Switch
                id="auto-enrich"
                checked={config.auto_enrich_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, auto_enrich_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="enrich-create">Enrich on Contact Creation</Label>
                <p className="text-sm text-muted-foreground">
                  Enrich new contacts automatically when created
                </p>
              </div>
              <Switch
                id="enrich-create"
                checked={config.enrich_on_create}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enrich_on_create: checked })
                }
                disabled={!config.auto_enrich_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="enrich-email">Enrich on Email Change</Label>
                <p className="text-sm text-muted-foreground">
                  Re-enrich when contact email is updated
                </p>
              </div>
              <Switch
                id="enrich-email"
                checked={config.enrich_on_email_change}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enrich_on_email_change: checked })
                }
                disabled={!config.auto_enrich_enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Default Reveal Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Default Reveal Settings
            </CardTitle>
            <CardDescription>
              Configure default behavior for revealing contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="reveal-phone">Reveal Phone Numbers</Label>
                <p className="text-sm text-muted-foreground">
                  Use extra credits to reveal phone numbers by default
                </p>
              </div>
              <Switch
                id="reveal-phone"
                checked={config.reveal_phone_by_default}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, reveal_phone_by_default: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="reveal-email">Reveal Personal Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Use extra credits to reveal personal emails by default
                </p>
              </div>
              <Switch
                id="reveal-email"
                checked={config.reveal_email_by_default}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, reveal_email_by_default: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

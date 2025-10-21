import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";

export default function ExotelSettings() {
  const notify = useNotification();
  const { effectiveOrgId } = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    api_key: "",
    api_token: "",
    account_sid: "",
    subdomain: "api.exotel.com",
    caller_id: "",
    call_recording_enabled: true,
    is_active: true,
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exotel-webhook`;

  useEffect(() => {
    if (effectiveOrgId) {
      fetchSettings();
    }
  }, [effectiveOrgId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('exotel_settings')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          api_key: data.api_key || "",
          api_token: data.api_token || "",
          account_sid: data.account_sid || "",
          subdomain: data.subdomain || "api.exotel.com",
          caller_id: data.caller_id || "",
          call_recording_enabled: data.call_recording_enabled ?? true,
          is_active: data.is_active ?? true,
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.api_key || !settings.api_token || !settings.account_sid || !settings.caller_id) {
      notify.error("Missing fields", "Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('exotel_settings')
        .upsert({
          org_id: effectiveOrgId,
          ...settings,
        });

      if (error) throw error;

      notify.success("Settings saved", "Exotel configuration has been updated");
    } catch (error: any) {
      console.error('Error saving settings:', error);
      notify.error("Error", error);
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify.success("Copied!", "Webhook URL copied to clipboard");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Exotel Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure Exotel integration for calling functionality
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Credentials</CardTitle>
            <CardDescription>
              Enter your Exotel API credentials. You can find these in your Exotel dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={settings.api_key}
                  onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                  placeholder="Enter your Exotel API key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_token">API Token *</Label>
                <Input
                  id="api_token"
                  type="password"
                  value={settings.api_token}
                  onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                  placeholder="Enter your Exotel API token"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_sid">Account SID *</Label>
                <Input
                  id="account_sid"
                  value={settings.account_sid}
                  onChange={(e) => setSettings({ ...settings, account_sid: e.target.value })}
                  placeholder="Enter your Exotel Account SID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  value={settings.subdomain}
                  onChange={(e) => setSettings({ ...settings, subdomain: e.target.value })}
                  placeholder="api.exotel.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caller_id">Caller ID *</Label>
                <Input
                  id="caller_id"
                  value={settings.caller_id}
                  onChange={(e) => setSettings({ ...settings, caller_id: e.target.value })}
                  placeholder="Enter verified Exotel number"
                />
                <p className="text-xs text-muted-foreground">
                  This number will be displayed when making calls
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="recording">Call Recording</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically record all calls
                </p>
              </div>
              <Switch
                id="recording"
                checked={settings.call_recording_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, call_recording_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable Exotel integration
                </p>
              </div>
              <Switch
                id="active"
                checked={settings.is_active}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, is_active: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              This webhook URL is automatically included in all Exotel API calls (no configuration needed in Exotel portal)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This webhook receives call status updates from Exotel
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

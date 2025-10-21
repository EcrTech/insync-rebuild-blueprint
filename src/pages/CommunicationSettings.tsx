import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { MessageSquare, Mail, PhoneCall } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { LoadingState } from "@/components/common/LoadingState";
import { Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// WhatsApp Settings Component
function WhatsAppSettingsTab() {
  const { effectiveOrgId } = useOrgContext();
  const notify = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          gupshup_api_key: data.gupshup_api_key || "",
          whatsapp_source_number: data.whatsapp_source_number || "",
          app_name: data.app_name || "",
          is_active: data.is_active ?? true,
        });
      }
    } catch (error) {
      notify.error("Error loading settings", error as Error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateCount = async () => {
    try {
      // @ts-ignore - Avoiding deep type instantiation issue
      const result = await supabase
        .from("communication_templates")
        .select("*", { count: 'exact', head: true })
        .eq("org_id", effectiveOrgId)
        .eq("channel", "whatsapp");

      setTemplateCount(result.count || 0);
    } catch (error) {
      console.error("Error fetching template count:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_settings")
        .upsert({
          org_id: effectiveOrgId,
          ...settings,
        });

      if (error) throw error;
      notify.success("Settings saved", "WhatsApp settings have been updated successfully");
    } catch (error) {
      notify.error("Error saving settings", error as Error);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-gupshup-templates');
      if (error) throw error;
      
      notify.success("Templates synced", "WhatsApp templates have been synced successfully");
      fetchTemplateCount();
    } catch (error) {
      notify.error("Error syncing templates", error as Error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading WhatsApp settings..." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gupshup Configuration</CardTitle>
          <CardDescription>
            Configure your Gupshup WhatsApp Business API settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gupshup_api_key">API Key</Label>
            <Input
              id="gupshup_api_key"
              type="password"
              value={settings.gupshup_api_key}
              onChange={(e) => setSettings({ ...settings, gupshup_api_key: e.target.value })}
              placeholder="Enter your Gupshup API key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_source_number">WhatsApp Business Number</Label>
            <Input
              id="whatsapp_source_number"
              value={settings.whatsapp_source_number}
              onChange={(e) => setSettings({ ...settings, whatsapp_source_number: e.target.value })}
              placeholder="91XXXXXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app_name">App Name</Label>
            <Input
              id="app_name"
              value={settings.app_name}
              onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
              placeholder="Your app name"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
            />
            <Label htmlFor="is_active">Enable WhatsApp Integration</Label>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template Management</CardTitle>
          <CardDescription>
            Sync and manage your WhatsApp message templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active Templates</p>
              <p className="text-2xl font-bold">{templateCount}</p>
            </div>
            <Button onClick={handleSyncTemplates} disabled={syncing} variant="outline">
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync Templates
            </Button>
          </div>
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Templates are synced automatically from your Gupshup account
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

// Email Settings Component
function EmailSettingsTab() {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { action: 'get-domain' },
      });

      if (error) throw error;
      return data;
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success("Copied", "DNS record copied to clipboard");
  };

  const handleAddDomain = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { 
          action: 'add-domain',
          domain,
        },
      });

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      notify.success("Domain added", "Email domain has been configured");
      setDomain("");
    } catch (error) {
      notify.error("Error", (error as Error).message || "Failed to add domain");
    }
  };

  const handleVerifyDomain = async () => {
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { action: 'verify-domain' },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      
      if (data.verified) {
        notify.success("Domain verified", "Your email domain is now verified");
      } else {
        notify.error("Verification pending", "DNS records not yet propagated. Please wait a few minutes.");
      }
    } catch (error) {
      notify.error("Error", (error as Error).message || "Failed to verify domain");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading email settings..." />;
  }

  return (
    <div className="space-y-6">
      {!settings?.domain ? (
        <Card>
          <CardHeader>
            <CardTitle>Configure Email Domain</CardTitle>
            <CardDescription>
              Add your domain to start sending emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
              />
            </div>
            <Button onClick={handleAddDomain}>
              Add Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Domain Status</CardTitle>
              <CardDescription>{settings.domain}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {settings.verified ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {settings.verified ? "Verified" : "Pending Verification"}
                </span>
              </div>

              {!settings.verified && (
                <Button onClick={handleVerifyDomain} disabled={isVerifying}>
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Domain
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DNS Records</CardTitle>
              <CardDescription>
                Add these DNS records to your domain provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.dns_records?.map((record: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{record.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(record.value)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm space-y-1">
                    <div><span className="text-muted-foreground">Name:</span> {record.name}</div>
                    <div className="break-all"><span className="text-muted-foreground">Value:</span> {record.value}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Exotel Settings Component
function ExotelSettingsTab() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error) {
      notify.error("Error loading settings", error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('exotel_settings')
        .upsert({
          org_id: effectiveOrgId,
          ...settings,
        });

      if (error) throw error;
      notify.success("Settings saved", "Exotel settings have been updated successfully");
    } catch (error) {
      notify.error("Error saving settings", error as Error);
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    notify.success("Copied", "Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingState message="Loading Exotel settings..." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exotel API Configuration</CardTitle>
          <CardDescription>
            Configure your Exotel calling credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={settings.api_key}
              onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
              placeholder="Enter your Exotel API key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_token">API Token</Label>
            <Input
              id="api_token"
              type="password"
              value={settings.api_token}
              onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
              placeholder="Enter your Exotel API token"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_sid">Account SID</Label>
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
            <Label htmlFor="caller_id">Caller ID (ExoPhone)</Label>
            <Input
              id="caller_id"
              value={settings.caller_id}
              onChange={(e) => setSettings({ ...settings, caller_id: e.target.value })}
              placeholder="Enter your Exotel ExoPhone number"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="call_recording_enabled"
              checked={settings.call_recording_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, call_recording_enabled: checked })}
            />
            <Label htmlFor="call_recording_enabled">Enable Call Recording</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
            />
            <Label htmlFor="is_active">Enable Exotel Integration</Label>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Configure this webhook URL in your Exotel dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyWebhookUrl} variant="outline" size="icon">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Add this webhook URL to your Exotel dashboard to receive call events
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CommunicationSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Communication Settings</h1>
          <p className="text-muted-foreground">
            Configure WhatsApp, Email, and Calling integrations
          </p>
        </div>

        <Tabs defaultValue="whatsapp" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="whatsapp">
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="exotel">
              <PhoneCall className="h-4 w-4 mr-2" />
              Calling (Exotel)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="space-y-6">
            <WhatsAppSettingsTab />
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <EmailSettingsTab />
          </TabsContent>

          <TabsContent value="exotel" className="space-y-6">
            <ExotelSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

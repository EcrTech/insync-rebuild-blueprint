import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WebhookConfigProps {
  webhookToken?: string;
  webhookUrl: string;
  sourceName: string;
  rateLimit: number;
  fieldMappings: Record<string, string>;
  onSourceNameChange: (value: string) => void;
  onRateLimitChange: (value: number) => void;
  onFieldMappingChange: (mappings: Record<string, string>) => void;
  onRegenerateToken?: () => void;
  customFields: Array<{ id: string; field_name: string; field_label: string }>;
}

export function WebhookConfig({
  webhookToken,
  webhookUrl,
  sourceName,
  rateLimit,
  fieldMappings,
  onSourceNameChange,
  onRateLimitChange,
  onFieldMappingChange,
  onRegenerateToken,
  customFields,
}: WebhookConfigProps) {
  const [showToken, setShowToken] = useState(false);
  const [newMapping, setNewMapping] = useState({ incoming: "", target: "" });
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const addMapping = () => {
    if (!newMapping.incoming || !newMapping.target) return;
    
    onFieldMappingChange({
      ...fieldMappings,
      [newMapping.incoming]: newMapping.target,
    });
    
    setNewMapping({ incoming: "", target: "" });
  };

  const removeMapping = (key: string) => {
    const { [key]: _, ...rest } = fieldMappings;
    onFieldMappingChange(rest);
  };

  const targetFieldOptions = [
    { value: "first_name", label: "First Name (Standard)" },
    { value: "last_name", label: "Last Name (Standard)" },
    { value: "email", label: "Email (Standard)" },
    { value: "phone", label: "Phone (Standard)" },
    { value: "company", label: "Company (Standard)" },
    { value: "notes", label: "Notes (Standard)" },
    ...customFields.map(field => ({
      value: field.field_name,
      label: `${field.field_label} (Custom)`,
    })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Endpoint</CardTitle>
          <CardDescription>
            Send POST requests to this URL to create leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {webhookToken && (
            <div>
              <Label className="text-xs text-muted-foreground">Webhook Token</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={showToken ? webhookToken : "wh_" + "•".repeat(40)}
                  readOnly
                  className="font-mono text-sm bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookToken, "Token")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {onRegenerateToken && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRegenerateToken}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Token is embedded in the URL. No additional authentication needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source_name">Source Name</Label>
          <Input
            id="source_name"
            value={sourceName}
            onChange={(e) => onSourceNameChange(e.target.value)}
            placeholder="e.g., Justdial, Facebook Ads"
          />
          <p className="text-xs text-muted-foreground">
            How this lead source will appear in contact records
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate_limit">Rate Limit (requests/minute)</Label>
          <Input
            id="rate_limit"
            type="number"
            min={1}
            max={1000}
            value={rateLimit}
            onChange={(e) => onRateLimitChange(parseInt(e.target.value) || 60)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum webhook requests allowed per minute
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field Mappings</CardTitle>
          <CardDescription>
            Map incoming webhook fields to your CRM fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(fieldMappings).length > 0 && (
            <div className="space-y-2">
              {Object.entries(fieldMappings).map(([incoming, target]) => (
                <div key={incoming} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Badge variant="outline" className="font-mono">
                    {incoming}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge>
                    {targetFieldOptions.find(opt => opt.value === target)?.label || target}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => removeMapping(incoming)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]">
            <Input
              placeholder="Incoming field name"
              value={newMapping.incoming}
              onChange={(e) => setNewMapping({ ...newMapping, incoming: e.target.value })}
              className="font-mono"
            />
            <span className="flex items-center text-muted-foreground">→</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={newMapping.target}
              onChange={(e) => setNewMapping({ ...newMapping, target: e.target.value })}
            >
              <option value="">Select target field</option>
              {targetFieldOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={addMapping}
              disabled={!newMapping.incoming || !newMapping.target}
            >
              Add
            </Button>
          </div>

          <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1">
            <p className="font-medium">Default mappings (auto-applied):</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><code>name</code> → first_name, last_name</li>
              <li><code>email</code> → email</li>
              <li><code>phone</code> or <code>mobile</code> → phone</li>
              <li><code>company</code> or <code>company_name</code> → company</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Your Webhook</CardTitle>
          <CardDescription>
            Example cURL command to test webhook integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
{`curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+919876543210",
  "company": "Test Company"
}'`}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => copyToClipboard(`curl -X POST '${webhookUrl}' -H 'Content-Type: application/json' -d '{"name": "Test User", "email": "test@example.com", "phone": "+919876543210", "company": "Test Company"}'`, "cURL command")}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy cURL
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

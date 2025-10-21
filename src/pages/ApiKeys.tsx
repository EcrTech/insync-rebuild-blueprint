import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Copy, Key, Plus, Trash2, Eye, EyeOff, BookOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useOrgData } from "@/hooks/useOrgData";
import { useNotification } from "@/hooks/useNotification";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, Column } from "@/components/common/DataTable";

export default function ApiKeys() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [selectedKeyForDocs, setSelectedKeyForDocs] = useState<any>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const notification = useNotification();

  // Fetch API keys
  const { data: apiKeys, isLoading } = useOrgData<any>('api_keys', {
    orderBy: { column: 'created_at', ascending: false },
  });

  // Fetch usage logs
  const { data: usageLogs } = useOrgData<any>('api_key_usage_logs', {
    select: '*, api_keys(key_name)',
    orderBy: { column: 'created_at', ascending: false },
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile?.org_id) throw new Error('No organization found');

      // Generate API key
      const { data: keyData, error: keyError } = await supabase.rpc('generate_api_key');
      if (keyError) throw keyError;

      const apiKey = keyData as string;
      const keyPrefix = apiKey.substring(0, 15) + '...';

      // Insert API key
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          org_id: profile.org_id,
          key_name: newKeyName,
          api_key: apiKey,
          key_prefix: keyPrefix,
          permissions: {
            endpoints: ['contacts', 'activities', 'pipeline-stages', 'custom-fields'],
            description: newKeyDescription
          },
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      return { ...data, full_api_key: apiKey };
    },
    onSuccess: (data) => {
      setGeneratedKey(data.full_api_key);
      setShowGeneratedKey(true);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notification.success("API Key Created", "Your API key has been generated. Make sure to copy it now!");
      setNewKeyName("");
      setNewKeyDescription("");
    },
    onError: (error) => {
      notification.error("Error creating API key", error);
    },
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notification.success("API key deleted successfully");
      setDeleteKeyId(null);
    },
    onError: (error) => {
      notification.error("Error deleting API key", error);
    },
  });

  // Toggle API key status
  const toggleKeyMutation = useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !isActive })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notification.success("API key status updated");
    },
    onError: (error) => {
      notification.error("Error updating API key", error);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notification.success("Copied!", "API key copied to clipboard");
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      notification.error("Please enter a key name");
      return;
    }
    createKeyMutation.mutate();
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setGeneratedKey(null);
    setShowGeneratedKey(false);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage secure API access to your CRM data
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for external access to your CRM data
              </DialogDescription>
            </DialogHeader>

            {!generatedKey ? (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name *</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production Bridge"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What will this key be used for?"
                      value={newKeyDescription}
                      onChange={(e) => setNewKeyDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateKey}
                    disabled={createKeyMutation.isPending}
                  >
                    {createKeyMutation.isPending ? "Generating..." : "Generate Key"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure to copy your API key now. You won't be able to see it again!
                  </AlertDescription>
                </Alert>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Your API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={showGeneratedKey ? generatedKey : '•'.repeat(50)}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowGeneratedKey(!showGeneratedKey)}
                      >
                        {showGeneratedKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(generatedKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={handleCloseCreateDialog}>Done</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage Logs</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for external integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingState message="Loading API keys..." />
              ) : !apiKeys || apiKeys.length === 0 ? (
                <EmptyState
                  icon={<Key className="h-12 w-12 opacity-50" />}
                  title="No API keys created yet"
                  message="Create your first API key to get started"
                />
              ) : (
                <DataTable
                  data={apiKeys}
                  columns={[
                    { header: 'Name', accessor: 'key_name' },
                    { header: 'Key Prefix', accessor: 'key_prefix', className: 'font-mono text-sm' },
                    {
                      header: 'Status',
                      accessor: (key) => (
                        <StatusBadge 
                          status={key.is_active ? 'active' : 'inactive'} 
                        />
                      ),
                    },
                    {
                      header: 'Last Used',
                      accessor: (key) => (
                        <span className="text-sm">
                          {key.last_used_at
                            ? format(new Date(key.last_used_at), 'MMM dd, yyyy HH:mm')
                            : 'Never'}
                        </span>
                      ),
                    },
                    {
                      header: 'Created',
                      accessor: (key) => (
                        <span className="text-sm">
                          {format(new Date(key.created_at), 'MMM dd, yyyy')}
                        </span>
                      ),
                    },
                  ]}
                  renderActions={(key) => (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedKeyForDocs(key)}
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleKeyMutation.mutate({
                            keyId: key.id,
                            isActive: key.is_active,
                          })
                        }
                      >
                        {key.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteKeyId(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Usage</CardTitle>
              <CardDescription>
                Monitor API requests and responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!usageLogs || usageLogs.length === 0 ? (
                <EmptyState
                  title="No API usage yet"
                  message="API usage logs will appear here once you start making requests"
                />
              ) : (
                <DataTable
                  data={usageLogs}
                  columns={[
                    {
                      header: 'Timestamp',
                      accessor: (log) => (
                        <span className="text-sm">
                          {format(new Date(log.created_at), 'MMM dd HH:mm:ss')}
                        </span>
                      ),
                    },
                    {
                      header: 'API Key',
                      accessor: (log) => (
                        <span className="text-sm">
                          {log.api_keys?.key_name || 'Unknown'}
                        </span>
                      ),
                    },
                    { header: 'Endpoint', accessor: 'endpoint', className: 'font-mono text-sm' },
                    {
                      header: 'Method',
                      accessor: (log) => <Badge variant="outline">{log.method}</Badge>,
                    },
                    {
                      header: 'Status',
                      accessor: (log) => (
                        <Badge
                          variant={
                            log.status_code >= 200 && log.status_code < 300
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {log.status_code}
                        </Badge>
                      ),
                    },
                    {
                      header: 'Response Time',
                      accessor: (log) => (
                        <span className="text-sm">
                          {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>
                Learn how to use the CRM Bridge API
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <h3>Authentication</h3>
              <p>Include your API key in the <code>X-API-Key</code> header:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`curl -H "X-API-Key: your_api_key_here" \\
  https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api/contacts`}
              </pre>

              <h3>Base URL</h3>
              <div className="flex items-center gap-2 mb-6">
                <p className="font-mono text-sm bg-muted p-2 rounded flex-1">
                  https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard('https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <h3>Complete Endpoint URLs</h3>
              <div className="space-y-3 mb-6">
                {[
                  { method: 'GET', path: '/contacts', desc: 'List all contacts with filters' },
                  { method: 'GET', path: '/contacts/{id}', desc: 'Get single contact details' },
                  { method: 'POST', path: '/contacts', desc: 'Create new contact' },
                  { method: 'PATCH', path: '/contacts/{id}', desc: 'Update contact' },
                  { method: 'GET', path: '/contacts/{id}/activities', desc: 'Get contact activities' },
                  { method: 'POST', path: '/contacts/{id}/activities', desc: 'Log new activity' },
                  { method: 'GET', path: '/pipeline-stages', desc: 'Get pipeline stages' },
                  { method: 'GET', path: '/custom-fields', desc: 'Get custom fields' },
                  { method: 'GET', path: '/approval-types', desc: 'List approval types' },
                  { method: 'GET', path: '/approval-types/{id}', desc: 'Get single approval type' },
                  { method: 'GET', path: '/approval-rules', desc: 'List approval rules' },
                  { method: 'GET', path: '/approval-rules/{id}', desc: 'Get single approval rule' },
                  { method: 'GET', path: '/approval-rules/evaluate', desc: 'Evaluate approval rule for amount' },
                  { method: 'GET', path: '/users', desc: 'List all users with filters' },
                  { method: 'GET', path: '/users/{id}', desc: 'Get single user details' },
                  { method: 'PATCH', path: '/users/{id}', desc: 'Update user profile' },
                  { method: 'GET', path: '/users/{id}/roles', desc: 'Get user roles' },
                  { method: 'GET', path: '/roles', desc: 'List all user roles in org' },
                  { method: 'POST', path: '/users/{id}/roles', desc: 'Assign role to user' },
                  { method: 'DELETE', path: '/users/{id}/roles/{role_id}', desc: 'Remove role from user' },
                  { method: 'GET', path: '/designations', desc: 'List all designations' },
                  { method: 'GET', path: '/designations/{id}', desc: 'Get single designation' },
                  { method: 'POST', path: '/designations', desc: 'Create new designation' },
                  { method: 'PATCH', path: '/designations/{id}', desc: 'Update designation' },
                  { method: 'DELETE', path: '/designations/{id}', desc: 'Deactivate designation' },
                  { method: 'GET', path: '/designations/{id}/features', desc: 'Get designation feature access' },
                  { method: 'PATCH', path: '/designations/{id}/features', desc: 'Update designation feature access' },
                  { method: 'GET', path: '/blog-posts', desc: 'List or check blog posts' },
                  { method: 'POST', path: '/blog-posts', desc: 'Create new blog post entry' },
                  { method: 'PUT', path: '/blog-posts/{id}', desc: 'Update blog post details' },
                ].map((endpoint, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-1">
                      <Badge variant="outline" className="mt-0.5">
                        {endpoint.method}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm break-all">
                          https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api{endpoint.path}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{endpoint.desc}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api${endpoint.path}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <h3>API Usage Examples</h3>
              
              <h4>List Contacts</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /contacts?limit=50&offset=0&status=new&search=john

Response:
{
  "success": true,
  "data": {
    "contacts": [...],
    "pagination": {
      "total": 100,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}`}
              </pre>

              <h4>Get Single Contact</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /contacts/{contact_id}`}
              </pre>

              <h4>Create Contact</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST /contacts
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "Acme Corp"
}`}
              </pre>

              <h4>Update Contact</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`PATCH /contacts/{contact_id}
Content-Type: application/json

{
  "status": "qualified",
  "notes": "Updated information"
}`}
              </pre>

              <h4>Other Endpoints</h4>
              <ul>
                <li><code>GET /contacts/{'{contact_id}'}/activities</code> - Get contact activities</li>
                <li><code>POST /contacts/{'{contact_id}'}/activities</code> - Log new activity</li>
                <li><code>GET /pipeline-stages</code> - Get all pipeline stages</li>
                <li><code>GET /custom-fields</code> - Get custom field definitions</li>
              </ul>

              <h3>Approval Matrix Endpoints</h3>
              
              <h4>List Approval Types</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /approval-types?is_active=true

Response:
{
  "success": true,
  "data": {
    "approval_types": [
      {
        "id": "uuid",
        "org_id": "uuid",
        "name": "Purchase Order",
        "description": "Approval for purchase orders",
        "is_active": true,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-10-15T14:20:00Z"
      }
    ]
  }
}`}
              </pre>

              <h4>List Approval Rules</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /approval-rules?approval_type_id=uuid&limit=50&offset=0

Response:
{
  "success": true,
  "data": {
    "approval_rules": [
      {
        "id": "uuid",
        "approval_type_id": "uuid",
        "name": "Small Purchase",
        "description": "Orders under $1000",
        "threshold_amount": 1000.00,
        "required_roles": ["sales_agent"],
        "approval_flow": [
          {
            "step": 1,
            "role": "sales_agent",
            "role_label": "Sales Agent"
          }
        ],
        "is_active": true,
        "approval_types": {
          "id": "uuid",
          "name": "Purchase Order"
        }
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}`}
              </pre>

              <h4>Evaluate Approval Rule</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /approval-rules/evaluate?approval_type_id=uuid&amount=5000

Response:
{
  "success": true,
  "data": {
    "matched": true,
    "rule": {
      "id": "uuid",
      "name": "Medium Purchase",
      "threshold_amount": 5000.00,
      "approval_flow": [
        {
          "step": 1,
          "role": "sales_manager",
          "role_label": "Sales Manager"
        },
        {
          "step": 2,
          "role": "admin",
          "role_label": "Admin"
        }
      ]
    },
    "approval_type_id": "uuid",
    "amount": 5000
  }
}`}
              </pre>

              <h3>Users & Roles Endpoints</h3>
              
              <h4>List Users</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /users?limit=50&offset=0&designation_id=uuid&is_active=true&search=john

Response:
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890",
        "designation_id": "uuid",
        "is_active": true,
        "calling_enabled": true,
        "whatsapp_enabled": true,
        "email_enabled": true,
        "sms_enabled": true,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-10-15T14:20:00Z",
        "roles": [
          {
            "id": "uuid",
            "role": "sales_agent",
            "role_label": "Sales Agent"
          }
        ],
        "designations": {
          "id": "uuid",
          "name": "Senior Sales Executive",
          "role": "sales_agent"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}`}
              </pre>

              <h4>Get Single User</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /users/{user_id}

Response includes full profile with roles and designation details`}
              </pre>

              <h4>Update User Profile</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`PATCH /users/{user_id}
Content-Type: application/json

{
  "first_name": "Jane",
  "designation_id": "uuid",
  "calling_enabled": true,
  "is_active": true
}

Allowed fields: first_name, last_name, phone, designation_id, is_active,
calling_enabled, whatsapp_enabled, email_enabled, sms_enabled`}
              </pre>

              <h4>User Roles Management</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`# Get user's roles
GET /users/{user_id}/roles

# List all roles in organization
GET /roles

# Assign role to user
POST /users/{user_id}/roles
Content-Type: application/json

{
  "role": "sales_manager"
}

Available roles: super_admin, admin, sales_manager, sales_agent,
support_manager, support_agent, analyst

# Remove role from user
DELETE /users/{user_id}/roles/{role_id}`}
              </pre>

              <h3>Blog Posts Endpoints</h3>
              
              <h4>Check if Blog Exists</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /blog-posts?blog_url=https://yoursite.com/blog/post-title

Response:
{
  "success": true,
  "data": {
    "blog_posts": [
      {
        "id": "uuid",
        "org_id": "uuid",
        "blog_url": "https://yoursite.com/blog/post-title",
        "blog_title": "Post Title",
        "blog_excerpt": "Post excerpt...",
        "publish_date": "2025-10-20",
        "social_posted": true,
        "email_campaign_sent": true,
        "twitter_url": "https://twitter.com/...",
        "linkedin_url": "https://linkedin.com/...",
        "facebook_url": "https://facebook.com/...",
        "campaign_id": "uuid",
        "status": "posted",
        "created_at": "2025-10-20T10:00:00Z"
      }
    ]
  }
}`}
              </pre>

              <h4>Create Blog Post</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST /blog-posts
Content-Type: application/json

{
  "blog_url": "https://yoursite.com/blog/post-title",
  "blog_title": "Your Blog Post Title",
  "blog_excerpt": "Brief excerpt of the blog post...",
  "publish_date": "2025-10-20",
  "social_posted": true,
  "email_campaign_sent": false,
  "twitter_url": "https://twitter.com/status/...",
  "linkedin_url": "https://linkedin.com/post/...",
  "facebook_url": "https://facebook.com/post/...",
  "featured_image_url": "https://yoursite.com/image.jpg",
  "status": "posted"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "uuid",
    "org_id": "uuid",
    "blog_url": "https://yoursite.com/blog/post-title",
    "blog_title": "Your Blog Post Title",
    ... (blog post details)
  }
}

Note: Database trigger will automatically create email campaign and send to all contacts`}
              </pre>

              <h4>Update Blog Post</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`PUT /blog-posts/{blog_id}
Content-Type: application/json

{
  "campaign_id": "uuid",
  "email_campaign_sent": true,
  "status": "completed"
}`}
              </pre>

              <h3>Designations Endpoints</h3>
              
              <h4>List Designations</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`GET /designations?is_active=true

Response:
{
  "success": true,
  "data": {
    "designations": [
      {
        "id": "uuid",
        "org_id": "uuid",
        "name": "Senior Sales Executive",
        "description": "Handles major accounts",
        "role": "sales_agent",
        "role_label": "Sales Agent",
        "is_active": true,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-10-15T14:20:00Z"
      }
    ]
  }
}`}
              </pre>

              <h4>Create Designation</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST /designations
Content-Type: application/json

{
  "name": "Sales Executive",
  "description": "Handles sales operations",
  "role": "sales_agent",
  "is_active": true
}`}
              </pre>

              <h4>Update Designation</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`PATCH /designations/{designation_id}
Content-Type: application/json

{
  "name": "Senior Sales Executive",
  "description": "Updated description"
}`}
              </pre>

              <h4>Designation Feature Access</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`# Get feature access for designation
GET /designations/{designation_id}/features

Response:
{
  "success": true,
  "data": {
    "feature_access": [
      {
        "id": "uuid",
        "designation_id": "uuid",
        "feature_key": "contacts",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": false,
        "custom_permissions": {},
        "feature_permissions": {
          "feature_key": "contacts",
          "feature_name": "Contacts",
          "category": "core"
        }
      }
    ]
  }
}

# Update feature access
PATCH /designations/{designation_id}/features
Content-Type: application/json

{
  "feature_key": "contacts",
  "can_view": true,
  "can_create": true,
  "can_edit": true,
  "can_delete": false,
  "custom_permissions": {}
}`}
              </pre>

              <h3>Rate Limits</h3>
              <p>100 requests per minute per API key</p>

              <h3>Error Handling</h3>
              <p>All errors follow this format:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  },
  "meta": {
    "timestamp": "2025-10-15T11:00:00Z",
    "request_id": "uuid"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* API Key Documentation Dialog */}
      <Dialog open={!!selectedKeyForDocs} onOpenChange={() => setSelectedKeyForDocs(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Documentation - {selectedKeyForDocs?.key_name}</DialogTitle>
            <DialogDescription>
              Integration guide for the {selectedKeyForDocs?.key_name} API
            </DialogDescription>
          </DialogHeader>

          {selectedKeyForDocs?.key_name?.toLowerCase().includes('blog') ? (
            // Blog Webhook Documentation
            <div className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is a webhook endpoint for automatically creating blog posts and triggering email campaigns
                </AlertDescription>
              </Alert>

              <div>
                <h3 className="text-lg font-semibold mb-2">Endpoint URL</h3>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                  <code className="flex-1 text-sm">
                    https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/blog-webhook
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/blog-webhook')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Request Format</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST /functions/v1/blog-webhook
Content-Type: application/json

{
  "blog_url": "https://yoursite.com/blog/post-title",
  "blog_title": "Your Blog Post Title",
  "blog_excerpt": "Brief summary...",
  "publish_date": "2025-10-20",
  "featured_image_url": "https://yoursite.com/image.jpg",
  "status": "posted",
  "social_posted": true
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Required Fields</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>org_id</code> (UUID) - Organization ID: <code>65e22e43-f23d-4c0a-9d84-2eba65ad0e12</code></li>
                  <li><code>blog_url</code> (URL) - Full URL of the blog post</li>
                  <li><code>blog_title</code> (string, max 500 chars) - Title of the blog post</li>
                  <li><code>status</code> (string) - Must be "posted" to trigger email campaign</li>
                  <li><code>social_posted</code> (boolean) - Must be true to trigger email campaign</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Optional Fields</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>blog_excerpt</code> (string, max 1000 chars) - Brief summary of the post</li>
                  <li><code>featured_image_url</code> (URL) - Main image for the blog post</li>
                  <li><code>publish_date</code> (YYYY-MM-DD) - Defaults to today if not provided</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Success Response (200)</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "message": "Blog post created and email campaign initiated",
  "blog_post_id": "uuid",
  "campaign_id": "uuid",
  "request_id": "req_1729418426000_a1b2c3d4",
  "timestamp": "2025-10-20T12:00:00.000Z"
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Error Responses</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">400 Bad Request - Validation Error</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "success": false,
  "error": "Validation failed: Missing required field 'blog_title'",
  "request_id": "req_1729418426000_a1b2c3d4",
  "timestamp": "2025-10-20T12:00:00.000Z"
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">404 Not Found - Invalid Organization</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "success": false,
  "error": "Organization not found",
  "request_id": "req_1729418426000_a1b2c3d4",
  "timestamp": "2025-10-20T12:00:00.000Z"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Example cURL Request</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/blog-webhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "org_id": "65e22e43-f23d-4c0a-9d84-2eba65ad0e12",
    "blog_url": "https://example.com/my-blog-post",
    "blog_title": "Amazing New Feature Launch",
    "blog_excerpt": "We are excited to announce...",
    "featured_image_url": "https://example.com/featured.jpg",
    "status": "posted",
    "social_posted": true
  }'`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What Happens Next?</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Blog post is created in the database</li>
                  <li>Email campaign is automatically created</li>
                  <li>All subscribers from <code>platform_email_sending_list</code> are added as recipients</li>
                  <li>Emails are sent using the "Blog Announcement" template</li>
                  <li>Template variables are populated: <code>blog_title</code>, <code>blog_url</code>, <code>blog_excerpt</code>, <code>featured_image_url</code></li>
                </ol>
              </div>
            </div>
          ) : (
            // Default CRM Bridge API Documentation
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Authentication</h3>
                <p className="text-sm mb-2">Include your API key in the <code>X-API-Key</code> header:</p>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                  <code className="flex-1 text-sm">{selectedKeyForDocs?.key_prefix}...</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedKeyForDocs?.key_prefix || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Base URL</h3>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                  <code className="flex-1 text-sm">
                    https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Example Request</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -H "X-API-Key: ${selectedKeyForDocs?.key_prefix}..." \\
  https://aizgpxaqvtvvqarzjmze.supabase.co/functions/v1/crm-bridge-api/contacts`}
                </pre>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  For complete API documentation, visit the Documentation tab above
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSelectedKeyForDocs(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteKeyId}
        onOpenChange={(open) => !open && setDeleteKeyId(null)}
        title="Delete API Key"
        description="Are you sure you want to delete this API key? This action cannot be undone and any applications using this key will stop working."
        onConfirm={() => deleteKeyId && deleteKeyMutation.mutate(deleteKeyId)}
        confirmText="Delete"
        variant="destructive"
      />
      </div>
    </DashboardLayout>
  );
}

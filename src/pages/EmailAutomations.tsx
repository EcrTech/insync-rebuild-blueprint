import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Zap, TrendingUp, Mail, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RuleBuilder } from "@/components/EmailAutomation/RuleBuilder";

export default function EmailAutomations() {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Fetch automation rules
  const { data: rules, isLoading, refetch } = useQuery({
    queryKey: ["email_automation_rules", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      const { data, error } = await supabase
        .from("email_automation_rules")
        .select(`
          *,
          email_templates(name, subject)
        `)
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  // Fetch execution stats
  const { data: stats } = useQuery({
    queryKey: ["automation_stats", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return null;

      const { data, error } = await supabase
        .from("email_automation_executions")
        .select("status", { count: "exact" })
        .eq("org_id", effectiveOrgId);

      if (error) throw error;

      const total = data?.length || 0;
      const sent = data?.filter(e => e.status === "sent").length || 0;
      const failed = data?.filter(e => e.status === "failed").length || 0;
      const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : "0";

      return { total, sent, failed, successRate };
    },
    enabled: !!effectiveOrgId,
  });

  // Toggle rule active status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_automation_rules"] });
      toast({
        title: "Rule updated",
        description: "Automation rule status changed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_automation_rules"] });
      toast({
        title: "Rule deleted",
        description: "Automation rule deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case "stage_change":
        return "Stage Change";
      case "disposition_set":
        return "Call Disposition";
      default:
        return type;
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsRuleBuilderOpen(true);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setIsRuleBuilderOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Email Automations</h1>
          <p className="text-muted-foreground">
            Automate your email outreach based on pipeline changes and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleCreateRule}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules?.filter(r => r.is_active).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {rules?.length || 0} total rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">automated emails</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate}%</div>
            <p className="text-xs text-muted-foreground">delivery success</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
          <CardDescription>
            Manage your email automation rules and triggers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading automation rules...
            </div>
          ) : rules?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No automation rules yet. Create your first rule to get started!
              </p>
              <Button onClick={handleCreateRule}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) =>
                          toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-sm text-muted-foreground">
                            {rule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTriggerTypeLabel(rule.trigger_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {rule.email_templates?.name || "No template"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>Triggered: {rule.total_triggered}</div>
                        <div className="text-green-600">Sent: {rule.total_sent}</div>
                        {rule.total_failed > 0 && (
                          <div className="text-red-600">Failed: {rule.total_failed}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRule(rule)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this rule?")) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RuleBuilder
        open={isRuleBuilderOpen}
        onOpenChange={setIsRuleBuilderOpen}
        editingRule={editingRule}
      />
    </div>
  );
}

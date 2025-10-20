import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { Activity, Mail, TrendingUp, AlertCircle } from "lucide-react";

interface AutomationAnalyticsProps {
  dateRange?: number; // days
}

export function AutomationAnalytics({ dateRange = 30 }: AutomationAnalyticsProps) {
  const { effectiveOrgId } = useOrgContext();

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ["automation_trend", effectiveOrgId, dateRange],
    queryFn: async () => {
      if (!effectiveOrgId) return [];

      const startDate = startOfDay(subDays(new Date(), dateRange));

      const { data, error } = await supabase
        .from("email_automation_executions")
        .select("created_at, status, sent_at")
        .eq("org_id", effectiveOrgId)
        .gte("created_at", startDate.toISOString());

      if (error) throw error;

      // Group by day
      const dailyStats: Record<string, { date: string; triggered: number; sent: number; failed: number }> = {};

      data.forEach((exec) => {
        const date = format(new Date(exec.created_at), "MMM dd");
        if (!dailyStats[date]) {
          dailyStats[date] = { date, triggered: 0, sent: 0, failed: 0 };
        }
        dailyStats[date].triggered++;
        if (exec.status === "sent") dailyStats[date].sent++;
        if (exec.status === "failed") dailyStats[date].failed++;
      });

      return Object.values(dailyStats).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },
    enabled: !!effectiveOrgId,
  });

  const { data: rulePerformance, isLoading: ruleLoading } = useQuery({
    queryKey: ["rule_performance", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];

      const { data, error } = await supabase
        .from("email_automation_rules")
        .select("id, name, total_triggered, total_sent, total_failed")
        .eq("org_id", effectiveOrgId)
        .order("total_sent", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map((rule) => ({
        name: rule.name.substring(0, 20) + (rule.name.length > 20 ? "..." : ""),
        fullName: rule.name,
        triggered: rule.total_triggered,
        sent: rule.total_sent,
        failed: rule.total_failed,
        successRate: rule.total_triggered > 0 
          ? Math.round((rule.total_sent / rule.total_triggered) * 100) 
          : 0,
      }));
    },
    enabled: !!effectiveOrgId,
  });

  const { data: triggerStats, isLoading: triggerLoading } = useQuery({
    queryKey: ["trigger_stats", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];

      const { data, error } = await supabase
        .from("email_automation_executions")
        .select("trigger_type, status")
        .eq("org_id", effectiveOrgId);

      if (error) throw error;

      const stats: Record<string, { trigger: string; count: number; sent: number }> = {};

      data.forEach((exec) => {
        if (!stats[exec.trigger_type]) {
          stats[exec.trigger_type] = { trigger: exec.trigger_type, count: 0, sent: 0 };
        }
        stats[exec.trigger_type].count++;
        if (exec.status === "sent") stats[exec.trigger_type].sent++;
      });

      return Object.values(stats).map((stat) => ({
        ...stat,
        trigger: stat.trigger.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      }));
    },
    enabled: !!effectiveOrgId,
  });

  if (trendLoading || ruleLoading || triggerLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Automation Trend (Last {dateRange} Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!trendData || trendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No trend data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="triggered"
                  stroke="hsl(var(--primary))"
                  name="Triggered"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="sent"
                  stroke="hsl(var(--chart-2))"
                  name="Sent"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="hsl(var(--destructive))"
                  name="Failed"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rule Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Performing Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!rulePerformance || rulePerformance.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No rule performance data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rulePerformance}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" fill="hsl(var(--chart-2))" name="Sent" />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Trigger Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Performance by Trigger Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!triggerStats || triggerStats.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No trigger data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={triggerStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="trigger" type="category" className="text-xs" width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Total" />
                  <Bar dataKey="sent" fill="hsl(var(--chart-2))" name="Sent" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

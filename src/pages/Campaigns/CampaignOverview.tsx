import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { exportToCSV, formatCurrencyForExport, formatNumberForExport } from "@/utils/exportUtils";
import MetricCard from "@/components/Campaigns/Analytics/MetricCard";
import DateRangeFilter from "@/components/Campaigns/Analytics/DateRangeFilter";
import PerformanceTrendChart from "@/components/Campaigns/Analytics/PerformanceTrendChart";
import ChannelPerformanceTable from "@/components/Campaigns/Analytics/ChannelPerformanceTable";

export default function CampaignOverview() {
  const notify = useNotification();
  const [dateRange, setDateRange] = useState(30);

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ["campaign-analytics", dateRange],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const { data, error } = await supabase
        .from("campaign_analytics")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { lastRefresh, manualRefresh } = useAutoRefresh({
    onRefresh: () => refetch(),
    intervalMs: 900000, // 15 minutes
  });

  const handleRefresh = () => {
    manualRefresh();
    notify.info("Refreshing data", "Campaign analytics are being updated");
  };

  const handleExport = () => {
    if (!analytics || analytics.length === 0) {
      notify.error("No data to export");
      return;
    }

    exportToCSV(
      analytics,
      [
        { key: "date", label: "Date" },
        { key: "campaign_type", label: "Type" },
        { key: "spend", label: "Spend", format: formatCurrencyForExport },
        { key: "conversions", label: "Conversions" },
        { key: "revenue", label: "Revenue", format: formatCurrencyForExport },
        { key: "roas", label: "ROAS", format: (v) => formatNumberForExport(v, 2) },
        { key: "cpa", label: "CPA", format: formatCurrencyForExport },
      ],
      `campaign-analytics-${dateRange}days`
    );

    notify.success("Export successful", "Analytics data has been downloaded");
  };

  // Calculate totals
  const totals = analytics?.reduce(
    (acc, curr) => ({
      spend: acc.spend + (curr.spend || 0),
      conversions: acc.conversions + (curr.conversions || 0),
      revenue: acc.revenue + (curr.revenue || 0),
    }),
    { spend: 0, conversions: 0, revenue: 0 }
  ) || { spend: 0, conversions: 0, revenue: 0 };

  const avgROAS = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCPA = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaign Overview</h1>
            <p className="text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Top Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Spend"
            value={`$${totals.spend.toFixed(2)}`}
            trend={12}
            isLoading={isLoading}
          />
          <MetricCard
            title="ROAS"
            value={avgROAS.toFixed(2)}
            trend={8}
            isLoading={isLoading}
          />
          <MetricCard
            title="Conversions"
            value={totals.conversions.toString()}
            trend={-5}
            isLoading={isLoading}
          />
          <MetricCard
            title="Avg CPA"
            value={`$${avgCPA.toFixed(2)}`}
            trend={-3}
            isLoading={isLoading}
          />
        </div>

        {/* Performance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTrendChart data={analytics || []} isLoading={isLoading} />
          </CardContent>
        </Card>

        {/* Channel Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelPerformanceTable data={analytics || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
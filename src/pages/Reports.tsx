import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Calendar, Plus, Phone, Target } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { useNavigate } from "react-router-dom";
import { CustomReportsList } from "@/components/Reports/CustomReportsList";
import { ReportViewer } from "@/components/Reports/ReportViewer";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesReport {
  user_name: string;
  total_contacts: number;
  total_calls: number;
  total_emails: number;
  total_meetings: number;
  deals_won: number;
  conversion_rate: number;
}

interface PipelineReport {
  stage_name: string;
  contact_count: number;
  stage_color: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter">("month");
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const notify = useNotification();
  const { effectiveOrgId } = useOrgContext();

  // Calculate date range
  const getStartDate = () => {
    const now = new Date();
    const startDate = new Date();
    if (dateRange === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === "month") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setMonth(now.getMonth() - 3);
    }
    return startDate;
  };

  // Optimized sales reports query - single database call instead of N+1
  const { data: salesReports = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-reports', dateRange, effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      const { data, error } = await supabase.rpc('get_sales_performance_report', {
        p_org_id: effectiveOrgId,
        p_start_date: getStartDate().toISOString(),
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveOrgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Optimized pipeline reports query - single database call instead of N+1
  const { data: pipelineReports = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline-reports', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      const { data, error } = await supabase.rpc('get_pipeline_performance_report', {
        p_org_id: effectiveOrgId,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveOrgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      notify.error("No data", "There is no data to export");
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    notify.success("Export successful", `Report exported as ${filename}_${dateRange}.csv`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive insights into your sales performance
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => navigate('/reports/builder')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="custom">Custom Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Tabs defaultValue="sales" className="space-y-4">
              <TabsList>
                <TabsTrigger value="sales">Sales Performance</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline Analysis</TabsTrigger>
                <TabsTrigger value="activity">Activity Reports</TabsTrigger>
              </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sales Performance by User</CardTitle>
                  <CardDescription>Individual performance metrics</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(salesReports, "sales_performance")}
                  disabled={salesLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : salesReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sales data available for this period
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Emails</TableHead>
                        <TableHead className="text-right">Meetings</TableHead>
                        <TableHead className="text-right">Deals Won</TableHead>
                        <TableHead className="text-right">Conversion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReports.map((report, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{report.user_name}</TableCell>
                          <TableCell className="text-right">{report.total_contacts}</TableCell>
                          <TableCell className="text-right">{report.total_calls}</TableCell>
                          <TableCell className="text-right">{report.total_emails}</TableCell>
                          <TableCell className="text-right">{report.total_meetings}</TableCell>
                          <TableCell className="text-right">{report.deals_won}</TableCell>
                          <TableCell className="text-right">{report.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pipeline Stage Analysis</CardTitle>
                  <CardDescription>Performance metrics by stage</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(pipelineReports, "pipeline_analysis")}
                  disabled={pipelineLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {pipelineLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pipelineReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pipeline data available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineReports.map((report, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: report.stage_color }}
                              />
                              {report.stage_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{report.contact_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.reduce((sum, r) => sum + r.total_calls + r.total_emails + r.total_meetings, 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all team members
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.reduce((sum, r) => sum + r.total_calls, 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Phone conversations
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Conversion</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.length > 0
                          ? Math.round(
                              salesReports.reduce((sum, r) => sum + Number(r.conversion_rate), 0) /
                                salesReports.length
                            )
                          : 0}
                        %
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Average across team
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <CustomReportsList onViewReport={setViewingReportId} />
          </TabsContent>
        </Tabs>

        <ReportViewer
          reportId={viewingReportId}
          open={!!viewingReportId}
          onClose={() => setViewingReportId(null)}
        />
      </div>
    </DashboardLayout>
  );
}

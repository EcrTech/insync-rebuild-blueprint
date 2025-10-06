import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, TrendingUp, Users, Phone, Target, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesReport {
  userName: string;
  totalContacts: number;
  calls: number;
  emails: number;
  meetings: number;
  dealsWon: number;
  conversionRate: number;
}

interface PipelineReport {
  stage: string;
  count: number;
  averageDays: number;
  conversionRate: number;
}

export default function Reports() {
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);
  const [pipelineReports, setPipelineReports] = useState<PipelineReport[]>([]);
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter">("month");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      if (dateRange === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === "month") {
        startDate.setMonth(now.getMonth() - 1);
      } else {
        startDate.setMonth(now.getMonth() - 3);
      }

      // Fetch sales reports by user
      const { data: users } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      const salesData: SalesReport[] = [];
      
      for (const userProfile of users || []) {
        // Count contacts created by user
        const { count: totalContacts } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userProfile.id)
          .gte("created_at", startDate.toISOString());

        // Count activities by type
        const { count: calls } = await supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userProfile.id)
          .eq("activity_type", "call")
          .gte("created_at", startDate.toISOString());

        const { count: emails } = await supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userProfile.id)
          .eq("activity_type", "email")
          .gte("created_at", startDate.toISOString());

        const { count: meetings } = await supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userProfile.id)
          .eq("activity_type", "meeting")
          .gte("created_at", startDate.toISOString());

        // Count deals won
        const { data: wonStage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("name", "Won")
          .single();

        const { count: dealsWon } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("created_by", userProfile.id)
          .eq("pipeline_stage_id", wonStage?.id)
          .gte("updated_at", startDate.toISOString());

        const conversionRate = totalContacts && dealsWon 
          ? Math.round((dealsWon / totalContacts) * 100) 
          : 0;

        salesData.push({
          userName: `${userProfile.first_name} ${userProfile.last_name}`,
          totalContacts: totalContacts || 0,
          calls: calls || 0,
          emails: emails || 0,
          meetings: meetings || 0,
          dealsWon: dealsWon || 0,
          conversionRate,
        });
      }

      setSalesReports(salesData);

      // Fetch pipeline stage reports
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("*")
        .order("stage_order");

      const pipelineData: PipelineReport[] = [];
      
      for (const stage of stages || []) {
        const { count } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("pipeline_stage_id", stage.id);

        pipelineData.push({
          stage: stage.name,
          count: count || 0,
          averageDays: Math.floor(Math.random() * 30) + 5, // Mock data
          conversionRate: stage.probability,
        });
      }

      setPipelineReports(pipelineData);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reports",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There is no data to export",
      });
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

    toast({
      title: "Export successful",
      description: `Report exported as ${filename}_${dateRange}.csv`,
    });
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
        </div>

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
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading reports...</div>
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
                          <TableCell className="font-medium">{report.userName}</TableCell>
                          <TableCell className="text-right">{report.totalContacts}</TableCell>
                          <TableCell className="text-right">{report.calls}</TableCell>
                          <TableCell className="text-right">{report.emails}</TableCell>
                          <TableCell className="text-right">{report.meetings}</TableCell>
                          <TableCell className="text-right">{report.dealsWon}</TableCell>
                          <TableCell className="text-right">{report.conversionRate}%</TableCell>
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
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading reports...</div>
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
                        <TableHead className="text-right">Avg. Days</TableHead>
                        <TableHead className="text-right">Conversion Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineReports.map((report, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{report.stage}</TableCell>
                          <TableCell className="text-right">{report.count}</TableCell>
                          <TableCell className="text-right">{report.averageDays} days</TableCell>
                          <TableCell className="text-right">{report.conversionRate}%</TableCell>
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
                  <div className="text-2xl font-bold">
                    {salesReports.reduce((sum, r) => sum + r.calls + r.emails + r.meetings, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all team members
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {salesReports.reduce((sum, r) => sum + r.calls, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone conversations
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Conversion</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {salesReports.length > 0
                      ? Math.round(
                          salesReports.reduce((sum, r) => sum + r.conversionRate, 0) /
                            salesReports.length
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average across team
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

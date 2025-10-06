import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, TrendingUp, Phone, Target, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  callsToday: number;
  conversionRate: number;
  newContactsThisWeek: number;
  dealsWonThisMonth: number;
  contactGrowth: number;
  dealGrowth: number;
}

interface PipelineData {
  stage: string;
  count: number;
  value: number;
}

interface ActivityData {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
}

const COLORS = ['#01B8AA', '#168980', '#8AD4EB', '#F2C80F', '#A66999', '#FE9666', '#FD625E'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    activeDeals: 0,
    callsToday: 0,
    conversionRate: 0,
    newContactsThisWeek: 0,
    dealsWonThisMonth: 0,
    contactGrowth: 0,
    dealGrowth: 0,
  });
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date ranges once
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // OPTIMIZATION: Batch all queries in parallel using Promise.all
      const [
        { count: totalContacts },
        { data: stages },
        { count: callsToday },
        { count: newContactsThisWeek },
        { data: wonStage },
        { data: pipelineStats },
        { data: activityStats }
      ] = await Promise.all([
        // Total contacts
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true }),
        
        // Pipeline stages (for active deals)
        supabase
          .from("pipeline_stages")
          .select("id, name")
          .not("name", "in", '("Won","Lost")'),
        
        // Calls today
        supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("activity_type", "call")
          .gte("created_at", today.toISOString()),
        
        // New contacts this week
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
        
        // Won stage
        supabase
          .from("pipeline_stages")
          .select("id")
          .eq("name", "Won")
          .maybeSingle(),
        
        // Pipeline distribution
        supabase
          .from("contacts")
          .select(`
            pipeline_stage_id,
            pipeline_stages (name, stage_order)
          `),
        
        // OPTIMIZATION: Fetch all activities for 7 days in ONE query instead of 21 queries
        supabase
          .from("contact_activities")
          .select("activity_type, created_at")
          .gte("created_at", weekAgo.toISOString())
          .in("activity_type", ["call", "email", "meeting"])
      ]);

      // Calculate active deals
      const stageIds = stages?.map(s => s.id) || [];
      const { count: activeDeals } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .in("pipeline_stage_id", stageIds);

      // Calculate won deals this month
      const { count: dealsWonThisMonth } = wonStage?.id 
        ? await supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("pipeline_stage_id", wonStage.id)
            .gte("updated_at", monthStart.toISOString())
        : { count: 0 };

      // Calculate conversion rate
      const conversionRate = totalContacts && dealsWonThisMonth
        ? Math.round((dealsWonThisMonth / totalContacts) * 100)
        : 0;

      // Process pipeline distribution
      const pipelineMap = new Map<string, number>();
      pipelineStats?.forEach(contact => {
        const stageName = (contact as any).pipeline_stages?.name || "Unassigned";
        pipelineMap.set(stageName, (pipelineMap.get(stageName) || 0) + 1);
      });

      const pipeline: PipelineData[] = Array.from(pipelineMap.entries()).map(([stage, count]) => ({
        stage,
        count,
        value: count,
      }));

      // OPTIMIZATION: Process activities in memory instead of 21 database queries
      const activities: ActivityData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        // Filter activities in memory
        const dayActivities = activityStats?.filter(activity => {
          const activityDate = new Date(activity.created_at);
          return activityDate >= date && activityDate < nextDay;
        }) || [];

        activities.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          calls: dayActivities.filter(a => a.activity_type === "call").length,
          emails: dayActivities.filter(a => a.activity_type === "email").length,
          meetings: dayActivities.filter(a => a.activity_type === "meeting").length,
        });
      }

      setStats({
        totalContacts: totalContacts || 0,
        activeDeals: activeDeals || 0,
        callsToday: callsToday || 0,
        conversionRate,
        newContactsThisWeek: newContactsThisWeek || 0,
        dealsWonThisMonth: dealsWonThisMonth || 0,
        contactGrowth: 12, // Mock data for growth percentage
        dealGrowth: 8,
      });
      setPipelineData(pipeline);
      setActivityData(activities);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time insights into your sales performance</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-500">{stats.contactGrowth}%</span> from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.activeDeals}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-500">{stats.dealGrowth}%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stats.callsToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.newContactsThisWeek} new contacts this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : `${stats.conversionRate}%`}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.dealsWonThisMonth} deals won this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Distribution</CardTitle>
              <CardDescription>Contacts across pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              {loading || pipelineData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No pipeline data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ stage, percent }) => `${stage}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Trends</CardTitle>
              <CardDescription>Last 7 days activity breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {loading || activityData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No activity data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="calls" stroke="#01B8AA" strokeWidth={2} />
                    <Line type="monotone" dataKey="emails" stroke="#168980" strokeWidth={2} />
                    <Line type="monotone" dataKey="meetings" stroke="#8AD4EB" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Performance</CardTitle>
            <CardDescription>Activities completed over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || activityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No activity data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#01B8AA" />
                  <Bar dataKey="emails" fill="#168980" />
                  <Bar dataKey="meetings" fill="#8AD4EB" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useMemo } from "react";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useOrgData } from "@/hooks/useOrgData";
import { LoadingState } from "@/components/common/LoadingState";

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
  const { effectiveOrgId } = useOrgContext();

  // Fetch all data using useOrgData hook for better caching
  const { data: contacts = [] } = useOrgData('contacts', { enabled: !!effectiveOrgId });
  const { data: stages = [] } = useOrgData('pipeline_stages', {
    orderBy: { column: 'stage_order', ascending: true },
    enabled: !!effectiveOrgId,
  });
  const { data: activities = [] } = useOrgData('contact_activities', {
    select: 'activity_type, created_at',
    enabled: !!effectiveOrgId,
  });

  // Calculate all stats in memory using useMemo
  const { stats, pipelineData, activityData, loading } = useMemo(() => {
    if (!contacts || contacts.length === 0) {
      return {
        stats: {
          totalContacts: 0,
          activeDeals: 0,
          callsToday: 0,
          conversionRate: 0,
          newContactsThisWeek: 0,
          dealsWonThisMonth: 0,
          contactGrowth: 0,
          dealGrowth: 0,
        },
        pipelineData: [],
        activityData: [],
        loading: !effectiveOrgId,
      };
    }

    // Calculate date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);

    // Find won stage
    const wonStage = stages.find((s: any) => s.name?.toLowerCase() === 'won');
    const activeStageIds = stages
      .filter((s: any) => !['won', 'lost'].includes(s.name?.toLowerCase()))
      .map((s: any) => s.id);

    // Calculate stats
    const totalContacts = contacts.length;
    const contactsLastWeek = contacts.filter((c: any) => new Date(c.created_at) < weekAgo).length;
    const newContactsThisWeek = contacts.filter((c: any) => new Date(c.created_at) >= weekAgo).length;
    
    const activeDeals = contacts.filter((c: any) => activeStageIds.includes(c.pipeline_stage_id)).length;
    const activeDealsLastMonth = contacts.filter((c: any) => 
      activeStageIds.includes(c.pipeline_stage_id) && new Date(c.created_at) < lastMonthStart
    ).length;
    
    const dealsWonThisMonth = wonStage 
      ? contacts.filter((c: any) => 
          c.pipeline_stage_id === wonStage.id && new Date(c.updated_at) >= monthStart
        ).length
      : 0;

    const callsToday = activities.filter((a: any) => 
      a.activity_type === 'call' && new Date(a.created_at) >= today
    ).length;

    const conversionRate = totalContacts && dealsWonThisMonth
      ? Math.round((dealsWonThisMonth / totalContacts) * 100)
      : 0;

    const contactGrowth = contactsLastWeek > 0
      ? Math.round(((totalContacts - contactsLastWeek) / contactsLastWeek) * 100)
      : 0;

    const dealGrowth = activeDealsLastMonth > 0
      ? Math.round(((activeDeals - activeDealsLastMonth) / activeDealsLastMonth) * 100)
      : 0;

    // Process pipeline distribution
    const pipelineMap = new Map<string, number>();
    contacts.forEach((contact: any) => {
      const stage = stages.find((s: any) => s.id === contact.pipeline_stage_id);
      const stageName = stage?.name || "Unassigned";
      pipelineMap.set(stageName, (pipelineMap.get(stageName) || 0) + 1);
    });

    const pipeline: PipelineData[] = Array.from(pipelineMap.entries()).map(([stage, count]) => ({
      stage,
      count,
      value: count,
    }));

    // Process activity trends (last 7 days)
    const activityArray: ActivityData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayActivities = activities.filter((activity: any) => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= date && activityDate < nextDay;
      });

      activityArray.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        calls: dayActivities.filter((a: any) => a.activity_type === "call").length,
        emails: dayActivities.filter((a: any) => a.activity_type === "email").length,
        meetings: dayActivities.filter((a: any) => a.activity_type === "meeting").length,
      });
    }

    return {
      stats: {
        totalContacts,
        activeDeals,
        callsToday,
        conversionRate,
        newContactsThisWeek,
        dealsWonThisMonth,
        contactGrowth,
        dealGrowth,
      },
      pipelineData: pipeline,
      activityData: activityArray,
      loading: false,
    };
  }, [contacts, stages, activities, effectiveOrgId]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard data..." />
      </DashboardLayout>
    );
  }

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
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stats.contactGrowth >= 0 ? (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">{stats.contactGrowth}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{Math.abs(stats.contactGrowth)}%</span>
                  </>
                )}
                {' '}from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDeals}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stats.dealGrowth >= 0 ? (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">{stats.dealGrowth}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{Math.abs(stats.dealGrowth)}%</span>
                  </>
                )}
                {' '}from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.callsToday}</div>
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
              <div className="text-2xl font-bold">{`${stats.conversionRate}%`}</div>
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
              {pipelineData.length === 0 ? (
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
              {activityData.length === 0 ? (
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
            {activityData.length === 0 ? (
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

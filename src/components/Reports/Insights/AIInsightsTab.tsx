import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, MessageCircle, TrendingUp, GitBranch } from "lucide-react";
import InsightCard from "@/components/Campaigns/Insights/InsightCard";
import AIChatInterface from "./AIChatInterface";
import PipelineInsightsCard from "./PipelineInsightsCard";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AIInsightsTab() {
  const { effectiveOrgId } = useOrgContext();

  // Fetch AI-generated insights from campaign_insights table
  const { data: aiInsights = [], isLoading: insightsLoading, refetch } = useQuery({
    queryKey: ['campaign-insights', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      const { data, error } = await supabase
        .from('campaign_insights')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .eq('status', 'active')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveOrgId,
  });

  // Separate pipeline-specific insights from campaign insights
  const pipelineInsights = aiInsights.filter(i => !i.campaign_id);
  const campaignInsights = aiInsights.filter(i => i.campaign_id);

  // Fetch pipeline metrics
  const { data: pipelineMetrics = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline-metrics', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      const [stagesRes, contactsRes, movementsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').eq('org_id', effectiveOrgId).order('stage_order'),
        supabase.from('contacts').select('id, pipeline_stage_id').eq('org_id', effectiveOrgId),
        supabase.from('pipeline_movement_history')
          .select('*')
          .eq('org_id', effectiveOrgId)
          .gte('moved_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      if (!stagesRes.data) return [];

      return stagesRes.data.map((stage, idx) => {
        const stageContacts = contactsRes.data?.filter(c => c.pipeline_stage_id === stage.id) || [];
        const stageMovements = movementsRes.data?.filter(m => m.from_stage_id === stage.id) || [];
        
        const avgDays = stageMovements.length > 0
          ? Math.round(stageMovements.reduce((sum, m) => sum + (m.days_in_previous_stage || 0), 0) / stageMovements.length)
          : 0;

        const nextStageId = stagesRes.data[idx + 1]?.id;
        const movedToNext = movementsRes.data?.filter(m => 
          m.from_stage_id === stage.id && m.to_stage_id === nextStageId
        ).length || 0;
        
        const conversionRate = stageMovements.length > 0 
          ? Math.round((movedToNext / stageMovements.length) * 100)
          : 0;

        return {
          name: stage.name,
          count: stageContacts.length,
          probability: stage.probability || 0,
          avgDays,
          conversionRate,
          trend: (conversionRate > 60 ? 'up' : conversionRate < 40 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
        };
      });
    },
    enabled: !!effectiveOrgId,
  });

  const isLoading = insightsLoading || pipelineLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
        <p className="text-muted-foreground">Get intelligent recommendations for your campaigns</p>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">
            <Brain className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <GitBranch className="h-4 w-4 mr-2" />
            Pipeline Intelligence
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageCircle className="h-4 w-4 mr-2" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : aiInsights.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No AI insights available yet. Run analytics to generate insights!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaignInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} onUpdate={() => refetch()} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : pipelineMetrics.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No pipeline data available. Add contacts to your pipeline to see insights!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <PipelineInsightsCard metrics={pipelineMetrics} />
              
              {/* AI-Generated Pipeline Recommendations */}
              {pipelineInsights.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">AI Recommendations</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {pipelineInsights.map((insight) => (
                      <InsightCard key={insight.id} insight={insight} onUpdate={() => refetch()} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          <AIChatInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
}

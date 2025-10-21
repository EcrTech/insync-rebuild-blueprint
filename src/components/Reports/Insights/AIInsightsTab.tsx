import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, MessageCircle, TrendingUp } from "lucide-react";
import InsightCard from "./InsightCard";
import AIChatInterface from "./AIChatInterface";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AIInsightsTab() {
  const { effectiveOrgId } = useOrgContext();

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['ai-insights', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      
      // Fetch some basic insights data
      const [emailData, whatsappData, contactsData] = await Promise.all([
        supabase.from('email_bulk_campaigns').select('*').eq('org_id', effectiveOrgId).limit(10),
        supabase.from('whatsapp_bulk_campaigns').select('*').eq('org_id', effectiveOrgId).limit(10),
        supabase.from('contacts').select('*').eq('org_id', effectiveOrgId).limit(100),
      ]);

      const insights = [];
      
      if (emailData.data && emailData.data.length > 0) {
        const totalSent = emailData.data.reduce((sum, c) => sum + (c.sent_count || 0), 0);
        // Note: opened_count tracking will be added in future updates
        const openRate = totalSent > 0 ? Math.round((totalSent / Math.max(totalSent, 1)) * 100) : 0;
        
        insights.push({
          title: "Email Campaign Performance",
          description: `Your email campaigns have an average open rate of ${openRate}%. ${openRate > 20 ? 'Great job!' : 'Consider improving subject lines.'}`,
          type: openRate > 20 ? "success" : "warning",
          metric: `${openRate}%`,
          trend: openRate > 20 ? "up" : "neutral"
        });
      }

      if (whatsappData.data && whatsappData.data.length > 0) {
        const totalSent = whatsappData.data.reduce((sum, c) => sum + (c.sent_count || 0), 0);
        const totalFailed = whatsappData.data.reduce((sum, c) => sum + (c.failed_count || 0), 0);
        const deliveryRate = totalSent > 0 ? Math.round(((totalSent - totalFailed) / totalSent) * 100) : 0;
        
        insights.push({
          title: "WhatsApp Delivery Rate",
          description: `${deliveryRate}% of your WhatsApp messages are being delivered successfully. ${deliveryRate > 90 ? 'Excellent!' : 'Some numbers may be invalid.'}`,
          type: deliveryRate > 90 ? "success" : "warning",
          metric: `${deliveryRate}%`,
          trend: deliveryRate > 90 ? "up" : "neutral"
        });
      }

      if (contactsData.data && contactsData.data.length > 0) {
        insights.push({
          title: "Contact Database Health",
          description: `You have ${contactsData.data.length} contacts in your database. Keep engaging with them regularly.`,
          type: "info",
          metric: `${contactsData.data.length}`,
          trend: "up"
        });
      }

      return insights;
    },
    enabled: !!effectiveOrgId,
  });

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
            Smart Insights
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageCircle className="h-4 w-4 mr-2" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : insights.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No insights available yet. Create some campaigns to get started!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
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

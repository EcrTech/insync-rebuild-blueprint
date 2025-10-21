import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";

interface InsightCardProps {
  insight: {
    id: string;
    priority: string;
    insight_type: string;
    title: string;
    description: string;
    impact?: string;
    suggested_action?: string;
  };
  onUpdate: () => void;
}

export default function InsightCard({ insight, onUpdate }: InsightCardProps) {
  const notify = useNotification();

  const handleDismiss = async () => {
    const { error } = await supabase
      .from("campaign_insights")
      .update({ status: "dismissed" })
      .eq("id", insight.id);

    if (error) {
      notify.error("Error", "Failed to dismiss insight");
      return;
    }

    notify.success("Insight dismissed");
    onUpdate();
  };

  const priorityColors = {
    high: "destructive",
    medium: "default",
    low: "secondary",
  } as const;

  const typeIcons = {
    optimization: TrendingUp,
    alert: AlertTriangle,
    recommendation: Lightbulb,
  };

  const Icon = typeIcons[insight.insight_type as keyof typeof typeIcons] || Lightbulb;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 mt-1 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{insight.title}</CardTitle>
                <Badge variant={priorityColors[insight.priority as keyof typeof priorityColors]}>
                  {insight.priority}
                </Badge>
              </div>
              <CardDescription>{insight.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {insight.impact && (
          <div>
            <p className="text-sm font-medium mb-1">Impact:</p>
            <p className="text-sm text-muted-foreground">{insight.impact}</p>
          </div>
        )}
        {insight.suggested_action && (
          <div>
            <p className="text-sm font-medium mb-1">Suggested Action:</p>
            <p className="text-sm text-muted-foreground">{insight.suggested_action}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
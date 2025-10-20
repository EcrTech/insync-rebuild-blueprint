import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, TrendingDown, Minus, 
  Flame, Snowflake, ThermometerSun 
} from "lucide-react";

interface LeadScoreCardProps {
  contactId: string;
  orgId: string;
}

export function LeadScoreCard({ contactId, orgId }: LeadScoreCardProps) {
  const { data: leadScore, isLoading } = useQuery({
    queryKey: ['contact-lead-score', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_lead_scores')
        .select('*')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lead Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leadScore) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lead Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Minus className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No score calculated yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCategoryIcon = () => {
    switch (leadScore.score_category) {
      case 'hot':
        return <Flame className="h-6 w-6 text-red-500" />;
      case 'warm':
        return <ThermometerSun className="h-6 w-6 text-orange-500" />;
      case 'cold':
        return <Snowflake className="h-6 w-6 text-blue-500" />;
      default:
        return <Minus className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getCategoryColor = () => {
    switch (leadScore.score_category) {
      case 'hot':
        return 'destructive';
      case 'warm':
        return 'secondary';
      case 'cold':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const breakdown = leadScore.score_breakdown as Record<string, number> || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Lead Score
        </CardTitle>
        <CardDescription>
          Engagement-based scoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getCategoryIcon()}
            <div>
              <div className="text-3xl font-bold">{leadScore.score}</div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
          </div>
          <Badge variant={getCategoryColor()} className="text-lg px-4 py-2">
            {leadScore.score_category?.toUpperCase()}
          </Badge>
        </div>

        <Progress value={leadScore.score} className="h-2" />

        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(leadScore.last_calculated).toLocaleString()}
        </div>

        {Object.keys(breakdown).length > 0 && (
          <div className="pt-4 border-t space-y-2">
            <div className="text-sm font-medium mb-2">Score Breakdown</div>
            {Object.entries(breakdown).map(([reason, points]) => (
              <div key={reason} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{reason}</span>
                <span className={points > 0 ? 'text-success' : 'text-destructive'}>
                  {points > 0 ? '+' : ''}{points}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

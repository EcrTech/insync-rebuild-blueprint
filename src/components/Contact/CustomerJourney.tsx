import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, Calendar, FileText, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  description: string | null;
  created_at: string;
  call_duration: number | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  call_dispositions: {
    name: string;
    category: string;
  } | null;
}

interface CustomerJourneyProps {
  contactId: string;
}

export const CustomerJourney = ({ contactId }: CustomerJourneyProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel(`contact_activities_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_activities",
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_activities")
        .select(
          `
          id,
          activity_type,
          subject,
          description,
          created_at,
          call_duration,
          profiles!contact_activities_created_by_fkey (
            first_name,
            last_name
          ),
          call_dispositions (
            name,
            category
          )
        `
        )
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast({
        title: "Error",
        description: "Failed to load customer journey",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return Phone;
      case "email":
        return Mail;
      case "meeting":
        return Calendar;
      case "note":
        return FileText;
      default:
        return FileText;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-500";
      case "email":
        return "bg-purple-500";
      case "meeting":
        return "bg-green-500";
      case "note":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDispositionColor = (category: string | undefined) => {
    switch (category) {
      case "positive":
        return "text-green-600";
      case "negative":
        return "text-red-600";
      case "follow_up":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No journey activities yet</p>
      </Card>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {activities.map((activity, index) => {
          const Icon = getActivityIcon(activity.activity_type);
          const colorClass = getActivityColor(activity.activity_type);

          return (
            <div key={activity.id} className="relative pl-20">
              {/* Timeline dot and icon */}
              <div className={`absolute left-4 w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shadow-lg`}>
                <Icon className="h-4 w-4 text-white" />
              </div>

              {/* Activity card */}
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm capitalize flex items-center gap-2">
                      {activity.activity_type}
                      {activity.call_dispositions && (
                        <CheckCircle2 className={`h-4 w-4 ${getDispositionColor(activity.call_dispositions.category)}`} />
                      )}
                    </h4>
                    {activity.subject && (
                      <p className="text-sm text-foreground mt-1">{activity.subject}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>

                {activity.description && (
                  <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {activity.profiles && (
                    <span>
                      By {activity.profiles.first_name} {activity.profiles.last_name}
                    </span>
                  )}
                  {activity.call_duration && (
                    <span>Duration: {Math.floor(activity.call_duration / 60)}:{(activity.call_duration % 60).toString().padStart(2, "0")}</span>
                  )}
                  {activity.call_dispositions && (
                    <span className={getDispositionColor(activity.call_dispositions.category)}>
                      {activity.call_dispositions.name}
                    </span>
                  )}
                </div>
              </Card>

              {/* Connector line to next item */}
              {index < activities.length - 1 && (
                <div className="absolute left-8 top-12 w-0.5 h-6 bg-border" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

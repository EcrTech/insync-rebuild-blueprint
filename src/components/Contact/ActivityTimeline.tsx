import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PhoneCall, Mail, Video, MessageSquare, Calendar, User } from "lucide-react";

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  scheduled_at: string | null;
  call_duration: number | null;
  profiles: { first_name: string; last_name: string } | null;
  call_dispositions: { name: string } | null;
}

interface ActivityTimelineProps {
  contactId: string;
}

export function ActivityTimeline({ contactId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`activities-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_activities',
          filter: `contact_id=eq.${contactId}`
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
        .select(`
          *,
          profiles:created_by (first_name, last_name),
          call_dispositions (name)
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading activities",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <PhoneCall className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <Video className="h-4 w-4" />;
      case "note":
        return <MessageSquare className="h-4 w-4" />;
      case "task":
        return <Calendar className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-500";
      case "email":
        return "bg-green-500";
      case "meeting":
        return "bg-purple-500";
      case "note":
        return "bg-gray-500";
      case "task":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading activities...</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activities yet. Log your first interaction to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex gap-4 animate-fade-in">
          <div className="flex flex-col items-center">
            <div className={`rounded-full p-2 ${getActivityColor(activity.activity_type)} text-white`}>
              {getActivityIcon(activity.activity_type)}
            </div>
            {index < activities.length - 1 && (
              <div className="w-px h-full bg-border mt-2" />
            )}
          </div>

          <div className="flex-1 pb-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium capitalize">
                  {activity.activity_type}
                  {activity.subject && `: ${activity.subject}`}
                </p>
                {activity.call_dispositions && (
                  <p className="text-sm text-muted-foreground">
                    Disposition: {activity.call_dispositions.name}
                  </p>
                )}
                {activity.call_duration && (
                  <p className="text-sm text-muted-foreground">
                    Duration: {formatDuration(activity.call_duration)}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(activity.created_at).toLocaleString()}
              </span>
            </div>

            {activity.description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {activity.description}
              </p>
            )}

            {activity.profiles && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {activity.profiles.first_name} {activity.profiles.last_name}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

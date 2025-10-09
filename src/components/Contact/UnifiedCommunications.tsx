import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface UnifiedMessage {
  id: string;
  channel: string;
  direction: string;
  content: string;
  subject?: string;
  sent_at: string;
  status: string;
  is_read: boolean;
}

interface UnifiedCommunicationsProps {
  contactId: string;
}

export function UnifiedCommunications({ contactId }: UnifiedCommunicationsProps) {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
    subscribeToUpdates();
  }, [contactId]);

  const fetchMessages = async () => {
    try {
      // Fetch WhatsApp messages
      const { data: whatsappData } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false });

      // Fetch Email conversations
      const { data: emailData } = await supabase
        .from("email_conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false });

      // Combine and sort
      const combined: UnifiedMessage[] = [
        ...(whatsappData || []).map((msg) => ({
          id: msg.id,
          channel: "whatsapp",
          direction: msg.direction,
          content: msg.message_content,
          sent_at: msg.sent_at,
          status: msg.status,
          is_read: !!msg.read_at,
        })),
        ...(emailData || []).map((msg) => ({
          id: msg.id,
          channel: "email",
          direction: msg.direction,
          content: msg.email_content,
          subject: msg.subject,
          sent_at: msg.sent_at,
          status: msg.status,
          is_read: msg.is_read,
        })),
      ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

      setMessages(combined);
    } catch (error) {
      console.error("Error fetching unified communications:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const whatsappChannel = supabase
      .channel('contact-whatsapp-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `contact_id=eq.${contactId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    const emailChannel = supabase
      .channel('contact-email-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_conversations',
          filter: `contact_id=eq.${contactId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(whatsappChannel);
      supabase.removeChannel(emailChannel);
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No messages yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg border ${
              message.direction === "inbound"
                ? "bg-muted border-border"
                : "bg-background border-border"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {message.channel === "whatsapp" ? (
                  <MessageSquare className="h-4 w-4 text-green-600" />
                ) : (
                  <Mail className="h-4 w-4 text-blue-600" />
                )}
                <Badge
                  variant={message.direction === "inbound" ? "default" : "secondary"}
                >
                  {message.direction === "inbound" ? "Received" : "Sent"}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {message.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(message.sent_at), "MMM d, h:mm a")}
              </span>
            </div>

            {message.subject && (
              <p className="font-semibold text-sm mb-1">{message.subject}</p>
            )}

            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

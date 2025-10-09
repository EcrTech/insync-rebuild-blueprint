import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WhatsAppMessage {
  id: string;
  contact_id: string;
  phone_number: string;
  message_content: string;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  contacts: {
    first_name: string;
    last_name: string | null;
  };
  sent_by_profile: {
    first_name: string;
    last_name: string;
  } | null;
}

interface MessageStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

const WhatsAppDashboard = () => {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchMessages();
      fetchStats();
    }
  }, [effectiveOrgId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(`
          *,
          contacts (first_name, last_name),
          sent_by_profile:profiles!sent_by (first_name, last_name)
        `)
        .eq("org_id", effectiveOrgId)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessages((data || []) as unknown as WhatsAppMessage[]);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load WhatsApp messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count: total } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId);

      const { count: sent } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId)
        .eq("status", "sent");

      const { count: delivered } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId)
        .eq("status", "delivered");

      const { count: read } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId)
        .eq("status", "read");

      const { count: failed } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", effectiveOrgId)
        .eq("status", "failed");

      setStats({
        total: total || 0,
        sent: sent || 0,
        delivered: delivered || 0,
        read: read || 0,
        failed: failed || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "sent":
        return <Badge variant="secondary"><Send className="mr-1 h-3 w-3" />Sent</Badge>;
      case "delivered":
        return <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />Delivered</Badge>;
      case "read":
        return <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />Read</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Messages</h1>
          <p className="text-muted-foreground mt-2">
            Track and monitor your WhatsApp message delivery
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.delivered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.read}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Last 100 WhatsApp messages sent</CardDescription>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                <p className="text-muted-foreground">
                  WhatsApp messages will appear here once you start sending them
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent By</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-medium">
                          {message.contacts.first_name} {message.contacts.last_name}
                        </TableCell>
                        <TableCell>{message.phone_number}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {message.message_content}
                        </TableCell>
                        <TableCell>{getStatusBadge(message.status)}</TableCell>
                        <TableCell>
                          {message.sent_by_profile
                            ? `${message.sent_by_profile.first_name} ${message.sent_by_profile.last_name}`
                            : "System"}
                        </TableCell>
                        <TableCell>{format(new Date(message.sent_at), "PPp")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppDashboard;
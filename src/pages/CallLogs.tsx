import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Search, Download, Phone, Clock, User, Calendar } from "lucide-react";
import { format } from "date-fns";

interface CallLog {
  id: string;
  contact_id: string | null;
  agent_id: string | null;
  exotel_call_sid: string;
  call_type: string;
  from_number: string;
  to_number: string;
  status: string;
  call_duration: number | null;
  conversation_duration: number | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  disposition_id: string | null;
  contacts?: {
    first_name: string;
    last_name: string | null;
  };
  call_dispositions?: {
    name: string;
    category: string;
  };
}

export default function CallLogs() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("7");
  const notify = useNotification();

  useEffect(() => {
    fetchCallLogs();
  }, [dateFilter, callTypeFilter]);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Calculate date filter
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateFilter));

      let query = supabase
        .from('call_logs')
        .select(`
          *,
          contacts (first_name, last_name),
          call_dispositions (name, category)
        `)
        .eq('org_id', profile.org_id)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false });

      if (callTypeFilter !== 'all') {
        query = query.eq('call_type', callTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCallLogs((data || []) as CallLog[]);
    } catch (error: any) {
        notify.error("Error loading call logs", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const exportCallLogs = () => {
    notify.info("Export initiated", "Call logs export will be available once API is integrated");
  };

  const filteredLogs = callLogs.filter((log) => {
    const contactName = log.contacts 
      ? `${log.contacts.first_name} ${log.contacts.last_name || ''}`.toLowerCase()
      : '';

    const matchesSearch =
      contactName.includes(searchQuery.toLowerCase()) ||
      log.from_number.includes(searchQuery) ||
      log.to_number.includes(searchQuery);

    const matchesCallType =
      callTypeFilter === "all" || log.call_type === callTypeFilter;

    return matchesSearch && matchesCallType;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Call Logs</h1>
            <p className="text-muted-foreground">
              View and manage all call records and recordings
            </p>
          </div>
          <Button onClick={exportCallLogs}>
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter call logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={callTypeFilter} onValueChange={setCallTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Call Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Call Types</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Today</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Call Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Call Records</CardTitle>
            <CardDescription>
              {filteredLogs.length} call{filteredLogs.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading call logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No call logs found</h3>
                <p className="text-muted-foreground mb-4">
                  {callLogs.length === 0
                    ? "Call logs will appear here once API integration is complete"
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date & Time
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Contact
                        </div>
                      </TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Duration
                        </div>
                      </TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Recording</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="text-sm">
                            {log.started_at && format(new Date(log.started_at), "MMM d, yyyy")}
                            <div className="text-xs text-muted-foreground">
                              {log.started_at && format(new Date(log.started_at), "h:mm a")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.contacts ? `${log.contacts.first_name} ${log.contacts.last_name || ''}` : 'Unknown'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.call_type === 'outbound' ? log.to_number : log.from_number}
                        </TableCell>
                        <TableCell>Agent</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.call_type === "inbound"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {log.call_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.conversation_duration ? formatDuration(log.conversation_duration) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {log.call_dispositions ? (
                            <Badge variant="outline">{log.call_dispositions.name}</Badge>
                          ) : (
                            <Badge variant="outline" className="opacity-50">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.recording_url ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.functions.invoke('exotel-get-recording', {
                                    body: { callLogId: log.id }
                                  });
                                  if (error) throw error;
                                  // Handle recording playback
                                } catch (error: any) {
                                  notify.error("Error", new Error("Failed to load recording"));
                                }
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              N/A
                            </span>
                          )}
                        </TableCell>
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
}

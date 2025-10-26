import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Clock, RotateCw, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OutboundWebhookLogsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
}

export const OutboundWebhookLogs = ({
  open,
  onOpenChange,
  webhookId,
}: OutboundWebhookLogsProps) => {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["webhook-logs", webhookId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("outbound_webhook_logs")
        .select("*")
        .eq("webhook_id", webhookId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!webhookId,
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const log = logs.find((l: any) => l.id === logId);
      if (!log) throw new Error("Log not found");

      const { data, error } = await supabase.functions.invoke("outbound-webhook-handler", {
        body: {
          orgId: log.org_id,
          triggerEvent: log.trigger_event,
          triggerData: log.request_payload,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
      notify.success("Webhook retried successfully");
    },
    onError: (error: any) => {
      notify.error(`Failed to retry webhook: ${error.message}`);
    },
  });

  const viewDetails = (log: any) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Webhook Execution Logs</DialogTitle>
            <DialogDescription>
              View the history of webhook executions and their responses
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">
              Showing {logs.length} {logs.length === 100 ? "(max)" : ""} logs
            </div>
          </div>

          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found for this webhook
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge
                            variant={log.status === "success" ? "default" : "destructive"}
                          >
                            {log.status}
                          </Badge>
                          <Badge variant="outline">HTTP {log.response_status || "N/A"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {log.execution_time_ms}ms
                          </span>
                          {log.attempt_count > 1 && (
                            <Badge variant="secondary">
                              {log.attempt_count} attempts
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                          <div className="font-medium">{log.trigger_event}</div>
                          {log.error_message && (
                            <div className="text-xs text-destructive mt-2">
                              Error: {log.error_message}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {log.status === "failed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryMutation.mutate(log.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <AlertDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Execution Details</AlertDialogTitle>
            <AlertDialogDescription>
              Request and response details for this webhook execution
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Request Payload</h4>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Response</h4>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                  {typeof selectedLog.response_body === "string"
                    ? selectedLog.response_body
                    : JSON.stringify(selectedLog.response_body, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={selectedLog.status === "success" ? "default" : "destructive"}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">HTTP Status:</span>{" "}
                  {selectedLog.response_status || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground">Execution Time:</span>{" "}
                  {selectedLog.execution_time_ms}ms
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts:</span>{" "}
                  {selectedLog.attempt_count}
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

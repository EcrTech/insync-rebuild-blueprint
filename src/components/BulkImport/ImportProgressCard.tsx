import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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

interface ImportProgressCardProps {
  job: {
    id: string;
    file_name: string;
    status: string;
    current_stage: string;
    total_rows: number;
    processed_rows: number;
    success_count: number;
    error_count: number;
    stage_details: any;
    import_type: string;
    started_at: string;
  };
  onCancel?: () => void;
}

export function ImportProgressCard({ job, onCancel }: ImportProgressCardProps) {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRollbackOption, setShowRollbackOption] = useState(false);

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      pending: 'Queued',
      downloading: 'Downloading file',
      validating: 'Validating structure',
      parsing: 'Parsing CSV',
      inserting: 'Inserting records',
      finalizing: 'Finalizing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    };
    return labels[stage] || stage;
  };

  const getStatusIcon = () => {
    if (job.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (job.status === 'failed') {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (job.status === 'cancelled') {
      return <Ban className="h-5 w-5 text-orange-500" />;
    }
    if (job.status === 'processing') {
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    }
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusColor = () => {
    if (job.status === 'completed') return 'bg-green-500';
    if (job.status === 'failed') return 'bg-destructive';
    if (job.status === 'cancelled') return 'bg-orange-500';
    if (job.status === 'processing') return 'bg-primary';
    return 'bg-muted';
  };

  const handleCancelClick = () => {
    if (job.success_count > 0) {
      setShowRollbackOption(true);
    }
    setShowCancelDialog(true);
  };

  const handleCancel = async (rollback: boolean = false) => {
    setIsCancelling(true);
    try {
      // Update job status to cancelled
      const { error: updateError } = await supabase
        .from('import_jobs')
        .update({
          status: 'cancelled',
          current_stage: 'cancelled',
          completed_at: new Date().toISOString(),
          stage_details: {
            message: 'Import cancelled by user',
            rollback_requested: rollback
          }
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // If rollback is requested and records were inserted
      if (rollback && job.success_count > 0 && job.started_at) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Delete records created during this import based on import type
        if (job.import_type === 'contacts') {
          await supabase
            .from('contacts')
            .delete()
            .gte('created_at', job.started_at)
            .eq('created_by', user.id);
        } else if (job.import_type === 'redefine_repository') {
          await supabase
            .from('redefine_data_repository')
            .delete()
            .gte('created_at', job.started_at)
            .eq('created_by', user.id);
        } else if (job.import_type === 'email_recipients') {
          await supabase
            .from('email_campaign_recipients')
            .delete()
            .gte('created_at', job.started_at);
        } else if (job.import_type === 'whatsapp_recipients') {
          await supabase
            .from('whatsapp_campaign_recipients')
            .delete()
            .gte('created_at', job.started_at);
        }

        toast({
          title: "Import cancelled",
          description: `Import cancelled and ${job.success_count} records rolled back.`
        });
      } else {
        toast({
          title: "Import cancelled",
          description: job.success_count > 0 
            ? `Import cancelled. ${job.success_count} records were already imported.`
            : "Import cancelled successfully."
        });
      }

      if (onCancel) {
        onCancel();
      }
    } catch (error) {
      console.error('Cancel error:', error);
      toast({
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "Failed to cancel import",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const progressPercentage = job.total_rows > 0 
    ? Math.round((job.processed_rows / job.total_rows) * 100) 
    : 0;

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {getStatusIcon()}
              <div className="flex-1">
                <h4 className="font-medium">{job.file_name}</h4>
                <p className="text-sm text-muted-foreground">
                  {getStageLabel(job.current_stage)}
                </p>
              </div>
            </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
              {job.status}
            </Badge>
            {['pending', 'processing'].includes(job.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Cancel'
                )}
              </Button>
            )}
          </div>
          </div>

        {job.total_rows > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {job.processed_rows.toLocaleString()} / {job.total_rows.toLocaleString()} rows
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressPercentage}%</span>
              {job.stage_details?.message && (
                <span>{job.stage_details.message}</span>
              )}
            </div>
          </div>
        )}

        {(job.success_count > 0 || job.error_count > 0) && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{job.success_count.toLocaleString()} successful</span>
            </div>
            {job.error_count > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{job.error_count.toLocaleString()} errors</span>
              </div>
            )}
          </div>
        )}

        {job.stage_details?.batches_completed !== undefined && (
          <div className="text-sm text-muted-foreground">
            Processing batch {job.stage_details.batches_completed + 1} of {job.stage_details.total_batches}
          </div>
        )}
      </div>
    </Card>

    <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Import?</AlertDialogTitle>
          <AlertDialogDescription>
            {showRollbackOption ? (
              <>
                <p className="mb-3">
                  This import has already inserted {job.success_count} records into the database.
                </p>
                <p className="font-medium mb-2">What would you like to do?</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Cancel & Keep Data:</strong> Stop the import but keep the {job.success_count} records already inserted</li>
                  <li><strong>Cancel & Rollback:</strong> Stop the import and delete all {job.success_count} records that were inserted</li>
                </ul>
              </>
            ) : (
              "Are you sure you want to cancel this import? No data has been inserted yet."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>
            Continue Import
          </AlertDialogCancel>
          {showRollbackOption ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleCancel(false)}
                disabled={isCancelling}
              >
                Cancel & Keep Data
              </Button>
              <AlertDialogAction
                onClick={() => handleCancel(true)}
                disabled={isCancelling}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Cancel & Rollback'
                )}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              onClick={() => handleCancel(false)}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Yes, Cancel Import'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, AlertCircle, X } from "lucide-react";

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
  };
  onCancel?: (jobId: string) => void;
}

export function ImportProgressCard({ job, onCancel }: ImportProgressCardProps) {
  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      pending: 'Queued',
      downloading: 'Downloading file',
      validating: 'Validating structure',
      parsing: 'Parsing CSV',
      inserting: 'Inserting records',
      finalizing: 'Finalizing',
      completed: 'Completed',
      failed: 'Failed'
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
    if (job.status === 'processing') {
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    }
    return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusColor = () => {
    if (job.status === 'completed') return 'bg-green-500';
    if (job.status === 'failed') return 'bg-destructive';
    if (job.status === 'processing') return 'bg-primary';
    return 'bg-muted';
  };

  const progressPercentage = job.total_rows > 0 
    ? Math.round((job.processed_rows / job.total_rows) * 100) 
    : 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {getStatusIcon()}
            <div>
              <h4 className="font-medium">{job.file_name}</h4>
              <p className="text-sm text-muted-foreground">
                {getStageLabel(job.current_stage)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
              {job.status}
            </Badge>
            {(job.status === 'pending' || job.status === 'processing') && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancel(job.id)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
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
  );
}
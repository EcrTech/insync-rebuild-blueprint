import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ImportJob {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  created_at: string;
  completed_at: string;
}

interface ImportHistoryTableProps {
  jobs: ImportJob[];
  onRefresh: () => void;
  onComplete?: () => void;
}

export function ImportHistoryTable({ jobs, onRefresh, onComplete }: ImportHistoryTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: 'default', icon: CheckCircle2, className: 'bg-green-500' },
      failed: { variant: 'destructive', icon: XCircle },
      processing: { variant: 'secondary', icon: Clock },
      pending: { variant: 'outline', icon: Clock }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const handleRefresh = () => {
    onRefresh();
    if (onComplete) {
      const hasCompleted = jobs.some(job => 
        job.status === 'completed' && 
        new Date(job.completed_at).getTime() > Date.now() - 10000
      );
      if (hasCompleted) {
        onComplete();
      }
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Import History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Rows</TableHead>
              <TableHead className="text-right">Success</TableHead>
              <TableHead className="text-right">Errors</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No import history
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.file_name}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-right">
                    {job.total_rows.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-green-600">
                      {job.success_count.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {job.error_count > 0 ? (
                      <span className="text-destructive">
                        {job.error_count.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
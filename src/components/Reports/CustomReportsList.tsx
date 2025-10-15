import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Pencil, Download, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOrgContext } from "@/hooks/useOrgContext";

interface CustomReportsListProps {
  onViewReport: (reportId: string) => void;
}

export const CustomReportsList = ({ onViewReport }: CustomReportsListProps) => {
  const navigate = useNavigate();
  const { effectiveOrgId } = useOrgContext();

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['saved-reports', effectiveOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('saved_reports')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Failed to delete report");
      return;
    }

    toast.success("Report deleted successfully");
    refetch();
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CardHeader>
          <CardTitle>No Custom Reports Yet</CardTitle>
          <CardDescription>
            Create your first custom report using the Report Builder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/reports/builder')}>
            Create Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <Card key={report.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">{report.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {report.description || 'No description'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p><span className="font-medium">Data Source:</span> {report.data_source}</p>
                <p><span className="font-medium">Created:</span> {format(new Date(report.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => onViewReport(report.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/reports/builder?edit=${report.id}`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(report.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

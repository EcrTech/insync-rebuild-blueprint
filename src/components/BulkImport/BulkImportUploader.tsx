import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, Loader2 } from "lucide-react";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { useOrgContext } from "@/hooks/useOrgContext";

interface BulkImportUploaderProps {
  importType: 'contacts' | 'email_recipients' | 'whatsapp_recipients' | 'redefine_repository' | 'inventory';
  targetId?: string;
  identifierType?: 'email' | 'phone';
  requiredColumns: string[];
  optionalColumns?: string[];
  maxRows?: number;
  onUploadComplete?: (jobId: string) => void;
  onDataLoaded?: () => void;
}

interface ImportJob {
  id: string;
  file_name: string;
  status: string;
  current_stage: string;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  error_details: any;
  stage_details: any;
  created_at: string;
  started_at: string;
  completed_at: string;
}

export function BulkImportUploader({
  importType,
  targetId,
  identifierType,
  requiredColumns,
  optionalColumns = [],
  maxRows = 50000,
  onUploadComplete,
  onDataLoaded
}: BulkImportUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const { toast } = useToast();
  const { effectiveOrgId } = useOrgContext();

  useEffect(() => {
    loadImportJobs();
    subscribeToJobUpdates();
  }, [effectiveOrgId]);

  const loadImportJobs = async () => {
    if (!effectiveOrgId) return;

    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('org_id', effectiveOrgId)
      .eq('import_type', importType)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading import jobs:', error);
      return;
    }

    setImportJobs(data as any || []);
    
    const active = data?.find(job => 
      job.status === 'pending' || job.status === 'processing'
    );
    setActiveJob(active as any || null);
  };

  const subscribeToJobUpdates = () => {
    const channel = supabase
      .channel('import-jobs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'import_jobs'
      }, () => {
        loadImportJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const validateCSVStructure = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    try {
      const text = await file.slice(0, 10240).text();
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        return { valid: false, error: 'CSV file must contain headers and at least one data row' };
      }

      const headers = lines[0].split(',').map(h => 
        h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      );

      const missing = requiredColumns.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        return { valid: false, error: `Missing required columns: ${missing.join(', ')}` };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to parse CSV file' };
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Validate CSV structure
      const validation = await validateCSVStructure(file);
      if (!validation.valid) {
        toast({
          title: "Invalid CSV structure",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('bulk-imports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create import job record
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          org_id: effectiveOrgId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          import_type: importType,
          target_id: targetId,
          status: 'pending',
          current_stage: 'pending'
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Trigger processing with detailed logging
      console.log('[UPLOAD] Invoking bulk-import-trigger for job:', job.id);
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke('bulk-import-trigger', {
        body: { importJobId: job.id }
      });

      console.log('[UPLOAD] Trigger response:', { data: triggerData, error: triggerError });

      if (triggerError) {
        console.error('[UPLOAD] Trigger failed, attempting direct processing:', triggerError);
        
        // Fallback: Try direct processing
        const { data: directData, error: directError } = await supabase.functions.invoke('process-bulk-import', {
          body: { importJobId: job.id }
        });
        
        console.log('[UPLOAD] Direct processing response:', { data: directData, error: directError });
        
        if (directError) throw directError;
      }

      toast({
        title: "Import started",
        description: "Your file is being processed in the background. You can continue working.",
        duration: 300000 // 5 minutes - will stay visible until job completes or user dismisses
      });

      if (onUploadComplete) {
        onUploadComplete(job.id);
      }

      loadImportJobs();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('import_jobs')
        .update({ 
          status: 'failed',
          current_stage: 'cancelled',
          error_details: [{ message: 'Cancelled by user' }]
        })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Import cancelled",
        description: "The import process has been stopped."
      });

      setActiveJob(null);
      loadImportJobs();
    } catch (error) {
      console.error('Cancel error:', error);
      toast({
        title: "Failed to cancel",
        description: error.message || "Could not cancel the import",
        variant: "destructive"
      });
    }
  };

  const handleRollback = async (jobId: string) => {
    try {
      if (!confirm('Are you sure you want to rollback this import? This will delete all records imported in this job.')) {
        return;
      }

      toast({
        title: "Rollback started",
        description: "Deleting imported records...",
      });

      const { data, error } = await supabase.functions.invoke('rollback-bulk-import', {
        body: { importJobId: jobId }
      });

      if (error) throw error;

      toast({
        title: "Rollback completed",
        description: `Successfully deleted ${data?.deletedCount || 0} records.`,
      });

      loadImportJobs();
      if (onDataLoaded) {
        onDataLoaded();
      }
    } catch (error) {
      console.error('Rollback error:', error);
      toast({
        title: "Rollback failed",
        description: error.message || "Could not rollback the import",
        variant: "destructive"
      });
    }
  };

  const downloadTemplate = () => {
    const allColumns = [...requiredColumns, ...optionalColumns];
    const csvContent = allColumns.join(',') + '\n';
    const sampleRow = allColumns.map(col => {
      if (col === 'email') return 'user@example.com';
      if (col === 'phone') return '+1234567890';
      if (col === 'first_name') return 'John';
      if (col === 'last_name') return 'Doe';
      return 'sample_value';
    }).join(',') + '\n';

    const blob = new Blob([csvContent + sampleRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Bulk Import</h3>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file to import up to {maxRows.toLocaleString()} records
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="csv-upload">
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading || !!activeJob}
                className="hidden"
              />
              <Button
                variant="default"
                disabled={isUploading || !!activeJob}
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </>
                )}
              </Button>
            </label>

            {activeJob && (
              <span className="text-sm text-muted-foreground">
                An import is currently in progress
              </span>
            )}
          </div>
        </div>
      </Card>

      {activeJob && (
        <ImportProgressCard job={activeJob} onCancel={handleCancelJob} />
      )}

      {importJobs.length > 0 && (
        <ImportHistoryTable 
          jobs={importJobs} 
          onRefresh={loadImportJobs}
          onComplete={onDataLoaded}
          onCancel={handleCancelJob}
          onRollback={handleRollback}
        />
      )}
    </div>
  );
}
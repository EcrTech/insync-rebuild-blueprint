import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Upload, Download, Loader2 } from "lucide-react";
import { ImportProgressCard } from "./ImportProgressCard";
import { ImportHistoryTable } from "./ImportHistoryTable";
import { useOrgContext } from "@/hooks/useOrgContext";

interface BulkImportUploaderProps {
  importType: 'contacts' | 'email_recipients' | 'whatsapp_recipients' | 'redefine_repository';
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
  import_type: string;
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
      .limit(3);

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

      // Trigger processing
      const { error: triggerError } = await supabase.functions.invoke('bulk-import-trigger', {
        body: { importJobId: job.id }
      });

      if (triggerError) throw triggerError;

      toast({
        title: "Import started",
        description: "Your file is being processed in the background. You can continue working."
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
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Bulk Import Repository Data</CardTitle>
          <CardDescription>
            Upload a CSV file to import multiple repository records at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <label htmlFor="csv-upload" className="w-full max-w-md">
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading || !!activeJob}
                className="hidden"
              />
              <Button
                variant="outline"
                size="lg"
                disabled={isUploading || !!activeJob}
                onClick={() => document.getElementById('csv-upload')?.click()}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose CSV File
                  </>
                )}
              </Button>
            </label>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
            <div className="font-semibold text-base">Import Guidelines:</div>
            <ul className="space-y-2 list-disc list-inside">
              <li>Maximum <strong>5,000 records</strong> per file</li>
              <li>Processing runs in the background with progress tracking (updates every 15 seconds)</li>
              <li>Use the same CSV template format as your existing data</li>
              <li>Automatic duplicate handling via <strong>PersonalEmailID</strong></li>
              <li>Processing rate: ~5,000-8,000 rows/minute</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {activeJob && (
        <ImportProgressCard 
          job={activeJob} 
          onCancel={loadImportJobs}
        />
      )}

      {importJobs.length > 0 && (
        <ImportHistoryTable 
          jobs={importJobs} 
          onRefresh={loadImportJobs}
          onComplete={onDataLoaded}
        />
      )}
    </div>
  );
}
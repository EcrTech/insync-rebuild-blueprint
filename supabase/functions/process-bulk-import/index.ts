import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const OPERATION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
const MAX_RETRIES = 3;
const BATCH_SIZE = 2500;
const PROGRESS_UPDATE_INTERVAL = 15000; // 15 seconds

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportJob {
  id: string;
  org_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  import_type: string;
  target_id: string | null;
}

interface ContactRecord {
  org_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status?: string;
  source?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  postal_code?: string;
  website?: string;
  linkedin_url?: string;
  notes?: string;
  created_by: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values.map(v => v.replace(/^"|"$/g, ''));
}

function normalizeHeader(header: string): string {
  return header.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: any;
  let importJobId: string | undefined;

  try {
    console.log('[INIT] Starting bulk import processor');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    importJobId = body.importJobId;
    
    if (!importJobId) {
      throw new Error('Missing importJobId');
    }

    console.log('[JOB] Processing job:', importJobId);

    // Fetch import job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single() as { data: ImportJob | null; error: any };

    if (jobError || !importJob) {
      throw new Error(`Import job not found: ${jobError?.message}`);
    }

    console.log('[JOB] Found:', importJob.file_name, 'Type:', importJob.import_type);

    // Download file from storage
    await updateJobStage(supabase, importJobId, 'downloading', {
      message: 'Downloading file...'
    });

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bulk-imports')
      .download(importJob.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const fileSizeKB = Math.round(fileData.size / 1024);
    console.log('[STORAGE] File downloaded:', fileSizeKB, 'KB');

    // Convert blob to text
    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter((line: string) => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    await updateJobStage(supabase, importJobId, 'validating', {
      message: 'Validating CSV structure...',
      file_size_kb: fileSizeKB
    });

    const headers = parseCSVLine(lines[0]).map(normalizeHeader);
    console.log('[PARSE] Headers detected:', headers);

    // Validate required columns based on import type
    let requiredColumns: string[];
    switch (importJob.import_type) {
      case 'contacts':
        requiredColumns = ['first_name'];
        break;
      case 'redefine_repository':
        requiredColumns = ['name', 'personalemailid'];
        break;
      case 'email_recipients':
      case 'whatsapp_recipients':
        requiredColumns = ['email'];
        break;
      default:
        requiredColumns = [];
    }
    
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse and process data
    await updateJobStage(supabase, importJobId, 'parsing', {
      message: 'Parsing CSV data...',
      headers_found: headers.length,
      total_batches: Math.ceil((lines.length - 1) / BATCH_SIZE)
    });

    const totalRows = lines.length - 1;
    let processedRows = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];
    let batch: any[] = [];
    let batchNumber = 0;
    let lastProgressUpdate = Date.now();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check if job was cancelled every 100 rows
      if (i % 100 === 0) {
        const { data: jobCheck } = await supabase
          .from('import_jobs')
          .select('status')
          .eq('id', importJobId)
          .single();
        
        if (jobCheck?.status === 'cancelled') {
          console.log('[CANCELLED] Import job was cancelled by user');
          await updateJobStage(supabase, importJobId, 'cancelled', {
            message: 'Import cancelled by user',
            processed_at_cancellation: i - 1
          });
          return new Response(JSON.stringify({
            success: false,
            message: 'Import cancelled by user',
            processed: successCount,
            errors: errorCount
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      try {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        // Map to target table structure
        let record: any;
        if (importJob.import_type === 'contacts') {
          record = {
            org_id: importJob.org_id,
            first_name: row.first_name,
            last_name: row.last_name || '',
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || null,
            job_title: row.job_title || null,
            status: row.status || 'new',
            source: row.source || 'bulk_import',
            city: row.city || row.location_city || null,
            state: row.state || row.location_state || null,
            country: row.country || null,
            address: row.address || null,
            postal_code: row.postal_code || row.location_zip || null,
            website: row.website || null,
            linkedin_url: row.linkedin_url || null,
            notes: row.notes || null,
            created_by: importJob.user_id
          };
        } else if (importJob.import_type === 'email_recipients') {
          record = {
            campaign_id: importJob.target_id,
            contact_id: null,
            email: row.email,
            custom_data: row,
            status: 'pending'
          };
        } else if (importJob.import_type === 'whatsapp_recipients') {
          record = {
            campaign_id: importJob.target_id,
            contact_id: null,
            phone_number: row.phone,
            custom_data: row,
            status: 'pending'
          };
        } else if (importJob.import_type === 'redefine_repository') {
          // Validate org is Redefine
          const { data: org } = await supabase
            .from('organizations')
            .select('slug')
            .eq('id', importJob.org_id)
            .single();
          
          if (org?.slug !== 'redefine-marcom-pvt-ltd') {
            throw new Error('This import type is exclusive to Redefine organization');
          }
          
          record = {
            org_id: importJob.org_id,
            name: row.name,
            designation: row.designation || null,
            department: row.deppt || row.department || null,
            job_level: row.job_level_updated || row.job_level || null,
            linkedin_url: row.linkedin || null,
            mobile_number: row.mobilenumb || row.mobile_number || null,
            mobile_2: row.mobile2 || null,
            official_email: row.official || null,
            personal_email: row.personalemailid || row.personal_email || null,
            generic_email: row.generic_email_id || row.generic_email || null,
            industry_type: row.industry_type || null,
            sub_industry: row.sub_industry || null,
            company_name: row.company_name || null,
            address: row.address || null,
            location: row.location || null,
            city: row.city || null,
            state: row.state || null,
            zone: row.zone || null,
            tier: row.tier || null,
            pincode: row.pincode || null,
            website: row.website || null,
            turnover: row.turnover || null,
            employee_size: row.emp_size || row.employee_size || null,
            erp_name: row.erp_name || null,
            erp_vendor: row.erp_vendor || null,
            created_by: importJob.user_id
          };
          
          // Validate required fields for redefine_repository
          if (!record.name || !record.personal_email) {
            throw new Error('Missing required fields: name and personalemailid are required');
          }
          
          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(record.personal_email)) {
            throw new Error(`Invalid email format in personalemailid: ${record.personal_email}`);
          }
        }

        batch.push(record);
        processedRows++;

        // Process batch when full
        if (batch.length >= BATCH_SIZE) {
          batchNumber++;
          await processBatch(supabase, importJob, batch, batchNumber);
          successCount += batch.length;
          batch = [];

          // Throttled progress update
          const now = Date.now();
          if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
            await updateJobProgress(supabase, importJobId, {
              total_rows: totalRows,
              processed_rows: processedRows,
              success_count: successCount,
              error_count: errorCount,
              current_stage: 'inserting',
              stage_details: {
                message: `Processing batch ${batchNumber}...`,
                current_batch: batch.length,
                batches_completed: batchNumber
              }
            });
            lastProgressUpdate = now;
          }
        }

      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          row: i,
          error: errorMessage,
          data: line.substring(0, 100)
        });
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      batchNumber++;
      await processBatch(supabase, importJob, batch, batchNumber);
      successCount += batch.length;
    }

    console.log('[COMPLETE] Processed:', successCount, 'success,', errorCount, 'errors');

    // Finalize import
    await updateJobStage(supabase, importJobId, 'finalizing', {
      message: 'Finalizing import...',
      total_success: successCount,
      total_errors: errorCount
    });

    // Cleanup file
    const { error: deleteError } = await supabase.storage
      .from('bulk-imports')
      .remove([importJob.file_path]);

    if (deleteError) {
      console.error('[CLEANUP] Failed to delete file:', deleteError);
    } else {
      console.log('[CLEANUP] File deleted successfully');
    }

    // Update final status
    const duration = Math.round((Date.now() - startTime) / 1000);
    await supabase.from('import_jobs').update({
      status: 'completed',
      current_stage: 'completed',
      total_rows: totalRows,
      processed_rows: processedRows,
      success_count: successCount,
      error_count: errorCount,
      error_details: errors.slice(-100),
      completed_at: new Date().toISOString(),
      file_cleaned_up: !deleteError,
      file_cleanup_at: new Date().toISOString(),
      stage_details: {
        message: `Import completed in ${duration}s`,
        total_success: successCount,
        total_errors: errorCount
      }
    }).eq('id', importJobId);

    console.log('[SUCCESS] Import completed in', duration, 'seconds');

    return new Response(JSON.stringify({
      success: true,
      processed: successCount,
      errors: errorCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ERROR] Processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Use importJobId from outer scope instead of re-reading request body
    if (supabase && importJobId) {
      try {
        await supabase.from('import_jobs').update({
          status: 'failed',
          current_stage: 'failed',
          completed_at: new Date().toISOString(),
          error_details: [{
            error: errorMessage,
            stack: errorStack,
            timestamp: new Date().toISOString()
          }],
          stage_details: { 
            error: errorMessage,
            message: `Import failed: ${errorMessage}`
          }
        }).eq('id', importJobId);
      } catch (updateError) {
        console.error('[ERROR] Failed to update job status:', updateError);
      }
    }

    return new Response(JSON.stringify({
      error: 'Processing failed',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function updateJobStage(supabase: any, jobId: string, stage: string, details: any) {
  await supabase.from('import_jobs').update({
    current_stage: stage,
    stage_details: details,
    updated_at: new Date().toISOString()
  }).eq('id', jobId);
}

async function updateJobProgress(supabase: any, jobId: string, progress: any) {
  await supabase.from('import_jobs').update({
    ...progress,
    updated_at: new Date().toISOString()
  }).eq('id', jobId);
}

async function processBatch(supabase: any, importJob: ImportJob, batch: any[], batchNumber: number) {
  console.log('[DB] Inserting batch', batchNumber, 'with', batch.length, 'records');

  try {
    let tableName: string;
    let conflictColumn: string;

    if (importJob.import_type === 'contacts') {
      tableName = 'contacts';
      conflictColumn = 'email';
      
      // Deduplicate by email
      const deduped = [];
      const seen = new Set();
      for (let i = batch.length - 1; i >= 0; i--) {
        const record = batch[i];
        if (record.email && !seen.has(record.email)) {
          seen.add(record.email);
          deduped.unshift(record);
        } else if (!record.email) {
          deduped.unshift(record);
        }
      }
      batch = deduped;
    } else if (importJob.import_type === 'email_recipients') {
      tableName = 'email_campaign_recipients';
      conflictColumn = 'email';
    } else if (importJob.import_type === 'whatsapp_recipients') {
      tableName = 'whatsapp_campaign_recipients';
      conflictColumn = 'phone_number';
    } else if (importJob.import_type === 'redefine_repository') {
      tableName = 'redefine_data_repository';
      conflictColumn = 'personal_email';
      
      // Deduplicate by personal_email
      const deduped = [];
      const seen = new Set();
      for (let i = batch.length - 1; i >= 0; i--) {
        const record = batch[i];
        const key = `${record.org_id}:${record.personal_email}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.unshift(record);
        }
      }
      batch = deduped;
    } else {
      throw new Error(`Unknown import type: ${importJob.import_type}`);
    }

    const { error } = await supabase
      .from(tableName)
      .upsert(batch, {
        onConflict: conflictColumn,
        ignoreDuplicates: false
      });

    if (error) {
      console.error('[DB] Batch insert failed:', error);
      throw error;
    }

    console.log('[DB] Batch', batchNumber, 'inserted successfully');
  } catch (error) {
    console.error('[DB] Batch processing error:', error);
    throw error;
  }
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BulkImportUploader } from "@/components/BulkImport/BulkImportUploader";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onImportComplete: () => void;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  orgId,
  onImportComplete,
}: BulkImportDialogProps) {
  const requiredColumns = ["name", "personalemailid"];

  const optionalColumns = [
    "designation",
    "deppt",
    "job_level_updated",
    "linkedin",
    "mobilenumb",
    "mobile2",
    "official",
    "generic_email_id",
    "industry_type",
    "sub_industry",
    "company_name",
    "address",
    "location",
    "city",
    "state",
    "zone",
    "tier",
    "pincode",
    "website",
    "turnover",
    "emp_size",
    "erp_name",
    "erp_vendor",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Repository Data</DialogTitle>
        </DialogHeader>

        <BulkImportUploader
          importType="redefine_repository"
          requiredColumns={requiredColumns}
          optionalColumns={optionalColumns}
          onUploadComplete={() => {
            onImportComplete();
            onOpenChange(false);
          }}
          onDataLoaded={onImportComplete}
        />
      </DialogContent>
    </Dialog>
  );
}

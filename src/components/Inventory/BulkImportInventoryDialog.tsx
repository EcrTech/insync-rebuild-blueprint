import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BulkImportUploader } from "@/components/BulkImport/BulkImportUploader";

interface BulkImportInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onImportComplete: () => void;
}

export function BulkImportInventoryDialog({
  open,
  onOpenChange,
  orgId,
  onImportComplete,
}: BulkImportInventoryDialogProps) {
  const requiredColumns = [
    "item_id_sku",
    "item_name",
    "brand",
    "category",
    "diameter_mm",
    "length_mm",
    "available_qty",
    "uom"
  ];

  const optionalColumns = [
    "subcategory",
    "grade_class",
    "material",
    "finish_coating",
    "thread_pitch",
    "head_type",
    "drive_type",
    "standard_spec",
    "reorder_level",
    "reorder_qty",
    "storage_location",
    "warehouse_branch",
    "supplier_name",
    "supplier_code",
    "last_purchase_date",
    "last_purchase_price",
    "lead_time_days",
    "purchase_order_no",
    "selling_price",
    "discount_pct",
    "customer_project",
    "last_sale_date",
    "gst_pct",
    "hsn_code",
    "batch_no",
    "heat_no",
    "inspection_status",
    "date_of_entry",
    "remarks_notes",
    "weight_per_unit",
    "image_ref",
    "certificate_no",
    "expiry_review_date",
    "issued_to"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Inventory</DialogTitle>
        </DialogHeader>

        <BulkImportUploader
          importType="inventory"
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

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotification } from "@/hooks/useNotification";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AddEditInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  orgId: string;
}

export function AddEditInventoryDialog({ open, onOpenChange, item, orgId }: AddEditInventoryDialogProps) {
  const notify = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({
        brand: "Unbrako",
        available_qty: 0,
        uom: "Nos",
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        org_id: orgId,
      };

      if (item) {
        const { error } = await supabase
          .from("inventory_items")
          .update(dataToSave)
          .eq("id", item.id);

        if (error) throw error;

        notify.success("Item updated successfully");
      } else {
        const { error } = await supabase
          .from("inventory_items")
          .insert(dataToSave);

        if (error) throw error;

        notify.success("Item added successfully");
      }

      onOpenChange(false);
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "Add"} Inventory Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="supplier">Supplier & Sales</TabsTrigger>
              <TabsTrigger value="quality">Quality & More</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item_id_sku">Item ID / SKU *</Label>
                  <Input
                    id="item_id_sku"
                    value={formData.item_id_sku || ""}
                    onChange={(e) => handleChange("item_id_sku", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="item_name">Item Name *</Label>
                  <Input
                    id="item_name"
                    value={formData.item_name || ""}
                    onChange={(e) => handleChange("item_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="brand">Brand *</Label>
                  <Select value={formData.brand || ""} onValueChange={(val) => handleChange("brand", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unbrako">Unbrako</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category || ""} onValueChange={(val) => handleChange("category", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bolt">Bolt</SelectItem>
                      <SelectItem value="Nut">Nut</SelectItem>
                      <SelectItem value="Washer">Washer</SelectItem>
                      <SelectItem value="Screw">Screw</SelectItem>
                      <SelectItem value="Stud">Stud</SelectItem>
                      <SelectItem value="Socket Set Screw">Socket Set Screw</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Input
                    id="subcategory"
                    value={formData.subcategory || ""}
                    onChange={(e) => handleChange("subcategory", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="available_qty">Available Quantity *</Label>
                  <Input
                    id="available_qty"
                    type="number"
                    value={formData.available_qty || 0}
                    onChange={(e) => handleChange("available_qty", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="uom">Unit of Measure *</Label>
                  <Select value={formData.uom || "Nos"} onValueChange={(val) => handleChange("uom", val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nos">Nos</SelectItem>
                      <SelectItem value="Box">Box</SelectItem>
                      <SelectItem value="Packet">Packet</SelectItem>
                      <SelectItem value="Kg">Kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="storage_location">Storage Location</Label>
                  <Input
                    id="storage_location"
                    value={formData.storage_location || ""}
                    onChange={(e) => handleChange("storage_location", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="warehouse_branch">Warehouse / Branch</Label>
                  <Input
                    id="warehouse_branch"
                    value={formData.warehouse_branch || ""}
                    onChange={(e) => handleChange("warehouse_branch", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specs" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="diameter_mm">Diameter (mm) *</Label>
                  <Input
                    id="diameter_mm"
                    value={formData.diameter_mm || ""}
                    onChange={(e) => handleChange("diameter_mm", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="length_mm">Length (mm) *</Label>
                  <Input
                    id="length_mm"
                    value={formData.length_mm || ""}
                    onChange={(e) => handleChange("length_mm", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Select value={formData.material || ""} onValueChange={(val) => handleChange("material", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alloy Steel">Alloy Steel</SelectItem>
                      <SelectItem value="Stainless Steel">Stainless Steel</SelectItem>
                      <SelectItem value="Mild Steel">Mild Steel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="finish_coating">Finish / Coating</Label>
                  <Select value={formData.finish_coating || ""} onValueChange={(val) => handleChange("finish_coating", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Black Oxide">Black Oxide</SelectItem>
                      <SelectItem value="Zinc Plated">Zinc Plated</SelectItem>
                      <SelectItem value="Phosphate">Phosphate</SelectItem>
                      <SelectItem value="Plain">Plain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grade_class">Grade / Class</Label>
                  <Input
                    id="grade_class"
                    value={formData.grade_class || ""}
                    onChange={(e) => handleChange("grade_class", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="thread_pitch">Thread Pitch</Label>
                  <Input
                    id="thread_pitch"
                    value={formData.thread_pitch || ""}
                    onChange={(e) => handleChange("thread_pitch", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="head_type">Head Type</Label>
                  <Select value={formData.head_type || ""} onValueChange={(val) => handleChange("head_type", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select head type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Socket">Socket</SelectItem>
                      <SelectItem value="Hex">Hex</SelectItem>
                      <SelectItem value="Button">Button</SelectItem>
                      <SelectItem value="Countersunk">Countersunk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="drive_type">Drive Type</Label>
                  <Select value={formData.drive_type || ""} onValueChange={(val) => handleChange("drive_type", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drive type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Allen Key">Allen Key</SelectItem>
                      <SelectItem value="Torx">Torx</SelectItem>
                      <SelectItem value="Slotted">Slotted</SelectItem>
                      <SelectItem value="Phillips">Phillips</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="standard_spec">Standard / Specification</Label>
                  <Input
                    id="standard_spec"
                    value={formData.standard_spec || ""}
                    onChange={(e) => handleChange("standard_spec", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="supplier" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier_name">Supplier Name</Label>
                  <Input
                    id="supplier_name"
                    value={formData.supplier_name || ""}
                    onChange={(e) => handleChange("supplier_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_code">Supplier Code</Label>
                  <Input
                    id="supplier_code"
                    value={formData.supplier_code || ""}
                    onChange={(e) => handleChange("supplier_code", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="last_purchase_price">Last Purchase Price (₹)</Label>
                  <Input
                    id="last_purchase_price"
                    type="number"
                    step="0.01"
                    value={formData.last_purchase_price || ""}
                    onChange={(e) => handleChange("last_purchase_price", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="selling_price">Selling Price (₹)</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    step="0.01"
                    value={formData.selling_price || ""}
                    onChange={(e) => handleChange("selling_price", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="discount_pct">Discount (%)</Label>
                  <Input
                    id="discount_pct"
                    type="number"
                    step="0.01"
                    value={formData.discount_pct || ""}
                    onChange={(e) => handleChange("discount_pct", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gst_pct">GST (%)</Label>
                  <Input
                    id="gst_pct"
                    type="number"
                    step="0.01"
                    value={formData.gst_pct || ""}
                    onChange={(e) => handleChange("gst_pct", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="hsn_code">HSN Code</Label>
                  <Input
                    id="hsn_code"
                    value={formData.hsn_code || ""}
                    onChange={(e) => handleChange("hsn_code", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reorder_level">Reorder Level</Label>
                  <Input
                    id="reorder_level"
                    type="number"
                    value={formData.reorder_level || ""}
                    onChange={(e) => handleChange("reorder_level", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reorder_qty">Reorder Quantity</Label>
                  <Input
                    id="reorder_qty"
                    type="number"
                    value={formData.reorder_qty || ""}
                    onChange={(e) => handleChange("reorder_qty", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch_no">Batch No.</Label>
                  <Input
                    id="batch_no"
                    value={formData.batch_no || ""}
                    onChange={(e) => handleChange("batch_no", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="heat_no">Heat No.</Label>
                  <Input
                    id="heat_no"
                    value={formData.heat_no || ""}
                    onChange={(e) => handleChange("heat_no", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="inspection_status">Inspection Status</Label>
                  <Select value={formData.inspection_status || ""} onValueChange={(val) => handleChange("inspection_status", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Passed">Passed</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="certificate_no">Certificate No.</Label>
                  <Input
                    id="certificate_no"
                    value={formData.certificate_no || ""}
                    onChange={(e) => handleChange("certificate_no", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="weight_per_unit">Weight per Unit (g/kg)</Label>
                  <Input
                    id="weight_per_unit"
                    type="number"
                    step="0.01"
                    value={formData.weight_per_unit || ""}
                    onChange={(e) => handleChange("weight_per_unit", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="image_ref">Image Reference</Label>
                  <Input
                    id="image_ref"
                    value={formData.image_ref || ""}
                    onChange={(e) => handleChange("image_ref", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="remarks_notes">Remarks / Notes</Label>
                  <Textarea
                    id="remarks_notes"
                    value={formData.remarks_notes || ""}
                    onChange={(e) => handleChange("remarks_notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? "Update" : "Add"} Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

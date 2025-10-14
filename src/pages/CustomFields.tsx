import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Upload, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options: any;
  is_required: boolean;
  is_active: boolean;
  field_order: number;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Text Area" },
  { value: "file", label: "File Upload (Image/PDF)" },
  { value: "location", label: "Location (Lat/Long)" },
];

interface SortableFieldCardProps {
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (id: string) => void;
}

function SortableFieldCard({ field, onEdit, onDelete }: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {field.field_label}
                  {field.is_required && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                  {!field.is_active && (
                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  <span className="font-mono text-xs">{field.field_name}</span>
                  {" • "}
                  <span className="capitalize">{field.field_type}</span>
                  {field.field_options && field.field_options.length > 0 && (
                    <>
                      {" • "}
                      <span>{field.field_options.length} options</span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(field)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(field.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {field.field_options && field.field_options.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {field.field_options.map((option, idx) => (
                <Badge key={idx} variant="outline">
                  {option}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function CustomFields() {
  const { effectiveOrgId } = useOrgContext();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    field_name: "",
    field_label: "",
    field_type: "text",
    field_options: "",
    is_required: false,
    is_active: true,
    field_order: 0,
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchFields();
    }
  }, [effectiveOrgId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchFields = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("field_order");

      if (error) throw error;
      setFields(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading fields",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    const newFields = arrayMove(fields, oldIndex, newIndex);
    
    // Update local state immediately for smooth UX
    setFields(newFields);

    // Update field_order in the database
    try {
      const updates = newFields.map((field, index) => ({
        id: field.id,
        field_order: index,
      }));

      // Batch update all field orders
      for (const update of updates) {
        await supabase
          .from('custom_fields')
          .update({ field_order: update.field_order })
          .eq('id', update.id);
      }

      toast({
        title: "Order updated",
        description: "Custom fields have been reordered successfully",
      });
    } catch (error: any) {
      // Revert to original order on error
      fetchFields();
      toast({
        variant: "destructive",
        title: "Error updating order",
        description: error.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveOrgId) return;
    
    setLoading(true);

    try {
      const fieldData: any = {
        field_name: formData.field_name.toLowerCase().replace(/\s+/g, '_'),
        field_label: formData.field_label,
        field_type: formData.field_type,
        is_required: formData.is_required,
        is_active: formData.is_active,
        field_order: formData.field_order,
        org_id: effectiveOrgId,
      };

      // Parse options for select type
      if (formData.field_type === "select" && formData.field_options) {
        fieldData.field_options = formData.field_options
          .split(",")
          .map(opt => opt.trim())
          .filter(opt => opt);
      } else {
        fieldData.field_options = null;
      }

      if (editingField) {
        const { error } = await supabase
          .from("custom_fields")
          .update(fieldData)
          .eq("id", editingField.id);

        if (error) throw error;

        toast({
          title: "Field updated",
          description: "Custom field has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("custom_fields")
          .insert([fieldData]);

        if (error) throw error;

        toast({
          title: "Field created",
          description: "Custom field has been added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchFields();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all values for this field from existing contacts.")) return;

    try {
      const { error } = await supabase
        .from("custom_fields")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Field deleted",
        description: "Custom field has been removed successfully",
      });
      fetchFields();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting field",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      field_name: "",
      field_label: "",
      field_type: "text",
      field_options: "",
      is_required: false,
      is_active: true,
      field_order: fields.length,
    });
    setEditingField(null);
  };

  const openEditDialog = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: field.field_options ? field.field_options.join(", ") : "",
      is_required: field.is_required,
      is_active: field.is_active,
      field_order: field.field_order,
    });
    setIsDialogOpen(true);
  };

  const downloadTemplate = () => {
    const template = [
      ["field_name", "field_label", "field_type", "field_options", "is_required", "is_active", "field_order"],
      ["department", "Department", "select", "Sales,Marketing,Engineering", "true", "true", "1"],
      ["budget", "Budget", "number", "", "false", "true", "2"],
      ["notes", "Additional Notes", "textarea", "", "false", "true", "3"],
    ];

    const csvContent = template.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_fields_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "CSV template has been downloaded successfully",
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a CSV file",
        });
        return;
      }
      setUploadFile(file);
    }
  };

  const processCSVUpload = async () => {
    if (!uploadFile || !effectiveOrgId) return;

    setLoading(true);
    try {
      const text = await uploadFile.text();
      const rows = text.split("\n").map(row => row.split(","));
      
      // Skip header row
      const dataRows = rows.slice(1).filter(row => row.length >= 7 && row[0].trim());

      const fieldsToInsert = dataRows.map((row, index) => ({
        field_name: row[0].trim().toLowerCase().replace(/\s+/g, "_"),
        field_label: row[1].trim(),
        field_type: row[2].trim(),
        field_options: row[3].trim() ? row[3].trim().split(";").map(opt => opt.trim()).filter(opt => opt) : null,
        is_required: row[4].trim().toLowerCase() === "true",
        is_active: row[5].trim().toLowerCase() === "true",
        field_order: parseInt(row[6].trim()) || index,
        org_id: effectiveOrgId,
      }));

      const { error } = await supabase
        .from("custom_fields")
        .insert(fieldsToInsert);

      if (error) throw error;

      toast({
        title: "Upload successful",
        description: `${fieldsToInsert.length} custom field(s) have been imported`,
      });

      setIsUploadDialogOpen(false);
      setUploadFile(null);
      fetchFields();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Custom Fields</h1>
            <p className="text-muted-foreground">Configure dynamic fields for contact forms</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Custom Fields CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload a CSV file with custom field definitions. Download the template for the correct format.
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium">CSV Format:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• field_name: Internal name (lowercase, underscores)</li>
                      <li>• field_label: Display label</li>
                      <li>• field_type: text, email, phone, number, date, select, textarea, file, location</li>
                      <li>• field_options: For select type, separate with semicolons (;)</li>
                      <li>• is_required: true or false</li>
                      <li>• is_active: true or false</li>
                      <li>• field_order: Number for ordering</li>
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsUploadDialogOpen(false);
                        setUploadFile(null);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={processCSVUpload}
                      disabled={!uploadFile || loading}
                      className="flex-1"
                    >
                      {loading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingField ? "Edit Field" : "Add New Field"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="field_label">Field Label *</Label>
                  <Input
                    id="field_label"
                    value={formData.field_label}
                    onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                    placeholder="e.g., Department"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_name">Field Name (Internal) *</Label>
                  <Input
                    id="field_name"
                    value={formData.field_name}
                    onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                    placeholder="e.g., department"
                    disabled={!!editingField}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Will be converted to lowercase with underscores
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_type">Field Type *</Label>
                  <Select 
                    value={formData.field_type} 
                    onValueChange={(value) => setFormData({ ...formData, field_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.field_type === "select" && (
                  <div className="space-y-2">
                    <Label htmlFor="field_options">Dropdown Options *</Label>
                    <Input
                      id="field_options"
                      value={formData.field_options}
                      onChange={(e) => setFormData({ ...formData, field_options: e.target.value })}
                      placeholder="Option 1, Option 2, Option 3"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate options with commas
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="field_order">Display Order</Label>
                  <Input
                    id="field_order"
                    type="number"
                    value={formData.field_order}
                    onChange={(e) => setFormData({ ...formData, field_order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_required">Required Field</Label>
                  <Switch
                    id="is_required"
                    checked={formData.is_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Saving..." : editingField ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading fields...</p>
              </CardContent>
            </Card>
          ) : fields.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No custom fields configured. Click "Add Field" to create one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((field) => (
                  <SortableFieldCard
                    key={field.id}
                    field={field}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Link2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_active: boolean;
}

interface Form {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface FormWithFields extends Form {
  field_count: number;
}

export default function Forms() {
  const { effectiveOrgId } = useOrgContext();
  const [forms, setForms] = useState<FormWithFields[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchForms();
      fetchCustomFields();
    }
  }, [effectiveOrgId]);

  const fetchForms = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data: formsData, error: formsError } = await supabase
        .from("forms")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false });

      if (formsError) throw formsError;

      // Get field counts for each form
      const formsWithCounts = await Promise.all(
        (formsData || []).map(async (form) => {
          const { count } = await supabase
            .from("form_fields")
            .select("*", { count: "exact", head: true })
            .eq("form_id", form.id);

          return {
            ...form,
            field_count: count || 0,
          };
        })
      );

      setForms(formsWithCounts);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading forms",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, field_name, field_label, field_type, is_active")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("field_order");

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading fields",
        description: error.message,
      });
    }
  };

  const fetchFormFields = async (formId: string) => {
    try {
      const { data, error } = await supabase
        .from("form_fields")
        .select("custom_field_id")
        .eq("form_id", formId);

      if (error) throw error;
      return data.map((ff) => ff.custom_field_id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading form fields",
        description: error.message,
      });
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFields.length === 0) {
      toast({
        variant: "destructive",
        title: "No fields selected",
        description: "Please select at least one field for the form",
      });
      return;
    }

    if (!effectiveOrgId) return;

    setLoading(true);

    try {
      let formId: string;

      if (editingForm) {
        const { error: updateError } = await supabase
          .from("forms")
          .update({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
          })
          .eq("id", editingForm.id);

        if (updateError) throw updateError;
        formId = editingForm.id;

        // Delete existing form fields
        await supabase
          .from("form_fields")
          .delete()
          .eq("form_id", formId);
      } else {
        const { data: newForm, error: insertError } = await supabase
          .from("forms")
          .insert([{
            org_id: effectiveOrgId,
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        formId = newForm.id;
      }

      // Insert form fields
      const formFields = selectedFields.map((fieldId, index) => ({
        form_id: formId,
        custom_field_id: fieldId,
        field_order: index,
      }));

      const { error: fieldsError } = await supabase
        .from("form_fields")
        .insert(formFields);

      if (fieldsError) throw fieldsError;

      toast({
        title: editingForm ? "Form updated" : "Form created",
        description: `Form has been ${editingForm ? "updated" : "created"} successfully`,
      });

      setIsDialogOpen(false);
      resetForm();
      fetchForms();
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
    if (!confirm("Are you sure? This will delete the form and all its field associations.")) return;

    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Form deleted",
        description: "Form has been removed successfully",
      });
      fetchForms();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting form",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_active: true,
    });
    setSelectedFields([]);
    setEditingForm(null);
  };

  const openEditDialog = async (form: Form) => {
    setEditingForm(form);
    setFormData({
      name: form.name,
      description: form.description || "",
      is_active: form.is_active,
    });
    
    const fields = await fetchFormFields(form.id);
    setSelectedFields(fields);
    setIsDialogOpen(true);
  };

  const toggleFieldSelection = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const copyFormLink = (formId: string) => {
    const link = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied",
      description: "Form link has been copied to clipboard",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Forms</h1>
            <p className="text-muted-foreground">Create custom forms for lead data collection</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Create Form
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingForm ? "Edit Form" : "Create New Form"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Form Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Lead Intake Form"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this form"
                    rows={3}
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

                <div className="space-y-3">
                  <Label>Select Fields for Form *</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which custom fields to include in this form
                  </p>
                  <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                    {customFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No custom fields available. Create some fields first.
                      </p>
                    ) : (
                      customFields.map((field) => (
                        <div key={field.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                          <Checkbox
                            id={field.id}
                            checked={selectedFields.includes(field.id)}
                            onCheckedChange={() => toggleFieldSelection(field.id)}
                          />
                          <Label
                            htmlFor={field.id}
                            className="flex-1 cursor-pointer flex items-center gap-2"
                          >
                            <span>{field.field_label}</span>
                            <Badge variant="outline" className="text-xs">
                              {field.field_type}
                            </Badge>
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedFields.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Saving..." : editingForm ? "Update Form" : "Create Form"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading forms...</p>
              </CardContent>
            </Card>
          ) : forms.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No forms created yet. Click "Create Form" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            forms.map((form) => (
              <Card key={form.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {form.name}
                          {!form.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="space-y-1">
                          <div>{form.description || "No description"}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span>{form.field_count} field{form.field_count !== 1 ? 's' : ''}</span>
                            <span>•</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyFormLink(form.id);
                              }}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Link2 className="h-3 w-3" />
                              Public link
                            </button>
                          </div>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyFormLink(form.id)}
                        title="Copy form link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(form)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(form.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

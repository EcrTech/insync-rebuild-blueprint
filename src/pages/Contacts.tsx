import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { useBulkUpload } from "@/hooks/useBulkUpload";
import { Plus, Pencil, Trash2, Mail, Phone as PhoneIcon, Building, Upload, Download, Loader2 } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Checkbox } from "@/components/ui/checkbox";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  pipeline_stage_id: string | null;
  enrichment_status?: string | null;
  last_enriched_at?: string | null;
  pipeline_stages?: {
    name: string;
    color: string;
  } | null;
  created_at: string;
}

interface PipelineStage {
  id: string;
  name: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
}

export default function Contacts() {
  const { effectiveOrgId } = useOrgContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const notify = useNotification();
  const bulkUpload = useBulkUpload();
  const navigate = useNavigate();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    status: "new",
    source: "",
    pipeline_stage_id: "",
    assigned_to: "",
    notes: "",
  });

  useEffect(() => {
    if (effectiveOrgId) {
      fetchContacts();
      fetchPipelineStages();
      fetchUsers();
    }
  }, [effectiveOrgId]);

  const fetchContacts = async (reset = false) => {
    if (!effectiveOrgId) return;
    
    try {
      const offset = reset ? 0 : contacts.length;
      const limit = 100; // Load 100 at a time
      
      // PERFORMANCE: Paginated loading with cursor
      // Note: Using left join with contact_emails to get primary email if available
      const { data, error, count } = await supabase
        .from("contacts")
        .select(`
          *,
          pipeline_stages:pipeline_stage_id(name, color),
          contact_emails!left(email, is_primary)
        `, { count: 'exact' })
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      
      // Map the data to prioritize primary email from contact_emails
      const mappedData = (data || []).map((contact: any) => {
        const primaryEmail = Array.isArray(contact.contact_emails) 
          ? contact.contact_emails.find((ce: any) => ce.is_primary)?.email 
          : null;
        
        return {
          ...contact,
          email: primaryEmail || contact.email, // Use primary email from contact_emails or fallback to contacts.email
        };
      });
      
      if (reset) {
        setContacts(mappedData);
      } else {
        setContacts(prev => [...prev, ...mappedData]);
      }
      
      // Check if there are more contacts to load
      setHasMore((data?.length || 0) === limit && (offset + limit) < (count || 0));
    } catch (error: any) {
      notify.error("Error loading contacts", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreContacts = () => {
    setLoadingMore(true);
    fetchContacts(false);
  };

  const fetchPipelineStages = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("stage_order");

      if (error) throw error;
      setPipelineStages(data || []);
    } catch (error: any) {
      console.error("Error fetching pipeline stages:", error);
    }
  };

  const fetchUsers = async () => {
    if (!effectiveOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("org_id", effectiveOrgId);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("Organization not found");

      const contactData = {
        first_name: formData.first_name,
        last_name: formData.last_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        company: formData.company || null,
        job_title: formData.job_title || null,
        status: formData.status,
        source: formData.source || null,
        pipeline_stage_id: formData.pipeline_stage_id || null,
        assigned_to: formData.assigned_to || null,
        notes: formData.notes || null,
        org_id: profile.org_id,
        created_by: user.id,
      };

      if (editingContact) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", editingContact.id);

        if (error) throw error;

        notify.success("Contact updated", "Contact has been updated successfully");
      } else {
        const { error } = await supabase
          .from("contacts")
          .insert([contactData]);

        if (error) throw error;

        notify.success("Contact created", "New contact has been added successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchContacts(true);
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      notify.success("Contact deleted", "Contact has been removed successfully");
      fetchContacts(true);
      setSelectedContacts(prev => prev.filter(cid => cid !== id));
    } catch (error: any) {
      notify.error("Error deleting contact", error);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      company: "",
      job_title: "",
      status: "new",
      source: "",
      pipeline_stage_id: "",
      assigned_to: "",
      notes: "",
    });
    setEditingContact(null);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      job_title: contact.job_title || "",
      status: contact.status,
      source: contact.source || "",
      pipeline_stage_id: contact.pipeline_stage_id || "",
      assigned_to: contact.assigned_to || "",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const downloadTemplate = () => {
    const template = `first_name,last_name,email,phone,company,job_title,status,source
John,Doe,john.doe@example.com,+1234567890,Acme Corp,Sales Manager,new,Website
Jane,Smith,jane.smith@example.com,+0987654321,Tech Inc,CEO,contacted,Referral`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    notify.info("Template Downloaded", "Use this template to format your contacts CSV file.");
  };

  const handleCSVUpload = async (parsedData: any[]) => {
    // LIMIT: Check count already validated by useBulkUpload
    if (parsedData.length > 10000) {
      throw new Error(`Maximum 10,000 contacts allowed per import. Your file contains ${parsedData.length} rows.`);
    }

    // Map CSV data to contact format
    const contactsToInsert = parsedData.map(row => ({
      first_name: row.first_name,
      last_name: row.last_name || null,
      email: row.email || null,
      phone: row.phone || null,
      company: row.company || null,
      job_title: row.job_title || row.title || null,
      status: row.status || 'new',
      source: row.source || 'csv_import',
    }));

    // PERFORMANCE: Use queue manager for batch processing with rate limiting
    const { data, error } = await supabase.functions.invoke('queue-manager', {
      body: {
        operation: 'contact_import',
        data: contactsToInsert,
        priority: 5,
      },
    });

    if (error) {
      if (error.message?.includes('Rate limit')) {
        throw new Error("Please wait a minute before importing more contacts.");
      } else if (error.message?.includes('Item limit exceeded')) {
        throw error;
      } else {
        throw error;
      }
    }

    fetchContacts(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      contacted: "bg-yellow-500",
      qualified: "bg-green-500",
      converted: "bg-purple-500",
      lost: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  if (loading && contacts.length === 0) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading contacts..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Contact Management</h1>
            <p className="text-muted-foreground">Manage your leads and contacts</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={bulkUpload.isOpen} onOpenChange={(open) => open ? bulkUpload.openDialog() : bulkUpload.closeDialog()}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Contacts from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a CSV file with the following columns:<br />
                      <strong>Required:</strong> first_name<br />
                      <strong>Optional:</strong> last_name, email, phone, company, job_title, status, source<br />
                      <strong className="text-destructive">Maximum: 10,000 contacts per file</strong>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mb-4"
                      onClick={downloadTemplate}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV Template
                    </Button>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={bulkUpload.handleFileChange}
                      disabled={bulkUpload.uploading}
                    />
                  </div>
                  {bulkUpload.uploading && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Processing CSV in batches of 100...</p>
                      <p className="text-xs text-muted-foreground">Large imports may take several minutes. Rate limited to 5 imports/min (max 10k contacts per file).</p>
                    </div>
                  )}
                  <Button
                    onClick={() => bulkUpload.handleUpload(handleCSVUpload, 'email')}
                    disabled={!bulkUpload.file || bulkUpload.uploading}
                    className="w-full"
                  >
                    {bulkUpload.uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload CSV'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="e.g., Website, Referral"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
                    <Select value={formData.pipeline_stage_id} onValueChange={(value) => setFormData({ ...formData, pipeline_stage_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelineStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Assign To</Label>
                    <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {editingContact ? "Update Contact" : "Create Contact"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contacts ({contacts.length})</CardTitle>
            <CardDescription>All your leads and contacts</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedContacts.length === contacts.length && contacts.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Pipeline Stage</TableHead>
                    <TableHead>Enrichment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {contact.first_name} {contact.last_name}
                        {contact.job_title && (
                          <div className="text-sm text-muted-foreground">{contact.job_title}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.company && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {contact.company}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <PhoneIcon className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.pipeline_stages && (
                          <Badge 
                            style={{ 
                              backgroundColor: contact.pipeline_stages.color || '#8AD4EB',
                              color: '#fff'
                            }}
                          >
                            {contact.pipeline_stages.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.enrichment_status === 'enriched' && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            ✓ Enriched
                          </Badge>
                        )}
                        {contact.enrichment_status === 'failed' && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                            ✗ Failed
                          </Badge>
                        )}
                        {contact.enrichment_status === 'pending' && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            ⏳ Pending
                          </Badge>
                        )}
                        {!contact.enrichment_status && (
                          <span className="text-xs text-muted-foreground">Not enriched</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/contacts/${contact.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Load More Button */}
            {!loading && hasMore && (
              <div className="flex justify-center mt-4">
                <Button 
                  onClick={loadMoreContacts} 
                  disabled={loadingMore}
                  variant="outline"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load More (${contacts.length} loaded)`
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

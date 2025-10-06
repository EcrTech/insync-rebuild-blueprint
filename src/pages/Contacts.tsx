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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Mail, Phone as PhoneIcon, Building } from "lucide-react";

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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
    fetchContacts();
    fetchPipelineStages();
    fetchUsers();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading contacts",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineStages = async () => {
    try {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("is_active", true)
        .order("stage_order");

      if (error) throw error;
      setPipelineStages(data || []);
    } catch (error: any) {
      console.error("Error fetching pipeline stages:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

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

        toast({
          title: "Contact updated",
          description: "Contact has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("contacts")
          .insert([contactData]);

        if (error) throw error;

        toast({
          title: "Contact created",
          description: "New contact has been added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchContacts();
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
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Contact deleted",
        description: "Contact has been removed successfully",
      });
      fetchContacts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting contact",
        description: error.message,
      });
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
      pipeline_stage_id: "",
      assigned_to: contact.assigned_to || "",
      notes: "",
    });
    setIsDialogOpen(true);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Contact Management</h1>
            <p className="text-muted-foreground">Manage your leads and contacts</p>
          </div>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
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
                        <Badge className={getStatusColor(contact.status)}>
                          {contact.status}
                        </Badge>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

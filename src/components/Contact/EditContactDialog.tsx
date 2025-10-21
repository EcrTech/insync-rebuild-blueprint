import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotification } from "@/hooks/useNotification";
import { ContactEmails } from "./ContactEmails";
import { ContactPhones } from "./ContactPhones";
import { Separator } from "@/components/ui/separator";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface Contact {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  status: string;
  source: string | null;
  linkedin_url: string | null;
  notes: string | null;
  pipeline_stage_id: string | null;
}

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onContactUpdated?: () => void;
}

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onContactUpdated,
}: EditContactDialogProps) {
  const notify = useNotification();
  const [loading, setLoading] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    company: "",
    job_title: "",
    source: "",
    linkedin_url: "",
    notes: "",
    pipeline_stage_id: "",
  });

  useEffect(() => {
    const fetchPipelineStages = async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color")
        .eq("is_active", true)
        .order("stage_order");

      if (!error && data) {
        setPipelineStages(data);
      }
    };

    if (open) {
      fetchPipelineStages();
    }
  }, [open]);

  useEffect(() => {
    if (open && contact) {
      setFormData({
        first_name: contact.first_name,
        last_name: contact.last_name || "",
        company: contact.company || "",
        job_title: contact.job_title || "",
        source: contact.source || "",
        linkedin_url: contact.linkedin_url || "",
        notes: contact.notes || "",
        pipeline_stage_id: contact.pipeline_stage_id || "",
      });
    }
  }, [open, contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name || null,
          company: formData.company || null,
          job_title: formData.job_title || null,
          source: formData.source || null,
          linkedin_url: formData.linkedin_url || null,
          notes: formData.notes || null,
          pipeline_stage_id: formData.pipeline_stage_id || null,
        })
        .eq("id", contact.id);

      if (error) throw error;

      notify.success("Contact updated", "Contact has been updated successfully");

      onOpenChange(false);
      if (onContactUpdated) onContactUpdated();
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
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

          <div className="space-y-2">
            <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
            <Select 
              value={formData.pipeline_stage_id} 
              onValueChange={(value) => setFormData({ ...formData, pipeline_stage_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {pipelineStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
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

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
            <Input
              id="linkedin_url"
              type="url"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label>Email Addresses</Label>
            <ContactEmails contactId={contact.id} orgId={contact.org_id} />
          </div>

          <div className="space-y-2">
            <Label>Phone Numbers</Label>
            <ContactPhones contactId={contact.id} orgId={contact.org_id} />
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Updating..." : "Update Contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

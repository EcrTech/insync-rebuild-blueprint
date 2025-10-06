import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CallDisposition {
  id: string;
  name: string;
}

interface CallSubDisposition {
  id: string;
  disposition_id: string;
  name: string;
}

interface LogActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  defaultActivityType?: string;
  onActivityLogged?: () => void;
}

export function LogActivityDialog({
  open,
  onOpenChange,
  contactId,
  defaultActivityType = "note",
  onActivityLogged,
}: LogActivityDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [subDispositions, setSubDispositions] = useState<CallSubDisposition[]>([]);
  const [filteredSubDispositions, setFilteredSubDispositions] = useState<CallSubDisposition[]>([]);

  const [formData, setFormData] = useState({
    activity_type: defaultActivityType,
    subject: "",
    description: "",
    call_disposition_id: "",
    call_sub_disposition_id: "",
    call_duration: "",
  });

  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, activity_type: defaultActivityType }));
      fetchDispositions();
    }
  }, [open, defaultActivityType]);

  useEffect(() => {
    if (formData.call_disposition_id) {
      const filtered = subDispositions.filter(
        sub => sub.disposition_id === formData.call_disposition_id
      );
      setFilteredSubDispositions(filtered);
    } else {
      setFilteredSubDispositions([]);
    }
  }, [formData.call_disposition_id, subDispositions]);

  const fetchDispositions = async () => {
    try {
      const [dispositionsRes, subDispositionsRes] = await Promise.all([
        supabase.from("call_dispositions").select("id, name").eq("is_active", true),
        supabase.from("call_sub_dispositions").select("*").eq("is_active", true),
      ]);

      if (dispositionsRes.error) throw dispositionsRes.error;
      if (subDispositionsRes.error) throw subDispositionsRes.error;

      setDispositions(dispositionsRes.data || []);
      setSubDispositions(subDispositionsRes.data || []);
    } catch (error: any) {
      console.error("Error fetching dispositions:", error);
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

      const activityData = {
        contact_id: contactId,
        org_id: profile.org_id,
        activity_type: formData.activity_type,
        subject: formData.subject || null,
        description: formData.description || null,
        call_disposition_id: formData.call_disposition_id || null,
        call_sub_disposition_id: formData.call_sub_disposition_id || null,
        call_duration: formData.call_duration ? parseInt(formData.call_duration) * 60 : null,
        created_by: user.id,
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("contact_activities")
        .insert([activityData]);

      if (error) throw error;

      toast({
        title: "Activity logged",
        description: "Activity has been logged successfully",
      });

      resetForm();
      onOpenChange(false);
      if (onActivityLogged) onActivityLogged();
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

  const resetForm = () => {
    setFormData({
      activity_type: "note",
      subject: "",
      description: "",
      call_disposition_id: "",
      call_sub_disposition_id: "",
      call_duration: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity_type">Activity Type *</Label>
            <Select
              value={formData.activity_type}
              onValueChange={(value) => setFormData({ ...formData, activity_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Follow-up call"
            />
          </div>

          {formData.activity_type === "call" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="call_duration">Duration (minutes)</Label>
                <Input
                  id="call_duration"
                  type="number"
                  min="0"
                  value={formData.call_duration}
                  onChange={(e) => setFormData({ ...formData, call_duration: e.target.value })}
                  placeholder="5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disposition">Call Disposition</Label>
                <Select
                  value={formData.call_disposition_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, call_disposition_id: value, call_sub_disposition_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions.map((disp) => (
                      <SelectItem key={disp.id} value={disp.id}>
                        {disp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredSubDispositions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="sub_disposition">Sub-Disposition</Label>
                  <Select
                    value={formData.call_sub_disposition_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, call_sub_disposition_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-disposition" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubDispositions.map((subDisp) => (
                        <SelectItem key={subDisp.id} value={subDisp.id}>
                          {subDisp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Add details about this activity..."
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Log Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

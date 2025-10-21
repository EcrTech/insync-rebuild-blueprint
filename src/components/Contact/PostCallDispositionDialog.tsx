import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotification } from "@/hooks/useNotification";

interface CallDisposition {
  id: string;
  name: string;
}

interface CallSubDisposition {
  id: string;
  disposition_id: string;
  name: string;
}

interface PostCallDispositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLogId: string;
  contactId: string | null;
  callDuration: number;
  onDispositionSaved?: () => void;
}

export function PostCallDispositionDialog({
  open,
  onOpenChange,
  callLogId,
  contactId,
  callDuration,
  onDispositionSaved,
}: PostCallDispositionDialogProps) {
  const notify = useNotification();
  const [loading, setLoading] = useState(false);
  const [dispositions, setDispositions] = useState<CallDisposition[]>([]);
  const [subDispositions, setSubDispositions] = useState<CallSubDisposition[]>([]);
  const [filteredSubDispositions, setFilteredSubDispositions] = useState<CallSubDisposition[]>([]);

  const [formData, setFormData] = useState({
    disposition_id: "",
    sub_disposition_id: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchDispositions();
    }
  }, [open]);

  useEffect(() => {
    if (formData.disposition_id) {
      const filtered = subDispositions.filter(
        sub => sub.disposition_id === formData.disposition_id
      );
      setFilteredSubDispositions(filtered);
    } else {
      setFilteredSubDispositions([]);
    }
  }, [formData.disposition_id, subDispositions]);

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
    
    if (!formData.disposition_id) {
      notify.error("Disposition required", new Error("Please select a call disposition"));
      return;
    }

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

      // Update call log with disposition
      const { error: callLogError } = await supabase
        .from("call_logs")
        .update({
          disposition_id: formData.disposition_id,
          sub_disposition_id: formData.sub_disposition_id || null,
          notes: formData.notes || null,
        })
        .eq("id", callLogId);

      if (callLogError) throw callLogError;

      // Create contact activity if contact exists
      if (contactId) {
        const activityData = {
          contact_id: contactId,
          org_id: profile.org_id,
          activity_type: "call",
          subject: "Call completed",
          description: formData.notes || `Call duration: ${Math.floor(callDuration / 60)}m ${callDuration % 60}s`,
          call_disposition_id: formData.disposition_id,
          call_sub_disposition_id: formData.sub_disposition_id || null,
          call_duration: callDuration,
          created_by: user.id,
          completed_at: new Date().toISOString(),
        };

        const { data: activity, error: activityError } = await supabase
          .from("contact_activities")
          .insert([activityData])
          .select()
          .single();

        if (activityError) throw activityError;

        // Link activity to call log
        if (activity) {
          await supabase
            .from("call_logs")
            .update({ activity_id: activity.id })
            .eq("id", callLogId);
        }
      }

      notify.success("Disposition saved", "Call disposition has been recorded successfully");

      resetForm();
      onOpenChange(false);
      if (onDispositionSaved) onDispositionSaved();
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      disposition_id: "",
      sub_disposition_id: "",
      notes: "",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Call Disposition</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Call duration: {formatDuration(callDuration)}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disposition">Call Disposition *</Label>
            <Select
              value={formData.disposition_id}
              onValueChange={(value) =>
                setFormData({ ...formData, disposition_id: value, sub_disposition_id: "" })
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
                value={formData.sub_disposition_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, sub_disposition_id: value })
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Add any notes about this call..."
            />
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="flex-1"
            >
              Skip
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Disposition"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  onEmailSent?: () => void;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  onEmailSent,
}: SendEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      fetchPrimaryEmail();
    }
  }, [open, contactId]);

  const fetchPrimaryEmail = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_emails")
        .select("email")
        .eq("contact_id", contactId)
        .eq("is_primary", true)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.email) {
        setRecipientEmail(data.email);
      } else {
        // Fallback to legacy email field
        const { data: contact } = await supabase
          .from("contacts")
          .select("email")
          .eq("id", contactId)
          .single();
        
        if (contact?.email) {
          setRecipientEmail(contact.email);
        }
      }
    } catch (error: any) {
      console.error("Error fetching email:", error);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all fields before sending.",
      });
      return;
    }

    setLoading(true);

    try {
      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: subject,
          htmlContent: body.replace(/\n/g, '<br>'),
          contactId: contactId,
        },
      });

      if (error) throw error;

      // Create activity log
      await supabase.from("contact_activities").insert({
        contact_id: contactId,
        activity_type: "email",
        subject: subject,
        description: body,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        org_id: (await supabase.from("contacts").select("org_id").eq("id", contactId).single()).data?.org_id,
      });

      toast({
        title: "Email sent",
        description: `Email sent successfully to ${contactName}`,
      });

      // Reset form
      setSubject("");
      setBody("");
      
      onEmailSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: error.message || "Please check your email settings and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email to {contactName}</DialogTitle>
          <DialogDescription>
            Compose and send an email message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "@/hooks/useOrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Users, Send } from "lucide-react";

export default function BulkWhatsAppSender() {
  const navigate = useNavigate();
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [csvInput, setCsvInput] = useState("");

  useEffect(() => {
    if (effectiveOrgId) {
      fetchTemplates();
      fetchContacts();
    }
  }, [effectiveOrgId]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("communication_templates")
      .select("*")
      .eq("org_id", effectiveOrgId)
      .eq("template_type", "whatsapp")
      .eq("status", "approved");
    
    setTemplates(data || []);
  };

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, email")
      .eq("org_id", effectiveOrgId)
      .not("phone", "is", null);
    
    setContacts(data || []);
  };

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    const template = templates.find(t => t.id === value);
    if (template) {
      setMessageContent(template.content);
    }
  };

  const handleContactToggle = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleCsvUpload = () => {
    const phoneNumbers = csvInput
      .split(/[\n,]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    toast({
      title: "CSV Parsed",
      description: `Found ${phoneNumbers.length} phone numbers`,
    });
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !messageContent || selectedContacts.size === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("whatsapp_bulk_campaigns")
        .insert({
          org_id: effectiveOrgId,
          name: campaignName,
          template_id: templateId || null,
          message_content: messageContent,
          created_by: user?.id,
          total_recipients: selectedContacts.size,
          pending_count: selectedContacts.size,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients
      const selectedContactsList = contacts.filter(c => selectedContacts.has(c.id));
      const recipients = selectedContactsList.map(contact => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        phone_number: contact.phone,
      }));

      const { error: recipientsError } = await supabase
        .from("whatsapp_campaign_recipients")
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      // Start sending
      const { error: sendError } = await supabase.functions.invoke('bulk-whatsapp-sender', {
        body: { campaignId: campaign.id },
      });

      if (sendError) throw sendError;

      toast({
        title: "Campaign Started",
        description: `Sending to ${selectedContacts.size} recipients`,
      });

      navigate(`/whatsapp/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Bulk WhatsApp Sender</h1>
        <p className="text-muted-foreground">Send WhatsApp messages to multiple contacts</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8 gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {s}
            </div>
            {s < 3 && <div className="w-16 h-1 bg-muted mx-2" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Setup</CardTitle>
            <CardDescription>Configure your WhatsApp campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Holiday Promotion 2025"
              />
            </div>

            <div>
              <Label>Template (Optional)</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Message</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Message Content *</Label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
              />
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Next: Select Recipients
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Recipients</CardTitle>
            <CardDescription>Choose who will receive your message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">
                  {selectedContacts.size} of {contacts.length} selected
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedContacts.size === contacts.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedContacts.size === contacts.length && contacts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => handleContactToggle(contact.id)}
                        />
                      </TableCell>
                      <TableCell>{contact.first_name} {contact.last_name}</TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>{contact.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-4">
              <Label>Or Add Phone Numbers (CSV)</Label>
              <Textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="+1234567890, +0987654321&#10;or one per line"
                rows={3}
              />
              <Button variant="outline" onClick={handleCsvUpload} className="mt-2">
                <Upload className="mr-2 h-4 w-4" />
                Parse CSV
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                className="flex-1"
                disabled={selectedContacts.size === 0}
              >
                Next: Review & Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Send</CardTitle>
            <CardDescription>Review your campaign before sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign Name:</span>
                <span className="font-medium">{campaignName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients:</span>
                <span className="font-medium">{selectedContacts.size}</span>
              </div>
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground mb-2">Message Preview:</p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleCreateCampaign} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Campaign
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

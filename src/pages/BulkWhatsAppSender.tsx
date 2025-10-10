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
import { VariableMappingStep } from "@/components/Campaigns/VariableMappingStep";
import { TemplateVariable, VariableMapping, detectTemplateVariables } from "@/utils/templateVariables";
import { ParsedCSVData } from "@/utils/csvParser";

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
  const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
  const [csvData, setCsvData] = useState<ParsedCSVData | null>(null);

  const MAX_RECIPIENTS = 50000;
  const MAX_MESSAGE_LENGTH = 1024;
  const MAX_CAMPAIGN_NAME_LENGTH = 100;

  // Phone validation regex
  const isValidPhone = (phone: string) => {
    return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ''));
  };

  // Sanitize campaign name
  const sanitizeCampaignName = (name: string) => {
    return name.replace(/[<>\"']/g, '').trim();
  };

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
      
      // Detect variables in template
      const vars = detectTemplateVariables(
        template.content,
        template.header_content,
        template.footer_text
      );
      setTemplateVariables(vars);
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

  const handleVariableMappingComplete = (
    mappings: Record<string, VariableMapping>,
    csv: ParsedCSVData | null
  ) => {
    setVariableMappings(mappings);
    setCsvData(csv);
    setStep(3);
  };

  const handleCreateCampaign = async () => {
    // Validate campaign name
    if (!campaignName || campaignName.length > MAX_CAMPAIGN_NAME_LENGTH) {
      toast({
        title: "Error",
        description: `Campaign name is required and must be less than ${MAX_CAMPAIGN_NAME_LENGTH} characters`,
        variant: "destructive",
      });
      return;
    }

    // Validate message content
    if (!messageContent || messageContent.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Error",
        description: `Message content is required and must be less than ${MAX_MESSAGE_LENGTH} characters`,
        variant: "destructive",
      });
      return;
    }

    // Validate recipient selection
    const finalRecipients = csvData?.rows.length 
      ? csvData.rows 
      : contacts.filter(c => selectedContacts.has(c.id));
    
    if (finalRecipients.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    // Check max recipients
    if (finalRecipients.length > MAX_RECIPIENTS) {
      toast({
        title: "Error",
        description: `Maximum ${MAX_RECIPIENTS.toLocaleString()} recipients allowed per campaign`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sanitize campaign name
      const sanitizedName = sanitizeCampaignName(campaignName);

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("whatsapp_bulk_campaigns")
        .insert([{
          org_id: effectiveOrgId,
          name: sanitizedName,
          template_id: templateId || null,
          message_content: messageContent,
          created_by: user?.id,
          total_recipients: finalRecipients.length,
          pending_count: finalRecipients.length,
          variable_mappings: variableMappings as any,
        }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients with custom data from CSV if available
      let recipients;
      if (csvData) {
        // Match CSV data with contacts or use CSV-only data
        const identifierCol = csvData.identifierColumn;
        recipients = csvData.rows.map(row => {
          const identifier = row[identifierCol];
          const contact = contacts.find(c => c.phone === identifier);
          
          // Extract custom data (all columns except identifier)
          const customData: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            if (key !== identifierCol) {
              customData[key] = row[key];
            }
          });
          
          return {
            campaign_id: campaign.id,
            contact_id: contact?.id || null,
            phone_number: identifier,
            custom_data: customData,
          };
        });
      } else {
        // Use selected contacts from CRM
        const selectedContactsList = contacts.filter(c => selectedContacts.has(c.id));
        const uniqueContacts = selectedContactsList.filter((contact, index, self) => 
          self.findIndex(c => c.phone === contact.phone) === index
        );
        
        recipients = uniqueContacts.map(contact => ({
          campaign_id: campaign.id,
          contact_id: contact.id,
          phone_number: contact.phone,
          custom_data: {},
        }));
      }

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
        description: `Sending to ${finalRecipients.length} recipients`,
      });

      navigate(`/whatsapp/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.message?.includes('maximum')) {
        errorMessage = `Maximum ${MAX_RECIPIENTS.toLocaleString()} recipients allowed`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {s}
            </div>
            {s < 4 && <div className="w-16 h-1 bg-muted mx-2" />}
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
              <Label>Campaign Name * (max {MAX_CAMPAIGN_NAME_LENGTH} chars)</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Holiday Promotion 2025"
                maxLength={MAX_CAMPAIGN_NAME_LENGTH}
              />
              {campaignName.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {campaignName.length}/{MAX_CAMPAIGN_NAME_LENGTH}
                </p>
              )}
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
              <Label>Message Content * (max {MAX_MESSAGE_LENGTH} chars)</Label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              {messageContent.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {messageContent.length}/{MAX_MESSAGE_LENGTH}
                </p>
              )}
            </div>

            <Button 
              onClick={() => {
                if (!campaignName.trim() || !messageContent.trim()) {
                  toast({
                    title: "Error",
                    description: "Please fill in campaign name and message content",
                    variant: "destructive",
                  });
                  return;
                }
                setStep(2);
              }} 
              className="w-full"
            >
              Next: Variable Mapping
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <VariableMappingStep
          templateVariables={templateVariables}
          identifierType="phone"
          orgId={effectiveOrgId}
          onComplete={handleVariableMappingComplete}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
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
                  {selectedContacts.size > MAX_RECIPIENTS && (
                    <span className="text-destructive ml-2">
                      (exceeds limit of {MAX_RECIPIENTS.toLocaleString()})
                    </span>
                  )}
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
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => setStep(4)} 
                className="flex-1"
                disabled={!csvData && selectedContacts.size === 0}
              >
                Next: Review & Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
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
                <span className="font-medium">
                  {csvData?.rows.length || selectedContacts.size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Source:</span>
                <span className="font-medium">{csvData ? 'CSV Upload' : 'CRM Contacts'}</span>
              </div>
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground mb-2">Message Preview:</p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
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

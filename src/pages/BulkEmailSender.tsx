import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, ArrowRight, ArrowLeft } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";
import { VariableMappingStep } from "@/components/Campaigns/VariableMappingStep";
import { TemplateVariable, VariableMapping, detectTemplateVariables } from "@/utils/templateVariables";
import { ParsedCSVData } from "@/utils/csvParser";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  phone: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  html_content: string;
}

const BulkEmailSender = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { effectiveOrgId } = useOrgContext();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Campaign Setup
  const [campaignName, setCampaignName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  // Step 2: Recipients
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Variable mapping and CSV
  const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<string, VariableMapping>>({});
  const [csvData, setCsvData] = useState<ParsedCSVData | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchContacts();
  }, [effectiveOrgId]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, company, phone")
        .eq("org_id", effectiveOrgId)
        .not("email", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts",
        variant: "destructive",
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setHtmlContent(template.html_content);
      
      // Detect variables in template
      const vars = detectTemplateVariables(
        template.html_content,
        template.subject
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
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleVariableMappingComplete = (
    mappings: Record<string, VariableMapping>,
    csv: ParsedCSVData | null
  ) => {
    setVariableMappings(mappings);
    setCsvData(csv);
    setStep(3);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!campaignName.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a campaign name",
          variant: "destructive",
        });
        return;
      }
      if (!selectedTemplateId) {
        toast({
          title: "Validation Error",
          description: "Please select a template",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 3) {
      const finalRecipients = csvData?.rows.length 
        ? csvData.rows 
        : contacts.filter(c => selectedContacts.has(c.id));
      
      if (finalRecipients.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one recipient",
          variant: "destructive",
        });
        return;
      }
      setStep(4);
    }
  };

  const handleSendCampaign = async () => {
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      const finalRecipients = csvData?.rows.length 
        ? csvData.rows 
        : contacts.filter(c => selectedContacts.has(c.id));

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("email_bulk_campaigns")
        .insert([{
          name: campaignName,
          template_id: selectedTemplateId,
          subject: subject,
          html_content: htmlContent,
          total_recipients: finalRecipients.length,
          pending_count: finalRecipients.length,
          status: "sending",
          org_id: effectiveOrgId,
          created_by: session.session?.user.id,
          started_at: new Date().toISOString(),
          variable_mappings: variableMappings as any,
        }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients with custom data from CSV if available
      let recipients;
      if (csvData) {
        const identifierCol = csvData.identifierColumn;
        recipients = csvData.rows.map(row => {
          const identifier = row[identifierCol];
          const contact = contacts.find(c => c.email === identifier);
          
          // Extract custom data
          const customData: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            if (key !== identifierCol) {
              customData[key] = row[key];
            }
          });
          
          return {
            campaign_id: campaign.id,
            contact_id: contact?.id || null,
            email: identifier,
            status: "pending",
            custom_data: customData as any,
          };
        });
      } else {
        recipients = Array.from(selectedContacts).map((contactId) => {
          const contact = contacts.find((c) => c.id === contactId);
          return {
            campaign_id: campaign.id,
            contact_id: contactId,
            email: contact?.email || "",
            status: "pending",
            custom_data: {} as any,
          };
        });
      }

      const { error: recipientsError } = await supabase
        .from("email_campaign_recipients")
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      // Trigger edge function to send emails
      const { error: functionError } = await supabase.functions.invoke(
        "send-bulk-email",
        {
          body: { campaignId: campaign.id },
        }
      );

      if (functionError) throw functionError;

      toast({
        title: "Success",
        description: "Campaign started! Emails are being sent.",
      });

      navigate(`/email-campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error("Error sending campaign:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const replaceVariables = (html: string, contact: Contact) => {
    return html
      .replace(/\{\{first_name\}\}/g, contact.first_name || "")
      .replace(/\{\{last_name\}\}/g, contact.last_name || "")
      .replace(/\{\{email\}\}/g, contact.email || "")
      .replace(/\{\{company\}\}/g, contact.company || "")
      .replace(/\{\{phone\}\}/g, contact.phone || "");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bulk Email Sender</h1>
            <p className="text-muted-foreground">
              Send personalized emails to multiple recipients
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`w-20 h-1 ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Campaign Setup */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Campaign Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., November Newsletter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Select Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateId && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border rounded-lg p-4 max-h-60 overflow-auto">
                      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={handleNext}>
                  Next: Variable Mapping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Variable Mapping */}
        {step === 2 && (
          <VariableMappingStep
            templateVariables={templateVariables}
            identifierType="email"
            orgId={effectiveOrgId}
            onComplete={handleVariableMappingComplete}
            onBack={() => setStep(1)}
          />
        )}

        {/* Step 3: Select Recipients */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Select Recipients</CardTitle>
              <p className="text-sm text-muted-foreground">
                {csvData ? `${csvData.rows.length} rows from CSV` : `${selectedContacts.size} of ${contacts.length} contacts selected`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedContacts.size === contacts.length}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  Select All
                </Label>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
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
                        <TableCell>
                          {contact.first_name} {contact.last_name}
                        </TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{contact.company}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Next: Review & Send
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review & Send */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Review & Send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Campaign Name</h3>
                  <p className="text-muted-foreground">{campaignName}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Subject</h3>
                  <p className="text-muted-foreground">{subject}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Recipients</h3>
                  <p className="text-muted-foreground">
                    {csvData?.rows.length || selectedContacts.size} contacts
                    {csvData && ' (from CSV)'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Email Preview (with sample data)</h3>
                  <div className="border rounded-lg p-4 max-h-60 overflow-auto">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: replaceVariables(htmlContent, contacts[0] || {} as Contact),
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleSendCampaign} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BulkEmailSender;

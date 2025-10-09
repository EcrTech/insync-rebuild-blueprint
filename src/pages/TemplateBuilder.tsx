import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";

interface Button {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { effectiveOrgId } = useOrgContext();
  
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState("marketing");
  const [language, setLanguage] = useState("en");
  const [headerType, setHeaderType] = useState<string>("none");
  const [headerContent, setHeaderContent] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<Button[]>([]);
  const [sampleHeader, setSampleHeader] = useState<string[]>([]);
  const [sampleBody, setSampleBody] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");

  const insertVariable = (location: 'header' | 'body') => {
    if (location === 'header') {
      const currentVars = (headerContent.match(/{{(\d+)}}/g) || []).length;
      const newVar = `{{${currentVars + 1}}}`;
      setHeaderContent(headerContent + newVar);
      setSampleHeader([...sampleHeader, ""]);
    } else {
      const currentVars = (bodyContent.match(/{{(\d+)}}/g) || []).length;
      const newVar = `{{${currentVars + 1}}}`;
      setBodyContent(bodyContent + newVar);
      setSampleBody([...sampleBody, ""]);
    }
  };

  const addButton = (type: string) => {
    if (buttons.length >= 3) {
      toast({
        title: "Button Limit Reached",
        description: "You can add a maximum of 3 buttons",
        variant: "destructive",
      });
      return;
    }

    setButtons([
      ...buttons,
      {
        type,
        text: "",
        ...(type === "URL" && { url: "" }),
        ...(type === "PHONE_NUMBER" && { phone_number: "" }),
      },
    ]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!templateName || !bodyContent) {
      toast({
        title: "Validation Error",
        description: "Template name and body content are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-gupshup-template', {
        body: {
          template_name: templateName,
          category,
          language,
          header_type: headerType === 'none' ? null : headerType,
          header_content: headerType === 'text' ? headerContent : (headerType !== 'none' ? mediaUrl : null),
          body_content: bodyContent,
          footer_text: footerText || null,
          buttons: buttons.length > 0 ? buttons : null,
          sample_values: {
            ...(sampleHeader.length > 0 && { header: sampleHeader }),
            ...(sampleBody.length > 0 && { body: sampleBody }),
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Template Submitted",
        description: data.message || "Template submitted successfully for WhatsApp approval",
      });

      navigate('/templates');
    } catch (error: any) {
      console.error('Error submitting template:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    return (
      <div className="bg-muted p-4 rounded-lg max-w-sm">
        <div className="bg-background rounded-lg p-4 shadow-md">
          {headerType !== 'none' && (
            <div className="mb-3">
              {headerType === 'text' ? (
                <p className="font-semibold text-lg">{headerContent || "Header text here"}</p>
              ) : (
                <div className="bg-muted h-32 rounded flex items-center justify-center text-muted-foreground">
                  {headerType.toUpperCase()} Preview
                </div>
              )}
            </div>
          )}
          
          <div className="mb-3 whitespace-pre-wrap">
            {bodyContent || "Your message body will appear here. Use variables like {{1}} for dynamic content."}
          </div>
          
          {footerText && (
            <div className="text-sm text-muted-foreground mb-3">
              {footerText}
            </div>
          )}
          
          {buttons.length > 0 && (
            <div className="space-y-2">
              {buttons.map((btn, idx) => (
                <div key={idx} className="border border-primary rounded py-2 px-3 text-center text-primary hover:bg-primary/10 cursor-pointer transition-colors">
                  {btn.text || `Button ${idx + 1}`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create WhatsApp Template</h1>
            <p className="text-muted-foreground">Design and submit templates for WhatsApp approval</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Template name, category, and language settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="welcome_message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use lowercase letters, numbers, and underscores only</p>
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                      <SelectItem value="authentication">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language">Language *</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle>Header (Optional)</CardTitle>
                <CardDescription>Add a header with text or media</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="headerType">Header Type</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger id="headerType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {headerType === 'text' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="headerContent">Header Text</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('header')}>
                        Insert Variable
                      </Button>
                    </div>
                    <Input
                      id="headerContent"
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                      placeholder="Welcome to our service!"
                    />
                    
                    {sampleHeader.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <Label>Sample Values</Label>
                        {sampleHeader.map((_, idx) => (
                          <Input
                            key={idx}
                            placeholder={`Sample value for {{${idx + 1}}}`}
                            value={sampleHeader[idx]}
                            onChange={(e) => {
                              const newSamples = [...sampleHeader];
                              newSamples[idx] = e.target.value;
                              setSampleHeader(newSamples);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {headerType !== 'none' && headerType !== 'text' && (
                  <div>
                    <Label htmlFor="mediaUrl">Media URL</Label>
                    <Input
                      id="mediaUrl"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Provide a publicly accessible URL</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader>
                <CardTitle>Body Content *</CardTitle>
                <CardDescription>The main message content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="bodyContent">Message Text</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('body')}>
                      Insert Variable
                    </Button>
                  </div>
                  <Textarea
                    id="bodyContent"
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    placeholder="Hello {{1}}, your order {{2}} is confirmed!"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use variables like {"{{1}}"}, {"{{2}}"} for dynamic content</p>
                </div>

                {sampleBody.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sample Values</Label>
                    {sampleBody.map((_, idx) => (
                      <Input
                        key={idx}
                        placeholder={`Sample value for {{${idx + 1}}}`}
                        value={sampleBody[idx]}
                        onChange={(e) => {
                          const newSamples = [...sampleBody];
                          newSamples[idx] = e.target.value;
                          setSampleBody(newSamples);
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            <Card>
              <CardHeader>
                <CardTitle>Footer (Optional)</CardTitle>
                <CardDescription>Add a footer text</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Thank you for your business"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Maximum 60 characters</p>
                </div>
              </CardContent>
            </Card>

            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons (Optional)</CardTitle>
                <CardDescription>Add call-to-action or quick reply buttons (max 3)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => addButton("URL")} disabled={buttons.length >= 3}>
                    <Plus className="h-4 w-4 mr-2" />
                    URL Button
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addButton("PHONE_NUMBER")} disabled={buttons.length >= 3}>
                    <Plus className="h-4 w-4 mr-2" />
                    Phone Button
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addButton("QUICK_REPLY")} disabled={buttons.length >= 3}>
                    <Plus className="h-4 w-4 mr-2" />
                    Quick Reply
                  </Button>
                </div>

                {buttons.map((btn, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Button {idx + 1} - {btn.type.replace('_', ' ')}</Label>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) => updateButton(idx, 'text', e.target.value)}
                        maxLength={25}
                      />
                      {btn.type === "URL" && (
                        <Input
                          placeholder="https://example.com"
                          value={btn.url || ""}
                          onChange={(e) => updateButton(idx, 'url', e.target.value)}
                        />
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <Input
                          placeholder="+1234567890"
                          value={btn.phone_number || ""}
                          onChange={(e) => updateButton(idx, 'phone_number', e.target.value)}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? "Submitting..." : "Submit Template for Approval"}
              </Button>
              <Button variant="outline" onClick={() => navigate('/templates')}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>How your template will appear on WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                {renderPreview()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

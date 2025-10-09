import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Eye } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";
import EmailEditor, { EditorRef, EmailEditorProps } from "react-email-editor";

const EmailTemplateBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { effectiveOrgId } = useOrgContext();
  const emailEditorRef = useRef<EditorRef>(null);

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [designJson, setDesignJson] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setTemplateName(data.name);
      setSubject(data.subject);
      setDesignJson(data.design_json);

      // Load design into editor after a brief delay
      setTimeout(() => {
        if (emailEditorRef.current && data.design_json) {
          emailEditorRef.current.editor?.loadDesign(data.design_json as any);
        }
      }, 500);
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast({
        title: "Error",
        description: "Failed to load template",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim() || !subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide template name and subject",
        variant: "destructive",
      });
      return;
    }

    if (!emailEditorRef.current) {
      toast({
        title: "Error",
        description: "Email editor not initialized",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      emailEditorRef.current.editor?.exportHtml(async (data) => {
        const { design, html } = data;

        const templateData = {
          name: templateName.trim(),
          subject: subject.trim(),
          design_json: design,
          html_content: html,
          org_id: effectiveOrgId,
        };

        if (id) {
          // Update existing template
          const { error } = await supabase
            .from("email_templates")
            .update(templateData)
            .eq("id", id);

          if (error) throw error;

          toast({
            title: "Success",
            description: "Template updated successfully",
          });
        } else {
          // Create new template
          const { data: session } = await supabase.auth.getSession();
          const { error } = await supabase
            .from("email_templates")
            .insert({
              ...templateData,
              created_by: session.session?.user.id,
            });

          if (error) throw error;

          toast({
            title: "Success",
            description: "Template created successfully",
          });
          navigate("/templates");
        }
      });
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!emailEditorRef.current) return;

    emailEditorRef.current.editor?.exportHtml((data) => {
      const { html } = data;
      const previewWindow = window.open("", "_blank");
      if (previewWindow) {
        previewWindow.document.write(html);
        previewWindow.document.close();
      }
    });
  };

  const onReady: EmailEditorProps["onReady"] = () => {
    console.log("Email editor is ready");
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {id ? "Edit Email Template" : "Create Email Template"}
            </h1>
            <p className="text-muted-foreground">
              Design beautiful email templates with drag-and-drop
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePreview} variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {id ? "Update" : "Save"} Template
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Welcome Email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Welcome to our platform!"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <EmailEditor
              ref={emailEditorRef}
              onReady={onReady}
              minHeight="600px"
              options={{
                mergeTags: {
                  first_name: {
                    name: "First Name",
                    value: "{{first_name}}",
                  },
                  last_name: {
                    name: "Last Name",
                    value: "{{last_name}}",
                  },
                  email: {
                    name: "Email",
                    value: "{{email}}",
                  },
                  company: {
                    name: "Company",
                    value: "{{company}}",
                  },
                  phone: {
                    name: "Phone",
                    value: "{{phone}}",
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmailTemplateBuilder;

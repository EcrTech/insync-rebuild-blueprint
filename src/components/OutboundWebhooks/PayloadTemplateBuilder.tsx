import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface PayloadTemplateBuilderProps {
  template: any;
  onChange: (template: any) => void;
  triggerEvent: string;
}

export const PayloadTemplateBuilder = ({
  template,
  onChange,
  triggerEvent,
}: PayloadTemplateBuilderProps) => {
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(template || getDefaultTemplate(triggerEvent), null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setJsonValue(value);
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const getAvailableVariables = () => {
    const common = [
      "{{timestamp}}",
      "{{org_id}}",
    ];

    const eventVariables: Record<string, string[]> = {
      contact_created: [
        "{{contact.id}}",
        "{{contact.first_name}}",
        "{{contact.last_name}}",
        "{{contact.email}}",
        "{{contact.phone}}",
        "{{contact.company}}",
        "{{contact.job_title}}",
      ],
      contact_updated: [
        "{{contact.id}}",
        "{{contact.first_name}}",
        "{{contact.last_name}}",
        "{{contact.email}}",
      ],
      stage_changed: [
        "{{contact.id}}",
        "{{contact.first_name}}",
        "{{contact.last_name}}",
        "{{old_stage.name}}",
        "{{new_stage.name}}",
      ],
      activity_logged: [
        "{{activity.id}}",
        "{{activity.type}}",
        "{{activity.subject}}",
        "{{contact.id}}",
        "{{contact.first_name}}",
      ],
      disposition_set: [
        "{{activity.id}}",
        "{{disposition.name}}",
        "{{contact.id}}",
      ],
      assignment_changed: [
        "{{contact.id}}",
        "{{old_user.name}}",
        "{{new_user.name}}",
      ],
    };

    return [...common, ...(eventVariables[triggerEvent] || [])];
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("payload-template") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = jsonValue;
    const newText = text.substring(0, start) + variable + text.substring(end);

    setJsonValue(newText);
    handleChange(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">How to use variables:</p>
          <p>
            Use <code className="px-1 bg-background rounded">{"{{variable}}"}</code> syntax
            to insert dynamic values. Click any variable below to insert it at cursor position.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Available Variables</Label>
        <div className="flex flex-wrap gap-2">
          {getAvailableVariables().map((variable) => (
            <Badge
              key={variable}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => insertVariable(variable)}
            >
              {variable}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payload-template">Payload Template (JSON)</Label>
        <Textarea
          id="payload-template"
          value={jsonValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter JSON template..."
          className="font-mono text-sm min-h-[300px]"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const formatted = JSON.stringify(JSON.parse(jsonValue), null, 2);
          setJsonValue(formatted);
        }}
        disabled={!!error}
      >
        Format JSON
      </Button>
    </div>
  );
};

function getDefaultTemplate(triggerEvent: string): any {
  const templates: Record<string, any> = {
    contact_created: {
      event: "contact_created",
      timestamp: "{{timestamp}}",
      contact: {
        id: "{{contact.id}}",
        first_name: "{{contact.first_name}}",
        last_name: "{{contact.last_name}}",
        email: "{{contact.email}}",
        phone: "{{contact.phone}}",
        company: "{{contact.company}}",
      },
    },
    contact_updated: {
      event: "contact_updated",
      timestamp: "{{timestamp}}",
      contact_id: "{{contact.id}}",
    },
    stage_changed: {
      event: "stage_changed",
      timestamp: "{{timestamp}}",
      contact_id: "{{contact.id}}",
      old_stage: "{{old_stage.name}}",
      new_stage: "{{new_stage.name}}",
    },
  };

  return templates[triggerEvent] || {
    event: triggerEvent,
    timestamp: "{{timestamp}}",
  };
}

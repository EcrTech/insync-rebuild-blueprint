import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";

interface FilterConditionsBuilderProps {
  conditions: any;
  onChange: (conditions: any) => void;
  triggerEvent: string;
}

interface FilterRule {
  field: string;
  operator: string;
  value: string;
}

export const FilterConditionsBuilder = ({
  conditions,
  onChange,
  triggerEvent,
}: FilterConditionsBuilderProps) => {
  const [rules, setRules] = useState<FilterRule[]>(() => {
    if (!conditions || Object.keys(conditions).length === 0) {
      return [];
    }
    return Object.entries(conditions).map(([field, condition]: [string, any]) => ({
      field,
      operator: condition.operator || "equals",
      value: condition.value || "",
    }));
  });

  const getAvailableFields = () => {
    const fieldsByEvent: Record<string, Array<{ value: string; label: string }>> = {
      contact_created: [
        { value: "contact.company", label: "Company" },
        { value: "contact.job_title", label: "Job Title" },
        { value: "contact.email", label: "Email" },
        { value: "contact.phone", label: "Phone" },
      ],
      contact_updated: [
        { value: "contact.company", label: "Company" },
        { value: "contact.status", label: "Status" },
      ],
      stage_changed: [
        { value: "new_stage.name", label: "New Stage" },
        { value: "old_stage.name", label: "Old Stage" },
      ],
      activity_logged: [
        { value: "activity.type", label: "Activity Type" },
        { value: "activity.subject", label: "Subject" },
      ],
    };

    return fieldsByEvent[triggerEvent] || [];
  };

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does Not Contain" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "is_empty", label: "Is Empty" },
    { value: "is_not_empty", label: "Is Not Empty" },
  ];

  const addRule = () => {
    setRules([...rules, { field: "", operator: "equals", value: "" }]);
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
    updateConditions(newRules);
  };

  const updateRule = (index: number, updates: Partial<FilterRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
    updateConditions(newRules);
  };

  const updateConditions = (newRules: FilterRule[]) => {
    const newConditions: any = {};
    newRules.forEach((rule) => {
      if (rule.field) {
        newConditions[rule.field] = {
          operator: rule.operator,
          value: rule.value,
        };
      }
    });
    onChange(newConditions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Filter Conditions</p>
          <p>
            Only send webhooks when ALL conditions are met. Leave empty to send for every event.
          </p>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-4">
            No filters configured. Webhook will trigger for every event.
          </p>
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="mr-2 h-4 w-4" />
            Add Filter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Field</Label>
                  <Select
                    value={rule.field}
                    onValueChange={(value) => updateRule(index, { field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableFields().map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={rule.operator}
                    onValueChange={(value) => updateRule(index, { operator: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={rule.value}
                    onChange={(e) => updateRule(index, { value: e.target.value })}
                    placeholder="Enter value..."
                    disabled={rule.operator === "is_empty" || rule.operator === "is_not_empty"}
                  />
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => removeRule(index)}
                className="mt-7"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="mr-2 h-4 w-4" />
            Add Another Filter
          </Button>
        </div>
      )}
    </div>
  );
};

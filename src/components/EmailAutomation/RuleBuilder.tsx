import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RuleBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: any;
}

export function RuleBuilder({ open, onOpenChange, editingRule }: RuleBuilderProps) {
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<"stage_change" | "disposition_set">("stage_change");
  const [templateId, setTemplateId] = useState("");
  const [sendDelayMinutes, setSendDelayMinutes] = useState(0);
  const [maxSends, setMaxSends] = useState<number | undefined>();
  const [cooldownDays, setCooldownDays] = useState<number | undefined>();
  const [priority, setPriority] = useState(50);

  // Stage change config
  const [fromStageId, setFromStageId] = useState<string | undefined>();
  const [toStageId, setToStageId] = useState<string | undefined>();

  // Disposition config
  const [dispositionIds, setDispositionIds] = useState<string[]>([]);

  // Fetch pipeline stages
  const { data: stages } = useQuery({
    queryKey: ["pipeline_stages", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("stage_order");
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  // Fetch dispositions
  const { data: dispositions } = useQuery({
    queryKey: ["call_dispositions", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("call_dispositions")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["email_templates", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  // Load editing rule data
  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setTriggerType(editingRule.trigger_type);
      setTemplateId(editingRule.email_template_id || "");
      setSendDelayMinutes(editingRule.send_delay_minutes || 0);
      setMaxSends(editingRule.max_sends_per_contact);
      setCooldownDays(editingRule.cooldown_period_days);
      setPriority(editingRule.priority || 50);

      if (editingRule.trigger_config) {
        setFromStageId(editingRule.trigger_config.from_stage_id);
        setToStageId(editingRule.trigger_config.to_stage_id);
        setDispositionIds(editingRule.trigger_config.disposition_ids || []);
      }
    } else {
      resetForm();
    }
  }, [editingRule, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTriggerType("stage_change");
    setTemplateId("");
    setSendDelayMinutes(0);
    setMaxSends(undefined);
    setCooldownDays(undefined);
    setPriority(50);
    setFromStageId(undefined);
    setToStageId(undefined);
    setDispositionIds([]);
  };

  // Save rule mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveOrgId) throw new Error("No organization selected");

      const triggerConfig =
        triggerType === "stage_change"
          ? { from_stage_id: fromStageId, to_stage_id: toStageId }
          : { disposition_ids: dispositionIds };

      const ruleData = {
        org_id: effectiveOrgId,
        name,
        description,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        email_template_id: templateId || null,
        send_delay_minutes: sendDelayMinutes,
        max_sends_per_contact: maxSends,
        cooldown_period_days: cooldownDays,
        priority,
        is_active: true,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("email_automation_rules")
          .update(ruleData)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("email_automation_rules")
          .insert({ ...ruleData, created_by: user.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_automation_rules"] });
      toast({
        title: editingRule ? "Rule updated" : "Rule created",
        description: "Automation rule saved successfully",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name) {
      toast({
        title: "Validation Error",
        description: "Please provide a rule name",
        variant: "destructive",
      });
      return;
    }

    if (!templateId) {
      toast({
        title: "Validation Error",
        description: "Please select an email template",
        variant: "destructive",
      });
      return;
    }

    if (triggerType === "stage_change" && !fromStageId && !toStageId) {
      toast({
        title: "Validation Error",
        description: "Please select at least one stage (from or to)",
        variant: "destructive",
      });
      return;
    }

    if (triggerType === "disposition_set" && dispositionIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one disposition",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Edit Automation Rule" : "Create Automation Rule"}
          </DialogTitle>
          <DialogDescription>
            Set up automated emails based on pipeline changes and activities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              placeholder="e.g., New Lead Welcome Email"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this rule does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Trigger Type */}
          <div className="space-y-2">
            <Label htmlFor="trigger">Trigger Type *</Label>
            <Select value={triggerType} onValueChange={(v: any) => setTriggerType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stage_change">Stage Change</SelectItem>
                <SelectItem value="disposition_set">Call Disposition</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stage Change Config */}
          {triggerType === "stage_change" && (
            <div className="space-y-2 border rounded-lg p-4">
              <Label>Stage Configuration</Label>
              <p className="text-sm text-muted-foreground">
                Select stages to trigger this rule (leave blank for "any")
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Stage</Label>
                  <Select value={fromStageId} onValueChange={setFromStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any stage</SelectItem>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Stage</Label>
                  <Select value={toStageId} onValueChange={setToStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any stage</SelectItem>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Disposition Config */}
          {triggerType === "disposition_set" && (
            <div className="space-y-2 border rounded-lg p-4">
              <Label>Disposition Selection *</Label>
              <p className="text-sm text-muted-foreground">
                Select which dispositions trigger this rule
              </p>
              <Select
                value={dispositionIds[0] || ""}
                onValueChange={(v) => setDispositionIds([v])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  {dispositions?.map((disp) => (
                    <SelectItem key={disp.id} value={disp.id}>
                      {disp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Email Template */}
          <div className="space-y-2">
            <Label htmlFor="template">Email Template *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timing */}
          <div className="space-y-2">
            <Label htmlFor="delay">Send Delay (minutes)</Label>
            <Input
              id="delay"
              type="number"
              min="0"
              value={sendDelayMinutes}
              onChange={(e) => setSendDelayMinutes(parseInt(e.target.value) || 0)}
            />
            <p className="text-sm text-muted-foreground">
              0 = send immediately, 60 = send 1 hour after trigger
            </p>
          </div>

          {/* Frequency Control */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxSends">Max Sends per Contact</Label>
              <Input
                id="maxSends"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxSends || ""}
                onChange={(e) =>
                  setMaxSends(e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (days)</Label>
              <Input
                id="cooldown"
                type="number"
                min="1"
                placeholder="No cooldown"
                value={cooldownDays || ""}
                onChange={(e) =>
                  setCooldownDays(e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority (0-100)</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              max="100"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
            />
            <p className="text-sm text-muted-foreground">
              Higher priority rules execute first when multiple rules match
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

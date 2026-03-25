import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentStore } from "@/stores/agentStore";
import { useSkillStore } from "@/stores/skillStore";
import { useWorkflowStore, type WorkflowStep } from "@/stores/workflowStore";

interface AddWorkflowStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  existingSteps: WorkflowStep[];
  editStep?: WorkflowStep | null;
}

export function AddWorkflowStepDialog({
  open,
  onOpenChange,
  workflowId,
  existingSteps,
  editStep,
}: AddWorkflowStepDialogProps) {
  const addStep = useWorkflowStore((s) => s.addStep);
  const updateStep = useWorkflowStore((s) => s.updateStep);
  const allAgents = useAgentStore((s) => s.agents);
  const agents = allAgents.filter((a) => !a.isSecretary);
  const allSkills = useSkillStore((s) => s.skills);

  const [agentId, setAgentId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [label, setLabel] = useState("");
  const [onSuccess, setOnSuccess] = useState<string>("next");
  const [onFailure, setOnFailure] = useState<string>("halt");

  useEffect(() => {
    if (editStep) {
      setAgentId(editStep.agentId);
      setSkillId(editStep.skillId);
      setLabel(editStep.label);
      setOnSuccess(editStep.onSuccess ?? "next");
      setOnFailure(editStep.onFailure ?? "halt");
    } else {
      setAgentId("");
      setSkillId("");
      setLabel("");
      setOnSuccess("next");
      setOnFailure("halt");
    }
  }, [editStep, open]);

  const selectedAgent = agents.find((a) => a.id === agentId);
  const agentSkills = selectedAgent
    ? allSkills.filter((sk) => selectedAgent.skills.includes(sk.id))
    : [];

  const handleSubmit = () => {
    if (!agentId || !skillId) return;

    const stepData = {
      agentId,
      skillId,
      label: label.trim(),
      onSuccess: onSuccess === "next" ? undefined : onSuccess === "halt" ? undefined : onSuccess,
      onFailure: onFailure === "halt" ? undefined : onFailure === "next" ? undefined : onFailure,
    };

    if (editStep) {
      updateStep(workflowId, editStep.id, stepData);
    } else {
      addStep(workflowId, { ...stepData, order: existingSteps.length });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editStep ? "Edit Step" : "Add Step"} className="sm:max-w-[480px] bg-card">
        <Separator />

        <div className="flex-1 overflow-y-auto space-y-6 p-4 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Section 1: Execution */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Context
            </Label>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1">Agent</Label>
                <Select value={agentId} onValueChange={(v) => { setAgentId(v); setSkillId(""); }}>
                  <SelectTrigger className="w-48 h-10 border-muted-foreground/20 text-sm">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1">Skill</Label>
                <Select value={skillId} onValueChange={setSkillId} disabled={!agentId}>
                  <SelectTrigger className="w-48 h-10 border-muted-foreground/20 text-sm">
                    <SelectValue placeholder="Select Skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentSkills.map((sk) => (
                      <SelectItem key={sk.id} value={sk.id}>/{sk.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="bg-muted/30" />

          {/* Section 2: Metadata */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metadata
            </Label>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="step-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 leading-none">
                Step Label
              </Label>
              <Input
                id="step-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Run test suite"
                className="w-64 h-10 border-muted-foreground/20 focus:border-primary text-sm"
              />
            </div>
          </div>

          <Separator className="bg-muted/30" />

          {/* Section 3: Flow Control */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Logic & Flow
            </Label>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1">On Success</Label>
                <Select value={onSuccess} onValueChange={setOnSuccess}>
                  <SelectTrigger className="w-48 h-10 border-muted-foreground/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">→ Next step</SelectItem>
                    <SelectItem value="halt">→ End workflow</SelectItem>
                    {existingSteps
                      .filter((s) => s.id !== editStep?.id)
                      .map((s, i) => (
                        <SelectItem key={s.id} value={s.id}>→ Step {i + 1}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pl-1">On Failure</Label>
                <Select value={onFailure} onValueChange={setOnFailure}>
                  <SelectTrigger className="w-48 h-10 border-muted-foreground/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="halt">→ Halt workflow</SelectItem>
                    <SelectItem value="next">→ Next step</SelectItem>
                    {existingSteps
                      .filter((s) => s.id !== editStep?.id)
                      .map((s, i) => (
                        <SelectItem key={s.id} value={s.id}>→ Step {i + 1}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2 bg-muted/5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!agentId || !skillId}>
            {editStep ? "Save" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

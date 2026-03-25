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
import { useProjectStore } from "@/stores/projectStore";
import { useWorkflowStore, type Workflow, type WorkflowStatus } from "@/stores/workflowStore";

interface AddWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editWorkflow?: Workflow | null;
}

export function AddWorkflowDialog({ open, onOpenChange, editWorkflow }: AddWorkflowDialogProps) {
  const addWorkflow = useWorkflowStore((s) => s.addWorkflow);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const projects = useProjectStore((s) => s.projects);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [status, setStatus] = useState<WorkflowStatus>("draft");

  useEffect(() => {
    if (editWorkflow) {
      setName(editWorkflow.name);
      setDescription(editWorkflow.description);
      setProjectId(editWorkflow.projectId ?? "none");
      setStatus(editWorkflow.status);
    } else {
      setName("");
      setDescription("");
      setProjectId("none");
      setStatus("draft");
    }
  }, [editWorkflow, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      description: description.trim(),
      projectId: projectId === "none" ? null : projectId,
      status,
    };

    if (editWorkflow) {
      updateWorkflow(editWorkflow.id, data);
    } else {
      addWorkflow({ ...data, steps: [], lastRunAt: null });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editWorkflow ? "Edit Workflow" : "New Workflow"} className="sm:max-w-[480px] bg-card">
        <Separator />

        <div className="flex-1 overflow-y-auto space-y-6 p-4 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Section 1: Basics */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              General Information
            </Label>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="wf-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 leading-none">
                Workflow Name
              </Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Code Review Pipeline..."
                className="w-80 h-10 border-muted-foreground/20 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Description
              </Label>
              <textarea
                id="wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do? Describe the steps and goals..."
                className="w-full min-h-[80px] rounded-md border border-muted-foreground/20 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
              />
            </div>
          </div>

          <Separator className="bg-muted/30" />

          {/* Section 2: Deployment & Strategy */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deployment & Strategy
            </Label>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="project" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 leading-none">
                Project Context
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project" className="w-80 h-10 border-muted-foreground/20">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global (All Project)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="wf-status" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 leading-none">
                Publishing State
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Workflow["status"])}>
                <SelectTrigger id="wf-status" className="w-80 h-10 border-muted-foreground/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editWorkflow ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

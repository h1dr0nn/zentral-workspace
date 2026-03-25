import { useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWorkflowStore, type Workflow } from "@/stores/workflowStore";
import { WorkflowCard } from "./WorkflowCard";
import { WorkflowStepList } from "./WorkflowStepList";
import { AddWorkflowDialog } from "./AddWorkflowDialog";
import { AddWorkflowStepDialog } from "./AddWorkflowStepDialog";

const STATUS_VARIANT: Record<string, "outline" | "default" | "secondary"> = {
  draft: "outline",
  active: "default",
  paused: "secondary",
};

export function WorkflowsTab() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId);
  const setActiveWorkflow = useWorkflowStore((s) => s.setActiveWorkflow);
  const removeWorkflow = useWorkflowStore((s) => s.removeWorkflow);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const removeStep = useWorkflowStore((s) => s.removeStep);
  const reorderSteps = useWorkflowStore((s) => s.reorderSteps);

  const [wfDialogOpen, setWfDialogOpen] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState<Workflow | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  const handleAddWorkflow = () => {
    setEditWorkflow(null);
    setWfDialogOpen(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditWorkflow(workflow);
    setWfDialogOpen(true);
  };

  const handleToggleStatus = (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const next = wf.status === "active" ? "paused" : "active";
    updateWorkflow(id, { status: next });
  };

  // Detail mode
  if (activeWorkflow) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 px-3 py-3 shrink-0">
          <button
            onClick={() => setActiveWorkflow(null)}
            className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground truncate">{activeWorkflow.name}</span>
            <Badge variant={STATUS_VARIANT[activeWorkflow.status]} className="text-[10px] px-1.5 py-0 h-[18px] font-normal capitalize shrink-0">
              {activeWorkflow.status}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <WorkflowStepList
            workflow={activeWorkflow}
            onAddStep={() => setStepDialogOpen(true)}
            onRemoveStep={(stepId) => removeStep(activeWorkflow.id, stepId)}
            onMoveStep={(stepId, direction) => {
              const sorted = [...activeWorkflow.steps].sort((a, b) => a.order - b.order);
              const idx = sorted.findIndex((s) => s.id === stepId);
              if (idx < 0) return;
              const swapIdx = direction === "up" ? idx - 1 : idx + 1;
              if (swapIdx < 0 || swapIdx >= sorted.length) return;
              const ids = sorted.map((s) => s.id);
              [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
              reorderSteps(activeWorkflow.id, ids);
            }}
          />
        </div>

        <AddWorkflowStepDialog
          open={stepDialogOpen}
          onOpenChange={setStepDialogOpen}
          workflowId={activeWorkflow.id}
          existingSteps={activeWorkflow.steps}
        />
      </div>
    );
  }

  // List mode
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">Workflows</p>
        <button
          onClick={handleAddWorkflow}
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="New Workflow"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No workflows yet.{"\n"}Click + to create an agent pipeline.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex flex-col gap-1 pb-2">
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onSelect={setActiveWorkflow}
                onEdit={handleEditWorkflow}
                onToggleStatus={handleToggleStatus}
                onDelete={removeWorkflow}
              />
            ))}
          </div>
        </div>
      )}

      <AddWorkflowDialog
        open={wfDialogOpen}
        onOpenChange={setWfDialogOpen}
        editWorkflow={editWorkflow}
      />
    </div>
  );
}

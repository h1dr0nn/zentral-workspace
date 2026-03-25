import { Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/stores/agentStore";
import { useSkillStore } from "@/stores/skillStore";
import type { Workflow, WorkflowStep } from "@/stores/workflowStore";

interface WorkflowStepListProps {
  workflow: Workflow;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onMoveStep: (stepId: string, direction: "up" | "down") => void;
}

function StepItem({
  step,
  index,
  isFirst,
  isLast,
  onRemove,
  onMove,
}: {
  step: WorkflowStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === step.agentId));
  const skill = useSkillStore((s) => s.skills.find((sk) => sk.id === step.skillId));

  return (
    <div className="group flex items-stretch gap-2">
      {/* Move buttons */}
      <div className="flex flex-col items-center justify-center shrink-0">
        <button
          onClick={() => onMove("up")}
          disabled={isFirst}
          className="h-3.5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => onMove("down")}
          disabled={isLast}
          className="h-3.5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Timeline: line + circle + line */}
      <div className="flex flex-col items-center shrink-0 w-5">
        {/* Line above circle */}
        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-border"}`} />
        {/* Circle */}
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
          {index + 1}
        </div>
        {/* Line below circle */}
        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-border"}`} />
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 py-1.5">
        <p className="text-sm font-medium text-foreground truncate">
          {step.label || `${agent?.name ?? "?"}: /${skill?.name ?? "?"}`}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {agent?.name ?? "?"} · /{skill?.name ?? "?"}
        </p>
        <div className="flex gap-3 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            success → {step.onSuccess ? `step ${step.onSuccess}` : "next"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            failure → {step.onFailure ? `step ${step.onFailure}` : "halt"}
          </span>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0 self-center"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export function WorkflowStepList({ workflow, onAddStep, onRemoveStep, onMoveStep }: WorkflowStepListProps) {
  const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col px-3 pb-3">
      {sortedSteps.map((step, i) => (
        <StepItem
          key={step.id}
          step={step}
          index={i}
          isFirst={i === 0}
          isLast={i === sortedSteps.length - 1}
          onRemove={() => onRemoveStep(step.id)}
          onMove={(dir) => onMoveStep(step.id, dir)}
        />
      ))}

      <div className="mt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onAddStep}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Step
        </Button>
      </div>
    </div>
  );
}

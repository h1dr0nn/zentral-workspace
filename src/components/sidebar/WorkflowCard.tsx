import { MoreVertical, Play, Pause, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useAgentStore } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Workflow } from "@/stores/workflowStore";
export interface WorkflowCardProps {
  workflow: Workflow;
  onSelect: (id: string) => void;
  onEdit: (workflow: Workflow) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WorkflowCard({ workflow, onSelect, onEdit, onToggleStatus, onDelete }: WorkflowCardProps) {
  const agents = useAgentStore((s) => s.agents);
  const project = useProjectStore((s) =>
    workflow.projectId ? s.projects.find((p) => p.id === workflow.projectId) : null
  );

  const stepSummary = workflow.steps
    .sort((a, b) => a.order - b.order)
    .map((step) => agents.find((a) => a.id === step.agentId)?.name ?? "?")
    .join(" → ");

  return (
    <div
      className="group flex flex-col gap-1.5 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onSelect(workflow.id)}
    >
      {/* Row 1: name + toggle & menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">
            {workflow.name}
          </span>
          {project && (
            <span className="text-[10px] text-muted-foreground truncate uppercase tracking-tight">
              {project.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <Switch
            checked={workflow.status === "active"}
            onCheckedChange={() => {
              // Note: This logic assumes onToggleStatus handles the complex state transitions
              onToggleStatus(workflow.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
            size="sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(workflow); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {workflow.status === "active" ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleStatus(workflow.id); }}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleStatus(workflow.id); }}>
                  <Play className="mr-2 h-4 w-4" />
                  {workflow.status === "draft" ? "Activate" : "Resume"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(workflow.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: step summary */}
      {stepSummary && (
        <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
          {stepSummary}
        </p>
      )}

      {/* Row 3: placeholder for alignment */}
      <div className="h-0.5" />
    </div>
  );
}

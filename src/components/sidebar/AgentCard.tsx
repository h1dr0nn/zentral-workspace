import { Star, MoreVertical, Pencil, Trash2, RotateCcw, Play, Square, FolderPlus, FolderMinus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Agent } from "@/stores/agentStore";
import { useAgentStore } from "@/stores/agentStore";
import { useChatStore } from "@/stores/chatStore";
import { SkillBadges } from "./SkillBadge";

interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  isInProject: boolean;
  onEdit: (agent: Agent) => void;
  onToggleProject: () => void;
}

export function AgentCard({ agent, isActive, isInProject, onEdit, onToggleProject }: AgentCardProps) {
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const updateStatus = useAgentStore((s) => s.updateStatus);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);

  const handleSelect = () => {
    if (!isInProject && !agent.isSecretary) return;
    setActiveAgent(agent.id);
  };

  const isRunningOrOnline = agent.status === "running" || agent.status === "online";

  return (
    <div
      className={cn(
        "group flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-colors",
        isInProject || agent.isSecretary ? "cursor-pointer" : "cursor-default opacity-50",
        isActive ? "bg-accent" : (isInProject || agent.isSecretary) && "hover:bg-muted/50",
        agent.isSecretary && "bg-primary/5",
      )}
      onClick={handleSelect}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Row 1: name - role + menu */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {agent.isSecretary && <Star className="h-3 w-3 text-primary shrink-0" />}
          <span className="font-semibold text-sm text-foreground truncate">{agent.name}</span>
          <span className="text-xs text-foreground/40">-</span>
          <span className="text-xs text-foreground/60 truncate">{agent.role}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!agent.isSecretary && (
              <DropdownMenuItem onClick={onToggleProject}>
                {isInProject ? (
                  <><FolderMinus className="mr-2 h-4 w-4" />Remove from Project</>
                ) : (
                  <><FolderPlus className="mr-2 h-4 w-4" />Add to Project</>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(agent)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Agent
            </DropdownMenuItem>
            {(isInProject || agent.isSecretary) && (
              <>
                {isRunningOrOnline ? (
                  <DropdownMenuItem onClick={() => updateStatus(agent.id, "stopped")}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => updateStatus(agent.id, "online")}>
                    <Play className="mr-2 h-4 w-4" />
                    Start
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => updateStatus(agent.id, "online")}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart
                </DropdownMenuItem>
              </>
            )}
            {!agent.isSecretary && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => removeAgent(agent.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Agent
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: skills */}
      {agent.skills.length > 0 && <SkillBadges skills={agent.skills} />}
    </div>
  );
}

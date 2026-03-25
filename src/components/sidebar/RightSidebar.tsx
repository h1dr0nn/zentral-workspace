import { useState } from "react";
import { Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAgentStore, type Agent } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";
import { useChatStore } from "@/stores/chatStore";
import { AgentCard } from "./AgentCard";
import { AgentCreationDialog } from "./AgentCreationDialog";

export function RightSidebar() {
  const agents = useAgentStore((s) => s.agents);
  const addToProject = useAgentStore((s) => s.addToProject);
  const removeFromProject = useAgentStore((s) => s.removeFromProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);

  const isInProject = (agent: Agent) =>
    agent.isSecretary || (activeProjectId != null && agent.projectIds.includes(activeProjectId));

  const secretary = agents.find((a) => a.isSecretary);
  const inProject = agents.filter((a) => !a.isSecretary && isInProject(a));
  const available = agents.filter((a) => !a.isSecretary && !isInProject(a));

  const handleEdit = (agent: Agent) => {
    setEditAgent(agent);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditAgent(null);
    setDialogOpen(true);
  };

  const handleToggleProject = (agent: Agent) => {
    if (!activeProjectId) return;
    if (isInProject(agent)) {
      removeFromProject(agent.id, activeProjectId);
    } else {
      addToProject(agent.id, activeProjectId);
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">Agents</p>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="New Agent"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="flex flex-col gap-1 pb-2">
          {secretary && (
            <AgentCard
              agent={secretary}
              isActive={activeAgentId === secretary.id}
              isInProject
              onEdit={handleEdit}
              onToggleProject={() => {}}
            />
          )}

          {inProject.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1">In Project</p>
              {inProject.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isActive={activeAgentId === agent.id}
                  isInProject
                  onEdit={handleEdit}
                  onToggleProject={() => handleToggleProject(agent)}
                />
              ))}
            </>
          )}

          {available.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1">Available</p>
              {available.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isActive={activeAgentId === agent.id}
                  isInProject={false}
                  onEdit={handleEdit}
                  onToggleProject={() => handleToggleProject(agent)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <AgentCreationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editAgent={editAgent}
      />
    </div>
  );
}

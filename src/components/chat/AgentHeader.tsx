import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical, Trash2, Download, Pin } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";

export function AgentHeader() {
  const { activeAgentId, setActiveAgent } = useChatStore();
  const agents = useAgentStore((s) => s.agents);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // Agents available in current project (secretary always included)
  const projectAgents = agents.filter(
    (a) => a.isSecretary || (activeProjectId != null && a.projectIds.includes(activeProjectId))
  );

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const agentName = activeAgentId === "general" ? "Project Room" : activeAgent?.name ?? "Unknown";
  const agentRole = activeAgentId === "general" ? "Collaboration" : activeAgent?.role ?? "";

  return (
    <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-muted text-base font-semibold">
              {agentName}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuItem onClick={() => setActiveAgent("general")}>
              Project Room
            </DropdownMenuItem>
            {projectAgents.length > 0 && <DropdownMenuSeparator />}
            {projectAgents.map((agent) => (
              <DropdownMenuItem key={agent.id} onClick={() => setActiveAgent(agent.id)}>
                {agent.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground">{agentRole}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem>
            <Pin className="mr-2 h-4 w-4" />
            Pin Chat
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download className="mr-2 h-4 w-4" />
            Export Chat
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (activeAgentId) {
                useChatStore.getState().setMessages(activeAgentId, []);
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

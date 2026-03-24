import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger, 
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";

export function AgentHeader() {
  const { activeAgentId, setActiveAgent } = useChatStore();

  const handleSwitchAgent = (id: string) => {
    setActiveAgent(id);
  };

  const agentName = 
    activeAgentId === "general" ? "Project Room" : 
    activeAgentId === "agent-qa" ? "QA Lead" : "Secretary";
    
  const agentRole = 
    activeAgentId === "general" ? "Collaboration" :
    activeAgentId === "agent-qa" ? "Testing" : "Orchestration";

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
            <DropdownMenuItem onClick={() => handleSwitchAgent("general")}>
              Project Room
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSwitchAgent("agent-secretary")}>
              Secretary
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSwitchAgent("agent-qa")}>
              QA Lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground">{agentRole}</span>
      </div>
      
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

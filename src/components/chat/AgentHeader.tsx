import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical, Trash2, Download, Pin, MessageSquareDashed, MessageSquareMore, Loader2, XCircle } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import { useDiscussionStore } from "@/stores/discussionStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AgentHeader() {
  const { activeAgentId, setActiveAgent, memoryEnabled, setMemoryEnabled, roomMode, setRoomMode } = useChatStore();
  const agents = useAgentStore((s) => s.agents);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const orchSession = useOrchestrationStore((s) => s.session);
  const discSession = useDiscussionStore((s) => s.session);

  const projectAgents = agents.filter(
    (a) => a.isSecretary || (activeProjectId != null && a.projectIds.includes(activeProjectId))
  );

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const isRoom = activeAgentId === "command" || activeAgentId === "discussion";
  const agentName = isRoom
    ? roomMode === "command" ? "Command Room" : "Discussion Room"
    : activeAgent?.name ?? "Unknown";
  const agentRole = isRoom
    ? roomMode === "command" ? "Orchestration" : "Multi-agent Discussion"
    : activeAgent?.role ?? "";

  // Orchestration status (Command Room)
  const isOrchActive = orchSession != null && orchSession.status !== "complete" && orchSession.status !== "error" && orchSession.status !== "idle";
  const orchStatusText = orchSession
    ? orchSession.status === "zennis-thinking" ? "Zennis is thinking…"
    : orchSession.status === "zennis-reviewing" ? "Zennis is reviewing…"
    : orchSession.status === "agent-working"
      ? `${agents.find((a) => a.id === orchSession.currentAgentId)?.name ?? "Agent"} is working…`
    : null
    : null;

  // Discussion status
  const isDiscActive = discSession != null && discSession.phase !== "complete" && discSession.phase !== "error" && discSession.phase !== "idle";
  const discStatusText = discSession
    ? discSession.phase === "selecting-agents" ? "Zennis is selecting agents…"
    : discSession.phase === "round-in-progress"
      ? `${agents.find((a) => a.id === discSession.currentAgentId)?.name ?? "Agent"} is sharing opinion…`
    : discSession.phase === "checking-consensus" ? "Zennis is checking consensus…"
    : discSession.phase === "concluding" ? "Zennis is writing conclusion…"
    : null
    : null;

  const activeSessionStatus = isOrchActive ? orchStatusText
    : isDiscActive ? discStatusText
    : null;
  const activeSessionStep = isOrchActive && orchSession ? `${orchSession.currentStep + 1}/${orchSession.maxIterations}`
    : isDiscActive && discSession ? `Round ${discSession.currentRound}/${discSession.maxRounds}`
    : null;
  const cancelSession = () => {
    if (isOrchActive) useOrchestrationStore.getState().cancelOrchestration();
    if (isDiscActive) useDiscussionStore.getState().cancelDiscussion();
  };

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
            <DropdownMenuItem onClick={() => { setActiveAgent("command"); setRoomMode("command"); }}>
              Command Room
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setActiveAgent("discussion"); setRoomMode("discussion"); }}>
              Discussion Room
            </DropdownMenuItem>
            {projectAgents.length > 0 && <DropdownMenuSeparator />}
            {projectAgents.map((agent) => (
              <DropdownMenuItem key={agent.id} onClick={() => setActiveAgent(agent.id)}>
                {agent.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeSessionStatus ? (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {activeSessionStatus}
            {activeSessionStep && <span className="text-muted-foreground text-xs">{activeSessionStep}</span>}
            <button onClick={cancelSession} className="ml-1 text-muted-foreground hover:text-destructive transition-colors" title="Cancel">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{agentRole}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${memoryEnabled ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => setMemoryEnabled(!memoryEnabled)}
              >
                {memoryEnabled ? <MessageSquareMore className="h-4 w-4" /> : <MessageSquareDashed className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {memoryEnabled ? "Memory On - Sends chat history" : "Memory Off - Each message is standalone"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
    </div>
  );
}

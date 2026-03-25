import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "./chatStore";
import { useAgentStore } from "./agentStore";
import { useProjectStore } from "./projectStore";
import { useSettingsStore } from "./settingsStore";
import { buildContextFromBudget } from "@/lib/tokenBudget";
import { orchAgentId } from "@/lib/orchestrationRouter";
import {
  buildZennisPrompt,
  buildDelegatePrompt,
  parseZennisResponse,
  type DelegationRecord,
} from "@/lib/orchestrationPrompts";

type SessionStatus = "idle" | "zennis-thinking" | "agent-working" | "zennis-reviewing" | "complete" | "error";

interface OrchestrationSession {
  id: string;
  status: SessionStatus;
  currentStep: number;
  maxIterations: number;
  model: string;
  userMessage: string;
  delegationChain: DelegationRecord[];
  currentAgentId: string | null;
  zennisMessageId: string | null;
  agentMessageId: string | null;
}

interface OrchestrationStore {
  session: OrchestrationSession | null;
  zennisBuffer: string;

  startOrchestration: (message: string, model: string) => void;
  handleZennisChunk: (text: string) => void;
  handleZennisDone: (fullText: string) => void;
  handleAgentDone: (fullText: string) => void;
  handleError: (error: string) => void;
  cancelOrchestration: () => void;
}

const MAX_ITERATIONS = 5;
const ROOM_KEY = "command";

function genSessionId(): string {
  return `s${Date.now().toString(36)}`;
}

function genMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export const useOrchestrationStore = create<OrchestrationStore>((set, get) => ({
  session: null,
  zennisBuffer: "",

  startOrchestration: (message, model) => {
    const sessionId = genSessionId();
    const session: OrchestrationSession = {
      id: sessionId,
      status: "zennis-thinking",
      currentStep: 0,
      maxIterations: MAX_ITERATIONS,
      model,
      userMessage: message,
      delegationChain: [],
      currentAgentId: null,
      zennisMessageId: null,
      agentMessageId: null,
    };
    set({ session, zennisBuffer: "" });
    sendToZennis(session);
  },

  handleZennisChunk: (text) => {
    // Buffer Zennis JSON — don't show raw to user
    set({ zennisBuffer: text });
  },

  handleZennisDone: (fullText) => {
    const { session } = get();
    if (!session) return;

    const decision = parseZennisResponse(fullText);
    const chat = useChatStore.getState();

    // Show Zennis reply in Project Room chat
    const replyId = genMsgId("zennis-reply");
    chat.addAgentMessage("agent-zennis", replyId, decision.reply, ROOM_KEY);

    // Check delegation
    if (decision.delegate) {
      const agents = useAgentStore.getState().agents;
      const targetAgent = agents.find((a) => a.id === decision.delegate!.agentId);

      if (!targetAgent) {
        chat.addSystemMessage(`Unknown agent: ${decision.delegate.agentId}`, ROOM_KEY);
        set({ session: { ...session, status: "complete" } });
        return;
      }

      if (session.currentStep >= session.maxIterations) {
        chat.addSystemMessage(`Orchestration reached maximum iterations (${session.maxIterations}).`, ROOM_KEY);
        set({ session: { ...session, status: "complete" } });
        return;
      }

      // Delegate
      chat.addSystemMessage(`Zennis → ${targetAgent.name}: ${decision.delegate.reason}`, ROOM_KEY);
      useAgentStore.getState().updateStatus(targetAgent.id, "running");

      const agentMsgId = genMsgId("agent-resp");
      // Create empty streaming message for the agent
      chat.addAgentMessage(targetAgent.id, agentMsgId, "", ROOM_KEY);
      // Mark it as streaming
      chat.setStreamContent(targetAgent.id, agentMsgId, "", ROOM_KEY);

      const updatedSession: OrchestrationSession = {
        ...session,
        status: "agent-working",
        currentStep: session.currentStep + 1,
        currentAgentId: targetAgent.id,
        agentMessageId: agentMsgId,
        delegationChain: [
          ...session.delegationChain,
          {
            agentId: targetAgent.id,
            agentName: targetAgent.name,
            instruction: decision.delegate.instruction,
            reason: decision.delegate.reason,
            result: "", // filled on completion
          },
        ],
      };
      set({ session: updatedSession, zennisBuffer: "" });

      // Spawn agent
      const systemPrompt = buildDelegatePrompt(
        targetAgent.name,
        targetAgent.role,
        decision.delegate.instruction,
      );

      invoke("send_chat_message", {
        agentId: orchAgentId(targetAgent.id, session.id),
        messageId: agentMsgId,
        message: decision.delegate.instruction,
        systemPrompt,
        model: session.model,
      }).catch((err) => {
        get().handleError(String(err));
      });
    } else {
      // No delegation — orchestration complete
      chat.stopStream("agent-zennis", ROOM_KEY);
      set({ session: { ...session, status: "complete" }, zennisBuffer: "" });
    }
  },

  handleAgentDone: (fullText) => {
    const { session } = get();
    if (!session || !session.currentAgentId) return;

    // Update delegation chain with result
    const chain = [...session.delegationChain];
    if (chain.length > 0) {
      chain[chain.length - 1].result = fullText;
    }

    // Reset agent status
    useAgentStore.getState().updateStatus(session.currentAgentId, "idle");

    // Stop streaming for agent message
    useChatStore.getState().stopStream(session.currentAgentId, ROOM_KEY);

    // Feed result back to Zennis for review
    const reviewSession: OrchestrationSession = {
      ...session,
      status: "zennis-reviewing",
      delegationChain: chain,
      currentAgentId: null,
      agentMessageId: null,
    };
    set({ session: reviewSession, zennisBuffer: "" });

    sendToZennis(reviewSession);
  },

  handleError: (error) => {
    const { session } = get();
    if (!session) return;

    if (session.currentAgentId) {
      useAgentStore.getState().updateStatus(session.currentAgentId, "idle");
    }
    useChatStore.getState().addSystemMessage(`Orchestration error: ${error}`, ROOM_KEY);
    useChatStore.getState().stopStream("_cleanup", ROOM_KEY);
    set({ session: { ...session, status: "error" }, zennisBuffer: "" });
  },

  cancelOrchestration: () => {
    const { session } = get();
    if (!session) return;

    if (session.currentAgentId) {
      useAgentStore.getState().updateStatus(session.currentAgentId, "idle");
    }
    useChatStore.getState().addSystemMessage("Orchestration cancelled.", ROOM_KEY);
    useChatStore.getState().stopStream("_cleanup", ROOM_KEY);
    set({ session: { ...session, status: "complete" }, zennisBuffer: "" });
  },
}));

/** Internal: send context to Zennis for decision */
function sendToZennis(session: OrchestrationSession) {
  const agents = useAgentStore.getState().agents;
  const projectId = useProjectStore.getState().activeProjectId;
  const projectAgents = agents.filter(
    (a) => !a.isSecretary && (projectId == null || a.projectIds.length === 0 || a.projectIds.includes(projectId)),
  );

  const systemPrompt = buildZennisPrompt(projectAgents, session.delegationChain);

  // Build message context
  const budget = useSettingsStore.getState().settings.chatTokenBudget;
  const chatMessages = useChatStore.getState().getMessages("command");

  let message: string;
  if (session.delegationChain.length > 0) {
    const lastDelegation = session.delegationChain[session.delegationChain.length - 1];
    message = `The user originally asked: "${session.userMessage}"\n\n${lastDelegation.agentName} completed the task "${lastDelegation.instruction}" with this result:\n\n${lastDelegation.result}\n\nDecide: reply to the user (task complete) or delegate to another agent for the next step.`;
  } else {
    const history = buildContextFromBudget(chatMessages, budget || 4000);
    message = history ? `${history}\n\nHuman: ${session.userMessage}` : session.userMessage;
  }

  const zennisMsgId = genMsgId("zennis-buf");
  useOrchestrationStore.setState({
    session: { ...session, zennisMessageId: zennisMsgId },
  });

  invoke("send_chat_message", {
    agentId: orchAgentId("zennis", session.id),
    messageId: zennisMsgId,
    message,
    systemPrompt,
    model: session.model,
  }).catch((err) => {
    useOrchestrationStore.getState().handleError(String(err));
  });
}

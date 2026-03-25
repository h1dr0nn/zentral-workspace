import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "./chatStore";
import { useAgentStore } from "./agentStore";
import { useProjectStore } from "./projectStore";
import { discAgentId } from "@/lib/discussionRouter";
import {
  buildAgentSelectionPrompt,
  buildOpinionPrompt,
  buildConsensusCheckPrompt,
  buildConclusionPrompt,
  parseAgentSelection,
  parseConsensusCheck,
  type AgentOpinion,
} from "@/lib/discussionPrompts";

type DiscussionPhase =
  | "idle"
  | "selecting-agents"
  | "round-in-progress"
  | "checking-consensus"
  | "concluding"
  | "complete"
  | "error";

interface DiscussionSession {
  id: string;
  phase: DiscussionPhase;
  topic: string;
  model: string;
  selectedAgentIds: string[];
  currentRound: number;
  maxRounds: number;
  opinions: AgentOpinion[];
  currentAgentIndex: number;
  currentAgentId: string | null;
  currentMessageId: string | null;
}

interface DiscussionStore {
  session: DiscussionSession | null;
  zennisBuffer: string;

  startDiscussion: (topic: string, model: string) => void;
  handleZennisChunk: (text: string) => void;
  handleZennisDone: (fullText: string) => void;
  handleAgentDone: (fullText: string) => void;
  handleError: (error: string) => void;
  cancelDiscussion: () => void;
}

const MAX_ROUNDS = 3;
const ROOM_KEY = "discussion";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export const useDiscussionStore = create<DiscussionStore>((set, get) => ({
  session: null,
  zennisBuffer: "",

  startDiscussion: (topic, model) => {
    const session: DiscussionSession = {
      id: genId("disc"),
      phase: "selecting-agents",
      topic,
      model,
      selectedAgentIds: [],
      currentRound: 0,
      maxRounds: MAX_ROUNDS,
      opinions: [],
      currentAgentIndex: 0,
      currentAgentId: null,
      currentMessageId: null,
    };
    set({ session, zennisBuffer: "" });

    const chat = useChatStore.getState();
    chat.addSystemMessage(`**Discussion Started**\n\n"${topic}"`, ROOM_KEY);

    sendZennis(session, "selection");
  },

  handleZennisChunk: (text) => {
    const { session } = get();
    if (!session) return;

    if (session.phase === "concluding") {
      // Conclusion is plain text — stream to chat
      if (session.currentMessageId) {
        useChatStore.getState().setStreamContent("agent-zennis", session.currentMessageId, text, ROOM_KEY);
      }
    } else {
      // JSON phases — buffer silently
      set({ zennisBuffer: text });
    }
  },

  handleZennisDone: (fullText) => {
    const { session } = get();
    if (!session) return;
    const chat = useChatStore.getState();
    const agents = useAgentStore.getState().agents;

    switch (session.phase) {
      case "selecting-agents": {
        const selection = parseAgentSelection(fullText);
        if (!selection || selection.agentIds.length === 0) {
          chat.addSystemMessage("Zennis could not select agents for this discussion.", ROOM_KEY);
          set({ session: { ...session, phase: "error" }, zennisBuffer: "" });
          return;
        }

        // Validate agent IDs
        const validIds = selection.agentIds.filter((id) => agents.some((a) => a.id === id));
        if (validIds.length === 0) {
          chat.addSystemMessage("No valid agents found for this discussion.", ROOM_KEY);
          set({ session: { ...session, phase: "error" }, zennisBuffer: "" });
          return;
        }

        const names = validIds.map((id) => agents.find((a) => a.id === id)?.name ?? id).join(", ");
        chat.addSystemMessage(`Zennis invited ${names} to discuss`, ROOM_KEY);

        const updated: DiscussionSession = {
          ...session,
          phase: "round-in-progress",
          selectedAgentIds: validIds,
          currentRound: 1,
          currentAgentIndex: 0,
        };
        set({ session: updated, zennisBuffer: "" });
        sendNextAgent(updated);
        break;
      }

      case "checking-consensus": {
        const check = parseConsensusCheck(fullText);
        if (!check) {
          // Parse fail — force conclude
          chat.addSystemMessage("Zennis could not determine consensus. Concluding discussion.", ROOM_KEY);
          const concludeSession = { ...session, phase: "concluding" as const };
          set({ session: concludeSession, zennisBuffer: "" });
          sendZennis(concludeSession, "conclusion");
          return;
        }

        chat.addSystemMessage(check.summary, ROOM_KEY);

        if (check.consensus || session.currentRound >= session.maxRounds) {
          if (!check.consensus) {
            chat.addSystemMessage(`Max rounds (${session.maxRounds}) reached. Zennis is concluding.`, ROOM_KEY);
          }
          const concludeSession: DiscussionSession = {
            ...session,
            phase: "concluding",
            currentMessageId: null,
          };
          // Create streaming message for conclusion
          const msgId = genId("zennis-conclusion");
          chat.addAgentMessage("agent-zennis", msgId, "", ROOM_KEY);
          concludeSession.currentMessageId = msgId;
          set({ session: concludeSession, zennisBuffer: "" });
          sendZennis(concludeSession, "conclusion");
        } else {
          // More rounds
          const nextRound = session.currentRound + 1;
          chat.addSystemMessage(`Round ${nextRound} — agents responding to each other${check.nextRoundFocus ? `: ${check.nextRoundFocus}` : ""}`, ROOM_KEY);
          const roundSession: DiscussionSession = {
            ...session,
            phase: "round-in-progress",
            currentRound: nextRound,
            currentAgentIndex: 0,
          };
          set({ session: roundSession, zennisBuffer: "" });
          sendNextAgent(roundSession);
        }
        break;
      }

      case "concluding": {
        // Conclusion streamed directly — stop streaming and complete
        useChatStore.getState().stopStream("agent-zennis", ROOM_KEY);
        set({ session: { ...session, phase: "complete" }, zennisBuffer: "" });
        break;
      }

      default:
        break;
    }
  },

  handleAgentDone: (fullText) => {
    const { session } = get();
    if (!session || !session.currentAgentId) return;
    const agents = useAgentStore.getState().agents;
    const agent = agents.find((a) => a.id === session.currentAgentId);

    // Record opinion
    const opinion: AgentOpinion = {
      agentId: session.currentAgentId,
      agentName: agent?.name ?? session.currentAgentId,
      round: session.currentRound,
      opinion: fullText,
    };

    // Reset agent status + stop streaming
    useAgentStore.getState().updateStatus(session.currentAgentId, "idle");
    useChatStore.getState().stopStream(session.currentAgentId, ROOM_KEY);

    const updated: DiscussionSession = {
      ...session,
      opinions: [...session.opinions, opinion],
      currentAgentId: null,
      currentMessageId: null,
    };
    set({ session: updated });
    sendNextAgent(updated);
  },

  handleError: (error) => {
    const { session } = get();
    if (!session) return;
    if (session.currentAgentId) {
      useAgentStore.getState().updateStatus(session.currentAgentId, "idle");
    }
    useChatStore.getState().addSystemMessage(`Discussion error: ${error}`, ROOM_KEY);
    useChatStore.getState().stopStream("_cleanup", ROOM_KEY);
    set({ session: { ...session, phase: "error" }, zennisBuffer: "" });
  },

  cancelDiscussion: () => {
    const { session } = get();
    if (!session) return;
    if (session.currentAgentId) {
      useAgentStore.getState().updateStatus(session.currentAgentId, "idle");
    }
    useChatStore.getState().addSystemMessage("Discussion cancelled.", ROOM_KEY);
    useChatStore.getState().stopStream("_cleanup", ROOM_KEY);
    set({ session: { ...session, phase: "complete" }, zennisBuffer: "" });
  },
}));

/** Send a Zennis prompt for a specific phase */
function sendZennis(session: DiscussionSession, purpose: "selection" | "consensus" | "conclusion") {
  const agents = useAgentStore.getState().agents;
  const projectId = useProjectStore.getState().activeProjectId;
  const projectAgents = agents.filter(
    (a) => !a.isSecretary && (projectId == null || a.projectIds.length === 0 || a.projectIds.includes(projectId)),
  );

  let systemPrompt: string;
  let message: string;

  switch (purpose) {
    case "selection":
      systemPrompt = buildAgentSelectionPrompt(projectAgents, session.topic);
      message = session.topic;
      break;
    case "consensus":
      systemPrompt = buildConsensusCheckPrompt(session.topic, session.opinions, session.currentRound);
      message = `Check consensus for round ${session.currentRound}`;
      break;
    case "conclusion":
      systemPrompt = buildConclusionPrompt(
        session.topic,
        session.opinions,
        session.opinions.length > 0 ? "See opinions above" : "No opinions collected",
      );
      message = `Write the final conclusion for: ${session.topic}`;
      break;
  }

  invoke("send_chat_message", {
    agentId: discAgentId("zennis", session.id),
    messageId: genId("disc-zennis"),
    message,
    systemPrompt,
    model: session.model,
  }).catch((err) => {
    useDiscussionStore.getState().handleError(String(err));
  });
}

/** Send the next agent in the round, or transition to consensus check */
function sendNextAgent(session: DiscussionSession) {
  if (session.currentAgentIndex >= session.selectedAgentIds.length) {
    // All agents done this round → check consensus
    const consensusSession: DiscussionSession = {
      ...session,
      phase: "checking-consensus",
      currentAgentIndex: 0,
    };
    useDiscussionStore.setState({ session: consensusSession, zennisBuffer: "" });
    sendZennis(consensusSession, "consensus");
    return;
  }

  const agentId = session.selectedAgentIds[session.currentAgentIndex];
  const agents = useAgentStore.getState().agents;
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    // Skip invalid agent
    const skipped = { ...session, currentAgentIndex: session.currentAgentIndex + 1 };
    useDiscussionStore.setState({ session: skipped });
    sendNextAgent(skipped);
    return;
  }

  // Previous opinions for context
  const prevOpinions = session.opinions
    .filter((o) => !(o.agentId === agentId && o.round === session.currentRound)) // exclude own current round
    .map((o) => ({ name: o.agentName, opinion: o.opinion }));

  const systemPrompt = buildOpinionPrompt(
    agent.name,
    agent.role,
    session.topic,
    prevOpinions,
    session.currentRound,
  );

  const msgId = genId("disc-agent");

  // Create streaming message in chat
  const chat = useChatStore.getState();
  chat.addAgentMessage(agentId, msgId, "", ROOM_KEY);

  useAgentStore.getState().updateStatus(agentId, "running");

  const updated: DiscussionSession = {
    ...session,
    currentAgentId: agentId,
    currentMessageId: msgId,
    currentAgentIndex: session.currentAgentIndex + 1,
  };
  useDiscussionStore.setState({ session: updated });

  invoke("send_chat_message", {
    agentId: discAgentId(agentId, session.id),
    messageId: msgId,
    message: session.topic,
    systemPrompt,
    model: session.model,
  }).catch((err) => {
    useDiscussionStore.getState().handleError(String(err));
  });
}

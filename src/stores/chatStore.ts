import { create } from "zustand";
import { useProjectStore } from "./projectStore";

export interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "agent" | "system" | "delegation";
  content: string;
  timestamp: number;
  source?: "local" | "telegram";
  isStreaming?: boolean;
}

// Chat key = "projectId:agentId" — each project has its own chat per agent
function chatKey(projectId: string | null, agentId: string): string {
  return `${projectId ?? "none"}:${agentId}`;
}

interface ChatState {
  messagesByKey: Record<string, ChatMessage[]>;
  streamingByKey: Record<string, boolean>;
  activeAgentId: string | null;

  setActiveAgent: (agentId: string) => void;
  sendMessage: (agentId: string, content: string, role?: ChatMessage["role"], source?: ChatMessage["source"]) => void;
  appendStreamChunk: (agentId: string, messageId: string, chunk: string) => void;
  stopStream: (agentId: string) => void;
  setMessages: (agentId: string, messages: ChatMessage[]) => void;

  // Derived helpers
  getMessages: (agentId: string) => ChatMessage[];
  getIsStreaming: (agentId: string) => boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByKey: {},
  streamingByKey: {},
  activeAgentId: "general",

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  getMessages: (agentId) => {
    const projectId = useProjectStore.getState().activeProjectId;
    return get().messagesByKey[chatKey(projectId, agentId)] || [];
  },

  getIsStreaming: (agentId) => {
    const projectId = useProjectStore.getState().activeProjectId;
    return get().streamingByKey[chatKey(projectId, agentId)] || false;
  },

  sendMessage: (agentId, content, role = "user", source = "local") =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, agentId);
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        agentId,
        role,
        content,
        timestamp: Date.now(),
        source,
      };
      const existing = state.messagesByKey[key] || [];
      return {
        messagesByKey: {
          ...state.messagesByKey,
          [key]: [...existing, newMessage],
        },
      };
    }),

  appendStreamChunk: (agentId, messageId, chunk) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, agentId);
      const messages = state.messagesByKey[key] || [];
      const messageExists = messages.some((m) => m.id === messageId);

      let updatedMessages;
      if (messageExists) {
        updatedMessages = messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: msg.content + chunk, isStreaming: true }
            : msg
        );
      } else {
        updatedMessages = [
          ...messages,
          { id: messageId, agentId, role: "agent" as const, content: chunk, timestamp: Date.now(), isStreaming: true },
        ];
      }

      return {
        messagesByKey: { ...state.messagesByKey, [key]: updatedMessages },
        streamingByKey: { ...state.streamingByKey, [key]: true },
      };
    }),

  stopStream: (agentId) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, agentId);
      const messages = state.messagesByKey[key] || [];
      const updated = messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      );
      return {
        streamingByKey: { ...state.streamingByKey, [key]: false },
        messagesByKey: { ...state.messagesByKey, [key]: updated },
      };
    }),

  setMessages: (agentId, messages) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, agentId);
      return {
        messagesByKey: { ...state.messagesByKey, [key]: messages },
      };
    }),
}));

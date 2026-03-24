import { create } from "zustand";

export interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  isStreaming: boolean;
}

interface ChatStore {
  messagesByAgent: Record<string, ChatMessage[]>;
  streamingAgentIds: Set<string>;
  inputDraft: string;

  addMessage: (agentId: string, message: ChatMessage) => void;
  appendToStream: (agentId: string, messageId: string, chunk: string) => void;
  finalizeStream: (agentId: string, messageId: string) => void;
  setInputDraft: (text: string) => void;
  clearMessages: (agentId: string) => void;
  getMessagesForAgent: (agentId: string) => ChatMessage[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messagesByAgent: {},
  streamingAgentIds: new Set(),
  inputDraft: "",

  addMessage: (agentId, message) =>
    set((s) => ({
      messagesByAgent: {
        ...s.messagesByAgent,
        [agentId]: [...(s.messagesByAgent[agentId] || []), message],
      },
    })),
  appendToStream: (agentId, messageId, chunk) =>
    set((s) => ({
      messagesByAgent: {
        ...s.messagesByAgent,
        [agentId]: (s.messagesByAgent[agentId] || []).map((m) =>
          m.id === messageId ? { ...m, content: m.content + chunk } : m,
        ),
      },
    })),
  finalizeStream: (agentId, messageId) =>
    set((s) => {
      const newStreaming = new Set(s.streamingAgentIds);
      newStreaming.delete(agentId);
      return {
        streamingAgentIds: newStreaming,
        messagesByAgent: {
          ...s.messagesByAgent,
          [agentId]: (s.messagesByAgent[agentId] || []).map((m) =>
            m.id === messageId ? { ...m, isStreaming: false } : m,
          ),
        },
      };
    }),
  setInputDraft: (text) => set({ inputDraft: text }),
  clearMessages: (agentId) =>
    set((s) => ({
      messagesByAgent: { ...s.messagesByAgent, [agentId]: [] },
    })),
  getMessagesForAgent: (agentId) => get().messagesByAgent[agentId] || [],
}));

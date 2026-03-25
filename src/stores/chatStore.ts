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

import { autoSave } from "./persist";

function loadMessages(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem("zentral:chat-messages");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    for (const key of Object.keys(parsed)) {
      parsed[key] = parsed[key].map((m: ChatMessage) => ({ ...m, isStreaming: false }));
    }
    return parsed;
  } catch {
    return {};
  }
}

export type RoomMode = "command" | "discussion";

interface ChatState {
  messagesByKey: Record<string, ChatMessage[]>;
  streamingByKey: Record<string, boolean>;
  memoryEnabled: boolean;
  roomMode: RoomMode;
  activeAgentId: string | null;

  setActiveAgent: (agentId: string) => void;
  setMemoryEnabled: (enabled: boolean) => void;
  setRoomMode: (mode: RoomMode) => void;
  sendMessage: (agentId: string, content: string, role?: ChatMessage["role"], source?: ChatMessage["source"]) => void;
  appendStreamChunk: (agentId: string, messageId: string, chunk: string, chatKeyOverride?: string) => void;
  setStreamContent: (agentId: string, messageId: string, content: string, chatKeyOverride?: string) => void;
  stopStream: (agentId: string, chatKeyOverride?: string) => void;
  setMessages: (agentId: string, messages: ChatMessage[]) => void;

  // Room helpers — target "command" or "discussion" chat key
  addSystemMessage: (content: string, roomKey?: string) => void;
  addAgentMessage: (agentId: string, messageId: string, content: string, roomKey?: string) => void;

  // Derived helpers
  getMessages: (agentId: string) => ChatMessage[];
  getIsStreaming: (agentId: string) => boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByKey: loadMessages(),
  streamingByKey: {},
  memoryEnabled: true,
  roomMode: "command",
  activeAgentId: "command",

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
  setRoomMode: (mode) => set({ roomMode: mode }),

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

  appendStreamChunk: (agentId, messageId, chunk, chatKeyOverride) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKeyOverride ? chatKey(projectId, chatKeyOverride) : chatKey(projectId, agentId);
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

  setStreamContent: (agentId, messageId, content, chatKeyOverride) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKeyOverride ? chatKey(projectId, chatKeyOverride) : chatKey(projectId, agentId);
      const messages = state.messagesByKey[key] || [];
      const messageExists = messages.some((m) => m.id === messageId);

      let updatedMessages;
      if (messageExists) {
        updatedMessages = messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, content, isStreaming: true }
            : msg
        );
      } else {
        updatedMessages = [
          ...messages,
          { id: messageId, agentId, role: "agent" as const, content, timestamp: Date.now(), isStreaming: true },
        ];
      }

      return {
        messagesByKey: { ...state.messagesByKey, [key]: updatedMessages },
        streamingByKey: { ...state.streamingByKey, [key]: true },
      };
    }),

  stopStream: (agentId, chatKeyOverride) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKeyOverride ? chatKey(projectId, chatKeyOverride) : chatKey(projectId, agentId);
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

  addSystemMessage: (content, roomKey) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, roomKey ?? state.activeAgentId ?? "command");
      const existing = state.messagesByKey[key] || [];
      const msg: ChatMessage = {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        agentId: "system",
        role: "delegation",
        content,
        timestamp: Date.now(),
      };
      return { messagesByKey: { ...state.messagesByKey, [key]: [...existing, msg] } };
    }),

  addAgentMessage: (agentId, messageId, content, roomKey) =>
    set((state) => {
      const projectId = useProjectStore.getState().activeProjectId;
      const key = chatKey(projectId, roomKey ?? state.activeAgentId ?? "command");
      const existing = state.messagesByKey[key] || [];
      const isPlaceholder = !content;
      const msg: ChatMessage = {
        id: messageId,
        agentId,
        role: "agent",
        content,
        timestamp: Date.now(),
        isStreaming: isPlaceholder,
      };
      return {
        messagesByKey: { ...state.messagesByKey, [key]: [...existing, msg] },
        // Set streamingByKey so "Thinking…" shows and UI knows streaming is active
        ...(isPlaceholder ? { streamingByKey: { ...state.streamingByKey, [key]: true } } : {}),
      };
    }),
}));

autoSave(useChatStore, "zentral:chat-messages", (s) => s.messagesByKey);

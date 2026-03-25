import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
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

  // Room helpers
  addSystemMessage: (content: string, roomKey?: string) => void;
  addAgentMessage: (agentId: string, messageId: string, content: string, roomKey?: string) => void;

  // Derived helpers
  getMessages: (agentId: string) => ChatMessage[];
  getIsStreaming: (agentId: string) => boolean;

  // SQLite persistence
  loadMessages: (projectId: string, agentId: string) => Promise<void>;
  persistMessage: (chatKeyStr: string, message: ChatMessage) => Promise<void>;
}

function toRow(chatKeyStr: string, m: ChatMessage) {
  return {
    id: m.id,
    chat_key: chatKeyStr,
    agent_id: m.agentId,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    source: m.source ?? "local",
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByKey: {},
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

  loadMessages: async (projectId, agentId) => {
    const key = chatKey(projectId, agentId);
    // Skip if already loaded
    if (get().messagesByKey[key]?.length) return;
    try {
      const rows: any[] = await invoke("get_chat_messages", { chatKey: key });
      const messages: ChatMessage[] = rows.map((r) => ({
        id: r.id,
        agentId: r.agent_id,
        role: r.role,
        content: r.content,
        timestamp: r.timestamp,
        source: r.source,
        isStreaming: false,
      }));
      if (messages.length) {
        set((s) => ({
          messagesByKey: { ...s.messagesByKey, [key]: messages },
        }));
      }
    } catch (err) {
      console.error("Failed to load chat messages:", err);
    }
  },

  persistMessage: async (chatKeyStr, message) => {
    try {
      await invoke("save_chat_message", { message: toRow(chatKeyStr, message) });
    } catch (err) {
      console.error("Failed to persist chat message:", err);
    }
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
      // Persist user message to SQLite
      get().persistMessage(key, newMessage);
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
      // Persist the final agent message to SQLite
      const agentMsg = updated.find((m) => m.isStreaming === false && m.role === "agent" && messages.some((om) => om.id === m.id && om.isStreaming));
      if (agentMsg) {
        get().persistMessage(key, agentMsg);
      }
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
      // Persist system message
      get().persistMessage(key, msg);
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
        ...(isPlaceholder ? { streamingByKey: { ...state.streamingByKey, [key]: true } } : {}),
      };
    }),
}));

import { create } from "zustand";

export interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "agent" | "system" | "delegation";
  content: string;
  timestamp: number;
  source?: "local" | "telegram";
  isStreaming?: boolean;
}

interface ChatState {
  messagesByAgent: Record<string, ChatMessage[]>;
  streamingByAgent: Record<string, boolean>;
  activeAgentId: string | null;

  // Actions
  setActiveAgent: (agentId: string) => void;
  sendMessage: (agentId: string, content: string, role?: ChatMessage["role"], source?: ChatMessage["source"]) => void;
  appendStreamChunk: (agentId: string, messageId: string, chunk: string) => void;
  stopStream: (agentId: string) => void;
  setMessages: (agentId: string, messages: ChatMessage[]) => void;
}

// Mock initial data to test the UI
const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  "agent-secretary": [
    {
      id: "msg-1",
      agentId: "agent-secretary",
      role: "system",
      content: "Session started securely.",
      timestamp: Date.now() - 1000 * 60 * 60,
    },
    {
      id: "msg-2",
      agentId: "agent-secretary",
      role: "agent",
      content: "Hello! I am your Secretary. How can I help you today?",
      timestamp: Date.now() - 1000 * 60 * 5,
    },
    {
      id: "msg-2-1",
      agentId: "agent-secretary",
      role: "user",
      content: "Can you run the test suite please?",
      timestamp: Date.now() - 1000 * 60 * 4,
    },
    {
      id: "msg-2-2",
      agentId: "agent-secretary",
      role: "delegation",
      content: "Delegated to QA Lead",
      timestamp: Date.now() - 1000 * 60 * 3,
    },
    {
      id: "msg-2-3",
      agentId: "agent-qa",
      role: "agent",
      content: "Running tests now...\n```bash\nPASS src/app.test.ts\nTests: 5 passed, 5 total\n```",
      timestamp: Date.now() - 1000 * 60 * 2,
    }
  ],
  "agent-qa": [
    {
      id: "msg-3",
      agentId: "agent-qa",
      role: "agent",
      content: "QA Lead ready. Waiting for task delegation.",
      timestamp: Date.now() - 1000 * 60 * 10,
    },
  ],
  "general": [
    {
      id: "gen-1",
      agentId: "agent-secretary",
      role: "agent",
      content: "Welcome to the Project General Room. All agents can coordinate here.",
      timestamp: Date.now() - 1000 * 60 * 30,
    },
    {
      id: "gen-2",
      agentId: "agent-qa",
      role: "agent",
      content: "QA Lead joined.",
      timestamp: Date.now() - 1000 * 60 * 25,
    }
  ]
};

export const useChatStore = create<ChatState>((set) => ({
  messagesByAgent: MOCK_MESSAGES,
  streamingByAgent: {},
  activeAgentId: "general", // Default to general room

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  sendMessage: (agentId, content, role = "user", source = "local") => 
    set((state) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        agentId,
        role,
        content,
        timestamp: Date.now(),
        source,
      };
      
      const existingMessages = state.messagesByAgent[agentId] || [];
      
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: [...existingMessages, newMessage],
        },
      };
    }),

  appendStreamChunk: (agentId, messageId, chunk) =>
    set((state) => {
      const messages = state.messagesByAgent[agentId] || [];
      // If message doesn't exist, we should probably create it. For simplicity, assume it exists.
      const messageExists = messages.some(m => m.id === messageId);
      
      let updatedMessages;
      if (messageExists) {
        updatedMessages = messages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, content: msg.content + chunk, isStreaming: true };
          }
          return msg;
        });
      } else {
        const newMsg: ChatMessage = {
          id: messageId,
          agentId,
          role: "agent",
          content: chunk,
          timestamp: Date.now(),
          isStreaming: true
        };
        updatedMessages = [...messages, newMsg];
      }

      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: updatedMessages,
        },
        streamingByAgent: {
          ...state.streamingByAgent,
          [agentId]: true,
        }
      };
    }),

  stopStream: (agentId) =>
    set((state) => {
      const messages = state.messagesByAgent[agentId] || [];
      const updatedMessages = messages.map((msg) => {
        if (msg.isStreaming) {
          return { ...msg, isStreaming: false };
        }
        return msg;
      });

      return {
        streamingByAgent: { ...state.streamingByAgent, [agentId]: false },
        messagesByAgent: { ...state.messagesByAgent, [agentId]: updatedMessages },
      };
    }),

  setMessages: (agentId, messages) =>
    set((state) => ({
      messagesByAgent: {
        ...state.messagesByAgent,
        [agentId]: messages,
      },
    })),
}));

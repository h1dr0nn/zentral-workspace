import { create } from "zustand";

export interface TelegramMessage {
  id: number;
  chatId: number;
  text: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
}

interface TelegramStore {
  isConnected: boolean;
  messages: TelegramMessage[];

  setConnected: (connected: boolean) => void;
  addMessage: (message: TelegramMessage) => void;
  clearMessages: () => void;
}

export const useTelegramStore = create<TelegramStore>((set) => ({
  isConnected: false,
  messages: [],

  setConnected: (connected) => set({ isConnected: connected }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));

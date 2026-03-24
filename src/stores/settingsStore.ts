import { create } from "zustand";

export interface Settings {
  theme: "light" | "dark" | "system";
  fontFamily: string;
  fontSize: number;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  defaultModel: string;
  defaultMaxTokens: number;
}

interface SettingsStore {
  settings: Settings;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const defaultSettings: Settings = {
  theme: "dark",
  fontFamily: "Inter",
  fontSize: 14,
  telegramBotToken: "",
  telegramChatId: "",
  telegramEnabled: false,
  defaultModel: "claude-sonnet-4-20250514",
  defaultMaxTokens: 8192,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    // TODO: invoke("get_settings") from Rust
    set({ isLoaded: true });
  },
  updateSettings: async (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    // TODO: invoke("update_settings", patch) to Rust
  },
  resetToDefaults: async () => {
    set({ settings: defaultSettings });
    // TODO: invoke("update_settings", defaultSettings) to Rust
  },
}));

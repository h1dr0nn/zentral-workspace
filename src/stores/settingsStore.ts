import { create } from "zustand";

export interface Settings {
  // General
  theme: string;
  fontSize: number;
  chatFontSize: number;
  defaultShell: string;

  // Agents
  maxConcurrentAgents: number;
  defaultAgentTimeout: number;
  autoRestartOnCrash: boolean;
  crashLoopThreshold: number;

  // Telegram
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramAllowedChatIds: string;

  // Chat
  chatTokenBudget: number;

  // Advanced
  chatRetention: "all" | "30days" | "7days";
  claudeCliPath: string;
}

interface SettingsStore {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetToDefaults: () => void;
}

const DEFAULTS: Settings = {
  theme: "",
  fontSize: 14,
  chatFontSize: 14,
  defaultShell: navigator.platform.includes("Win") ? "powershell.exe" : "/bin/bash",
  maxConcurrentAgents: 5,
  defaultAgentTimeout: 30,
  autoRestartOnCrash: true,
  crashLoopThreshold: 3,
  telegramEnabled: false,
  telegramBotToken: "",
  telegramAllowedChatIds: "",
  chatTokenBudget: 4000,
  chatRetention: "all",
  claudeCliPath: "",
};

function load(): Settings {
  try {
    const raw = localStorage.getItem("zentral:settings");
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: Settings) {
  try { localStorage.setItem("zentral:settings", JSON.stringify(settings)); } catch { /* quota exceeded */ }
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: load(),

  update: (key, value) => {
    const updated = { ...get().settings, [key]: value };
    set({ settings: updated });
    save(updated);
  },

  resetToDefaults: () => {
    set({ settings: { ...DEFAULTS } });
    save({ ...DEFAULTS });
  },
}));

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
  isLoaded: boolean;
  initialize: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
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

function fromBackend(raw: any): Settings {
  return {
    theme: raw.theme ?? DEFAULTS.theme,
    fontSize: raw.font_size ?? DEFAULTS.fontSize,
    chatFontSize: raw.chat_font_size ?? DEFAULTS.chatFontSize,
    defaultShell: raw.default_shell || DEFAULTS.defaultShell,
    maxConcurrentAgents: raw.max_concurrent_agents ?? DEFAULTS.maxConcurrentAgents,
    defaultAgentTimeout: raw.default_agent_timeout ?? DEFAULTS.defaultAgentTimeout,
    autoRestartOnCrash: raw.auto_restart_on_crash ?? DEFAULTS.autoRestartOnCrash,
    crashLoopThreshold: raw.crash_loop_threshold ?? DEFAULTS.crashLoopThreshold,
    telegramEnabled: raw.telegram_enabled ?? DEFAULTS.telegramEnabled,
    telegramBotToken: raw.telegram_bot_token ?? DEFAULTS.telegramBotToken,
    telegramAllowedChatIds: raw.telegram_allowed_chat_ids ?? DEFAULTS.telegramAllowedChatIds,
    chatTokenBudget: raw.chat_token_budget ?? DEFAULTS.chatTokenBudget,
    chatRetention: raw.chat_retention ?? DEFAULTS.chatRetention,
    claudeCliPath: raw.claude_cli_path ?? DEFAULTS.claudeCliPath,
  };
}

function toBackend(s: Settings) {
  return {
    theme: s.theme,
    font_size: s.fontSize,
    chat_font_size: s.chatFontSize,
    default_shell: s.defaultShell,
    max_concurrent_agents: s.maxConcurrentAgents,
    default_agent_timeout: s.defaultAgentTimeout,
    auto_restart_on_crash: s.autoRestartOnCrash,
    crash_loop_threshold: s.crashLoopThreshold,
    telegram_enabled: s.telegramEnabled,
    telegram_bot_token: s.telegramBotToken,
    telegram_allowed_chat_ids: s.telegramAllowedChatIds,
    chat_token_budget: s.chatTokenBudget,
    chat_retention: s.chatRetention,
    claude_cli_path: s.claudeCliPath,
  };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULTS },
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("get_settings");
      const settings = fromBackend(raw);
      set({ settings, isLoaded: true });
    } catch (err) {
      console.error("Failed to load settings from SQLite:", err);
      set({ isLoaded: true });
    }
  },

  update: async (key, value) => {
    const updated = { ...get().settings, [key]: value };
    set({ settings: updated });
    try {
      await invoke("update_settings", { settings: toBackend(updated) });
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  },

  resetToDefaults: async () => {
    set({ settings: { ...DEFAULTS } });
    try {
      await invoke("update_settings", { settings: toBackend(DEFAULTS) });
    } catch (err) {
      console.error("Failed to reset settings:", err);
    }
  },
}));

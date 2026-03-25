import type { LucideIcon } from "lucide-react";
import {
  FolderOpen,
  Bot,
  Plus,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Settings,
  Moon,
  Trash2,
  MessageCircle,
} from "lucide-react";

export type CommandCategory =
  | "Navigation"
  | "Agents"
  | "View"
  | "General"
  | "Chat"
  | "Telegram";

export interface CommandAction {
  id: string;
  label: string;
  category: CommandCategory;
  shortcut?: string;
  icon?: LucideIcon;
  keywords?: string[];
}

export const COMMAND_ACTIONS: CommandAction[] = [
  // Navigation
  { id: "switch-project", label: "Switch Project", category: "Navigation", icon: FolderOpen },
  { id: "go-to-agent", label: "Go to Agent", category: "Navigation", shortcut: "Ctrl+Tab", icon: Bot },

  // Agents
  { id: "new-agent", label: "New Agent", category: "Agents", shortcut: "Ctrl+Shift+N", icon: Plus },

  // View
  { id: "toggle-left-sidebar", label: "Toggle Left Sidebar", category: "View", shortcut: "Ctrl+B", icon: PanelLeft },
  { id: "toggle-terminal", label: "Toggle Terminal", category: "View", shortcut: "Ctrl+`", icon: PanelBottom },
  { id: "toggle-right-sidebar", label: "Toggle Right Sidebar", category: "View", shortcut: "Ctrl+Shift+B", icon: PanelRight },

  // General
  { id: "open-settings", label: "Open Settings", category: "General", shortcut: "Ctrl+,", icon: Settings },
  { id: "toggle-theme", label: "Toggle Theme", category: "General", icon: Moon, keywords: ["dark", "light"] },

  // Chat
  { id: "clear-chat", label: "Clear Chat History", category: "Chat", icon: Trash2 },

  // Telegram
  { id: "connect-telegram", label: "Connect Telegram Bot", category: "Telegram", icon: MessageCircle },
];

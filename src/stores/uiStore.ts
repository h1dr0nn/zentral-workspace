import { create } from "zustand";

interface UiStore {
  leftSidebarOpen: boolean;
  terminalOpen: boolean;
  rightSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  settingsModalOpen: boolean;
  agentCreationDialogOpen: boolean;
  activeTab: string;
  recentActionIds: string[];
  chatLayout: "aligned" | "bubbles";

  setLeftSidebarOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleTerminal: () => void;
  toggleRightSidebar: () => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAgentCreationDialogOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  addRecentAction: (id: string) => void;
  setChatLayout: (layout: "aligned" | "bubbles") => void;
}

export const useUiStore = create<UiStore>((set) => ({
  leftSidebarOpen: true,
  terminalOpen: false,
  rightSidebarOpen: true,
  commandPaletteOpen: false,
  settingsModalOpen: false,
  agentCreationDialogOpen: false,
  activeTab: "projects",
  recentActionIds: (() => { try { return JSON.parse(localStorage.getItem("zentral:recent-actions") || "[]"); } catch { return []; } })(),
  chatLayout: (() => { try { return (localStorage.getItem("zentral:chat-layout") as "aligned" | "bubbles") || "aligned"; } catch { return "aligned" as const; } })(),

  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setAgentCreationDialogOpen: (open) => set({ agentCreationDialogOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setChatLayout: (layout) => {
    localStorage.setItem("zentral:chat-layout", layout);
    set({ chatLayout: layout });
  },
  addRecentAction: (id) =>
    set((s) => {
      const updated = [id, ...s.recentActionIds.filter((a) => a !== id)].slice(0, 10);
      localStorage.setItem("zentral:recent-actions", JSON.stringify(updated));
      return { recentActionIds: updated };
    }),
}));

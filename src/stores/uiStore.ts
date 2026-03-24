import { create } from "zustand";

interface UiStore {
  leftSidebarOpen: boolean;
  terminalOpen: boolean;
  rightSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  settingsModalOpen: boolean;
  agentCreationDialogOpen: boolean;

  toggleLeftSidebar: () => void;
  toggleTerminal: () => void;
  toggleRightSidebar: () => void;
  toggleCommandPalette: () => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAgentCreationDialogOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  leftSidebarOpen: true,
  terminalOpen: false,
  rightSidebarOpen: true,
  commandPaletteOpen: false,
  settingsModalOpen: false,
  agentCreationDialogOpen: false,

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setAgentCreationDialogOpen: (open) => set({ agentCreationDialogOpen: open }),
}));

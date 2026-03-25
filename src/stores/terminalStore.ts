import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useUiStore } from "./uiStore";

interface TerminalTab {
  id: string;
  title: string;
}

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  nextTabNumber: number;

  addTab: () => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  nextTabNumber: 1,

  addTab: () => {
    const n = get().nextTabNumber;
    const id = `term-${n}`;
    const tab: TerminalTab = { id, title: `Terminal ${n}` };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
      nextTabNumber: s.nextTabNumber + 1,
    }));
    return id;
  },

  removeTab: (id) => {
    // Kill the PTY process for this tab
    invoke("pty_kill", { id }).catch(() => {});

    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const next = tabs.filter((t) => t.id !== id);

    if (next.length === 0) {
      set({ tabs: [], activeTabId: null });
      useUiStore.getState().toggleTerminal();
      return;
    }

    let newActive = activeTabId;
    if (activeTabId === id) {
      const newIdx = Math.min(idx, next.length - 1);
      newActive = next[newIdx].id;
    }

    set({ tabs: next, activeTabId: newActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),
}));

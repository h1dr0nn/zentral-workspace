import { create } from "zustand";
import { loadArray, autoSave } from "./persist";

export type HistoryEventType =
  | "skill_run"
  | "agent_start"
  | "agent_stop"
  | "workflow_run"
  | "schedule_trigger"
  | "error";

export type HistoryEventStatus = "success" | "failure" | "running" | "cancelled";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  agentId: string;
  projectId: string | null;
  skillId: string | null;
  workflowId: string | null;
  summary: string;
  details: string | null;
  status: HistoryEventStatus;
  duration: number | null;
  timestamp: string;
}

export interface HistoryFilter {
  agentId: string | null;
  projectId: string | null;
  type: HistoryEventType | null;
  status: HistoryEventStatus | null;
  search: string;
}

interface HistoryStore {
  events: HistoryEvent[];
  filter: HistoryFilter;
  addEvent: (event: Omit<HistoryEvent, "id">) => void;
  clearHistory: () => void;
  setFilter: (patch: Partial<HistoryFilter>) => void;
  resetFilter: () => void;
}

const DEFAULT_FILTER: HistoryFilter = {
  agentId: null,
  projectId: null,
  type: null,
  status: null,
  search: "",
};

export const useHistoryStore = create<HistoryStore>((set) => ({
  events: loadArray<HistoryEvent>("zentral:history"),
  filter: DEFAULT_FILTER,

  addEvent: (event) => {
    const id = `evt-${Date.now()}`;
    set((s) => ({ events: [{ ...event, id }, ...s.events] }));
  },

  clearHistory: () => set({ events: [] }),

  setFilter: (patch) =>
    set((s) => ({ filter: { ...s.filter, ...patch } })),

  resetFilter: () => set({ filter: DEFAULT_FILTER }),
}));

autoSave(useHistoryStore, "zentral:history", (s) => s.events);

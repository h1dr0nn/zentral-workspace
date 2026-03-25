import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addEvent: (event: Omit<HistoryEvent, "id">) => Promise<void>;
  clearHistory: () => Promise<void>;
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

function normalize(raw: any): HistoryEvent {
  return {
    id: raw.id,
    type: (raw.event_type ?? raw.type) as HistoryEventType,
    agentId: raw.agent_id ?? raw.agentId,
    projectId: raw.project_id ?? raw.projectId ?? null,
    skillId: raw.skill_id ?? raw.skillId ?? null,
    workflowId: raw.workflow_id ?? raw.workflowId ?? null,
    summary: raw.summary,
    details: raw.details ?? null,
    status: raw.status as HistoryEventStatus,
    duration: raw.duration ?? null,
    timestamp: raw.timestamp,
  };
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  events: [],
  filter: DEFAULT_FILTER,
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_history", {
        filter: {
          agent_id: null,
          project_id: null,
          event_type: null,
          status: null,
          limit: 500,
          offset: 0,
        },
      });
      set({ events: (raw as any[]).map(normalize), isLoaded: true });
    } catch (err) {
      console.error("Failed to load history:", err);
      set({ isLoaded: true });
    }
  },

  addEvent: async (event) => {
    try {
      const raw = await invoke("add_history_event", {
        event: {
          id: "",
          event_type: event.type,
          agent_id: event.agentId,
          project_id: event.projectId,
          skill_id: event.skillId,
          workflow_id: event.workflowId,
          summary: event.summary,
          details: event.details,
          status: event.status,
          duration: event.duration,
          timestamp: event.timestamp || new Date().toISOString(),
        },
      });
      const created = normalize(raw);
      set((s) => ({ events: [created, ...s.events] }));
    } catch (err) {
      console.error("Failed to add history event:", err);
    }
  },

  clearHistory: async () => {
    try {
      await invoke("clear_history");
      set({ events: [] });
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  },

  setFilter: (patch) =>
    set((s) => ({ filter: { ...s.filter, ...patch } })),

  resetFilter: () => set({ filter: DEFAULT_FILTER }),
}));

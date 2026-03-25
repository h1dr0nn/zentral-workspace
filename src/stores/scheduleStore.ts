import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ScheduleStatus = "active" | "paused" | "disabled";

export interface Schedule {
  id: string;
  name: string;
  agentId: string;
  skillId: string;
  projectId: string | null;
  frequency: ScheduleFrequency;
  cronExpression: string;
  prompt: string;
  description: string;
  status: ScheduleStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
}

interface ScheduleStore {
  schedules: Schedule[];
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addSchedule: (schedule: Omit<Schedule, "id" | "createdAt">) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  updateSchedule: (id: string, patch: Partial<Schedule>) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
}

function normalize(raw: any): Schedule {
  return {
    id: raw.id,
    name: raw.name,
    agentId: raw.agent_id ?? raw.agentId,
    skillId: raw.skill_id ?? raw.skillId,
    projectId: raw.project_id ?? raw.projectId ?? null,
    frequency: raw.frequency as ScheduleFrequency,
    cronExpression: raw.cron_expression ?? raw.cronExpression ?? "",
    prompt: raw.prompt ?? "",
    description: raw.description ?? "",
    status: raw.status as ScheduleStatus,
    nextRunAt: raw.next_run_at ?? raw.nextRunAt ?? "",
    lastRunAt: raw.last_run_at ?? raw.lastRunAt ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? "",
  };
}

function toDto(s: Schedule) {
  return {
    id: s.id,
    name: s.name,
    agent_id: s.agentId,
    skill_id: s.skillId,
    project_id: s.projectId,
    frequency: s.frequency,
    cron_expression: s.cronExpression,
    prompt: s.prompt,
    description: s.description,
    status: s.status,
    next_run_at: s.nextRunAt,
    last_run_at: s.lastRunAt,
    created_at: s.createdAt,
  };
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_schedules");
      set({ schedules: (raw as any[]).map(normalize), isLoaded: true });
    } catch (err) {
      console.error("Failed to load schedules:", err);
      set({ isLoaded: true });
    }
  },

  addSchedule: async (schedule) => {
    try {
      const raw = await invoke("create_schedule", { schedule: toDto({ ...schedule, id: "", createdAt: "" } as Schedule) });
      set((s) => ({ schedules: [...s.schedules, normalize(raw)] }));
    } catch (err) {
      console.error("Failed to create schedule:", err);
    }
  },

  removeSchedule: async (id) => {
    try {
      await invoke("delete_schedule", { id });
      set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) }));
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  },

  updateSchedule: async (id, patch) => {
    const current = get().schedules.find((s) => s.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    try {
      await invoke("update_schedule", { schedule: toDto(updated) });
      set((s) => ({
        schedules: s.schedules.map((sc) => (sc.id === id ? updated : sc)),
      }));
    } catch (err) {
      console.error("Failed to update schedule:", err);
    }
  },

  toggleStatus: async (id) => {
    try {
      const raw = await invoke("toggle_schedule_status", { id });
      const toggled = normalize(raw);
      set((s) => ({
        schedules: s.schedules.map((sc) => (sc.id === id ? toggled : sc)),
      }));
    } catch (err) {
      console.error("Failed to toggle schedule:", err);
    }
  },
}));

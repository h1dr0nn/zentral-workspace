import { create } from "zustand";

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
  addSchedule: (schedule: Omit<Schedule, "id" | "createdAt">) => void;
  removeSchedule: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<Schedule>) => void;
  toggleStatus: (id: string) => void;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  schedules: [],

  addSchedule: (schedule) => {
    const id = `sched-${Date.now()}`;
    set((s) => ({
      schedules: [...s.schedules, { ...schedule, id, createdAt: new Date().toISOString() }],
    }));
  },

  removeSchedule: (id) =>
    set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) })),

  updateSchedule: (id, patch) =>
    set((s) => ({
      schedules: s.schedules.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
    })),

  toggleStatus: (id) =>
    set((s) => ({
      schedules: s.schedules.map((sc) =>
        sc.id === id
          ? { ...sc, status: sc.status === "active" ? "paused" : "active" }
          : sc
      ),
    })),
}));

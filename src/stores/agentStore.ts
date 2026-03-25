import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type AgentStatus = "online" | "idle" | "running" | "error" | "stopped" | "queued";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  skills: string[];
  isSecretary?: boolean;
  projectIds: string[];
  is_builtin?: boolean;
}

interface AgentStore {
  agents: Agent[];
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addAgent: (agent: Agent) => Promise<void>;
  removeAgent: (id: string) => Promise<void>;
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>;
  updateStatus: (id: string, status: AgentStatus) => void;
  addToProject: (agentId: string, projectId: string) => Promise<void>;
  removeFromProject: (agentId: string, projectId: string) => Promise<void>;
}

function normalizeAgent(raw: any): Agent {
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    status: raw.status as AgentStatus,
    skills: raw.skills ?? [],
    isSecretary: raw.is_secretary ?? raw.isSecretary ?? false,
    projectIds: raw.project_ids ?? raw.projectIds ?? [],
    is_builtin: raw.is_builtin ?? false,
  };
}

function toDto(a: Agent) {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
    skills: a.skills,
    is_secretary: a.isSecretary ?? false,
    project_ids: a.projectIds,
    is_builtin: a.is_builtin ?? false,
  };
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_agents");
      const agents = (raw as any[]).map(normalizeAgent);
      set({ agents, isLoaded: true });
    } catch (err) {
      console.error("Failed to load agents from SQLite:", err);
      set({ isLoaded: true });
    }
  },

  addAgent: async (agent) => {
    try {
      const raw = await invoke("create_agent", {
        name: agent.name,
        role: agent.role,
        skills: agent.skills,
      });
      const created = normalizeAgent(raw);
      // If caller specified projectIds, persist them
      if (agent.projectIds?.length) {
        created.projectIds = agent.projectIds;
        await invoke("update_agent", { agent: toDto(created) });
      }
      set((s) => ({ agents: [...s.agents, created] }));
    } catch (err) {
      console.error("Failed to create agent:", err);
    }
  },

  removeAgent: async (id) => {
    try {
      await invoke("delete_agent", { id });
      set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  },

  updateAgent: async (id, patch) => {
    const current = get().agents.find((a) => a.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    try {
      await invoke("update_agent", { agent: toDto(updated) });
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? updated : a)),
      }));
    } catch (err) {
      console.error("Failed to update agent:", err);
    }
  },

  updateStatus: (id, status) => {
    // Status is transient — update locally, don't persist
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  },

  addToProject: async (agentId, projectId) => {
    const current = get().agents.find((a) => a.id === agentId);
    if (!current || current.projectIds.includes(projectId)) return;
    const updated = { ...current, projectIds: [...current.projectIds, projectId] };
    try {
      await invoke("update_agent", { agent: toDto(updated) });
      set((s) => ({
        agents: s.agents.map((a) => (a.id === agentId ? updated : a)),
      }));
    } catch (err) {
      console.error("Failed to add agent to project:", err);
    }
  },

  removeFromProject: async (agentId, projectId) => {
    const current = get().agents.find((a) => a.id === agentId);
    if (!current) return;
    const updated = { ...current, projectIds: current.projectIds.filter((p) => p !== projectId) };
    try {
      await invoke("update_agent", { agent: toDto(updated) });
      set((s) => ({
        agents: s.agents.map((a) => (a.id === agentId ? updated : a)),
      }));
    } catch (err) {
      console.error("Failed to remove agent from project:", err);
    }
  },
}));

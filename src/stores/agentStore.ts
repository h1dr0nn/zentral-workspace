import { create } from "zustand";

export interface Agent {
  id: string;
  name: string;
  role: "secretary" | "coder" | "reviewer" | "researcher" | "custom";
  status: "idle" | "working" | "paused" | "error" | "stopped";
  skills: string[];
  instructions: string;
  model: string;
  createdAt: string;
  lastActiveAt: string;
}

interface AgentStore {
  agents: Agent[];
  activeAgentId: string | null;

  setActiveAgent: (id: string) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  updateStatus: (id: string, status: Agent["status"]) => void;
  getActiveAgent: () => Agent | undefined;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  activeAgentId: null,

  setActiveAgent: (id) => set({ activeAgentId: id }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
      activeAgentId: s.activeAgentId === id ? null : s.activeAgentId,
    })),
  updateAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  updateStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    return agents.find((a) => a.id === activeAgentId);
  },
}));

import { create } from "zustand";

export type AgentStatus = "online" | "idle" | "running" | "error" | "stopped" | "queued";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  skills: string[];
  isSecretary?: boolean;
  projectIds: string[];
}

interface AgentStore {
  agents: Agent[];

  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  updateStatus: (id: string, status: AgentStatus) => void;
  addToProject: (agentId: string, projectId: string) => void;
  removeFromProject: (agentId: string, projectId: string) => void;
}

const BUILTIN_AGENTS: Agent[] = [
  // Orchestrator — always present in all projects
  {
    id: "agent-zennis",
    name: "Zennis",
    role: "Orchestrator",
    status: "online",
    skills: [],
    isSecretary: true,
    projectIds: [],
  },

  // Git — version control specialist
  {
    id: "agent-vex",
    name: "Vex",
    role: "Git & Version Control",
    status: "idle",
    skills: ["commit", "review-pr", "git-pushing", "changelog", "using-git-worktrees"],
    projectIds: [],
  },

  // Code — core development
  {
    id: "agent-koda",
    name: "Koda",
    role: "Code & Architecture",
    status: "idle",
    skills: ["simplify", "explain", "fix", "software-architecture", "prompt-engineering", "artifacts-builder", "mcp-builder"],
    projectIds: [],
  },

  // Testing — quality assurance
  {
    id: "agent-prova",
    name: "Prova",
    role: "Testing & QA",
    status: "stopped",
    skills: ["test", "tdd", "test-fixing", "playwright", "webapp-testing"],
    projectIds: [],
  },

  // Documentation — technical writing
  {
    id: "agent-doxa",
    name: "Doxa",
    role: "Documentation",
    status: "stopped",
    skills: ["docs", "api-docs", "skill-creator"],
    projectIds: [],
  },

  // Research — analysis and investigation
  {
    id: "agent-nova",
    name: "Nova",
    role: "Research & Analysis",
    status: "stopped",
    skills: ["deep-research", "brainstorming", "root-cause-tracing"],
    projectIds: [],
  },

  // Data — file and data processing
  {
    id: "agent-datum",
    name: "Datum",
    role: "Data Processing",
    status: "stopped",
    skills: ["csv-summarizer", "pdf", "docx", "xlsx"],
    projectIds: [],
  },

  // DevOps — infrastructure and deployment
  {
    id: "agent-flux",
    name: "Flux",
    role: "DevOps & Infrastructure",
    status: "idle",
    skills: ["aws-skills", "finishing-branch", "subagent-dev"],
    projectIds: [],
  },

  // Productivity — workflow and process
  {
    id: "agent-tempo",
    name: "Tempo",
    role: "Productivity & Workflow",
    status: "stopped",
    skills: ["kaizen", "ship-learn-next", "review-implementing"],
    projectIds: [],
  },
];

export const useAgentStore = create<AgentStore>((set) => ({
  agents: BUILTIN_AGENTS,

  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
    })),
  updateAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  updateStatus: (id, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
  addToProject: (agentId, projectId) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === agentId && !a.projectIds.includes(projectId)
          ? { ...a, projectIds: [...a.projectIds, projectId] }
          : a
      ),
    })),
  removeFromProject: (agentId, projectId) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === agentId
          ? { ...a, projectIds: a.projectIds.filter((p) => p !== projectId) }
          : a
      ),
    })),
}));

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type WorkflowStatus = "draft" | "active" | "paused";

export interface WorkflowStep {
  id: string;
  agentId: string;
  skillId: string;
  label: string;
  order: number;
  onSuccess?: string;
  onFailure?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: string;
  lastRunAt: string | null;
}

interface WorkflowStore {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addWorkflow: (workflow: Omit<Workflow, "id" | "createdAt">) => Promise<void>;
  removeWorkflow: (id: string) => Promise<void>;
  updateWorkflow: (id: string, patch: Partial<Omit<Workflow, "steps">>) => Promise<void>;
  setActiveWorkflow: (id: string | null) => void;

  addStep: (workflowId: string, step: Omit<WorkflowStep, "id">) => Promise<void>;
  removeStep: (workflowId: string, stepId: string) => Promise<void>;
  updateStep: (workflowId: string, stepId: string, patch: Partial<WorkflowStep>) => Promise<void>;
  reorderSteps: (workflowId: string, stepIds: string[]) => Promise<void>;

  // Execution
  runWorkflow: (id: string) => Promise<string | null>;
  cancelRun: (runId: string) => Promise<void>;
}

function normalizeStep(raw: any): WorkflowStep {
  return {
    id: raw.id,
    agentId: raw.agent_id ?? raw.agentId,
    skillId: raw.skill_id ?? raw.skillId,
    label: raw.label ?? "",
    order: raw.order ?? raw.step_order ?? 0,
    onSuccess: raw.on_success ?? raw.onSuccess,
    onFailure: raw.on_failure ?? raw.onFailure,
  };
}

function normalize(raw: any): Workflow {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    projectId: raw.project_id ?? raw.projectId ?? null,
    status: raw.status as WorkflowStatus,
    steps: (raw.steps ?? []).map(normalizeStep),
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    lastRunAt: raw.last_run_at ?? raw.lastRunAt ?? null,
  };
}

function toDto(w: Workflow) {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    project_id: w.projectId,
    status: w.status,
    steps: w.steps.map((s) => ({
      id: s.id,
      agent_id: s.agentId,
      skill_id: s.skillId,
      label: s.label,
      order: s.order,
      on_success: s.onSuccess ?? null,
      on_failure: s.onFailure ?? null,
    })),
    created_at: w.createdAt,
    last_run_at: w.lastRunAt,
  };
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  activeWorkflowId: null,
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_workflows");
      set({ workflows: (raw as any[]).map(normalize), isLoaded: true });
    } catch (err) {
      console.error("Failed to load workflows:", err);
      set({ isLoaded: true });
    }
  },

  addWorkflow: async (workflow) => {
    try {
      const raw = await invoke("create_workflow", { workflow: toDto({ ...workflow, id: "", createdAt: "" } as Workflow) });
      set((s) => ({ workflows: [...s.workflows, normalize(raw)] }));
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  },

  removeWorkflow: async (id) => {
    try {
      await invoke("delete_workflow", { id });
      set((s) => ({
        workflows: s.workflows.filter((w) => w.id !== id),
        activeWorkflowId: s.activeWorkflowId === id ? null : s.activeWorkflowId,
      }));
    } catch (err) {
      console.error("Failed to delete workflow:", err);
    }
  },

  updateWorkflow: async (id, patch) => {
    const current = get().workflows.find((w) => w.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    try {
      await invoke("update_workflow", { workflow: toDto(updated) });
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
      }));
    } catch (err) {
      console.error("Failed to update workflow:", err);
    }
  },

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  addStep: async (workflowId, step) => {
    const current = get().workflows.find((w) => w.id === workflowId);
    if (!current) return;
    const newStep: WorkflowStep = { ...step, id: `step-${Date.now()}` };
    const updated = { ...current, steps: [...current.steps, newStep] };
    try {
      await invoke("update_workflow", { workflow: toDto(updated) });
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === workflowId ? updated : w)),
      }));
    } catch (err) {
      console.error("Failed to add step:", err);
    }
  },

  removeStep: async (workflowId, stepId) => {
    const current = get().workflows.find((w) => w.id === workflowId);
    if (!current) return;
    const updated = {
      ...current,
      steps: current.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i })),
    };
    try {
      await invoke("update_workflow", { workflow: toDto(updated) });
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === workflowId ? updated : w)),
      }));
    } catch (err) {
      console.error("Failed to remove step:", err);
    }
  },

  updateStep: async (workflowId, stepId, patch) => {
    const current = get().workflows.find((w) => w.id === workflowId);
    if (!current) return;
    const updated = {
      ...current,
      steps: current.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    };
    try {
      await invoke("update_workflow", { workflow: toDto(updated) });
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === workflowId ? updated : w)),
      }));
    } catch (err) {
      console.error("Failed to update step:", err);
    }
  },

  reorderSteps: async (workflowId, stepIds) => {
    const current = get().workflows.find((w) => w.id === workflowId);
    if (!current) return;
    const stepMap = new Map(current.steps.map((s) => [s.id, s]));
    const reordered = stepIds
      .map((id, i) => {
        const step = stepMap.get(id);
        return step ? { ...step, order: i } : null;
      })
      .filter((s): s is WorkflowStep => s !== null);
    const updated = { ...current, steps: reordered };
    try {
      await invoke("update_workflow", { workflow: toDto(updated) });
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === workflowId ? updated : w)),
      }));
    } catch (err) {
      console.error("Failed to reorder steps:", err);
    }
  },

  runWorkflow: async (id) => {
    try {
      const runId: string = await invoke("run_workflow", { workflowId: id });
      // Refresh workflows to get updated last_run_at
      const raw = await invoke("list_workflows");
      set({ workflows: (raw as any[]).map(normalize) });
      return runId;
    } catch (err) {
      console.error("Failed to run workflow:", err);
      return null;
    }
  },

  cancelRun: async (runId) => {
    try {
      await invoke("cancel_workflow_run", { runId });
    } catch (err) {
      console.error("Failed to cancel run:", err);
    }
  },
}));

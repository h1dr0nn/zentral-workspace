import { create } from "zustand";

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

  addWorkflow: (workflow: Omit<Workflow, "id" | "createdAt">) => void;
  removeWorkflow: (id: string) => void;
  updateWorkflow: (id: string, patch: Partial<Omit<Workflow, "steps">>) => void;
  setActiveWorkflow: (id: string | null) => void;

  addStep: (workflowId: string, step: Omit<WorkflowStep, "id">) => void;
  removeStep: (workflowId: string, stepId: string) => void;
  updateStep: (workflowId: string, stepId: string, patch: Partial<WorkflowStep>) => void;
  reorderSteps: (workflowId: string, stepIds: string[]) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflows: [],
  activeWorkflowId: null,

  addWorkflow: (workflow) => {
    const id = `wf-${Date.now()}`;
    set((s) => ({
      workflows: [...s.workflows, { ...workflow, id, createdAt: new Date().toISOString() }],
    }));
  },

  removeWorkflow: (id) =>
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      activeWorkflowId: s.activeWorkflowId === id ? null : s.activeWorkflowId,
    })),

  updateWorkflow: (id, patch) =>
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  addStep: (workflowId, step) => {
    const id = `step-${Date.now()}`;
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === workflowId
          ? { ...w, steps: [...w.steps, { ...step, id }] }
          : w
      ),
    }));
  },

  removeStep: (workflowId, stepId) =>
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps
                .filter((st) => st.id !== stepId)
                .map((st, i) => ({ ...st, order: i })),
            }
          : w
      ),
    })),

  updateStep: (workflowId, stepId, patch) =>
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              steps: w.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)),
            }
          : w
      ),
    })),

  reorderSteps: (workflowId, stepIds) =>
    set((s) => ({
      workflows: s.workflows.map((w) => {
        if (w.id !== workflowId) return w;
        const stepMap = new Map(w.steps.map((st) => [st.id, st]));
        const reordered = stepIds
          .map((id, i) => {
            const step = stepMap.get(id);
            return step ? { ...step, order: i } : null;
          })
          .filter((st): st is WorkflowStep => st !== null);
        return { ...w, steps: reordered };
      }),
    })),
}));

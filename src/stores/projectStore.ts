import { create } from "zustand";

export interface Project {
  id: string;
  name: string;
  path: string;
  contextBadges: string[];
  lastOpenedAt: string;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;

  setActiveProject: (id: string) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  activeProjectId: null,

  setActiveProject: (id) => set({ activeProjectId: id }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    })),
  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
}));

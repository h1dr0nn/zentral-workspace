import { create } from "zustand";

export interface Project {
  id: string;
  name: string;
  path: string;
  language: string | null;
  lastOpenedAt: string;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;

  setActiveProject: (id: string) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  reorderProjects: (fromIndex: number, toIndex: number) => void;
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
  reorderProjects: (fromIndex, toIndex) =>
    set((s) => {
      const projects = [...s.projects];
      const [moved] = projects.splice(fromIndex, 1);
      projects.splice(toIndex, 0, moved);
      return { projects };
    }),
}));

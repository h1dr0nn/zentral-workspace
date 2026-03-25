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

const STORAGE_KEY = "zentral:projects";
const ACTIVE_KEY = "zentral:active-project";

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch {
    return null;
  }
}

function saveProjects(projects: Project[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch { /* quota */ }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* quota */ }
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: loadProjects(),
  activeProjectId: loadActiveId(),

  setActiveProject: (id) => {
    saveActiveId(id);
    set({ activeProjectId: id });
  },

  addProject: (project) =>
    set((s) => {
      const projects = [...s.projects, project];
      saveProjects(projects);
      return { projects };
    }),

  removeProject: (id) =>
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId = s.activeProjectId === id ? null : s.activeProjectId;
      saveProjects(projects);
      saveActiveId(activeProjectId);
      return { projects, activeProjectId };
    }),

  updateProject: (id, patch) =>
    set((s) => {
      const projects = s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
      saveProjects(projects);
      return { projects };
    }),
}));

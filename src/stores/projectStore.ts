import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
  isLoaded: boolean;

  initialize: () => Promise<void>;
  setActiveProject: (id: string) => void;
  addProject: (project: Partial<Project> & { name: string; path: string; contextBadges?: string[] }) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
}

function normalizeProject(raw: any): Project {
  return {
    id: raw.id,
    name: raw.name,
    path: raw.path,
    contextBadges: raw.context_badges ?? raw.contextBadges ?? [],
    lastOpenedAt: raw.last_opened_at ?? raw.lastOpenedAt ?? "",
  };
}

// Load active project ID from localStorage (lightweight, no DB needed)
function loadActiveId(): string | null {
  try {
    return localStorage.getItem("zentral:active-project") || null;
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem("zentral:active-project", id);
    else localStorage.removeItem("zentral:active-project");
  } catch { /* quota */ }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: loadActiveId(),
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_projects");
      const projects = (raw as any[]).map(normalizeProject);
      set({ projects, isLoaded: true });
    } catch (err) {
      console.error("Failed to load projects from SQLite:", err);
      set({ isLoaded: true });
    }
  },

  setActiveProject: (id) => {
    saveActiveId(id);
    set({ activeProjectId: id });
  },

  addProject: async (project) => {
    try {
      const raw = await invoke("create_project", {
        name: project.name,
        path: project.path,
        contextBadges: project.contextBadges,
      });
      const created = normalizeProject(raw);
      set((s) => ({ projects: [...s.projects, created] }));
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  },

  removeProject: async (id) => {
    try {
      await invoke("delete_project", { id });
      set((s) => {
        const activeProjectId = s.activeProjectId === id ? null : s.activeProjectId;
        saveActiveId(activeProjectId);
        return { projects: s.projects.filter((p) => p.id !== id), activeProjectId };
      });
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  },

  updateProject: async (id, patch) => {
    const current = get().projects.find((p) => p.id === id);
    if (!current) return;
    const updated = normalizeProject({ ...current, ...patch });
    try {
      await invoke("update_project", { project: {
        id: updated.id,
        name: updated.name,
        path: updated.path,
        context_badges: updated.contextBadges,
        last_opened_at: updated.lastOpenedAt,
      }});
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      console.error("Failed to update project:", err);
    }
  },
}));

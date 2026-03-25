import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  builtin: boolean;
}

interface SkillStore {
  skills: Skill[];
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addSkill: (skill: Omit<Skill, "id" | "builtin">) => Promise<void>;
  removeSkill: (id: string) => Promise<void>;
  updateSkill: (id: string, patch: Partial<Skill>) => Promise<void>;
}

function normalizeSkill(raw: any): Skill {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    category: raw.category ?? "",
    prompt: raw.prompt ?? "",
    builtin: raw.builtin ?? raw.is_builtin ?? false,
  };
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_skills");
      const skills = (raw as any[]).map(normalizeSkill);
      set({ skills, isLoaded: true });
    } catch (err) {
      console.error("Failed to load skills from SQLite:", err);
      set({ isLoaded: true });
    }
  },

  addSkill: async (skill) => {
    try {
      const raw = await invoke("create_skill", {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        prompt: skill.prompt,
      });
      const created = normalizeSkill(raw);
      set((s) => ({ skills: [...s.skills, created] }));
    } catch (err) {
      console.error("Failed to create skill:", err);
    }
  },

  removeSkill: async (id) => {
    const skill = get().skills.find((s) => s.id === id);
    if (!skill || skill.builtin) return;
    try {
      await invoke("delete_skill", { id });
      set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }));
    } catch (err) {
      console.error("Failed to delete skill:", err);
    }
  },

  updateSkill: async (id, patch) => {
    const current = get().skills.find((s) => s.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    try {
      await invoke("update_skill", { skill: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        category: updated.category,
        prompt: updated.prompt,
        builtin: updated.builtin,
      }});
      set((s) => ({
        skills: s.skills.map((sk) => (sk.id === id ? updated : sk)),
      }));
    } catch (err) {
      console.error("Failed to update skill:", err);
    }
  },
}));

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type KnowledgeCategory = "notes" | "references" | "specs" | "guidelines";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  projectIds: string[];
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStore {
  documents: KnowledgeDocument[];
  activeDocumentId: string | null;
  isLoaded: boolean;

  initialize: () => Promise<void>;
  addDocument: (doc: Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, patch: Partial<KnowledgeDocument>) => Promise<void>;
  setActiveDocument: (id: string | null) => void;
}

function normalize(raw: any): KnowledgeDocument {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content ?? "",
    category: (raw.category ?? "notes") as KnowledgeCategory,
    tags: raw.tags ?? [],
    projectIds: raw.project_ids ?? raw.projectIds ?? [],
    agentIds: raw.agent_ids ?? raw.agentIds ?? [],
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    updatedAt: raw.updated_at ?? raw.updatedAt ?? "",
  };
}

function toDto(d: KnowledgeDocument) {
  return {
    id: d.id,
    title: d.title,
    content: d.content,
    category: d.category,
    tags: d.tags,
    project_ids: d.projectIds,
    agent_ids: d.agentIds,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  isLoaded: false,

  initialize: async () => {
    try {
      const raw = await invoke("list_knowledge_documents");
      set({ documents: (raw as any[]).map(normalize), isLoaded: true });
    } catch (err) {
      console.error("Failed to load knowledge:", err);
      set({ isLoaded: true });
    }
  },

  addDocument: async (doc) => {
    try {
      const raw = await invoke("create_knowledge_document", {
        document: toDto({ ...doc, id: "", createdAt: "", updatedAt: "" } as KnowledgeDocument),
      });
      set((s) => ({ documents: [...s.documents, normalize(raw)] }));
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  },

  removeDocument: async (id) => {
    try {
      await invoke("delete_knowledge_document", { id });
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== id),
        activeDocumentId: s.activeDocumentId === id ? null : s.activeDocumentId,
      }));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  },

  updateDocument: async (id, patch) => {
    const current = get().documents.find((d) => d.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    try {
      await invoke("update_knowledge_document", { document: toDto(updated) });
      set((s) => ({
        documents: s.documents.map((d) => (d.id === id ? updated : d)),
      }));
    } catch (err) {
      console.error("Failed to update document:", err);
    }
  },

  setActiveDocument: (id) => set({ activeDocumentId: id }),
}));

import { create } from "zustand";
import { loadArray, autoSave } from "./persist";

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

  addDocument: (doc: Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, patch: Partial<KnowledgeDocument>) => void;
  setActiveDocument: (id: string | null) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
  documents: loadArray<KnowledgeDocument>("zentral:knowledge"),
  activeDocumentId: null,

  addDocument: (doc) => {
    const id = `doc-${Date.now()}`;
    const now = new Date().toISOString();
    set((s) => ({
      documents: [...s.documents, { ...doc, id, createdAt: now, updatedAt: now }],
    }));
  },

  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      activeDocumentId: s.activeDocumentId === id ? null : s.activeDocumentId,
    })),

  updateDocument: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
      ),
    })),

  setActiveDocument: (id) => set({ activeDocumentId: id }),
}));

autoSave(useKnowledgeStore, "zentral:knowledge", (s) => s.documents);

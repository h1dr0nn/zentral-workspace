import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useKnowledgeStore, type KnowledgeDocument } from "@/stores/knowledgeStore";
import { KnowledgeCard } from "./KnowledgeCard";
import { KnowledgeDetailPanel } from "./KnowledgeDetailPanel";
import { AddKnowledgeDialog } from "./AddKnowledgeDialog";

const CATEGORY_ORDER: Record<string, number> = {
  specs: 0,
  guidelines: 1,
  references: 2,
  notes: 3,
};

export function KnowledgeTab() {
  const documents = useKnowledgeStore((s) => s.documents);
  const activeDocumentId = useKnowledgeStore((s) => s.activeDocumentId);
  const setActiveDocument = useKnowledgeStore((s) => s.setActiveDocument);
  const removeDocument = useKnowledgeStore((s) => s.removeDocument);
  const addDocument = useKnowledgeStore((s) => s.addDocument);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<KnowledgeDocument | null>(null);
  const [search, setSearch] = useState("");

  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  const filtered = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.tags.some((t) => t.includes(q))
    );
  }, [documents, search]);

  const grouped = useMemo(() => {
    if (search) return null; // Flat list when searching
    const groups: Record<string, KnowledgeDocument[]> = {};
    for (const doc of filtered) {
      (groups[doc.category] ??= []).push(doc);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    );
  }, [filtered, search]);

  const handleEdit = (doc: KnowledgeDocument) => {
    setEditDocument(doc);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditDocument(null);
    setDialogOpen(true);
  };

  const handleDuplicate = (doc: KnowledgeDocument) => {
    addDocument({
      title: `${doc.title} (copy)`,
      content: doc.content,
      category: doc.category,
      tags: [...doc.tags],
      projectIds: [...doc.projectIds],
      agentIds: [...doc.agentIds],
    });
  };

  const handleDelete = (id: string) => {
    removeDocument(id);
    if (activeDocumentId === id) setActiveDocument(null);
  };

  // Detail mode
  if (activeDoc) {
    return (
      <KnowledgeDetailPanel
        document={activeDoc}
        onBack={() => setActiveDocument(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    );
  }

  // List mode
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">Knowledge</p>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="New Document"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No documents yet.{"\n"}Click + to create a knowledge document.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No documents match search.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex flex-col gap-3 pb-2">
            {grouped
              ? grouped.map(([category, docs]) => (
                  <div key={category}>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 mb-1">
                      {category}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {docs.map((doc) => (
                        <KnowledgeCard
                          key={doc.id}
                          document={doc}
                          onSelect={setActiveDocument}
                          onEdit={handleEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))
              : filtered.map((doc) => (
                  <KnowledgeCard
                    key={doc.id}
                    document={doc}
                    onSelect={setActiveDocument}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
          </div>
        </div>
      )}

      <AddKnowledgeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editDocument={editDocument}
      />
    </div>
  );
}

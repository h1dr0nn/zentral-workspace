import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore } from "@/stores/projectStore";
import { useAgentStore } from "@/stores/agentStore";
import { useKnowledgeStore, type KnowledgeDocument, type KnowledgeCategory } from "@/stores/knowledgeStore";

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDocument?: KnowledgeDocument | null;
}

const CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: "notes", label: "Notes" },
  { value: "references", label: "References" },
  { value: "specs", label: "Specifications" },
  { value: "guidelines", label: "Guidelines" },
];

export function AddKnowledgeDialog({ open, onOpenChange, editDocument }: AddKnowledgeDialogProps) {
  const addDocument = useKnowledgeStore((s) => s.addDocument);
  const updateDocument = useKnowledgeStore((s) => s.updateDocument);
  const projects = useProjectStore((s) => s.projects);
  const allAgents = useAgentStore((s) => s.agents);
  const agents = allAgents.filter((a) => !a.isSecretary);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<KnowledgeCategory>("notes");
  const [tagsInput, setTagsInput] = useState("");
  const [content, setContent] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  useEffect(() => {
    if (editDocument) {
      setTitle(editDocument.title);
      setCategory(editDocument.category);
      setTagsInput(editDocument.tags.join(", "));
      setContent(editDocument.content);
      setSelectedProjects(editDocument.projectIds);
      setSelectedAgents(editDocument.agentIds);
    } else {
      setTitle("");
      setCategory("notes");
      setTagsInput("");
      setContent("");
      setSelectedProjects([]);
      setSelectedAgents([]);
    }
  }, [editDocument, open]);

  const parseTags = (input: string): string[] =>
    input
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .filter((t, i, arr) => arr.indexOf(t) === i);

  const toggleProject = (id: string) => {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    const data = {
      title: title.trim(),
      content: content.trim(),
      category,
      tags: parseTags(tagsInput),
      projectIds: selectedProjects,
      agentIds: selectedAgents,
    };

    if (editDocument) {
      updateDocument(editDocument.id, data);
    } else {
      addDocument(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editDocument ? "Edit Document" : "New Document"} className="sm:max-w-[600px] bg-card max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. API Reference"
              className="w-80"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory)}>
              <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Tags</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="api, rest, auth (comma-separated)"
              className="w-80"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Content</Label>
            <textarea
              id="kb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document content..."
              rows={8}
              className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            />
          </div>

          {projects.length > 0 && (
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Projects</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-between w-80 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                    <span className="text-muted-foreground truncate">
                      {selectedProjects.length === 0
                        ? "Select projects..."
                        : `${selectedProjects.length} selected`}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={(e) => { e.preventDefault(); toggleProject(p.id); }}>
                      <Checkbox checked={selectedProjects.includes(p.id)} className="mr-2" />
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {agents.length > 0 && (
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Agents</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-between w-80 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                    <span className="text-muted-foreground truncate">
                      {selectedAgents.length === 0
                        ? "Select agents..."
                        : `${selectedAgents.length} selected`}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {agents.map((a) => (
                    <DropdownMenuItem key={a.id} onSelect={(e) => { e.preventDefault(); toggleAgent(a.id); }}>
                      <Checkbox checked={selectedAgents.includes(a.id)} className="mr-2" />
                      {a.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !content.trim()}>
            {editDocument ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

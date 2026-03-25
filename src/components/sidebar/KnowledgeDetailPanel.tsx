import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { useProjectStore } from "@/stores/projectStore";
import { useAgentStore } from "@/stores/agentStore";
import type { KnowledgeDocument } from "@/stores/knowledgeStore";

interface KnowledgeDetailPanelProps {
  document: KnowledgeDocument;
  onBack: () => void;
  onEdit: (doc: KnowledgeDocument) => void;
  onDelete: (id: string) => void;
}

export function KnowledgeDetailPanel({ document: doc, onBack, onEdit, onDelete }: KnowledgeDetailPanelProps) {
  const projects = useProjectStore((s) => s.projects);
  const agents = useAgentStore((s) => s.agents);

  const linkedProjects = projects.filter((p) => doc.projectIds.includes(p.id));
  const linkedAgents = agents.filter((a) => doc.agentIds.includes(a.id));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{doc.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal capitalize">
              {doc.category}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="px-3 pb-4">
          {/* Metadata */}
          <div className="space-y-2 mb-3">
            {doc.tags.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal text-foreground/70 border-foreground/20">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {linkedProjects.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Projects</p>
                <div className="flex flex-wrap gap-1">
                  {linkedProjects.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-normal">
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {linkedAgents.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Agents</p>
                <div className="flex flex-wrap gap-1">
                  {linkedAgents.map((a) => (
                    <Badge key={a.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-normal">
                      {a.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator className="mb-3" />

          {/* Content */}
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {doc.content}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 px-3 py-2 border-t shrink-0">
        <Button variant="outline" size="sm" onClick={() => onEdit(doc)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(doc.id)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

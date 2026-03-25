import { MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { KnowledgeDocument } from "@/stores/knowledgeStore";

interface KnowledgeCardProps {
  document: KnowledgeDocument;
  onSelect: (id: string) => void;
  onEdit: (doc: KnowledgeDocument) => void;
  onDuplicate: (doc: KnowledgeDocument) => void;
  onDelete: (id: string) => void;
}

export function KnowledgeCard({ document: doc, onSelect, onEdit, onDuplicate, onDelete }: KnowledgeCardProps) {
  return (
    <div
      className="group flex flex-col gap-1 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onSelect(doc.id)}
    >
      {/* Row 1: title + menu */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(doc); }}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(doc); }}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: tags */}
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal text-foreground/70 border-foreground/20">
              {tag}
            </Badge>
          ))}
          {doc.tags.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal text-foreground/70 border-foreground/20">
              +{doc.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Row 3: updated time */}
      <span className="text-[11px] text-muted-foreground">
        Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
      </span>
    </div>
  );
}

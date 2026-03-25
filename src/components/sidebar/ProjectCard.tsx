import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, Copy, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/stores/projectStore";
import { useProjectStore } from "@/stores/projectStore";
import { useChatStore } from "@/stores/chatStore";

interface ProjectCardProps {
  project: Project;
  isActive: boolean;
}

export function ProjectCard({ project, isActive }: ProjectCardProps) {
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const removeProject = useProjectStore((s) => s.removeProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSelect = () => {
    if (editing) return;
    setActiveProject(project.id);
    setActiveAgent("general");
  };

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== project.name) {
      updateProject(project.id, { name: trimmed });
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setEditValue(project.name);
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex flex-col gap-0.5 rounded-lg px-3 py-2 cursor-pointer transition-colors",
        isActive ? "bg-accent" : "hover:bg-muted/50",
      )}
      onClick={handleSelect}
    >
      {/* Row 1: name + menu */}
      <div className="flex items-center justify-between gap-1">
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-foreground outline-none border-b border-primary py-0"
          />
        ) : (
          <span className="font-semibold text-sm text-foreground truncate flex-1 min-w-0">
            {project.name}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => { setEditValue(project.name); setEditing(true); }}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(project.path)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Path
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => removeProject(project.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: path */}
      <span className="text-xs text-muted-foreground truncate">{project.path}</span>
    </div>
  );
}

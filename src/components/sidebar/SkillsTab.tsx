import { useState } from "react";
import { MoreVertical, Trash2, Lock, PlusCircle, FolderOpen, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSkillStore } from "@/stores/skillStore";
import { AddSkillDialog } from "./AddSkillDialog";

export function SkillsTab() {
  const skills = useSkillStore((s) => s.skills);
  const removeSkill = useSkillStore((s) => s.removeSkill);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Group by category
  const grouped: Record<string, typeof skills> = {};
  for (const skill of skills) {
    (grouped[skill.category] ??= []).push(skill);
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">Skills</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Skill
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Add Skill
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open Skill Directory
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-3 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="flex flex-col gap-4 pb-2">
          {Object.entries(grouped).map(([category, catSkills]) => (
            <div key={category}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
              <div className="flex flex-col gap-0.5">
                {catSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground font-medium">/{skill.name}</span>
                      </div>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                      )}
                    </div>
                    {skill.builtin ? (
                      <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <button
                        onClick={() => removeSkill(skill.id)}
                        className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0"
                        title="Remove skill"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddSkillDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

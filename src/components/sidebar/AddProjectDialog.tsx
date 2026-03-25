import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore, type Project } from "@/stores/projectStore";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";

/** Convert folder names like "aa-bb", "AaBb", "aa_bb" into "Aa Bb" */
function humanizeName(raw: string): string {
  return raw
    // insert space before uppercase letters in camelCase/PascalCase
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // replace dashes, underscores, dots with spaces
    .replace(/[-_.]+/g, " ")
    // capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const handleBrowse = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected) {
      setPath(selected);
      if (!name.trim()) {
        const folderName = selected.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
        setName(humanizeName(folderName));
      }
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !path.trim()) return;

    const project: Project = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      path: path.trim(),
      contextBadges: [],
      lastOpenedAt: new Date().toISOString(),
    };
    addProject(project);
    setActiveProject(project.id);
    setName("");
    setPath("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add Project" className="sm:max-w-[420px] bg-card">
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-app"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-path">Path</Label>
            <div className="flex gap-2">
              <Input
                id="proj-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g. ~/projects/my-app"
                className="flex-1"
              />
              <Button variant="outline" size="icon" className="shrink-0" onClick={handleBrowse} title="Browse folder">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !path.trim()}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSkillStore } from "@/stores/skillStore";

interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSkillDialog({ open, onOpenChange }: AddSkillDialogProps) {
  const addSkill = useSkillStore((s) => s.addSkill);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !prompt.trim()) return;
    addSkill({
      name: name.trim(),
      description: description.trim(),
      category: category.trim() || "Custom",
      prompt: prompt.trim(),
    });
    setName("");
    setDescription("");
    setCategory("");
    setPrompt("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create Skill" className="sm:max-w-[560px] bg-card">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. refactor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-cat">Category</Label>
              <Input
                id="skill-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Code (default: Custom)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-desc">Description</Label>
            <Input
              id="skill-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of what this skill does"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-prompt">Prompt</Label>
            <textarea
              id="skill-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="The instruction prompt that will be sent to the agent when this skill is invoked..."
              rows={5}
              className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !prompt.trim()}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

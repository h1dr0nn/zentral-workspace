import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAgentStore, type Agent } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";
import { useSkillStore } from "@/stores/skillStore";

interface AgentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAgent?: Agent | null;
}

export function AgentCreationDialog({ open, onOpenChange, editAgent }: AgentCreationDialogProps) {
  const addAgent = useAgentStore((s) => s.addAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const allSkills = useSkillStore((s) => s.skills);

  // Group skills by category
  const skillsByCategory: Record<string, typeof allSkills> = {};
  for (const sk of allSkills) {
    (skillsByCategory[sk.category] ??= []).push(sk);
  }

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (editAgent) {
        setName(editAgent.name);
        setRole(editAgent.role);
        setDescription("");
        setSkills([...editAgent.skills]);
      } else {
        setName("");
        setRole("");
        setDescription("");
        setSkills([]);
      }
    }
  }, [open, editAgent]);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || !role.trim()) return;

    if (editAgent) {
      updateAgent(editAgent.id, { name: name.trim(), role: role.trim(), skills });
    } else {
      const currentProjectId = useProjectStore.getState().activeProjectId;
      const agent: Agent = {
        id: `agent-${Date.now()}`,
        name: name.trim(),
        role: role.trim(),
        status: "stopped",
        skills,
        projectIds: currentProjectId ? [currentProjectId] : [],
      };
      addAgent(agent);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editAgent ? "Edit Agent" : "Create New Agent"} className="sm:max-w-[640px] bg-card">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DevOps Engineer"
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-role">Role / Title</Label>
              <Input
                id="agent-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Infrastructure"
                maxLength={64}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-desc">Description</Label>
            <textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this agent does..."
              rows={3}
              className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            />
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="space-y-3 max-h-[200px] overflow-y-auto rounded-lg border p-3 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                <div key={category}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{category}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {catSkills.map((skill) => (
                      <label
                        key={skill.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer transition-colors"
                        title={skill.description}
                      >
                        <Checkbox
                          checked={skills.includes(skill.name)}
                          onCheckedChange={() => toggleSkill(skill.name)}
                        />
                        {skill.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !role.trim()}>
            {editAgent ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

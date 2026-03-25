import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAgentStore } from "@/stores/agentStore";
import { useSkillStore } from "@/stores/skillStore";
import { useProjectStore } from "@/stores/projectStore";
import { useScheduleStore, type Schedule, type ScheduleFrequency } from "@/stores/scheduleStore";

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule?: Schedule | null;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildCron(frequency: ScheduleFrequency, hour: string, minute: string, dayOfWeek: string, dayOfMonth: string, customCron: string): string {
  if (frequency === "custom") return customCron;
  const h = Number(hour);
  const m = Number(minute);
  if (frequency === "daily") return `${m} ${h} * * *`;
  if (frequency === "weekly") return `${m} ${h} * * ${dayOfWeek}`;
  if (frequency === "monthly") return `${m} ${h} ${dayOfMonth} * *`;
  return `${m} ${h} * * *`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => String(i + 1));

export function AddScheduleDialog({ open, onOpenChange, editSchedule }: AddScheduleDialogProps) {
  const addSchedule = useScheduleStore((s) => s.addSchedule);
  const updateSchedule = useScheduleStore((s) => s.updateSchedule);
  const allAgents = useAgentStore((s) => s.agents);
  const agents = allAgents.filter((a) => !a.isSecretary);
  const allSkills = useSkillStore((s) => s.skills);
  const projects = useProjectStore((s) => s.projects);

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [prompt, setPrompt] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [customCron, setCustomCron] = useState("0 9 * * *");

  useEffect(() => {
    if (editSchedule) {
      setName(editSchedule.name);
      setAgentId(editSchedule.agentId);
      setSkillId(editSchedule.skillId);
      setProjectId(editSchedule.projectId ?? "none");
      setPrompt(editSchedule.prompt);
      setFrequency(editSchedule.frequency);
      setCustomCron(editSchedule.cronExpression);
    } else {
      setName("");
      setAgentId("");
      setSkillId("");
      setProjectId("none");
      setPrompt("");
      setFrequency("daily");
      setHour("09");
      setMinute("00");
      setDayOfWeek("1");
      setDayOfMonth("1");
      setCustomCron("0 9 * * *");
    }
  }, [editSchedule, open]);

  const selectedAgent = agents.find((a) => a.id === agentId);
  const agentSkills = selectedAgent
    ? allSkills.filter((sk) => selectedAgent.skills.includes(sk.id))
    : [];

  const handleSubmit = () => {
    if (!name.trim() || !agentId || !skillId || !prompt.trim()) return;
    const cron = buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth, customCron);
    const data = {
      name: name.trim(),
      agentId,
      skillId,
      projectId: projectId === "none" ? null : projectId,
      prompt: prompt.trim(),
      frequency,
      cronExpression: cron,
      description: "",
      status: "active" as const,
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      lastRunAt: null,
    };

    if (editSchedule) {
      updateSchedule(editSchedule.id, data);
    } else {
      addSchedule(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editSchedule ? "Edit Schedule" : "New Schedule"} className="sm:max-w-[560px] bg-card overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex-1 overflow-y-auto space-y-6 p-4 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Section 1: Basics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="schedule-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                Schedule Name
              </Label>
              <Input
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily PR Review..."
                className="w-80 h-10 border-muted-foreground/20 focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="project" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                Project Context
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project" className="w-80 h-10 border-muted-foreground/20">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project (Global context)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Section 2: Task Instructions */}
          <div className="space-y-4">
            <Label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Instructions
            </Label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tell the agent what to do during this run..."
              className="w-full min-h-[100px] rounded-md border border-muted-foreground/20 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            />
          </div>

          <Separator className="bg-border/50" />

          {/* Section 3: Agent & Skill */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Configuration
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent" className="text-[10px] text-muted-foreground pl-1">Agent</Label>
                <Select value={agentId} onValueChange={(v) => { setAgentId(v); setSkillId(""); }}>
                  <SelectTrigger id="agent" className="w-60 h-10 border-muted-foreground/20">
                    <SelectValue placeholder="Choose Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill" className="text-[10px] text-muted-foreground pl-1">Skill / Tool</Label>
                <Select value={skillId} onValueChange={setSkillId} disabled={!agentId}>
                  <SelectTrigger id="skill" className="w-60 h-10 border-muted-foreground/20">
                    <SelectValue placeholder="Select Skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentSkills.map((sk) => (
                      <SelectItem key={sk.id} value={sk.id}>/{sk.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Section 3: Schedule Timing */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recurrence Pattern
            </Label>

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="frequency" className="text-[10px] text-muted-foreground pl-1">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as ScheduleFrequency)}>
                  <SelectTrigger id="frequency" className="w-60 h-10 border-muted-foreground/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency !== "custom" && (
                <div className="col-span-2 space-y-2">
                  <Label className="text-[10px] text-muted-foreground pl-1">Run At</Label>
                  <div className="flex items-center gap-1.5 h-10">
                    <Select value={hour} onValueChange={setHour}>
                      <SelectTrigger className="w-full h-10 border-muted-foreground/20 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground font-medium">:</span>
                    <Select value={minute} onValueChange={setMinute}>
                      <SelectTrigger className="w-full h-10 border-muted-foreground/20 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {MINUTES.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {frequency === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="day-of-week" className="text-[10px] text-muted-foreground">On Day</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger id="day-of-week" className="h-10 border-muted-foreground/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {frequency === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="day-of-month" className="text-[10px] text-muted-foreground">On Day of Month</Label>
                <div className="flex items-center gap-3">
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger id="day-of-month" className="h-10 border-muted-foreground/20 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {DAYS_OF_MONTH.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground italic">of every month</span>
                </div>
              </div>
            )}

            {frequency === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-cron" className="text-[10px] text-muted-foreground">Cron Expression</Label>
                <Input
                  id="custom-cron"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="h-10 border-muted-foreground/20"
                />
                <p className="text-[10px] text-muted-foreground pl-1">
                  Format: minute hour day-of-month month day-of-week
                </p>
              </div>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-3 px-4 pb-4 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6 h-10">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !agentId || !skillId || !prompt.trim()}
            className="px-8 h-10 font-semibold"
          >
            {editSchedule ? "Update Schedule" : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

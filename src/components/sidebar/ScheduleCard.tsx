import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agentStore";
import { useSkillStore } from "@/stores/skillStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Schedule } from "@/stores/scheduleStore";
import { formatDistanceToNow, format, isToday, isTomorrow } from "date-fns";

interface ScheduleCardProps {
  schedule: Schedule;
  onToggle: (id: string) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
}

function formatNextRun(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow at ${format(date, "h:mm a")}`;
  return format(date, "EEE 'at' h:mm a");
}

export function ScheduleCard({ schedule, onToggle, onEdit, onDelete }: ScheduleCardProps) {
  const agent = useAgentStore((s) => s.agents.find((a) => a.id === schedule.agentId));
  const skill = useSkillStore((s) => s.skills.find((sk) => sk.id === schedule.skillId));
  const project = useProjectStore((s) =>
    schedule.projectId ? s.projects.find((p) => p.id === schedule.projectId) : null
  );

  const isPaused = schedule.status === "paused";

  return (
    <div
      className={cn(
        "group flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
        isPaused && "opacity-60"
      )}
    >
      {/* Row 1: schedule name, agent:skill + toggle & menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">
            {schedule.name}
          </span>
          <span className="text-[10px] text-muted-foreground truncate uppercase tracking-tight">
            {agent?.name ?? "Unknown"}: /{skill?.name ?? "unknown"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <Switch
            checked={schedule.status === "active"}
            onCheckedChange={() => onToggle(schedule.id)}
            className="shrink-0"
            size="sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(schedule)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(schedule.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: frequency + next run (right-aligned) */}
      <div className="flex items-center justify-between gap-1.5">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] font-normal capitalize">
          {schedule.frequency}
        </Badge>
        <span className="text-xs text-muted-foreground truncate ml-auto">
          {isPaused ? "Paused" : formatNextRun(schedule.nextRunAt)}
        </span>
      </div>

      {/* Row 3: project badge + last run (right-aligned) */}
      <div className="flex items-center justify-between gap-1.5">
        {project && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] font-normal">
            {project.name}
          </Badge>
        )}
        {schedule.lastRunAt && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            Last: {formatDistanceToNow(new Date(schedule.lastRunAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}

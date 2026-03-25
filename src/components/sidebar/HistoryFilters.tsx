import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentStore } from "@/stores/agentStore";
import { useProjectStore } from "@/stores/projectStore";
import type { HistoryFilter, HistoryEventType, HistoryEventStatus } from "@/stores/historyStore";

interface HistoryFiltersProps {
  filter: HistoryFilter;
  onFilterChange: (patch: Partial<HistoryFilter>) => void;
}

const EVENT_TYPES: { value: HistoryEventType; label: string }[] = [
  { value: "skill_run", label: "Skill Run" },
  { value: "agent_start", label: "Agent Start" },
  { value: "agent_stop", label: "Agent Stop" },
  { value: "workflow_run", label: "Workflow" },
  { value: "schedule_trigger", label: "Schedule" },
  { value: "error", label: "Error" },
];

const EVENT_STATUSES: { value: HistoryEventStatus; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "running", label: "Running" },
  { value: "cancelled", label: "Cancelled" },
];

export function HistoryFilters({ filter, onFilterChange }: HistoryFiltersProps) {
  const agents = useAgentStore((s) => s.agents);
  const projects = useProjectStore((s) => s.projects);

  return (
    <div className="space-y-2 px-3 pb-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filter.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search events..."
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Filter grid */}
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={filter.agentId ?? "all"}
          onValueChange={(v) => onFilterChange({ agentId: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-full h-7 text-xs">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.type ?? "all"}
          onValueChange={(v) => onFilterChange({ type: v === "all" ? null : v as HistoryEventType })}
        >
          <SelectTrigger className="w-full h-7 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.projectId ?? "all"}
          onValueChange={(v) => onFilterChange({ projectId: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-full h-7 text-xs">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.status ?? "all"}
          onValueChange={(v) => onFilterChange({ status: v === "all" ? null : v as HistoryEventStatus })}
        >
          <SelectTrigger className="w-full h-7 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/stores/agentStore";

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; pulse?: boolean }> = {
  online:  { color: "bg-green-500", label: "Online" },
  idle:    { color: "bg-amber-500", label: "Idle" },
  running: { color: "bg-blue-500",  label: "Running", pulse: true },
  error:   { color: "bg-red-500",   label: "Error" },
  stopped: { color: "bg-muted-foreground", label: "Stopped" },
  queued:  { color: "bg-secondary-foreground", label: "Queued" },
};

export function StatusIndicator({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full shrink-0", config.color, config.pulse && "animate-pulse")} />
      <span className="text-[11px] text-muted-foreground">{config.label}</span>
    </div>
  );
}

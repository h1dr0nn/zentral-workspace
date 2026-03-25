import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import type { HistoryEvent } from "@/stores/historyStore";

interface HistoryEventCardProps {
  event: HistoryEvent;
}

const STATUS_DOT: Record<string, string> = {
  success: "bg-green-500",
  failure: "bg-red-500",
  running: "bg-blue-500 animate-pulse",
  cancelled: "bg-muted-foreground",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function HistoryEventCard({ event }: HistoryEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = event.details !== null;

  return (
    <div
      className={cn(
        "rounded-md px-2.5 py-2 transition-colors",
        hasDetails && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        {/* Status dot */}
        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", STATUS_DOT[event.status])} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">{event.summary}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {event.projectId && (
              <span className="text-[11px] text-muted-foreground">
                {event.projectId.replace("proj-", "")}
              </span>
            )}
            {event.duration !== null && (
              <>
                {event.projectId && <span className="text-[11px] text-muted-foreground">·</span>}
                <span className="text-[11px] text-muted-foreground">{formatDuration(event.duration)}</span>
              </>
            )}
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && event.details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-2 bg-muted/50 rounded mt-2 ml-4">
              {event.details}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

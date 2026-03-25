import { useState, useMemo } from "react";
import { Filter, Trash2 } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import { useHistoryStore, type HistoryEvent } from "@/stores/historyStore";
import { HistoryEventCard } from "./HistoryEventCard";
import { HistoryFilters } from "./HistoryFilters";

function groupByDate(events: HistoryEvent[]): [string, HistoryEvent[]][] {
  const groups: Record<string, HistoryEvent[]> = {};
  for (const event of events) {
    const date = new Date(event.timestamp);
    let key: string;
    if (isToday(date)) key = "Today";
    else if (isYesterday(date)) key = "Yesterday";
    else key = format(date, "EEE, MMM d");
    (groups[key] ??= []).push(event);
  }
  return Object.entries(groups);
}

export function HistoryTab() {
  const events = useHistoryStore((s) => s.events);
  const filter = useHistoryStore((s) => s.filter);
  const setFilter = useHistoryStore((s) => s.setFilter);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilter = filter.agentId || filter.projectId || filter.type || filter.status || filter.search;

  const filtered = useMemo(() => {
    let result = [...events];
    if (filter.agentId) result = result.filter((e) => e.agentId === filter.agentId);
    if (filter.projectId) result = result.filter((e) => e.projectId === filter.projectId);
    if (filter.type) result = result.filter((e) => e.type === filter.type);
    if (filter.status) result = result.filter((e) => e.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((e) => e.summary.toLowerCase().includes(q));
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">History</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center rounded-sm h-6 w-6 transition-colors ${
              hasActiveFilter
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Toggle filters"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showFilters && <HistoryFilters filter={filter} onFilterChange={setFilter} />}

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No activity recorded yet.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No events match filters.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex flex-col gap-3 pb-2">
            {grouped.map(([dateLabel, groupEvents]) => (
              <div key={dateLabel}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-1">
                  {dateLabel}
                </p>
                <div className="flex flex-col gap-0.5">
                  {groupEvents.map((event) => (
                    <HistoryEventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

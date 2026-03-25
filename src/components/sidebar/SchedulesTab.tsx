import { useState } from "react";
import { Plus } from "lucide-react";
import { useScheduleStore, type Schedule } from "@/stores/scheduleStore";
import { ScheduleCard } from "./ScheduleCard";
import { AddScheduleDialog } from "./AddScheduleDialog";

export function SchedulesTab() {
  const schedules = useScheduleStore((s) => s.schedules);
  const toggleStatus = useScheduleStore((s) => s.toggleStatus);
  const removeSchedule = useScheduleStore((s) => s.removeSchedule);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);

  const sorted = [...schedules].sort(
    (a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
  );

  const handleEdit = (schedule: Schedule) => {
    setEditSchedule(schedule);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditSchedule(null);
    setDialogOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">Schedules</p>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="New Schedule"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-muted-foreground">
            No schedules yet.{"\n"}Click + to schedule a recurring task.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex flex-col gap-1 pb-2">
            {sorted.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onToggle={toggleStatus}
                onEdit={handleEdit}
                onDelete={removeSchedule}
              />
            ))}
          </div>
        </div>
      )}

      <AddScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSchedule={editSchedule}
      />
    </div>
  );
}

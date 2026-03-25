import {
  Files,
  Boxes,
  Clock,
  Workflow,
  History,
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

export function ActivityBar() {
  const { activeTab, setActiveTab, setSettingsModalOpen } = useUiStore();

  type SidebarItem = {
    id: string;
    icon: React.ElementType;
    label: string;
    badge?: number | string;
  };

  const topItems: SidebarItem[] = [
    { id: "projects", icon: Files, label: "Projects" },
    { id: "skills", icon: Boxes, label: "Skills" },
    { id: "schedules", icon: Clock, label: "Schedules" },
    { id: "workflows", icon: Workflow, label: "Workflows" },
    { id: "history", icon: History, label: "History" },
    { id: "knowledge", icon: BookOpen, label: "Knowledge" },
  ];

  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r bg-sidebar py-2">
      <div className="flex flex-1 flex-col items-center gap-4 w-full">
        {topItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "relative flex h-12 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                isActive ? "text-foreground" : ""
              )}
              title={item.label}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
              )}
              
              <div className="relative">
                <Icon 
                  strokeWidth={1.5} 
                  className={cn(
                    "h-6 w-6", 
                    isActive && "text-foreground" // Use foreground for active icon instead of blue
                  )} 
                />
                
                {item.badge && (
                  <span className="absolute -bottom-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center w-full pb-2">
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="flex h-10 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          title="Settings"
        >
          <Settings strokeWidth={1.5} className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

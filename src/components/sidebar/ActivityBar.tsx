import { 
  Files, 
  Boxes
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

export function ActivityBar() {
  const { activeTab, setActiveTab } = useUiStore();

  type SidebarItem = {
    id: string;
    icon: React.ElementType;
    label: string;
    badge?: number | string;
  };

  const topItems: SidebarItem[] = [
    { id: "projects", icon: Files, label: "Projects" },
    { id: "skills", icon: Boxes, label: "Skills" },
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
    </div>
  );
}

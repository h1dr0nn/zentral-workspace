import { Plus, X } from "lucide-react";
import { useTerminalStore } from "@/stores/terminalStore";
import { useUiStore } from "@/stores/uiStore";

export function TerminalToolbar() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTerminalStore();
  const toggleTerminal = useUiStore((s) => s.toggleTerminal);

  return (
    <div className="flex h-9 items-center border-b border-border bg-sidebar px-1 shrink-0">
      <div className="flex flex-1 min-w-0 items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              className={`group relative flex shrink-0 items-center gap-1 rounded-sm px-2.5 py-1 text-xs transition-colors max-w-[140px] ${
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) removeTab(tab.id);
              }}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                className={`inline-flex items-center justify-center rounded-sm h-4 w-4 hover:bg-muted ${
                  isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          );
        })}
        <button
          className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => addTab()}
          title="New Terminal"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        className="flex items-center justify-center rounded-sm h-6 w-6 ml-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={toggleTerminal}
        title="Close Panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

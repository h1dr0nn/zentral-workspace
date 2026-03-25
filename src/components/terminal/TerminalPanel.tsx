import { useEffect } from "react";
import { useTerminalStore } from "@/stores/terminalStore";
import { TerminalToolbar } from "./TerminalToolbar";
import { TerminalRenderer } from "./TerminalRenderer";

export function TerminalPanel() {
  const { tabs, activeTabId, addTab } = useTerminalStore();

  // Auto-create first tab on mount
  useEffect(() => {
    if (useTerminalStore.getState().tabs.length === 0) {
      addTab();
    }
  }, [addTab]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TerminalToolbar />
      <div className="relative flex-1 min-h-0">
        {tabs.map((tab) => (
          <TerminalRenderer
            key={tab.id}
            tabId={tab.id}
            visible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}

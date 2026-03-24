import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/ResizablePanel";
import { Toaster } from "sonner";
import { useUiStore } from "@/stores/uiStore";
import { CustomTitlebar } from "@/components/header/CustomTitlebar";
import { ActivityBar } from "@/components/sidebar/ActivityBar";
import { LeftSidebar } from "@/components/sidebar/LeftSidebar";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { ChatView } from "@/components/chat/ChatView";
import { CommandPalette } from "@/components/command/CommandPalette";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { UI_CONSTANTS } from "@/lib/constants";
import { useCallback, useRef, useState } from "react";

export default function App() {
  const { leftSidebarOpen, rightSidebarOpen, terminalOpen } = useUiStore();
  const [terminalHeight, setTerminalHeight] = useState(UI_CONSTANTS.TERMINAL_DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = terminalHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const newH = Math.min(
        UI_CONSTANTS.TERMINAL_MAX_HEIGHT,
        Math.max(UI_CONSTANTS.TERMINAL_MIN_HEIGHT, startH.current + delta)
      );
      setTerminalHeight(newH);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [terminalHeight]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <CustomTitlebar />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {leftSidebarOpen && (
          <>
            <ResizablePanel 
              defaultSize={UI_CONSTANTS.LEFT_SIDEBAR_DEFAULT_SIZE} 
              minSize={UI_CONSTANTS.LEFT_SIDEBAR_MIN_SIZE} 
              maxSize={UI_CONSTANTS.LEFT_SIDEBAR_MAX_SIZE}
            >
              <LeftSidebar />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel defaultSize={60}>
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden bg-background">
              <ChatView />
            </div>
            {terminalOpen && (
              <>
                {/* Drag handle — same style as sidebar ResizableHandle */}
                <div
                  className="relative flex h-px w-full cursor-ns-resize items-center justify-center bg-border after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-[''] hover:bg-primary/50 shrink-0"
                  onMouseDown={onMouseDown}
                />
                <div className="shrink-0 bg-card p-3 overflow-auto" style={{ height: terminalHeight }}>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Terminal</p>
                </div>
              </>
            )}
          </div>
        </ResizablePanel>

        {rightSidebarOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel 
              defaultSize={UI_CONSTANTS.RIGHT_SIDEBAR_DEFAULT_SIZE} 
              minSize={UI_CONSTANTS.RIGHT_SIDEBAR_MIN_SIZE} 
              maxSize={UI_CONSTANTS.RIGHT_SIDEBAR_MAX_SIZE}
            >
              <RightSidebar />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      </div>

      <CommandPalette />
      <SettingsDialog />
      <Toaster position="bottom-right" />
    </div>
  );
}


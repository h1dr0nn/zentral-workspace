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
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { UI_CONSTANTS } from "@/lib/constants";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { migrateLocalStorageToSqlite } from "@/utils/migrateToSqlite";
import { useProjectStore } from "@/stores/projectStore";
import { useAgentStore } from "@/stores/agentStore";
import { useSkillStore } from "@/stores/skillStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useKnowledgeStore } from "@/stores/knowledgeStore";
import { useChatStore } from "@/stores/chatStore";

export default function App() {
  useGlobalShortcuts();
  const [, setAppReady] = useState(false);

  // Initialize all stores from SQLite on first mount
  useEffect(() => {
    async function boot() {
      try {
        await migrateLocalStorageToSqlite();
      } catch (err) {
        console.error("Migration error:", err);
      }

      await Promise.allSettled([
        useProjectStore.getState().initialize(),
        useAgentStore.getState().initialize(),
        useSkillStore.getState().initialize(),
        useSettingsStore.getState().initialize(),
        useScheduleStore.getState().initialize(),
        useWorkflowStore.getState().initialize(),
        useHistoryStore.getState().initialize(),
        useKnowledgeStore.getState().initialize(),
      ]);

      // Load chat messages for active context
      const activeProject = useProjectStore.getState().activeProjectId;
      const activeAgent = useChatStore.getState().activeAgentId;
      if (activeProject && activeAgent) {
        await useChatStore.getState().loadMessages(activeProject, activeAgent);
      }

      setAppReady(true);
    }
    boot();
  }, []);
  const { leftSidebarOpen, rightSidebarOpen, terminalOpen, setLeftSidebarOpen, setRightSidebarOpen, setTerminalOpen } = useUiStore();
  const [terminalHeight, setTerminalHeight] = useState(UI_CONSTANTS.TERMINAL_DEFAULT_HEIGHT);
  const [terminalFull, setTerminalFull] = useState(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  // Track last size (pixels) before close for each sidebar
  const leftLastPx = useRef<number | null>(null);
  const rightLastPx = useRef<number | null>(null);
  // Freeze lastSize during toggle-collapse so onResize(0) doesn't overwrite it
  const leftFreezeSize = useRef(false);
  const rightFreezeSize = useRef(false);
  // Track how terminal was closed
  const terminalClosedBy = useRef<"drag" | "toggle">("toggle");

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  useEffect(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (leftSidebarOpen) {
      const target = leftLastPx.current;
      leftFreezeSize.current = true;
      panel.expand();
      if (target != null) panel.resize(`${target}px`);
    } else {
      leftFreezeSize.current = true;
      panel.collapse();
    }
  }, [leftSidebarOpen]);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (rightSidebarOpen) {
      const target = rightLastPx.current;
      rightFreezeSize.current = true;
      panel.expand();
      if (target != null) panel.resize(`${target}px`);
    } else {
      rightFreezeSize.current = true;
      panel.collapse();
    }
  }, [rightSidebarOpen]);

  // Sync terminal height before React renders to avoid flash
  useEffect(() => {
    const unsub = useUiStore.subscribe((state, prev) => {
      if (state.terminalOpen && !prev.terminalOpen) {
        if (terminalClosedBy.current === "drag") {
          setTerminalHeight(UI_CONSTANTS.TERMINAL_DEFAULT_HEIGHT);
        }
        setTerminalFull(false);
      }
      if (!state.terminalOpen && prev.terminalOpen) {
        setTerminalFull(false);
        if (terminalClosedBy.current !== "drag") {
          terminalClosedBy.current = "toggle";
        }
      }
    });
    return unsub;
  }, []);

  const centerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = terminalFull
      ? (centerRef.current?.clientHeight ?? terminalHeight)
      : terminalHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const raw = startH.current + delta;

      // Collapse when dragged below threshold
      if (raw < UI_CONSTANTS.TERMINAL_COLLAPSE_THRESHOLD) {
        terminalClosedBy.current = "drag";
        setTerminalOpen(false);
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        return;
      }

      const containerEl = centerRef.current;
      const containerH = containerEl?.clientHeight ?? window.innerHeight;
      const maxH = Math.round(containerH * 0.8);

      // Snap to full when cursor reaches top edge of container
      if (containerEl) {
        const containerTop = containerEl.getBoundingClientRect().top;
        if (ev.clientY <= containerTop) {
          setTerminalFull(true);
          return;
        }
      }

      setTerminalFull(false);
      setTerminalHeight(Math.min(maxH, Math.max(UI_CONSTANTS.TERMINAL_MIN_HEIGHT, raw)));
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
  }, [terminalHeight, terminalFull, setTerminalOpen]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <CustomTitlebar />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          <ResizablePanel
            panelRef={leftPanelRef}
            defaultSize={UI_CONSTANTS.LEFT_SIDEBAR_DEFAULT_SIZE}
            minSize={UI_CONSTANTS.LEFT_SIDEBAR_MIN_SIZE}
            maxSize={UI_CONSTANTS.LEFT_SIDEBAR_MAX_SIZE}
            groupResizeBehavior="preserve-pixel-size"
            collapsible
            collapsedSize="0px"
            onResize={(size) => {
              const px = typeof size === "number" ? size : size.inPixels;
              if (leftFreezeSize.current) {
                leftFreezeSize.current = false;
              } else if (px > 0) {
                leftLastPx.current = px;
              } else {
                leftLastPx.current = null;
              }
              setLeftSidebarOpen(px > 0);
            }}
          >
            <LeftSidebar />
          </ResizablePanel>
          <ResizableHandle />

          <ResizablePanel defaultSize={60}>
            <div ref={centerRef} className="flex h-full flex-col">
              {!terminalFull && (
                <div className="flex-1 overflow-hidden bg-background">
                  <ChatView />
                </div>
              )}
              {terminalOpen && (
                <>
                  <div
                    className="relative flex h-px w-full cursor-ns-resize items-center justify-center bg-border after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-[''] hover:bg-primary/50 shrink-0"
                    onMouseDown={onMouseDown}
                  />
                  <div
                    className={`overflow-hidden bg-sidebar ${terminalFull ? "flex-1" : "shrink-0"}`}
                    style={terminalFull ? undefined : { height: terminalHeight }}
                  >
                    <TerminalPanel />
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel
            panelRef={rightPanelRef}
            defaultSize={UI_CONSTANTS.RIGHT_SIDEBAR_DEFAULT_SIZE}
            minSize={UI_CONSTANTS.RIGHT_SIDEBAR_MIN_SIZE}
            maxSize={UI_CONSTANTS.RIGHT_SIDEBAR_MAX_SIZE}
            groupResizeBehavior="preserve-pixel-size"
            collapsible
            collapsedSize="0px"
            onResize={(size) => {
              const px = typeof size === "number" ? size : size.inPixels;
              if (rightFreezeSize.current) {
                rightFreezeSize.current = false;
              } else if (px > 0) {
                rightLastPx.current = px;
              } else {
                rightLastPx.current = null;
              }
              setRightSidebarOpen(px > 0);
            }}
          >
            <RightSidebar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <CommandPalette />
      <SettingsDialog />
      <Toaster position="bottom-right" />
    </div>
  );
}


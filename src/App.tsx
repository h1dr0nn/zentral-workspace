import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/ResizablePanel";
import { Toaster } from "sonner";
import { useUiStore } from "@/stores/uiStore";

export default function App() {
  const { leftSidebarOpen, rightSidebarOpen, terminalOpen } = useUiStore();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header
        className="flex h-10 items-center justify-between border-b px-3"
        data-tauri-drag-region
      >
        <span className="text-sm font-semibold">Zentral</span>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {leftSidebarOpen && (
          <>
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <div className="h-full bg-sidebar p-3 text-sidebar-foreground">
                <p className="text-xs font-medium uppercase text-muted-foreground">Projects</p>
              </div>
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel defaultSize={60}>
          <div className="flex h-full flex-col">
            <div className="flex-1 p-4">
              <p className="text-muted-foreground">Select an agent to start chatting</p>
            </div>
            {terminalOpen && (
              <div className="h-48 border-t bg-card p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Terminal</p>
              </div>
            )}
          </div>
        </ResizablePanel>

        {rightSidebarOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <div className="h-full bg-sidebar p-3 text-sidebar-foreground">
                <p className="text-xs font-medium uppercase text-muted-foreground">Agents</p>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <Toaster position="bottom-right" />
    </div>
  );
}

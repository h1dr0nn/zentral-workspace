import { useUiStore } from "@/stores/uiStore";

function PanelLeftIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      {filled && <path d="M3 5a2 2 0 0 1 2-2h4v18H5a2 2 0 0 1-2-2Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function PanelBottomIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 15h18" />
      {filled && <path d="M3 15h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function PanelRightIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
      {filled && <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function PanelToggles() {
  const {
    leftSidebarOpen,
    terminalOpen,
    rightSidebarOpen,
    toggleLeftSidebar,
    toggleTerminal,
    toggleRightSidebar,
  } = useUiStore();

  const baseClass =
    "flex items-center justify-center w-7 h-7 rounded text-xs font-semibold cursor-pointer transition-colors";
  
  const getButtonClass = (isActive: boolean) =>
    `${baseClass} ${
      isActive
        ? "bg-muted text-foreground"
        : "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    }`;

  return (
    <div className="flex items-center gap-1 mx-2">
      <button
        type="button"
        className={getButtonClass(leftSidebarOpen)}
        onClick={toggleLeftSidebar}
        title="Toggle Left Sidebar (Ctrl+B)"
      >
        <PanelLeftIcon filled={leftSidebarOpen} />
      </button>
      <button
        type="button"
        className={getButtonClass(terminalOpen)}
        onClick={toggleTerminal}
        title="Toggle Terminal (Ctrl+`)"
      >
        <PanelBottomIcon filled={terminalOpen} />
      </button>
      <button
        type="button"
        className={getButtonClass(rightSidebarOpen)}
        onClick={toggleRightSidebar}
        title="Toggle Right Sidebar (Ctrl+Shift+B)"
      >
        <PanelRightIcon filled={rightSidebarOpen} />
      </button>
    </div>
  );
}


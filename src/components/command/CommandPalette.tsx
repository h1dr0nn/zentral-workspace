import { useUiStore } from "@/stores/uiStore";

export function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette } = useUiStore();

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm">
      <div className="w-[600px] max-w-full rounded-xl border bg-card text-card-foreground shadow-lg">
        <div className="flex items-center border-b px-4 py-3">
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Type a command or search..."
          />
          <button 
            type="button"
            className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={toggleCommandPalette}
          >
            ESC
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            Command palette implementation pending...
          </p>
        </div>
      </div>
    </div>
  );
}

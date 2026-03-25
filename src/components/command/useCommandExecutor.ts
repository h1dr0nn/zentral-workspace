import { useCallback } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { themes, applyTheme, getSystemDefaultTheme } from "@/lib/themes";

export function useCommandExecutor() {
  return useCallback((actionId: string) => {
    const ui = useUiStore.getState();
    ui.setCommandPaletteOpen(false);

    switch (actionId) {
      case "toggle-left-sidebar":
        ui.toggleLeftSidebar();
        break;
      case "toggle-terminal":
        ui.toggleTerminal();
        break;
      case "toggle-right-sidebar":
        ui.toggleRightSidebar();
        break;
      case "open-settings":
        ui.setSettingsModalOpen(true);
        break;
      case "new-agent":
        ui.setAgentCreationDialogOpen(true);
        break;
      case "toggle-theme": {
        const settings = useSettingsStore.getState();
        const currentId = settings.settings.theme || getSystemDefaultTheme();
        const idx = themes.findIndex((t) => t.id === currentId);
        const next = themes[(idx + 1) % themes.length];
        settings.update("theme", next.id);
        applyTheme(next.id);
        break;
      }
    }
  }, []);
}

import { useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+B — Toggle Left Sidebar
      if (mod && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleLeftSidebar();
        return;
      }

      // Ctrl+` — Toggle Terminal
      if (mod && e.key === "`") {
        e.preventDefault();
        useUiStore.getState().toggleTerminal();
        return;
      }

      // Ctrl+Shift+B — Toggle Right Sidebar
      if (mod && e.key === "B" && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleRightSidebar();
        return;
      }

      // Ctrl+Shift+P — Command Palette
      if (mod && e.key === "P" && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleCommandPalette();
        return;
      }

      // Ctrl+Shift+N — New Agent
      if (mod && e.key === "N" && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().setAgentCreationDialogOpen(true);
        return;
      }

      // Ctrl+, — Settings
      if (mod && e.key === ",") {
        e.preventDefault();
        useUiStore.getState().setSettingsModalOpen(true);
        return;
      }

      // / — Focus chat input (only when not in an input)
      if (e.key === "/" && !mod && !e.shiftKey && !isInputFocused()) {
        e.preventDefault();
        const textarea = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        textarea?.focus();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}

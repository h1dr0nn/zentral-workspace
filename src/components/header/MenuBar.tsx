import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/uiStore";
import { useState } from "react";

type MenuItem = {
  id?: string;
  label: string;
  shortcut: string;
};

const menus: Record<string, MenuItem[]> = {
  File: [
    { label: "New Agent", shortcut: "Ctrl+Shift+N" },
    { label: "Open Project", shortcut: "Ctrl+O" },
    { label: "Close Project", shortcut: "" },
    { label: "Settings", shortcut: "Ctrl+,", id: "settings" },
    { label: "Exit", shortcut: "Alt+F4" },
  ],
  Edit: [
    { label: "Undo", shortcut: "Ctrl+Z" },
    { label: "Redo", shortcut: "Ctrl+Shift+Z" },
    { label: "Cut", shortcut: "Ctrl+X" },
    { label: "Copy", shortcut: "Ctrl+C" },
    { label: "Paste", shortcut: "Ctrl+V" },
    { label: "Select All", shortcut: "Ctrl+A" },
  ],
  Selection: [
    { label: "Select Agent", shortcut: "" },
    { label: "Select Project", shortcut: "" },
  ],
  View: [
    { id: "toggle-left", label: "Toggle Left Sidebar", shortcut: "Ctrl+B" },
    { id: "toggle-term", label: "Toggle Terminal", shortcut: "Ctrl+`" },
    { id: "toggle-right", label: "Toggle Right Sidebar", shortcut: "Ctrl+Shift+B" },
    { id: "command-palette", label: "Command Palette", shortcut: "Ctrl+Shift+P" },
    { label: "Zoom In", shortcut: "Ctrl+=" },
    { label: "Zoom Out", shortcut: "Ctrl+-" },
  ],
  Help: [
    { label: "Documentation", shortcut: "" },
    { label: "About", shortcut: "" },
    { label: "Check for Updates", shortcut: "" },
  ]
};

export function MenuBar() {
  const { toggleLeftSidebar, toggleTerminal, toggleRightSidebar, toggleCommandPalette, setSettingsModalOpen } = useUiStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleSelect = (id?: string) => {
    switch(id) {
      case "toggle-left": toggleLeftSidebar(); break;
      case "toggle-term": toggleTerminal(); break;
      case "toggle-right": toggleRightSidebar(); break;
      case "command-palette": toggleCommandPalette(); break;
      case "settings": setSettingsModalOpen(true); break;
    }
  };

  return (
    <div className="flex items-center h-full text-sm">
      {Object.entries(menus).map(([title, items]) => (
        <DropdownMenu 
          key={title} 
          open={openMenu === title} 
          onOpenChange={(open) => setOpenMenu(open ? title : null)}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <button 
              className="px-2 py-1 mx-0.5 rounded-sm cursor-default outline-none hover:bg-muted focus:bg-muted data-[state=open]:bg-muted text-foreground transition-colors font-medium"
              onMouseEnter={() => {
                if (openMenu !== null) setOpenMenu(title);
              }}
            >
              {title}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="min-w-[220px]">
            {items.map((item, i) => (
              <DropdownMenuItem
                key={i}
                onClick={() => handleSelect(item.id)}
              >
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}

import { Settings, FileText, Bug, RefreshCw, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/uiStore";

export function UserMenu() {
  const { setSettingsModalOpen } = useUiStore();

  // TODO: replace with real auth state
  const isSignedIn = false;
  const userName = "User";

  if (!isSignedIn) {
    return (
      <button
        onClick={() => {/* TODO: sign in flow */}}
        className="flex items-center rounded-md px-2.5 py-1 mx-1 text-xs font-medium text-white bg-primary transition-colors hover:bg-primary/90"
        title="Sign In to Claude"
      >
        Sign In
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center h-7 w-7 mx-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold transition-colors hover:bg-primary/90"
          title={userName}
        >
          {userName[0].toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52">
        <div className="px-2 py-1.5 text-sm font-medium">{userName}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setSettingsModalOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Palette className="mr-2 h-4 w-4" />
          Themes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <RefreshCw className="mr-2 h-4 w-4" />
          Check for Updates…
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FileText className="mr-2 h-4 w-4" />
          Docs
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bug className="mr-2 h-4 w-4" />
          Report Issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

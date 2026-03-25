import { useEffect } from "react";
import { Settings, FileText, Bug, RefreshCw, Palette, LogOut, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";

export function UserMenu() {
  const { setSettingsModalOpen } = useUiStore();
  const { loggedIn, email, loggingIn, checkStatus, startLogin, logout } = useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (!loggedIn) {
    return (
      <button
        onClick={startLogin}
        disabled={loggingIn}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 mx-1 text-xs font-medium text-white bg-primary transition-colors hover:bg-primary/90 disabled:opacity-70"
        title="Sign In with Claude"
      >
        {loggingIn && <Loader2 className="h-3 w-3 animate-spin" />}
        {loggingIn ? "Waiting…" : "Sign In"}
      </button>
    );
  }

  const initials = email
    ? email[0].toUpperCase()
    : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center h-5 w-5 mx-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold transition-colors hover:bg-primary/90"
          title={email}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52">
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium truncate">{email}</div>
        </div>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

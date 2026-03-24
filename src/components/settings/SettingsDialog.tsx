import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/stores/uiStore";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function SettingsDialog() {
  const { settingsModalOpen, setSettingsModalOpen } = useUiStore();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
  }, [settingsModalOpen]);

  const handleThemeToggle = (dark: boolean) => {
    setIsDark(dark);
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  return (
    <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
      <DialogContent className="sm:max-w-[480px] bg-card">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Appearance */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div className="flex items-center justify-between rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">
                    {isDark ? "Dark theme is active" : "Light theme is active"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={handleThemeToggle}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { themes, applyTheme, getSystemDefaultTheme } from "@/lib/themes";

export function GeneralTab() {
  const { settings, update } = useSettingsStore();
  const { chatLayout, setChatLayout } = useUiStore();

  const currentTheme = settings.theme || getSystemDefaultTheme();

  const handleThemeChange = (value: string) => {
    update("theme", value);
    applyTheme(value);
  };

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Theme</Label>
        <Select value={currentTheme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Chat Layout */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Chat Layout</Label>
        <Select value={chatLayout} onValueChange={(v) => setChatLayout(v as "aligned" | "bubbles")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aligned">Aligned</SelectItem>
            <SelectItem value="bubbles">Bubbles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Terminal Font Size</Label>
        <Select value={String(settings.fontSize)} onValueChange={(v) => update("fontSize", Number(v))}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[12, 13, 14, 15, 16, 18, 20, 22, 24].map((s) => (
              <SelectItem key={s} value={String(s)}>{s}px</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Default Shell */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Default Shell</Label>
        <Input
          value={settings.defaultShell}
          onChange={(e) => update("defaultShell", e.target.value)}
          placeholder="/bin/bash"
          className="w-48"
        />
      </div>

    </div>
  );
}

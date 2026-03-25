import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";

export function AdvancedTab() {
  const { settings, update, resetToDefaults } = useSettingsStore();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zentral-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        for (const [key, value] of Object.entries(data)) {
          if (key in settings) {
            update(key as keyof typeof settings, value as never);
          }
        }
      } catch {
        // invalid file
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Chat Retention */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Chat History Retention</Label>
        <Select value={settings.chatRetention} onValueChange={(v) => update("chatRetention", v as "all" | "30days" | "7days")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Keep all</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="7days">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claude CLI Path */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Claude CLI Path</Label>
          <p className="text-xs text-muted-foreground">Override if non-standard location</p>
        </div>
        <Input
          value={settings.claudeCliPath}
          onChange={(e) => update("claudeCliPath", e.target.value)}
          placeholder="Auto-detected"
          className="w-48"
        />
      </div>

      {/* Check for Updates */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Updates</Label>
          <p className="text-xs text-muted-foreground">Current version: 0.1.0</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {/* TODO: check update */}}>
          Check for Updates
        </Button>
      </div>

      <Separator />

      {/* Export / Import */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Data</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>Export Settings</Button>
          <Button variant="outline" size="sm" onClick={handleImport}>Import Settings</Button>
        </div>
      </div>

      <Separator />

      {/* Reset */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Danger Zone</Label>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">Are you sure?</span>
            <Button variant="destructive" size="sm" onClick={() => { resetToDefaults(); setConfirmReset(false); }}>
              Yes, Reset All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
            Reset to Defaults
          </Button>
        )}
      </div>

    </div>
  );
}

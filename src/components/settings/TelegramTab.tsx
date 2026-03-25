import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

export function TelegramTab() {
  const { settings, update } = useSettingsStore();
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  const handleTest = () => {
    // TODO: invoke("test_telegram_connection")
    setTestStatus("success");
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Enable Telegram Bot</p>
          <p className="text-xs text-muted-foreground">Interact with agents remotely via Telegram</p>
        </div>
        <Switch
          checked={settings.telegramEnabled}
          onCheckedChange={(v) => update("telegramEnabled", v)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Bot Token</Label>
        <div className="relative">
          <Input
            type={showToken ? "text" : "password"}
            value={settings.telegramBotToken}
            onChange={(e) => update("telegramBotToken", e.target.value)}
            placeholder="123456:ABC-DEF1234..."
            disabled={!settings.telegramEnabled}
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Allowed Chat IDs</Label>
        <Input
          value={settings.telegramAllowedChatIds}
          onChange={(e) => update("telegramAllowedChatIds", e.target.value)}
          placeholder="123456789, 987654321"
          disabled={!settings.telegramEnabled}
        />
        <p className="text-xs text-muted-foreground">Comma-separated numeric IDs</p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!settings.telegramEnabled || !settings.telegramBotToken}
        >
          Test Connection
        </Button>
        {testStatus === "success" && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-500">Connected</span>
          </div>
        )}
        {testStatus === "error" && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs text-red-500">Failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

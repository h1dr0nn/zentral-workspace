import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";

export function AgentsTab() {
  const { settings, update } = useSettingsStore();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Max Concurrent Agents</Label>
          <p className="text-xs text-muted-foreground">Simultaneously running (1-10)</p>
        </div>
        <Input
          type="number"
          min={1}
          max={10}
          value={settings.maxConcurrentAgents}
          onChange={(e) => update("maxConcurrentAgents", Number(e.target.value))}
          className="w-20 text-center"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Default Agent Timeout</Label>
          <p className="text-xs text-muted-foreground">Minutes before idle agent stops</p>
        </div>
        <Input
          type="number"
          min={1}
          max={1440}
          value={settings.defaultAgentTimeout}
          onChange={(e) => update("defaultAgentTimeout", Number(e.target.value))}
          className="w-20 text-center"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Auto-restart on Crash</Label>
          <p className="text-xs text-muted-foreground">Restart agents that exit unexpectedly</p>
        </div>
        <Switch
          checked={settings.autoRestartOnCrash}
          onCheckedChange={(v) => update("autoRestartOnCrash", v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Crash Loop Threshold</Label>
          <p className="text-xs text-muted-foreground">Crashes within 60s to disable restart</p>
        </div>
        <Input
          type="number"
          min={1}
          max={20}
          value={settings.crashLoopThreshold}
          onChange={(e) => update("crashLoopThreshold", Number(e.target.value))}
          className="w-20 text-center"
        />
      </div>
    </div>
  );
}

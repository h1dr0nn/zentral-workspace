import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Bot, Send, Wrench } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { GeneralTab } from "./GeneralTab";
import { AgentsTab } from "./AgentsTab";
import { TelegramTab } from "./TelegramTab";
import { AdvancedTab } from "./AdvancedTab";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "advanced", label: "Advanced", icon: Wrench },
] as const;

export function SettingsDialog() {
  const { settingsModalOpen, setSettingsModalOpen } = useUiStore();

  return (
    <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
      <DialogContent title="Settings" className="sm:max-w-[680px] bg-card p-0 gap-0">
        <div className="flex flex-col h-[480px]">

          <Tabs defaultValue="general" orientation="vertical" className="flex flex-1 min-h-0">
            <div className="shrink-0 w-[160px] border-r">
              <TabsList className="flex flex-col items-stretch bg-transparent rounded-none px-2 py-3 gap-1 w-full">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="w-full justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-accent data-[state=active]:shadow-none"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              <TabsContent value="general" className="mt-0"><GeneralTab /></TabsContent>
              <TabsContent value="agents" className="mt-0"><AgentsTab /></TabsContent>
              <TabsContent value="telegram" className="mt-0"><TelegramTab /></TabsContent>
              <TabsContent value="advanced" className="mt-0"><AdvancedTab /></TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between px-6 py-2.5 border-t text-xs text-muted-foreground shrink-0">
            <span>Zentral v0.1.0</span>
            <span>by <span className="text-foreground font-medium">h1dr0n</span></span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

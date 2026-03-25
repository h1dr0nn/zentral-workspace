import { AppIcon } from "./AppIcon";
import { MenuBar } from "./MenuBar";
import { PanelToggles } from "./PanelToggles";
import { UserMenu } from "./UserMenu";
import { WindowControls } from "./WindowControls";

export function CustomTitlebar() {
  return (
    <header className="relative z-[60] pointer-events-auto flex flex-row items-center h-[36px] bg-black/10 border-b border-border select-none" data-tauri-drag-region>
      <div className="flex w-12 shrink-0 items-center justify-center h-full">
        <AppIcon />
      </div>
      <div className="flex items-center h-full pl-0 pr-2">
        <MenuBar />
      </div>
      <div className="flex-1 h-full" data-tauri-drag-region />
      <div className="flex items-center justify-end h-full">
        <PanelToggles />
        <UserMenu />
        <WindowControls />
      </div>
    </header>
  );
}

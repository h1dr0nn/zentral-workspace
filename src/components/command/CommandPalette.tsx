import { useMemo } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/uiStore";
import { COMMAND_ACTIONS, type CommandCategory } from "./actions";
import { useCommandExecutor } from "./useCommandExecutor";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const recentActionIds = useUiStore((s) => s.recentActionIds);
  const addRecentAction = useUiStore((s) => s.addRecentAction);
  const execute = useCommandExecutor();

  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, typeof COMMAND_ACTIONS>();
    for (const action of COMMAND_ACTIONS) {
      const list = map.get(action.category) || [];
      list.push(action);
      map.set(action.category, list);
    }
    return map;
  }, []);

  const recentActions = useMemo(
    () =>
      recentActionIds
        .map((id) => COMMAND_ACTIONS.find((a) => a.id === id))
        .filter((a) => a != null),
    [recentActionIds]
  );

  const handleSelect = (actionId: string) => {
    addRecentAction(actionId);
    execute(actionId);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentActions.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={`recent-${action.id}`}
                    value={action.label}
                    onSelect={() => handleSelect(action.id)}
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                    {action.label}
                    {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {Array.from(grouped.entries()).map(([category, actions]) => (
          <CommandGroup key={category} heading={category}>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  value={`${action.label} ${(action.keywords || []).join(" ")}`}
                  onSelect={() => handleSelect(action.id)}
                >
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  {action.label}
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

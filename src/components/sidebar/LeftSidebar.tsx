import { useUiStore } from "@/stores/uiStore";

export function LeftSidebar() {
  const { activeTab } = useUiStore();

  return (
    <div className="flex h-full flex-col bg-sidebar p-3 text-sidebar-foreground">
      {activeTab === "projects" && (
        <>
          <p className="text-xs font-medium uppercase text-muted-foreground">Projects</p>
          <div className="mt-4 flex flex-1 flex-col gap-2">
            <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              No projects created yet
            </div>
          </div>
        </>
      )}

      {activeTab === "skills" && (
        <>
          <p className="text-xs font-medium uppercase text-muted-foreground">Skills</p>
          <div className="mt-4 flex flex-1 flex-col gap-2">
            <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              No skills discovered yet
            </div>
          </div>
        </>
      )}
    </div>
  );
}

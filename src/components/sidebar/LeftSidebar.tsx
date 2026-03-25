import { useState } from "react";
import { Plus } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { ProjectCard } from "./ProjectCard";
import { AddProjectDialog } from "./AddProjectDialog";
import { SkillsTab } from "./SkillsTab";
import { SchedulesTab } from "./SchedulesTab";
import { WorkflowsTab } from "./WorkflowsTab";
import { HistoryTab } from "./HistoryTab";
import { KnowledgeTab } from "./KnowledgeTab";

export function LeftSidebar() {
  const { activeTab } = useUiStore();
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {activeTab === "projects" && (
        <>
          <div className="flex items-center justify-between px-3 py-3 shrink-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Projects</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center justify-center rounded-sm h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Add Project"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <p className="text-center text-xs text-muted-foreground">
                No projects added.{"\n"}Click + to add a project directory.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="flex flex-col gap-1 pb-2">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={activeProjectId === project.id}
                  />
                ))}
              </div>
            </div>
          )}

          <AddProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </>
      )}

      {activeTab === "skills" && (
        <div className="flex flex-col flex-1 min-h-0">
          <SkillsTab />
        </div>
      )}

      {activeTab === "schedules" && (
        <div className="flex flex-col flex-1 min-h-0">
          <SchedulesTab />
        </div>
      )}

      {activeTab === "workflows" && (
        <div className="flex flex-col flex-1 min-h-0">
          <WorkflowsTab />
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col flex-1 min-h-0">
          <HistoryTab />
        </div>
      )}

      {activeTab === "knowledge" && (
        <div className="flex flex-col flex-1 min-h-0">
          <KnowledgeTab />
        </div>
      )}
    </div>
  );
}

use std::path::PathBuf;

/// Project workspace manager: tracks registered projects and active project.
pub struct ProjectManager {
    pub projects: Vec<ProjectEntry>,
    pub active_project: Option<PathBuf>,
}

pub struct ProjectEntry {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
}

impl ProjectManager {
    pub fn new() -> Self {
        Self {
            projects: Vec::new(),
            active_project: None,
        }
    }
}

impl Default for ProjectManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Agent process spawner: launches Claude CLI child processes.
/// TODO: Implement stdio piping and lifecycle management.
pub struct AgentSpawner;

impl AgentSpawner {
    pub fn new() -> Self {
        Self
    }
}

impl Default for AgentSpawner {
    fn default() -> Self {
        Self::new()
    }
}

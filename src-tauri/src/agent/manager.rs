use std::collections::HashMap;
use crate::agent::types::{AgentConfig, AgentInfo, AgentStatus};

pub struct AgentManager {
    agents: HashMap<String, AgentHandle>,
}

struct AgentHandle {
    config: AgentConfig,
    status: AgentStatus,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    pub fn create_agent(&mut self, config: AgentConfig) -> AgentInfo {
        let info = AgentInfo {
            id: config.id.clone(),
            name: config.name.clone(),
            role: config.role.clone(),
            status: AgentStatus::Idle,
            skills: config.skills.clone(),
            model: config.model.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            last_active_at: chrono::Utc::now().to_rfc3339(),
        };
        self.agents.insert(
            config.id.clone(),
            AgentHandle {
                config,
                status: AgentStatus::Idle,
            },
        );
        info
    }

    pub fn delete_agent(&mut self, id: &str) -> bool {
        self.agents.remove(id).is_some()
    }

    pub fn list_agents(&self) -> Vec<AgentInfo> {
        self.agents
            .values()
            .map(|h| AgentInfo {
                id: h.config.id.clone(),
                name: h.config.name.clone(),
                role: h.config.role.clone(),
                status: h.status.clone(),
                skills: h.config.skills.clone(),
                model: h.config.model.clone(),
                created_at: String::new(),
                last_active_at: String::new(),
            })
            .collect()
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}

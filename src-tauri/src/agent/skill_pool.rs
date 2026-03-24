use crate::agent::types::Skill;
use std::collections::HashMap;

pub struct SkillPool {
    skills: HashMap<String, Skill>,
}

impl SkillPool {
    pub fn new() -> Self {
        Self {
            skills: HashMap::new(),
        }
    }

    pub fn register(&mut self, skill: Skill) {
        self.skills.insert(skill.id.clone(), skill);
    }

    pub fn get(&self, id: &str) -> Option<&Skill> {
        self.skills.get(id)
    }

    pub fn list(&self) -> Vec<&Skill> {
        self.skills.values().collect()
    }
}

impl Default for SkillPool {
    fn default() -> Self {
        Self::new()
    }
}

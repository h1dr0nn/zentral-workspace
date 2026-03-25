#[cfg(test)]
mod tests {
    use crate::persistence::*;
    use crate::persistence::models::*;
    use crate::persistence::workflow_runs::*;
    use std::collections::HashMap;

    fn setup() -> rusqlite::Connection {
        Database::init_memory().expect("Failed to create test database")
    }

    // ── Settings ──

    #[test]
    fn test_settings_upsert_and_get() {
        let conn = setup();
        settings::upsert(&conn, "theme", "dark").unwrap();
        let val = settings::get(&conn, "theme").unwrap();
        assert_eq!(val, Some("dark".to_string()));
    }

    #[test]
    fn test_settings_upsert_overwrite() {
        let conn = setup();
        settings::upsert(&conn, "theme", "dark").unwrap();
        settings::upsert(&conn, "theme", "light").unwrap();
        let val = settings::get(&conn, "theme").unwrap();
        assert_eq!(val, Some("light".to_string()));
    }

    #[test]
    fn test_settings_get_missing() {
        let conn = setup();
        let val = settings::get(&conn, "nonexistent").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn test_settings_get_all() {
        let conn = setup();
        settings::upsert(&conn, "a", "1").unwrap();
        settings::upsert(&conn, "b", "2").unwrap();
        let all = settings::get_all(&conn).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all.get("a"), Some(&"1".to_string()));
    }

    #[test]
    fn test_settings_upsert_many() {
        let conn = setup();
        let mut entries = HashMap::new();
        entries.insert("x".into(), "10".into());
        entries.insert("y".into(), "20".into());
        settings::upsert_many(&conn, &entries).unwrap();
        assert_eq!(settings::get(&conn, "x").unwrap(), Some("10".to_string()));
        assert_eq!(settings::get(&conn, "y").unwrap(), Some("20".to_string()));
    }

    #[test]
    fn test_settings_delete() {
        let conn = setup();
        settings::upsert(&conn, "tmp", "val").unwrap();
        settings::delete(&conn, "tmp").unwrap();
        assert_eq!(settings::get(&conn, "tmp").unwrap(), None);
    }

    // ── Projects ──

    fn sample_project(id: &str) -> ProjectRow {
        ProjectRow {
            id: id.to_string(),
            name: format!("Project {}", id),
            path: format!("/path/{}", id),
            context_badges: "[]".to_string(),
            last_opened_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_project_insert_and_list() {
        let conn = setup();
        let p = sample_project("p1");
        projects::insert(&conn, &p).unwrap();
        let list = projects::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Project p1");
    }

    #[test]
    fn test_project_get() {
        let conn = setup();
        let p = sample_project("p2");
        projects::insert(&conn, &p).unwrap();
        let found = projects::get(&conn, "p2").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().path, "/path/p2");
    }

    #[test]
    fn test_project_update() {
        let conn = setup();
        let mut p = sample_project("p3");
        projects::insert(&conn, &p).unwrap();
        p.name = "Updated Name".to_string();
        projects::update(&conn, &p).unwrap();
        let found = projects::get(&conn, "p3").unwrap().unwrap();
        assert_eq!(found.name, "Updated Name");
    }

    #[test]
    fn test_project_delete() {
        let conn = setup();
        projects::insert(&conn, &sample_project("p4")).unwrap();
        projects::delete(&conn, "p4").unwrap();
        let found = projects::get(&conn, "p4").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_project_insert_ignore_duplicate() {
        let conn = setup();
        let p = sample_project("dup");
        projects::insert(&conn, &p).unwrap();
        projects::insert(&conn, &p).unwrap(); // should not error
        let list = projects::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
    }

    // ── Agents ──

    fn sample_agent(id: &str, builtin: bool) -> AgentRow {
        AgentRow {
            id: id.to_string(),
            name: format!("Agent {}", id),
            role: "Test Role".to_string(),
            status: "idle".to_string(),
            skills: r#"["skill1"]"#.to_string(),
            is_secretary: false,
            project_ids: "[]".to_string(),
            is_builtin: builtin,
        }
    }

    #[test]
    fn test_agent_crud() {
        let conn = setup();
        let a = sample_agent("a1", false);
        agents::insert(&conn, &a).unwrap();

        let list = agents::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Agent a1");

        let found = agents::get(&conn, "a1").unwrap().unwrap();
        assert_eq!(found.role, "Test Role");
    }

    #[test]
    fn test_agent_upsert_builtin() {
        let conn = setup();
        let a = sample_agent("builtin1", true);
        agents::upsert(&conn, &a).unwrap();

        // Upsert again with different name — should update name but keep project_ids
        let mut a2 = a.clone();
        a2.name = "Updated Builtin".to_string();
        agents::upsert(&conn, &a2).unwrap();

        let found = agents::get(&conn, "builtin1").unwrap().unwrap();
        assert_eq!(found.name, "Updated Builtin");
        let list = agents::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_agent_delete_only_non_builtin() {
        let conn = setup();
        agents::insert(&conn, &sample_agent("custom", false)).unwrap();
        agents::insert(&conn, &sample_agent("builtin", true)).unwrap();

        agents::delete(&conn, "custom").unwrap();
        agents::delete(&conn, "builtin").unwrap(); // should be ignored (is_builtin=1)

        let list = agents::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "builtin");
    }

    // ── Skills ──

    fn sample_skill(id: &str, builtin: bool) -> SkillRow {
        SkillRow {
            id: id.to_string(),
            name: format!("Skill {}", id),
            description: "Test skill".to_string(),
            category: "Testing".to_string(),
            prompt: "Do the thing".to_string(),
            is_builtin: builtin,
        }
    }

    #[test]
    fn test_skill_crud() {
        let conn = setup();
        skills::insert(&conn, &sample_skill("s1", false)).unwrap();
        let list = skills::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_skill_upsert_builtin() {
        let conn = setup();
        skills::upsert(&conn, &sample_skill("bs1", true)).unwrap();
        skills::upsert(&conn, &sample_skill("bs1", true)).unwrap();
        let list = skills::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_skill_delete_only_non_builtin() {
        let conn = setup();
        skills::insert(&conn, &sample_skill("custom_sk", false)).unwrap();
        skills::insert(&conn, &sample_skill("builtin_sk", true)).unwrap();
        skills::delete(&conn, "custom_sk").unwrap();
        skills::delete(&conn, "builtin_sk").unwrap();
        let list = skills::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "builtin_sk");
    }

    // ── Chat Messages ──

    fn sample_message(id: &str, key: &str, role: &str) -> ChatMessageRow {
        ChatMessageRow {
            id: id.to_string(),
            chat_key: key.to_string(),
            agent_id: "agent-1".to_string(),
            role: role.to_string(),
            content: format!("Message {}", id),
            timestamp: 1700000000,
            source: "local".to_string(),
        }
    }

    #[test]
    fn test_chat_insert_and_get_by_key() {
        let conn = setup();
        chat::insert(&conn, &sample_message("m1", "proj:agent", "user")).unwrap();
        chat::insert(&conn, &sample_message("m2", "proj:agent", "agent")).unwrap();
        chat::insert(&conn, &sample_message("m3", "proj:other", "user")).unwrap();

        let msgs = chat::get_by_key(&conn, "proj:agent").unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].id, "m1");
        assert_eq!(msgs[1].id, "m2");
    }

    #[test]
    fn test_chat_insert_many() {
        let conn = setup();
        let msgs = vec![
            sample_message("b1", "k1", "user"),
            sample_message("b2", "k1", "agent"),
        ];
        chat::insert_many(&conn, &msgs).unwrap();
        let result = chat::get_by_key(&conn, "k1").unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_chat_delete_by_key() {
        let conn = setup();
        chat::insert(&conn, &sample_message("d1", "k2", "user")).unwrap();
        chat::insert(&conn, &sample_message("d2", "k2", "agent")).unwrap();
        chat::delete_by_key(&conn, "k2").unwrap();
        let result = chat::get_by_key(&conn, "k2").unwrap();
        assert_eq!(result.len(), 0);
    }

    // ── Schedules ──

    fn sample_schedule(id: &str) -> ScheduleRow {
        ScheduleRow {
            id: id.to_string(),
            name: format!("Schedule {}", id),
            agent_id: "agent-1".to_string(),
            skill_id: "skill-1".to_string(),
            project_id: None,
            frequency: "daily".to_string(),
            cron_expression: "".to_string(),
            prompt: "Do daily task".to_string(),
            description: "Test schedule".to_string(),
            status: "active".to_string(),
            next_run_at: "2026-01-01T12:00:00Z".to_string(),
            last_run_at: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_schedule_crud() {
        let conn = setup();
        schedules::insert(&conn, &sample_schedule("sc1")).unwrap();
        let list = schedules::list(&conn).unwrap();
        assert_eq!(list.len(), 1);

        let mut updated = list[0].clone();
        updated.status = "paused".to_string();
        schedules::update(&conn, &updated).unwrap();
        let list2 = schedules::list(&conn).unwrap();
        assert_eq!(list2[0].status, "paused");

        schedules::delete(&conn, "sc1").unwrap();
        assert_eq!(schedules::list(&conn).unwrap().len(), 0);
    }

    #[test]
    fn test_schedule_list_due() {
        let conn = setup();
        let mut s1 = sample_schedule("due1");
        s1.next_run_at = "2020-01-01T00:00:00Z".to_string(); // past
        s1.status = "active".to_string();
        schedules::insert(&conn, &s1).unwrap();

        let mut s2 = sample_schedule("future1");
        s2.next_run_at = "2099-01-01T00:00:00Z".to_string(); // future
        s2.status = "active".to_string();
        schedules::insert(&conn, &s2).unwrap();

        let mut s3 = sample_schedule("paused1");
        s3.next_run_at = "2020-01-01T00:00:00Z".to_string(); // past but paused
        s3.status = "paused".to_string();
        schedules::insert(&conn, &s3).unwrap();

        let due = schedules::list_due(&conn, "2026-03-26T00:00:00Z").unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].id, "due1");
    }

    // ── Workflows + Steps ──

    fn sample_workflow(id: &str) -> WorkflowRow {
        WorkflowRow {
            id: id.to_string(),
            name: format!("Workflow {}", id),
            description: "Test workflow".to_string(),
            project_id: None,
            status: "draft".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            last_run_at: None,
        }
    }

    fn sample_step(id: &str, wf_id: &str, order: i32) -> WorkflowStepRow {
        WorkflowStepRow {
            id: id.to_string(),
            workflow_id: wf_id.to_string(),
            agent_id: "agent-1".to_string(),
            skill_id: "skill-1".to_string(),
            label: format!("Step {}", order),
            step_order: order,
            on_success: None,
            on_failure: None,
        }
    }

    #[test]
    fn test_workflow_crud() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wf1")).unwrap();
        let list = workflows::list(&conn).unwrap();
        assert_eq!(list.len(), 1);

        let mut updated = list[0].clone();
        updated.status = "active".to_string();
        workflows::update(&conn, &updated).unwrap();
        let list2 = workflows::list(&conn).unwrap();
        assert_eq!(list2[0].status, "active");

        workflows::delete(&conn, "wf1").unwrap();
        assert_eq!(workflows::list(&conn).unwrap().len(), 0);
    }

    #[test]
    fn test_workflow_steps() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wf2")).unwrap();

        workflows::insert_step(&conn, &sample_step("st1", "wf2", 0)).unwrap();
        workflows::insert_step(&conn, &sample_step("st2", "wf2", 1)).unwrap();
        workflows::insert_step(&conn, &sample_step("st3", "wf2", 2)).unwrap();

        let steps = workflows::list_steps(&conn, "wf2").unwrap();
        assert_eq!(steps.len(), 3);
        assert_eq!(steps[0].step_order, 0);
        assert_eq!(steps[2].step_order, 2);
    }

    #[test]
    fn test_workflow_reorder_steps() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wf3")).unwrap();
        workflows::insert_step(&conn, &sample_step("s1", "wf3", 0)).unwrap();
        workflows::insert_step(&conn, &sample_step("s2", "wf3", 1)).unwrap();
        workflows::insert_step(&conn, &sample_step("s3", "wf3", 2)).unwrap();

        // Reverse order
        workflows::reorder_steps(&conn, "wf3", &["s3".into(), "s2".into(), "s1".into()]).unwrap();
        let steps = workflows::list_steps(&conn, "wf3").unwrap();
        assert_eq!(steps[0].id, "s3");
        assert_eq!(steps[0].step_order, 0);
        assert_eq!(steps[2].id, "s1");
        assert_eq!(steps[2].step_order, 2);
    }

    #[test]
    fn test_workflow_replace_steps() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wf4")).unwrap();
        workflows::insert_step(&conn, &sample_step("old1", "wf4", 0)).unwrap();

        let new_steps = vec![
            sample_step("new1", "wf4", 0),
            sample_step("new2", "wf4", 1),
        ];
        workflows::replace_steps(&conn, "wf4", &new_steps).unwrap();

        let steps = workflows::list_steps(&conn, "wf4").unwrap();
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].id, "new1");
    }

    #[test]
    fn test_workflow_cascade_delete() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wf5")).unwrap();
        workflows::insert_step(&conn, &sample_step("cs1", "wf5", 0)).unwrap();
        workflows::delete(&conn, "wf5").unwrap();
        // Steps should be cascade-deleted
        let steps = workflows::list_steps(&conn, "wf5").unwrap();
        assert_eq!(steps.len(), 0);
    }

    // ── Workflow Runs ──

    #[test]
    fn test_workflow_run_lifecycle() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("wr1")).unwrap();

        let run = WorkflowRunRow {
            id: "run-1".to_string(),
            workflow_id: "wr1".to_string(),
            status: "running".to_string(),
            current_step: None,
            started_at: "2026-01-01T00:00:00Z".to_string(),
            completed_at: None,
        };
        workflow_runs::insert_run(&conn, &run).unwrap();

        let active = workflow_runs::get_active_run(&conn, "wr1").unwrap();
        assert!(active.is_some());
        assert_eq!(active.unwrap().status, "running");

        // Complete the run
        let mut completed = run.clone();
        completed.status = "completed".to_string();
        completed.completed_at = Some("2026-01-01T00:01:00Z".to_string());
        workflow_runs::update_run(&conn, &completed).unwrap();

        let active2 = workflow_runs::get_active_run(&conn, "wr1").unwrap();
        assert!(active2.is_none());

        let found = workflow_runs::get_run(&conn, "run-1").unwrap().unwrap();
        assert_eq!(found.status, "completed");
    }

    #[test]
    fn test_step_results() {
        let conn = setup();
        workflows::insert(&conn, &sample_workflow("sr_wf")).unwrap();
        workflow_runs::insert_run(&conn, &WorkflowRunRow {
            id: "run-sr".to_string(),
            workflow_id: "sr_wf".to_string(),
            status: "running".to_string(),
            current_step: None,
            started_at: "2026-01-01T00:00:00Z".to_string(),
            completed_at: None,
        }).unwrap();

        let result = StepResultRow {
            id: "sr1".to_string(),
            run_id: "run-sr".to_string(),
            step_id: "step-1".to_string(),
            agent_id: "agent-1".to_string(),
            skill_id: "skill-1".to_string(),
            status: "running".to_string(),
            output: None,
            duration_ms: None,
            started_at: "2026-01-01T00:00:00Z".to_string(),
            completed_at: None,
        };
        workflow_runs::insert_step_result(&conn, &result).unwrap();

        let mut done = result.clone();
        done.status = "success".to_string();
        done.output = Some("Agent output here".to_string());
        done.duration_ms = Some(1500);
        done.completed_at = Some("2026-01-01T00:00:02Z".to_string());
        workflow_runs::update_step_result(&conn, &done).unwrap();

        let results = workflow_runs::list_step_results(&conn, "run-sr").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, "success");
        assert_eq!(results[0].output, Some("Agent output here".to_string()));
        assert_eq!(results[0].duration_ms, Some(1500));
    }

    // ── History Events ──

    fn sample_event(id: &str, event_type: &str) -> HistoryEventRow {
        HistoryEventRow {
            id: id.to_string(),
            event_type: event_type.to_string(),
            agent_id: "agent-1".to_string(),
            project_id: None,
            skill_id: None,
            workflow_id: None,
            summary: format!("Event {}", id),
            details: None,
            status: "success".to_string(),
            duration: Some(100),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_history_insert_and_list() {
        let conn = setup();
        history::insert(&conn, &sample_event("e1", "skill_run")).unwrap();
        history::insert(&conn, &sample_event("e2", "agent_start")).unwrap();

        let events = history::list(&conn, None, None, None, None, 100, 0).unwrap();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_history_filter_by_type() {
        let conn = setup();
        history::insert(&conn, &sample_event("f1", "skill_run")).unwrap();
        history::insert(&conn, &sample_event("f2", "agent_start")).unwrap();
        history::insert(&conn, &sample_event("f3", "skill_run")).unwrap();

        let events = history::list(&conn, None, None, Some("skill_run"), None, 100, 0).unwrap();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_history_filter_by_agent() {
        let conn = setup();
        let mut e1 = sample_event("ag1", "skill_run");
        e1.agent_id = "agent-koda".to_string();
        history::insert(&conn, &e1).unwrap();
        history::insert(&conn, &sample_event("ag2", "skill_run")).unwrap();

        let events = history::list(&conn, Some("agent-koda"), None, None, None, 100, 0).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].agent_id, "agent-koda");
    }

    #[test]
    fn test_history_pagination() {
        let conn = setup();
        for i in 0..10 {
            history::insert(&conn, &sample_event(&format!("pg{}", i), "skill_run")).unwrap();
        }
        let page1 = history::list(&conn, None, None, None, None, 3, 0).unwrap();
        assert_eq!(page1.len(), 3);
        let page2 = history::list(&conn, None, None, None, None, 3, 3).unwrap();
        assert_eq!(page2.len(), 3);
    }

    #[test]
    fn test_history_clear() {
        let conn = setup();
        history::insert(&conn, &sample_event("c1", "skill_run")).unwrap();
        history::clear(&conn).unwrap();
        let events = history::list(&conn, None, None, None, None, 100, 0).unwrap();
        assert_eq!(events.len(), 0);
    }

    // ── Knowledge Documents ──

    fn sample_knowledge(id: &str) -> KnowledgeDocumentRow {
        KnowledgeDocumentRow {
            id: id.to_string(),
            title: format!("Doc {}", id),
            content: "Test content here".to_string(),
            category: "notes".to_string(),
            tags: r#"["test"]"#.to_string(),
            project_ids: "[]".to_string(),
            agent_ids: "[]".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_knowledge_crud() {
        let conn = setup();
        knowledge::insert(&conn, &sample_knowledge("d1")).unwrap();
        let list = knowledge::list(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "Doc d1");

        let mut updated = list[0].clone();
        updated.title = "Updated Title".to_string();
        updated.updated_at = "2026-01-02T00:00:00Z".to_string();
        knowledge::update(&conn, &updated).unwrap();
        let list2 = knowledge::list(&conn).unwrap();
        assert_eq!(list2[0].title, "Updated Title");

        knowledge::delete(&conn, "d1").unwrap();
        assert_eq!(knowledge::list(&conn).unwrap().len(), 0);
    }

    // ── Knowledge Injector ──

    #[test]
    fn test_knowledge_injection_guidelines() {
        let conn = setup();
        let mut doc = sample_knowledge("guide1");
        doc.category = "guidelines".to_string();
        doc.content = "Always follow best practices".to_string();
        knowledge::insert(&conn, &doc).unwrap();

        let context = crate::automation::knowledge_injector::build_context(&conn, "any-agent", None).unwrap();
        assert!(context.contains("Always follow best practices"));
        assert!(context.contains("Knowledge Context"));
    }

    #[test]
    fn test_knowledge_injection_agent_linked() {
        let conn = setup();
        let mut doc = sample_knowledge("linked1");
        doc.agent_ids = r#"["agent-koda"]"#.to_string();
        doc.content = "Koda specific knowledge".to_string();
        knowledge::insert(&conn, &doc).unwrap();

        let ctx = crate::automation::knowledge_injector::build_context(&conn, "agent-koda", None).unwrap();
        assert!(ctx.contains("Koda specific knowledge"));

        let ctx2 = crate::automation::knowledge_injector::build_context(&conn, "agent-other", None).unwrap();
        assert!(ctx2.is_empty());
    }

    #[test]
    fn test_knowledge_injection_empty() {
        let conn = setup();
        let ctx = crate::automation::knowledge_injector::build_context(&conn, "any", None).unwrap();
        assert!(ctx.is_empty());
    }

    // ── Migrations ──

    #[test]
    fn test_migrations_idempotent() {
        let conn = setup();
        // Running migrations again should not error
        migrations::run(&conn).unwrap();
        migrations::run(&conn).unwrap();
    }

    #[test]
    fn test_schema_version_tracked() {
        let conn = setup();
        let version: i32 = conn.query_row(
            "SELECT MAX(version) FROM schema_version",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(version >= 2); // We have at least 2 migrations
    }
}

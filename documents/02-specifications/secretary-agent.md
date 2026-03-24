# Secretary Agent

> Privileged always-present agent that acts as the default entry point for user messages, routing tasks to appropriate agents or building multi-agent execution plans.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Secretary is a privileged, always-present agent that acts as the default entry point for all user messages in Zentral. It reads the capabilities of every registered agent, decides whether to handle a request itself or delegate it, and assembles execution plans when a task requires coordination across multiple agents. The Secretary cannot be deleted, renamed, or demoted; it is the single orchestration authority for the workspace.

---

## Design Principles

| Principle | Description |
|---|---|
| Single point of dispatch | Every message that is not explicitly addressed to another agent passes through the Secretary first. |
| Skill awareness | The Secretary maintains a live index of agent names, roles, and skills and uses it to route work. |
| Dependency-safe execution | Multi-agent plans respect declared step dependencies before dispatching the next task. |
| Transparency | Every routing decision is recorded in the Secretary session so it can be audited or replayed. |
| Human authority | When agents disagree the Secretary defers to the user rather than choosing a winner silently. |

---

## Secretary Identity

The Secretary is created automatically when Zentral initializes. Its record is stored in the agent registry with a protected flag that prevents mutation through the normal agent management API.

```rust
pub struct SecretaryAgent {
    /// Fixed identifier. Never changes.
    pub id: &'static str,           // "secretary"

    /// Display name shown in the sidebar.
    pub display_name: String,        // "Secretary"

    /// Whether this agent can be deleted via the API.
    pub deletable: bool,             // always false

    /// Position hint consumed by the sidebar renderer.
    pub pinned: bool,                // always true

    /// Active Claude session ID used with --resume.
    pub session_id: Option<String>,
}
```

In the UI the Secretary is rendered at the top of the agent list in the right sidebar with a distinct visual treatment (muted badge, no delete button). Selecting any other agent in the list switches the message target away from the Secretary (see [Direct Bypass](#direct-bypass)).

---

## System Prompt

The Secretary receives a system prompt that is regenerated every time the agent roster changes (agent added, removed, skill list edited). The prompt gives the Secretary full visibility into what the workspace can do.

### Template

```
You are the Secretary of a Zentral workspace.
Your job is to receive the user's request and either answer it yourself
or delegate it to the most appropriate agent.

Available agents:
{{#each agents}}
- Name: {{this.name}}
  Role: {{this.role}}
  Skills: {{this.skills | join: ", "}}
{{/each}}

Rules:
1. If the request is a simple question or status query, answer directly.
2. If one agent clearly matches, delegate to that agent and report the result.
3. If the task requires multiple agents, output an execution plan as JSON
   (schema described below) and wait for the orchestrator to run it.
4. Never fabricate an agent name. Only delegate to agents listed above.
5. When two agents return contradictory results, present both and ask the
   user to decide.
```

### Regeneration Flow

```
Agent roster changes (add / remove / edit)
        |
        v
SecretaryPromptBuilder::rebuild()
        |
        v
Render Handlebars template with current agent list
        |
        v
Inject into Secretary Claude session via --system-prompt flag
```

The Rust side exposes a command that the frontend calls after any roster mutation:

```rust
#[tauri::command]
pub async fn refresh_secretary_prompt(
    state: tauri::State<'_, AgentRegistry>,
) -> Result<(), String> {
    let agents = state.list_agents();
    let prompt = SecretaryPromptBuilder::render(&agents)?;
    state.secretary_mut().set_system_prompt(prompt);
    Ok(())
}
```

---

## Dispatch Logic

When the Secretary receives a user message it follows a three-branch decision tree.

```
                    ┌─────────────────┐
                    │  User message   │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │   Secretary     │
                    │  classifies     │
                    └──┬─────┬─────┬──┘
                       │     │     │
          ┌────────────┘     │     └─────────────┐
          v                  v                   v
   ┌──────────────┐  ┌──────────────┐  ┌────────────────┐
   │ Handle       │  │ Delegate to  │  │ Build multi-   │
   │ directly     │  │ single agent │  │ agent plan     │
   └──────────────┘  └──────────────┘  └────────────────┘
```

### Branch 1 -- Direct Handling

The Secretary answers the message itself when:

- The user asks a meta question ("which agents are available?").
- The user asks for the status of a previous delegation.
- No agent in the roster has a matching skill.

### Branch 2 -- Single-Agent Delegation

The Secretary identifies exactly one agent whose skill set matches the request and forwards the message. The delegation message sent to the target agent includes the original user text and any relevant context the Secretary wants to add.

```typescript
interface DelegationMessage {
  from: "secretary";
  to: string;           // agent id
  user_message: string;
  context?: string;      // optional Secretary commentary
}
```

### Branch 3 -- Multi-Agent Execution Plan

When the task spans multiple domains the Secretary emits a structured JSON execution plan (see [Execution Plans](#execution-plans)). The plan is parsed by the orchestrator, not sent verbatim to agents.

---

## Skill-Based Routing

### Agent Skill Model

Every agent registered in Zentral declares a list of skills -- short lowercase tokens that describe what the agent can do.

```toml
# Example agent definition
[agent.devops]
name = "DevOps Engineer"
role = "Infrastructure and CI/CD"
skills = ["docker", "kubernetes", "ci-cd", "terraform", "monitoring"]

[agent.qa-lead]
name = "QA Lead"
role = "Testing and quality assurance"
skills = ["testing", "integration-tests", "e2e", "coverage", "benchmarks"]
```

### Routing Algorithm

```
FUNCTION route(message, agents):
    keywords  = extract_keywords(message)
    scores    = {}

    FOR agent IN agents:
        IF agent.id == "secretary":
            CONTINUE

        score = 0
        FOR keyword IN keywords:
            FOR skill IN agent.skills:
                IF exact_match(keyword, skill):
                    score += 10
                ELSE IF fuzzy_match(keyword, skill, threshold=0.8):
                    score += 5
                ELSE IF synonym_match(keyword, skill):
                    score += 3

        IF score > 0:
            scores[agent.id] = score

    IF len(scores) == 0:
        RETURN DirectHandle

    ranked = sort_descending(scores)

    IF ranked[0].score >= 10 AND (len(ranked) == 1 OR ranked[0].score > ranked[1].score * 1.5):
        RETURN DelegateSingle(ranked[0].agent)

    RETURN BuildPlan(ranked)
```

### Worked Example

User message: "run the integration tests then deploy to staging"

1. `extract_keywords` produces: `["integration-tests", "deploy", "staging"]`.
2. Agent `qa-lead` matches `integration-tests` (exact, +10).
3. Agent `devops` matches `deploy` (synonym of `ci-cd`, +3) and `staging` (fuzzy match to `kubernetes`, below threshold, +0). Effective score: 3.
4. Two agents scored, so the Secretary builds a multi-agent plan rather than delegating to one.

---

## Execution Plans

For tasks that span multiple agents the Secretary outputs a JSON execution plan. The Zentral orchestrator parses this plan and runs each step, honoring the dependency graph.

### Plan Schema

```json
{
  "plan_id": "plan-20260324-001",
  "description": "Run integration tests then deploy to staging",
  "steps": [
    {
      "step_id": "step-1",
      "agent": "qa-lead",
      "task": "Run the full integration test suite and report results",
      "depends_on": []
    },
    {
      "step_id": "step-2",
      "agent": "devops",
      "task": "Deploy the current build to the staging environment",
      "depends_on": ["step-1"]
    }
  ]
}
```

### Orchestration Algorithm

The orchestrator is adapted from the Agentrooms sequential-with-dependencies pattern. Steps with no unresolved dependencies are dispatched first. As each step completes, the orchestrator checks which downstream steps are now unblocked.

```
FUNCTION execute_plan(plan):
    completed = {}
    failed    = {}
    pending   = copy(plan.steps)

    WHILE len(pending) > 0:
        ready = [s FOR s IN pending
                 IF all(dep IN completed FOR dep IN s.depends_on)]

        IF len(ready) == 0 AND len(pending) > 0:
            RETURN PlanError("Deadlock: unresolvable dependencies")

        FOR step IN ready:
            result = dispatch_to_agent(step.agent, step.task)

            IF result.success:
                completed[step.step_id] = result
                REMOVE step FROM pending
            ELSE:
                failed[step.step_id] = result
                REMOVE step FROM pending
                -- Cancel all downstream steps that depend on this one
                cancel_downstream(pending, step.step_id)

    RETURN PlanResult(completed, failed)
```

### Step Lifecycle

| State | Meaning |
|---|---|
| `pending` | Waiting for dependencies to complete. |
| `dispatched` | Sent to the target agent, awaiting response. |
| `completed` | Agent returned a successful result. |
| `failed` | Agent returned an error or timed out. |
| `cancelled` | A dependency failed; this step was skipped. |

The frontend displays step states in the Agent Timeline component in the right sidebar, giving the user live visibility into plan progress.

---

## Message Flow

### Default Flow (Local UI)

```
┌──────┐         ┌───────────┐         ┌─────────┐
│ User │────────>│ Secretary │────────>│ Agent A │
│      │         │           │         │         │
│      │         │           │<────────│ (result)│
│      │<────────│ (summary) │         └─────────┘
└──────┘         └───────────┘
```

### Multi-Agent Flow

```
┌──────┐         ┌───────────┐         ┌─────────┐
│ User │────────>│ Secretary │──step1─>│ Agent A │
│      │         │           │<────────│ (done)  │
│      │         │           │         └─────────┘
│      │         │           │         ┌─────────┐
│      │         │           │──step2─>│ Agent B │
│      │         │           │<────────│ (done)  │
│      │<────────│ (summary) │         └─────────┘
└──────┘         └───────────┘
```

### Telegram Bridge Flow

```
┌──────────┐         ┌───────────────┐         ┌───────────┐         ┌─────────┐
│ Telegram │────────>│ Telegram      │────────>│ Secretary │────────>│ Agent A │
│ User     │         │ Bridge (bot)  │         │           │         │         │
│          │         │               │         │           │<────────│ (result)│
│          │<────────│               │<────────│ (summary) │         └─────────┘
└──────────┘         └───────────────┘         └───────────┘
```

In the Telegram flow the bridge process receives messages from the Telegram Bot API, forwards them to the Secretary over the Zentral IPC channel, collects the final summary, and posts it back to the Telegram chat.

---

## Direct Bypass

Users are not forced to route everything through the Secretary. Selecting a specific agent in the right sidebar switches the active message target so that subsequent messages go directly to that agent, bypassing Secretary dispatch entirely.

```
┌──────┐                           ┌─────────┐
│ User │──────(direct address)────>│ Agent B │
│      │<──────────────────────────│ (reply) │
└──────┘                           └─────────┘
```

### Rules

- The Secretary is the default target when no agent is explicitly selected.
- When the user selects an agent in the sidebar, all messages go to that agent until the user switches back to the Secretary or selects another agent.
- Direct messages are still logged in the Secretary session as observational entries so the Secretary retains awareness of what happened, but it does not intercept or modify them.
- The Secretary can reference direct-bypass interactions when building future execution plans ("Agent B already ran the linter in a previous direct message").

---

## Conflict Resolution

When two agents produce contradictory outputs during a multi-agent plan -- for example, one agent reports tests passing while another reports a build failure that should have blocked tests -- the Secretary does not silently pick a winner.

### Resolution Procedure

1. The Secretary detects the contradiction by comparing result summaries from the completed steps.
2. It pauses execution of any remaining plan steps that depend on the conflicting results.
3. It presents both results to the user with a clear description of the conflict.
4. The user chooses which result to trust or provides additional guidance.
5. The Secretary resumes the plan using the user's decision as the authoritative input.

```typescript
interface ConflictReport {
  plan_id: string;
  conflicting_steps: [string, string];  // step IDs
  summary_a: string;
  summary_b: string;
  question: string;   // Secretary's question to the user
}
```

### Example

```
Secretary: Steps step-2 (qa-lead) and step-3 (devops) produced conflicting
results.

  - qa-lead reports: "All 142 integration tests passed."
  - devops reports: "Build failed -- missing dependency libssl-dev."

A passing test suite with a failed build suggests the tests may have run
against a stale artifact. Which result should I trust, or would you like
me to re-run both steps?
```

The user's response is fed back into the Secretary session so it becomes part of the context for all future decisions in this plan.

---

## Secretary Session

The Secretary maintains a persistent Claude session using the `--resume` flag so that its context accumulates over time within a workspace session.

### Session Contents

The Secretary session context includes:

| Item | Source |
|---|---|
| System prompt with agent roster | Regenerated on roster changes |
| All user messages routed through the Secretary | Direct input |
| Delegation records (which agent, what task) | Generated by dispatch logic |
| Agent results and summaries | Returned from delegated agents |
| Direct-bypass observations | Logged passively |
| Conflict resolution decisions | User responses |
| Execution plan history | Stored as JSON blocks in context |

### Session Management

```rust
pub struct SecretarySession {
    /// Claude session ID for --resume.
    pub session_id: String,

    /// Running log of dispatched tasks and their outcomes.
    pub dispatch_log: Vec<DispatchEntry>,

    /// Currently active execution plan, if any.
    pub active_plan: Option<ExecutionPlan>,
}

pub struct DispatchEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub target_agent: String,
    pub task_summary: String,
    pub result_summary: Option<String>,
    pub status: DispatchStatus,
}

pub enum DispatchStatus {
    Pending,
    InProgress,
    Completed,
    Failed(String),
}
```

The session is persisted to disk alongside other Zentral session data so that restarting the application does not lose the Secretary's accumulated context. On session restore the Secretary's `--resume` flag reconnects it to the same Claude conversation.

---

## References

- [System Architecture](../01-architecture/system-architecture.md) -- overall layer model
- [Agent Adapters](../02-specifications/agent-adapters.md) -- per-agent PTY parsers
- [Agent Detection](../02-specifications/agent-detection.md) -- process-level agent identification
- [Session Management](../02-specifications/session-management.md) -- session persistence model

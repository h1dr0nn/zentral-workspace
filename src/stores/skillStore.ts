import { create } from "zustand";

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  builtin: boolean;
}

interface SkillStore {
  skills: Skill[];
  addSkill: (skill: Omit<Skill, "id" | "builtin">) => void;
  removeSkill: (id: string) => void;
  updateSkill: (id: string, patch: Partial<Skill>) => void;
}

const BUILTIN_SKILLS: Skill[] = [
  // Git
  { id: "commit", name: "commit", category: "Git", description: "Create a git commit with a descriptive message", prompt: "Review staged changes and create a commit with a clear, conventional commit message.", builtin: true },
  { id: "review-pr", name: "review-pr", category: "Git", description: "Review a pull request for issues and improvements", prompt: "Review the given pull request. Check for bugs, security issues, and suggest improvements.", builtin: true },
  { id: "git-pushing", name: "git-pushing", category: "Git", description: "Automate git push operations safely", prompt: "Push changes to remote, handling conflicts and ensuring branch safety.", builtin: true },
  { id: "changelog", name: "changelog", category: "Git", description: "Generate changelogs from git commits", prompt: "Create a user-facing changelog from recent git commits, grouping by type.", builtin: true },
  { id: "using-git-worktrees", name: "using-git-worktrees", category: "Git", description: "Create isolated git worktrees safely", prompt: "Create and manage git worktrees for parallel development.", builtin: true },

  // Code
  { id: "simplify", name: "simplify", category: "Code", description: "Review code for reuse, quality, and efficiency", prompt: "Review changed code for reuse opportunities, quality issues, and efficiency. Fix any issues found.", builtin: true },
  { id: "explain", name: "explain", category: "Code", description: "Explain how a piece of code works", prompt: "Explain the selected code in detail, covering what it does and important patterns.", builtin: true },
  { id: "fix", name: "fix", category: "Code", description: "Fix bugs or errors in the code", prompt: "Identify and fix any bugs or errors in the selected code. Explain what was wrong.", builtin: true },
  { id: "software-architecture", name: "software-architecture", category: "Code", description: "Design patterns, SOLID principles, architecture", prompt: "Implement appropriate design patterns and SOLID principles for the given problem.", builtin: true },
  { id: "prompt-engineering", name: "prompt-engineering", category: "Code", description: "Teach prompt engineering techniques", prompt: "Guide through prompt engineering techniques and patterns for effective AI usage.", builtin: true },
  { id: "artifacts-builder", name: "artifacts-builder", category: "Code", description: "Create multi-component HTML artifacts with React + Tailwind", prompt: "Create interactive HTML artifacts using React and Tailwind CSS.", builtin: true },
  { id: "mcp-builder", name: "mcp-builder", category: "Code", description: "Guide creation of MCP servers", prompt: "Guide the creation of Model Context Protocol servers step by step.", builtin: true },

  // Testing
  { id: "test", name: "test", category: "Testing", description: "Generate tests for the selected code", prompt: "Write comprehensive tests covering edge cases and expected behaviors.", builtin: true },
  { id: "tdd", name: "tdd", category: "Testing", description: "Test-driven development approach", prompt: "Implement features using TDD: write failing test first, then implementation.", builtin: true },
  { id: "test-fixing", name: "test-fixing", category: "Testing", description: "Detect failing tests and propose fixes", prompt: "Analyze failing tests, identify root causes, and propose fixes.", builtin: true },
  { id: "playwright", name: "playwright", category: "Testing", description: "Browser automation and web app testing", prompt: "Create Playwright tests for web application testing and automation.", builtin: true },
  { id: "webapp-testing", name: "webapp-testing", category: "Testing", description: "Test local web apps end-to-end", prompt: "Test local web applications using browser automation tools.", builtin: true },

  // Documentation
  { id: "docs", name: "docs", category: "Documentation", description: "Generate documentation for code", prompt: "Generate clear documentation including usage examples.", builtin: true },
  { id: "api-docs", name: "api-docs", category: "Documentation", description: "Generate API documentation", prompt: "Generate API docs with endpoints, parameters, and response examples.", builtin: true },
  { id: "skill-creator", name: "skill-creator", category: "Documentation", description: "Guidance for creating effective Claude Skills", prompt: "Guide the creation of well-structured Claude Skills with proper formatting.", builtin: true },

  // Research & Analysis
  { id: "deep-research", name: "deep-research", category: "Research", description: "Multi-step deep research on a topic", prompt: "Execute multi-step research, synthesizing findings into a comprehensive report.", builtin: true },
  { id: "brainstorming", name: "brainstorming", category: "Research", description: "Transform ideas into fully-formed designs", prompt: "Take rough ideas and develop them into well-structured, actionable designs.", builtin: true },
  { id: "root-cause-tracing", name: "root-cause-tracing", category: "Research", description: "Trace errors back to original triggers", prompt: "Trace the given error or issue back to its root cause through systematic analysis.", builtin: true },

  // Data & Files
  { id: "csv-summarizer", name: "csv-summarizer", category: "Data", description: "Analyze CSV files and generate insights", prompt: "Analyze the CSV data, generate summary statistics and key insights.", builtin: true },
  { id: "pdf", name: "pdf", category: "Data", description: "Extract text, tables, metadata from PDFs", prompt: "Extract and process content from PDF files.", builtin: true },
  { id: "docx", name: "docx", category: "Data", description: "Create, edit, analyze Word documents", prompt: "Work with Word documents: create, edit, and analyze content.", builtin: true },
  { id: "xlsx", name: "xlsx", category: "Data", description: "Spreadsheet manipulation with formulas and charts", prompt: "Manipulate spreadsheets with formulas, charts, and data transformations.", builtin: true },

  // DevOps
  { id: "aws-skills", name: "aws-skills", category: "DevOps", description: "AWS development with CDK and serverless patterns", prompt: "Develop AWS solutions using CDK best practices and serverless patterns.", builtin: true },
  { id: "finishing-branch", name: "finishing-branch", category: "DevOps", description: "Guide completion of development branch workflows", prompt: "Guide the completion of a development branch: cleanup, squash, rebase, merge.", builtin: true },
  { id: "subagent-dev", name: "subagent-dev", category: "DevOps", description: "Dispatch subagents for rapid parallel development", prompt: "Dispatch independent subagents for rapid parallel development tasks.", builtin: true },

  // Productivity
  { id: "kaizen", name: "kaizen", category: "Productivity", description: "Apply continuous improvement methodology", prompt: "Apply kaizen continuous improvement methodology to the given process or workflow.", builtin: true },
  { id: "ship-learn-next", name: "ship-learn-next", category: "Productivity", description: "Iterate on what to build or learn next", prompt: "Help decide what to build or learn next based on current progress and goals.", builtin: true },
  { id: "review-implementing", name: "review-implementing", category: "Productivity", description: "Evaluate code implementation plans", prompt: "Evaluate a proposed implementation plan for completeness and feasibility.", builtin: true },
];

export const useSkillStore = create<SkillStore>((set) => ({
  skills: BUILTIN_SKILLS,

  addSkill: (skill) => {
    const id = `skill-${Date.now()}`;
    set((s) => ({ skills: [...s.skills, { ...skill, id, builtin: false }] }));
  },

  removeSkill: (id) =>
    set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id || sk.builtin) })),

  updateSkill: (id, patch) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch } : sk)),
    })),
}));

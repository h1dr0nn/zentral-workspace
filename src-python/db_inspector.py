#!/usr/bin/env python3
"""
SQLite Database Inspector & Seeder for Zentral.

Usage:
    python db_inspector.py inspect tables
    python db_inspector.py inspect agents
    python db_inspector.py inspect messages <agent_id>
    python db_inspector.py inspect stats
    python db_inspector.py seed full
    python db_inspector.py seed agents 10
    python db_inspector.py seed messages <agent_id> 20
    python db_inspector.py seed skills
    python db_inspector.py seed clean
    python db_inspector.py migrate status
    python db_inspector.py migrate run
"""

import os
import sys
import json
import time
import uuid
import sqlite3
import argparse
import random

try:
    from tabulate import tabulate
except ImportError:
    def tabulate(data, headers, **kwargs):
        """Fallback table printer."""
        widths = [max(len(str(h)), *(len(str(row[i])) for row in data)) for i, h in enumerate(headers)]
        header_line = " | ".join(h.ljust(w) for h, w in zip(headers, widths))
        sep = "-+-".join("-" * w for w in widths)
        lines = [header_line, sep]
        for row in data:
            lines.append(" | ".join(str(v).ljust(w) for v, w in zip(row, widths)))
        return "\n".join(lines)

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    fake = None

# ---------- Schema ----------

INITIAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT '',
    session_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'stopped',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',
    is_builtin  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_skills (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL UNIQUE,
    created_at  INTEGER NOT NULL,
    last_opened INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id        TEXT PRIMARY KEY,
    agent_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role      TEXT NOT NULL,
    content   TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'app',
    timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened DESC);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);
"""

BUILTIN_SKILLS = [
    ("Code Review", "Review code for bugs, style, and best practices", "quality"),
    ("Refactoring", "Improve code structure without changing behavior", "quality"),
    ("Testing", "Write and run unit/integration tests", "quality"),
    ("Documentation", "Write docs, comments, and READMEs", "documentation"),
    ("Debugging", "Diagnose and fix bugs from logs/errors", "troubleshooting"),
    ("Deployment", "Build, deploy, and manage CI/CD pipelines", "devops"),
    ("Architecture", "Design system architecture and data models", "design"),
    ("Security", "Audit code for vulnerabilities and security issues", "security"),
]

DEFAULT_SETTINGS = {
    "theme": "dark",
    "font_size": "14",
    "font_family": "JetBrains Mono",
    "telegram_bot_token": "",
    "telegram_enabled": "false",
    "telegram_chat_ids": "[]",
    "max_concurrent_agents": "5",
    "default_shell": "",
    "chat_retention_days": "0",
    "editor_vim_mode": "false",
}

AGENT_NAMES = [
    ("Secretary", "secretary"), ("Code Wizard", "coder"), ("QA Lead", "reviewer"),
    ("Researcher", "researcher"), ("DevOps", "coder"), ("Architect", "reviewer"),
]

SAMPLE_MESSAGES = [
    ("user", "Can you review this pull request?"),
    ("assistant", "I'll take a look at the changes. Let me analyze the diff..."),
    ("user", "What do you think about the error handling?"),
    ("assistant", "The error handling looks solid overall. I noticed a few areas where we could improve:\n\n1. The `parse_config` function swallows errors silently\n2. Network timeouts aren't retried\n3. The fallback path doesn't log the original error\n\nWant me to suggest specific fixes?"),
    ("user", "Yes please, fix those issues"),
    ("assistant", "Done! I've made the following changes:\n\n- Added `thiserror` enum for typed errors in `parse_config`\n- Wrapped network calls with a retry loop (3 attempts, exponential backoff)\n- Added `tracing::warn!` for the fallback path with the original error context"),
    ("system", "Agent restarted due to session timeout"),
]


def now_epoch() -> int:
    return int(time.time())


def get_db_path(custom_path: str | None) -> str:
    if custom_path:
        return custom_path
    appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
    path = os.path.join(appdata, "com.zentral.app", "zentral.db")
    return path


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ---------- Inspect ----------

def inspect_tables(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    data = []
    for (table_name,) in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM [{table_name}]").fetchone()[0]
        data.append((table_name, count))
    print(tabulate(data, headers=["Table", "Row Count"], tablefmt="simple"))


def inspect_schema(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name")
    for (sql,) in cursor:
        print(f"{sql};\n")


def inspect_agents(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("""
        SELECT a.id, a.name, a.role, a.status, a.session_id,
               datetime(a.created_at, 'unixepoch') as created,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.agent_id = a.id) as msg_count,
               (SELECT GROUP_CONCAT(s.name, ', ')
                FROM skills s JOIN agent_skills as2 ON as2.skill_id = s.id
                WHERE as2.agent_id = a.id) as skills
        FROM agents a ORDER BY a.created_at DESC
    """)
    rows = cursor.fetchall()
    if not rows:
        print("No agents found.")
        return
    print(tabulate(rows,
        headers=["ID", "Name", "Role", "Status", "Session", "Created", "Messages", "Skills"],
        tablefmt="simple", maxcolwidths=[8, 15, 12, 8, 8, 19, 5, 30]))


def inspect_skills(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("""
        SELECT s.id, s.name, s.category, s.description,
               CASE s.is_builtin WHEN 1 THEN 'builtin' ELSE 'custom' END as type,
               (SELECT COUNT(*) FROM agent_skills a WHERE a.skill_id = s.id) as agents
        FROM skills s ORDER BY s.category, s.name
    """)
    rows = cursor.fetchall()
    if not rows:
        print("No skills found.")
        return
    print(tabulate(rows,
        headers=["ID", "Name", "Category", "Description", "Type", "Agents"],
        tablefmt="simple", maxcolwidths=[8, 15, 12, 40, 7, 6]))


def inspect_messages(conn: sqlite3.Connection, agent_id: str, limit: int = 20) -> None:
    cursor = conn.execute("""
        SELECT m.id, m.role, m.source,
               SUBSTR(m.content, 1, 80) as content_preview,
               datetime(m.timestamp, 'unixepoch') as time
        FROM chat_messages m
        WHERE m.agent_id LIKE ?
        ORDER BY m.timestamp DESC LIMIT ?
    """, (f"{agent_id}%", limit))
    rows = cursor.fetchall()
    if not rows:
        print(f"No messages found for agent '{agent_id}'.")
        return
    print(tabulate(rows,
        headers=["ID", "Role", "Source", "Content", "Time"],
        tablefmt="simple", maxcolwidths=[8, 9, 8, 60, 19]))


def inspect_projects(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("""
        SELECT id, name, path, datetime(last_opened, 'unixepoch') as last_opened
        FROM projects ORDER BY last_opened DESC
    """)
    rows = cursor.fetchall()
    if not rows:
        print("No projects found.")
        return
    print(tabulate(rows, headers=["ID", "Name", "Path", "Last Opened"], tablefmt="simple"))


def inspect_settings(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("SELECT key, value FROM settings ORDER BY key")
    rows = cursor.fetchall()
    if not rows:
        print("No settings found.")
        return
    print(tabulate(rows, headers=["Key", "Value"], tablefmt="simple"))


def inspect_stats(conn: sqlite3.Connection, db_path: str) -> None:
    agent_count = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
    skill_count = conn.execute("SELECT COUNT(*) FROM skills").fetchone()[0]
    project_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    message_count = conn.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
    version = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_version").fetchone()[0]
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    print(f"  Database:    {db_path}")
    print(f"  Size:        {db_size / 1024:.1f} KB")
    print(f"  Schema ver:  {version}")
    print(f"  Agents:      {agent_count}")
    print(f"  Skills:      {skill_count}")
    print(f"  Projects:    {project_count}")
    print(f"  Messages:    {message_count}")

    # Per-agent message count
    cursor = conn.execute("""
        SELECT a.name, COUNT(m.id)
        FROM agents a LEFT JOIN chat_messages m ON m.agent_id = a.id
        GROUP BY a.id ORDER BY COUNT(m.id) DESC
    """)
    rows = cursor.fetchall()
    if rows:
        print(f"\n  Messages per agent:")
        for name, count in rows:
            print(f"    {name}: {count}")


# ---------- Seed ----------

def seed_skills(conn: sqlite3.Connection) -> list[str]:
    now = now_epoch()
    skill_ids = []
    for name, desc, category in BUILTIN_SKILLS:
        sid = str(uuid.uuid4())
        try:
            conn.execute(
                "INSERT INTO skills (id, name, description, category, is_builtin, created_at) VALUES (?,?,?,?,1,?)",
                (sid, name, desc, category, now))
            skill_ids.append(sid)
        except sqlite3.IntegrityError:
            existing = conn.execute("SELECT id FROM skills WHERE name=?", (name,)).fetchone()
            if existing:
                skill_ids.append(existing[0])
    conn.commit()
    print(f"  Seeded {len(skill_ids)} skills")
    return skill_ids


def seed_agents(conn: sqlite3.Connection, count: int, skill_ids: list[str]) -> list[str]:
    now = now_epoch()
    agent_ids = []
    statuses = ["stopped", "running", "error", "stopped", "stopped"]
    for i in range(count):
        aid = str(uuid.uuid4())
        name, role = AGENT_NAMES[i % len(AGENT_NAMES)]
        if i >= len(AGENT_NAMES) and fake:
            name = fake.first_name() + " Bot"
        status = statuses[i % len(statuses)]
        conn.execute(
            "INSERT INTO agents (id, name, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (aid, name, role, status, now - random.randint(0, 86400), now))
        agent_ids.append(aid)

        # Assign 2-4 random skills
        if skill_ids:
            for sid in random.sample(skill_ids, min(random.randint(2, 4), len(skill_ids))):
                try:
                    conn.execute("INSERT INTO agent_skills (agent_id, skill_id) VALUES (?,?)", (aid, sid))
                except sqlite3.IntegrityError:
                    pass

    conn.commit()
    print(f"  Seeded {count} agents")
    return agent_ids


def seed_messages(conn: sqlite3.Connection, agent_id: str, count: int) -> None:
    now = now_epoch()
    sources = ["app", "app", "app", "telegram"]
    for i in range(count):
        role, content = SAMPLE_MESSAGES[i % len(SAMPLE_MESSAGES)]
        if fake and random.random() < 0.5:
            content = fake.paragraph(nb_sentences=random.randint(1, 4))
        source = sources[i % len(sources)]
        conn.execute(
            "INSERT INTO chat_messages (id, agent_id, role, content, source, timestamp) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), agent_id, role, content, source, now - (count - i) * 60))
    conn.commit()
    print(f"  Seeded {count} messages for agent {agent_id[:8]}...")


def seed_projects(conn: sqlite3.Connection) -> None:
    now = now_epoch()
    projects = [
        ("zentral", "C:/Projects/Tools/zentral-workspace"),
        ("my-web-app", "C:/Projects/my-web-app"),
        ("rust-playground", "C:/Projects/rust-playground"),
    ]
    for name, path in projects:
        try:
            conn.execute(
                "INSERT INTO projects (id, name, path, created_at, last_opened) VALUES (?,?,?,?,?)",
                (str(uuid.uuid4()), name, path, now - 86400, now - random.randint(0, 3600)))
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    print(f"  Seeded {len(projects)} projects")


def seed_settings(conn: sqlite3.Connection) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, value))
    conn.commit()
    print(f"  Seeded {len(DEFAULT_SETTINGS)} settings")


def seed_full(conn: sqlite3.Connection) -> None:
    print("Seeding full test dataset...")
    skill_ids = seed_skills(conn)
    agent_ids = seed_agents(conn, 5, skill_ids)
    for aid in agent_ids:
        seed_messages(conn, aid, random.randint(8, 15))
    seed_projects(conn)
    seed_settings(conn)
    print("Done!")


def seed_clean(conn: sqlite3.Connection) -> None:
    tables = ["chat_messages", "agent_skills", "agents", "skills", "projects", "settings"]
    for table in tables:
        conn.execute(f"DELETE FROM [{table}]")
    conn.commit()
    print("All data cleared.")


# ---------- Migrate ----------

def migrate_status(conn: sqlite3.Connection) -> None:
    try:
        cursor = conn.execute("SELECT version, datetime(applied_at, 'unixepoch') FROM schema_version ORDER BY version")
        rows = cursor.fetchall()
        if rows:
            print(tabulate(rows, headers=["Version", "Applied At"], tablefmt="simple"))
        else:
            print("No migrations applied yet.")
    except sqlite3.OperationalError:
        print("schema_version table does not exist. Run 'migrate run' first.")


def migrate_run(conn: sqlite3.Connection) -> None:
    print("Applying initial schema...")
    conn.executescript(INITIAL_SCHEMA)
    try:
        conn.execute("INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, ?)", (now_epoch(),))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    print("Schema applied successfully.")


# ---------- Main ----------

def main() -> None:
    parser = argparse.ArgumentParser(description="Zentral SQLite Database Inspector & Seeder")
    parser.add_argument("--db", type=str, default=None, help="Path to zentral.db")
    subparsers = parser.add_subparsers(dest="command")

    # inspect
    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("target", choices=["tables", "schema", "agents", "skills",
                                                     "messages", "projects", "settings", "stats"])
    inspect_parser.add_argument("args", nargs="*")

    # seed
    seed_parser = subparsers.add_parser("seed")
    seed_parser.add_argument("target", choices=["full", "agents", "messages", "skills", "clean"])
    seed_parser.add_argument("args", nargs="*")

    # migrate
    migrate_parser = subparsers.add_parser("migrate")
    migrate_parser.add_argument("target", choices=["status", "run"])

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    db_path = get_db_path(args.db)
    print(f"Database: {db_path}\n")

    # Create directory if needed
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = connect(db_path)

    if args.command == "migrate":
        if args.target == "status":
            migrate_status(conn)
        elif args.target == "run":
            migrate_run(conn)

    elif args.command == "inspect":
        handlers = {
            "tables": lambda: inspect_tables(conn),
            "schema": lambda: inspect_schema(conn),
            "agents": lambda: inspect_agents(conn),
            "skills": lambda: inspect_skills(conn),
            "messages": lambda: inspect_messages(conn, args.args[0] if args.args else ""),
            "projects": lambda: inspect_projects(conn),
            "settings": lambda: inspect_settings(conn),
            "stats": lambda: inspect_stats(conn, db_path),
        }
        handlers[args.target]()

    elif args.command == "seed":
        # Ensure schema exists
        migrate_run(conn)

        if args.target == "full":
            seed_full(conn)
        elif args.target == "skills":
            seed_skills(conn)
        elif args.target == "agents":
            count = int(args.args[0]) if args.args else 5
            skill_ids = [r[0] for r in conn.execute("SELECT id FROM skills").fetchall()]
            seed_agents(conn, count, skill_ids)
        elif args.target == "messages":
            if len(args.args) < 1:
                print("Usage: seed messages <agent_id> [count]")
                return
            agent_id = args.args[0]
            count = int(args.args[1]) if len(args.args) > 1 else 20
            seed_messages(conn, agent_id, count)
        elif args.target == "clean":
            seed_clean(conn)

    conn.close()


if __name__ == "__main__":
    main()

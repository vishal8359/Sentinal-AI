import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.environ.get("SENTINELAI_DB_PATH", str(BASE_DIR / "data" / "sentinelai.db"))


def ensure_db_dir():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


def get_connection():
    ensure_db_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    ensure_db_dir()
    conn = get_connection()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved_at TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            status TEXT NOT NULL,
            input TEXT NOT NULL,
            output TEXT NOT NULL,
            confidence REAL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        );

        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            decided_at TEXT,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        );
        """
    )
    conn.commit()
    conn.close()


def ensure_incident(incident_id: str):
    conn = get_connection()
    existing = conn.execute("SELECT id FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    if existing:
        conn.close()
        return
    conn.execute(
        "INSERT INTO incidents (id, title, severity, status, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            incident_id,
            f"Payment Service incident {incident_id}",
            "high",
            "open",
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def get_incident(incident_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def record_agent_run(incident_id: str, agent_name: str, status: str, input_text: str, output_text: str, confidence: float | None = None):
    conn = get_connection()
    conn.execute(
        "INSERT INTO agent_runs (incident_id, agent_name, status, input, output, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            incident_id,
            agent_name,
            status,
            input_text,
            output_text,
            confidence,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def list_agent_runs(incident_id: str):
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, incident_id, agent_name, status, input, output, confidence, timestamp FROM agent_runs WHERE incident_id = ? ORDER BY timestamp ASC",
        (incident_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_approval(incident_id: str, action: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO approvals (incident_id, action, status, decided_at) VALUES (?, ?, ?, ?)",
        (incident_id, action, "pending", None),
    )
    conn.commit()
    row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return row_id


def get_pending_approval(incident_id: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM approvals WHERE incident_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
        (incident_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_approval_status(incident_id: str, status: str):
    conn = get_connection()
    approval = get_pending_approval(incident_id)
    if not approval:
        conn.close()
        return None
    conn.execute(
        "UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?",
        (status, datetime.now(timezone.utc).isoformat(), approval["id"]),
    )
    conn.commit()
    conn.close()
    return approval


def set_incident_status(incident_id: str, status: str):
    conn = get_connection()
    conn.execute("UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?", (status, datetime.now(timezone.utc).isoformat() if status == "resolved" else None, incident_id))
    conn.commit()
    conn.close()


def list_approvals(incident_id: str):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM approvals WHERE incident_id = ? ORDER BY id ASC", (incident_id,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

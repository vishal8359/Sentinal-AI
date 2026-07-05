import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_connection, init_db
from app.main import approve_incident, reject_incident, run_incident_workflow


class ApprovalGateTests(unittest.TestCase):
    def setUp(self):
        init_db()
        conn = get_connection()
        conn.execute("DELETE FROM agent_runs")
        conn.execute("DELETE FROM approvals")
        conn.execute("DELETE FROM incidents")
        conn.commit()
        conn.close()
        self.incident_id = "test-incident"

    def test_reject_blocks_execution(self):
        result = run_incident_workflow(self.incident_id, log_excerpt="Payment service DB timeout bursts with CPU 96%")
        self.assertEqual(result["approval"]["status"], "pending")

        reject_incident(self.incident_id)

        conn = get_connection()
        execution_rows = conn.execute(
            "SELECT id FROM agent_runs WHERE incident_id = ? AND agent_name = ?",
            (self.incident_id, "Execution"),
        ).fetchall()
        self.assertEqual(len(execution_rows), 0)

    def test_approve_logs_execution(self):
        run_incident_workflow(self.incident_id, log_excerpt="Payment service DB timeout bursts with CPU 96%")
        approve_incident(self.incident_id)

        conn = get_connection()
        execution_rows = conn.execute(
            "SELECT id FROM agent_runs WHERE incident_id = ? AND agent_name = ?",
            (self.incident_id, "Execution"),
        ).fetchall()
        self.assertEqual(len(execution_rows), 1)


if __name__ == "__main__":
    unittest.main()

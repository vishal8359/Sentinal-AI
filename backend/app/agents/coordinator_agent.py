from __future__ import annotations

from app.agents.knowledge_agent import run_knowledge_agent
from app.agents.log_agent import run_log_agent
from app.agents.remediation_agent import run_remediation_agent
from app.agents.root_cause_agent import run_root_cause_agent
from app.db import create_approval, ensure_incident, record_agent_run


def run_incident_workflow(incident_id: str, log_excerpt: str | None = None) -> dict:
    ensure_incident(incident_id)

    record_agent_run(incident_id, "Coordinator", "pending", "Starting incident investigation", "")
    record_agent_run(incident_id, "Coordinator", "running", "Running the agent sequence", "")

    log_output = run_log_agent(incident_id, log_excerpt=log_excerpt)
    record_agent_run(incident_id, "Log Analysis", "done", log_excerpt or "sample log", str(log_output), 0.91)

    knowledge_output = run_knowledge_agent(log_output)
    record_agent_run(incident_id, "Knowledge", "done", "Runbook retrieval", str(knowledge_output), 0.88)

    root_cause_output = run_root_cause_agent(log_output, knowledge_output)
    record_agent_run(incident_id, "Root Cause", "done", "Ranked hypotheses", str(root_cause_output), root_cause_output["hypotheses"][0]["confidence"])

    remediation_output = run_remediation_agent(root_cause_output)
    record_agent_run(incident_id, "Remediation", "done", "Proposed actions", str(remediation_output), 0.9)

    approval_id = create_approval(incident_id, remediation_output["actions"][0]["action"])

    return {
        "incident_id": incident_id,
        "log_output": log_output,
        "knowledge_output": knowledge_output,
        "root_cause_output": root_cause_output,
        "remediation_output": remediation_output,
        "approval": {"id": approval_id, "status": "pending"},
    }

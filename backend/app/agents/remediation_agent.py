from __future__ import annotations


def run_remediation_agent(root_cause_output: dict) -> dict:
    top_cause = root_cause_output.get("hypotheses", [{}])[0]
    cause_name = top_cause.get("cause", "Unknown bottleneck")
    if "Database connection pool saturation" in cause_name:
        actions = [
            {
                "action": "Throttle background jobs and restart the connection pool",
                "risk": "medium",
                "confidence": 0.9,
                "estimated_downtime": "10-15 min",
            },
            {
                "action": "Scale the payment worker replicas temporarily",
                "risk": "low",
                "confidence": 0.82,
                "estimated_downtime": "5 min",
            },
        ]
    else:
        actions = [
            {
                "action": "Reduce the worker concurrency and validate saturation metrics",
                "risk": "medium",
                "confidence": 0.74,
                "estimated_downtime": "15 min",
            }
        ]

    return {"actions": actions, "top_cause": cause_name}

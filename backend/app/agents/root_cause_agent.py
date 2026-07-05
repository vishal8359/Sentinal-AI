from __future__ import annotations


def run_root_cause_agent(log_output: dict, knowledge_output: dict) -> dict:
    hypotheses = []
    if any("timeout" in item.lower() for item in [log_output.get("summary", ""), log_output.get("raw_excerpt", "")]):
        hypotheses.append(
            {
                "cause": "Database connection pool saturation",
                "confidence": 0.91,
                "justification": "The log shows repeated DB timeouts and the knowledge snippets point to connection starvation during burst traffic.",
            }
        )
    if any("cpu" in item.lower() for item in [log_output.get("summary", ""), log_output.get("raw_excerpt", "")]):
        hypotheses.append(
            {
                "cause": "CPU pressure from background workers",
                "confidence": 0.72,
                "justification": "CPU utilization hit 96%, which can amplify queueing and latency during the same window.",
            }
        )

    if not hypotheses:
        hypotheses.append(
            {
                "cause": "Unknown service bottleneck",
                "confidence": 0.33,
                "justification": "Fallback hypothesis generated from the available diagnostic output.",
            }
        )

    return {"hypotheses": sorted(hypotheses, key=lambda item: item["confidence"], reverse=True)}

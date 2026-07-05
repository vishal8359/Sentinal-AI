from __future__ import annotations


RUNBOOK_SNIPPETS = [
    {
        "title": "Redis memory exhaustion runbook",
        "content": "Redis memory pressure causes latency spikes and query timeouts; reduce key churn or expand memory to restore stability.",
    },
    {
        "title": "Database connection pool leak postmortem",
        "content": "A connection pool leak starves the application tier and causes repeated DB timeouts under burst traffic.",
    },
    {
        "title": "Payment service rollback checklist",
        "content": "If upstream payments are timing out, isolate the database tier, pause background jobs, and verify connection saturation.",
    },
    {
        "title": "Cache warming playbook",
        "content": "Warm the cache proactively after a restart to avoid cold-start latency and request amplification.",
    },
]


def run_knowledge_agent(log_output: dict, top_k: int = 3) -> dict:
    query = " ".join([log_output.get("summary", ""), log_output.get("likely_component", "")])
    query_words = set(query.lower().split())
    scored = []
    for snippet in RUNBOOK_SNIPPETS:
        content_words = set(snippet["content"].lower().split())
        overlap = len(query_words & content_words)
        score = round(overlap / max(1, len(query_words)), 2)
        scored.append({"title": snippet["title"], "content": snippet["content"], "score": score})

    scored.sort(key=lambda item: item["score"], reverse=True)
    return {"snippets": scored[:top_k]}

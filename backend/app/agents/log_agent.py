from __future__ import annotations


SAMPLE_LOG = """
2026-07-05T10:03:12Z payment-service api[2212] ERROR DB timeout while reading order history
2026-07-05T10:03:18Z payment-service api[2212] ERROR repeated DB timeout bursts
2026-07-05T10:03:24Z payment-service api[2212] WARN latency spike 712ms p95
2026-07-05T10:03:30Z payment-service api[2212] ERROR CPU utilization reached 96%
"""


def run_log_agent(incident_id: str, log_excerpt: str | None = None) -> dict:
    excerpt = log_excerpt or SAMPLE_LOG
    lowered = excerpt.lower()
    anomalies = []
    if "timeout" in lowered:
        anomalies.append("Repeated database timeouts")
    if "cpu" in lowered:
        anomalies.append("CPU saturation")
    if "latency" in lowered:
        anomalies.append("Latency spike")

    return {
        "incident_id": incident_id,
        "summary": "Payment service is showing repeated DB timeouts with elevated latency and CPU pressure.",
        "anomalies": anomalies,
        "timestamps": ["2026-07-05T10:03:12Z", "2026-07-05T10:03:18Z", "2026-07-05T10:03:24Z"],
        "likely_component": "payment-database",
        "raw_excerpt": excerpt,
    }

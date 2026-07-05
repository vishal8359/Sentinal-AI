from pydantic import BaseModel


class IncidentSummary(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    created_at: str


class AgentRunPayload(BaseModel):
    incident_id: str
    agent_name: str
    status: str
    input: str
    output: str
    confidence: float | None = None


class RunLogAgentRequest(BaseModel):
    log_excerpt: str | None = None

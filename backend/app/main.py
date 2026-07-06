from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.agents.coordinator_agent import run_incident_workflow
from app.agents.log_agent import run_log_agent
from app.db import (
    create_approval,
    ensure_incident,
    get_incident,
    get_pending_approval,
    list_agent_runs,
    list_approvals,
    record_agent_run,
    set_incident_status,
    update_approval_status,
)
from app.models import RunLogAgentRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db import init_db

    init_db()
    ensure_incident("demo-incident")
    yield


app = FastAPI(title="SentinelAI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.connections = {}


async def broadcast_update(incident_id: str, payload: dict[str, Any]):
    connections = app.state.connections.get(incident_id, set())
    dead: list[WebSocket] = []
    for connection in list(connections):
        try:
            await connection.send_json(payload)
        except Exception:
            dead.append(connection)
    for connection in dead:
        connections.discard(connection)


@app.get("/health")
def health_check() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/incidents/{incident_id}/run-log-agent")
def run_log_agent_endpoint(incident_id: str, payload: RunLogAgentRequest | None = None) -> dict[str, Any]:
    ensure_incident(incident_id)
    result = run_log_agent(incident_id, log_excerpt=payload.log_excerpt if payload else None)
    record_agent_run(incident_id, "Log Analysis", "done", payload.log_excerpt or "sample log", json.dumps(result), 0.91)
    return {"incident_id": incident_id, "result": result}


@app.post("/incidents/{incident_id}/run")
async def run_incident_endpoint(incident_id: str, payload: RunLogAgentRequest | None = None) -> dict[str, Any]:
    ensure_incident(incident_id)
    result = run_incident_workflow(incident_id, log_excerpt=payload.log_excerpt if payload else None)
    await broadcast_update(incident_id, {"type": "workflow_complete", "data": result})
    return result


def approve_incident(incident_id: str) -> dict[str, Any]:
    ensure_incident(incident_id)
    approval = get_pending_approval(incident_id)
    if not approval:
        raise HTTPException(status_code=404, detail="No pending approval found")

    updated_approval = update_approval_status(incident_id, "approved")
    set_incident_status(incident_id, "resolved")
    record_agent_run(incident_id, "Execution", "done", "Approved by human", "Execution successful (simulated)", 1.0)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(broadcast_update(incident_id, {"type": "approval", "status": "approved", "incident_id": incident_id}))
    else:
        loop.create_task(broadcast_update(incident_id, {"type": "approval", "status": "approved", "incident_id": incident_id}))
    return {"incident_id": incident_id, "status": "resolved", "approval": updated_approval}


@app.post("/incidents/{incident_id}/approve")
async def approve_incident_route(incident_id: str) -> dict[str, Any]:
    return approve_incident(incident_id)


def reject_incident(incident_id: str) -> dict[str, Any]:
    ensure_incident(incident_id)
    approval = get_pending_approval(incident_id)
    if not approval:
        raise HTTPException(status_code=404, detail="No pending approval found")

    updated_approval = update_approval_status(incident_id, "rejected")
    set_incident_status(incident_id, "open")
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(broadcast_update(incident_id, {"type": "approval", "status": "rejected", "incident_id": incident_id}))
    else:
        loop.create_task(broadcast_update(incident_id, {"type": "approval", "status": "rejected", "incident_id": incident_id}))
    return {"incident_id": incident_id, "status": "open", "approval": updated_approval}


@app.post("/incidents/{incident_id}/reject")
async def reject_incident_route(incident_id: str) -> dict[str, Any]:
    return reject_incident(incident_id)


@app.get("/incidents/{incident_id}")
def get_incident_details(incident_id: str) -> dict[str, Any]:
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {
        "incident": incident,
        "agent_runs": list_agent_runs(incident_id),
        "approvals": list_approvals(incident_id),
    }


@app.websocket("/ws/incidents/{incident_id}")
async def incident_socket(websocket: WebSocket, incident_id: str):
    await websocket.accept()
    app.state.connections.setdefault(incident_id, set()).add(websocket)
    await websocket.send_json({"type": "connected", "incident_id": incident_id})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        app.state.connections.get(incident_id, set()).discard(websocket)

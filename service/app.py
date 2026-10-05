import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

import actors
import notes
import store

mcp = MCPServer("job-orchestrator")
NAMES = "linkedin-jobs, indeed-jobs, glassdoor-jobs"


@mcp.tool(description="List runnable actors. Each entry includes a sample input, speed, and why fields are empty. Valid names: linkedin-jobs, indeed-jobs, glassdoor-jobs.")
def list_actors() -> dict:
    return {
        "actors": [
            {"name": actor["name"], "title": actor["title"], "description": actor["description"], **notes.limits(actor["name"])}
            for actor in actors.ACTORS
        ]
    }


@mcp.tool(description="Get one actor, including its input schema, sample input, and empty-field reasons.")
def get_actor(name: str) -> dict:
    actor = actors.actor_by_name(name)
    if not actor:
        raise ValueError(f"Actor not found. Valid names: {NAMES}")
    return {**actor, **notes.limits(name)}


@mcp.tool(description="Start an actor run. Does not return jobs. Poll get_run with the returned runId until SUCCEEDED or FAILED, then call get_dataset_items. linkedin-jobs needs search_term and location. indeed-jobs and glassdoor-jobs need search_term; country defaults to Germany.")
def call_actor(name: str, input: dict) -> dict:
    if name == "linkedin-jobs":
        started = actors.start_linkedin(input or {})
    elif name == "indeed-jobs":
        started = actors.start_indeed(input or {})
    elif name == "glassdoor-jobs":
        started = actors.start_glassdoor(input or {})
    else:
        raise ValueError(f"Actor not found. Valid names: {NAMES}")
    started["next"] = "Poll get_run with this runId until status is SUCCEEDED or FAILED."
    started["limitations"] = notes.limits(name)
    return started


@mcp.tool(description="Get actor run status. Returns durationSeconds, the agency note, and the next call. Poll until SUCCEEDED or FAILED.")
def get_run(runId: str) -> dict:
    run = store.get_run(runId)
    if not run:
        raise ValueError("Run not found")
    done = run["status"] in {"SUCCEEDED", "FAILED"}
    return {
        "runId": run["id"],
        "actorName": run["actor_name"],
        "status": run["status"],
        "datasetId": run["dataset_id"],
        "jobsFound": run["jobs_found"],
        "note": run.get("note"),
        "durationSeconds": notes.duration_seconds(run.get("started_at"), run.get("finished_at")),
        "limitations": notes.limits(run["actor_name"]),
        "errorMessage": run["error_message"],
        "next": "Call get_dataset_items with this datasetId and limit 5." if done and run["status"] == "SUCCEEDED" else "Poll get_run again.",
    }


@mcp.tool(description="Read dataset items. Descriptions are omitted unless includeDescription is true, so the model can keep the rows in context. The response includes fieldNotes explaining empty fields.")
def get_dataset_items(datasetId: str, limit: int = 5, offset: int = 0, includeDescription: bool = False) -> dict:
    total, items = store.get_items(datasetId, max(1, min(limit, 100)), max(0, offset))
    if not includeDescription:
        items = [{key: value for key, value in item.items() if key != "description"} for item in items]
    return {
        "datasetId": datasetId,
        "total": total,
        "offset": offset,
        "limit": limit,
        "fieldNotes": notes.field_notes(items),
        "next": "Ask for includeDescription true on one job if you need the posting text.",
        "items": items,
    }


@asynccontextmanager
async def lifespan(_app: FastAPI):
    store.init_db()
    async with mcp.session_manager.run():
        yield


app = FastAPI(lifespan=lifespan, redirect_slashes=False)


@app.get("/health")
def health():
    return {"status": "ok", "fixture": os.getenv("ALLOW_FIXTURE") == "1"}


def transport_security() -> TransportSecuritySettings:
    extra = [host.strip() for host in os.getenv("MCP_ALLOWED_HOSTS", "").split(",") if host.strip()]
    hosts = ["job-orchestrator.onrender.com", "localhost:*", "127.0.0.1:*", *extra]
    origins = [f"https://{host}" for host in hosts if ":" not in host]
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )


app.mount(
    "/mcp",
    mcp.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        transport_security=transport_security(),
    ),
)


@app.middleware("http")
async def accept_mcp_without_slash(request: Request, call_next):
    if request.scope["path"] == "/mcp":
        request.scope["path"] = "/mcp/"
        request.scope["raw_path"] = b"/mcp/"
    return await call_next(request)


@app.middleware("http")
async def require_token(request: Request, call_next):
    expected = os.getenv("MCP_TOKEN")
    if expected and request.url.path.startswith("/mcp"):
        header = request.headers.get("authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else request.headers.get("x-mcp-token", "")
        if token != expected:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)

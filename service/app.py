import os
import time
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

import actors
import notes
import store

mcp = MCPServer("job-orchestrator")
NAMES = "linkedin-jobs, indeed-jobs, glassdoor-jobs"
DEFAULT_FIELDS = "id,title,company,location,url,postedAt,workplaceType,applicantsCount"
ActorName = Literal["linkedin-jobs", "indeed-jobs", "glassdoor-jobs"]


@mcp.tool(description="List runnable actors. Each entry includes a sample input, speed, and why fields are empty. Valid names: linkedin-jobs, indeed-jobs, glassdoor-jobs.")
def list_actors() -> dict:
    return {
        "actors": [
            {"name": actor["name"], "title": actor["title"], "description": actor["description"], **notes.limits(actor["name"])}
            for actor in actors.ACTORS
        ]
    }


@mcp.tool(description="Get one actor, including its input schema, sample input, and empty-field reasons.")
def get_actor(name: ActorName) -> dict:
    actor = actors.actor_by_name(name)
    if not actor:
        raise ValueError(f"Actor not found. Valid names: {NAMES}")
    return {**actor, **notes.limits(name)}


@mcp.tool(description="Start an actor run. name is linkedin-jobs, indeed-jobs, or glassdoor-jobs. Does not return jobs. Poll get_run with the returned runId until SUCCEEDED or FAILED, then call get_dataset_items. linkedin-jobs needs search_term and location. indeed-jobs and glassdoor-jobs need search_term; country defaults to Germany. LinkedIn directUrl is always null. Glassdoor description is always null.")
def call_actor(name: ActorName, input: dict) -> dict:
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


@mcp.tool(description="Get actor run status. Returns durationSeconds, the agency note, and the next call. Poll until SUCCEEDED or FAILED. note is empty until the run finishes.")
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


@mcp.tool(description="Read dataset items. fields defaults to id,title,company,location,url,postedAt,workplaceType,applicantsCount. Pass fields=description for one job only. includeDescription adds the posting text.")
def get_dataset_items(datasetId: str, limit: int = 5, offset: int = 0, fields: str = DEFAULT_FIELDS, includeDescription: bool = False) -> dict:
    total, items = store.get_items(datasetId, max(1, min(limit, 100)), max(0, offset))
    return _project(datasetId, total, offset, limit, items, fields, includeDescription)


def _project(dataset_id, total, offset, limit, items, fields, include_description):
    field_notes = notes.field_notes(items)
    wanted = [part.strip() for part in (fields or DEFAULT_FIELDS).split(",") if part.strip()]
    if include_description and "description" not in wanted:
        wanted.append("description")
    projected = [{key: item[key] for key in wanted if key in item} for item in items]
    return {
        "datasetId": dataset_id,
        "total": total,
        "offset": offset,
        "limit": limit,
        "fields": wanted,
        "fieldNotes": field_notes,
        "next": "Pass fields=description for one chosen job if you need the posting text.",
        "items": projected,
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


@app.get("/api/jobs")
def api_jobs(
    actor: ActorName = Query(description="linkedin-jobs, indeed-jobs, or glassdoor-jobs"),
    search_term: str = Query(min_length=1),
    location: str = "",
    country: str = "Germany",
    hours_old: int = 168,
    limit: int = 5,
):
    payload = {"search_term": search_term, "location": location, "country": country, "hours_old": hours_old, "results_wanted": max(1, min(limit, 25))}
    started = call_actor(actor, payload)
    deadline = time.time() + 110
    run = None
    while time.time() < deadline:
        run = store.get_run(started["runId"])
        if run and run["status"] in {"SUCCEEDED", "FAILED"}:
            break
        time.sleep(1)
    if not run or run["status"] != "SUCCEEDED":
        return JSONResponse({"error": (run or {}).get("error_message") or "Timed out", "runId": started["runId"]}, status_code=504)
    _total, items = store.get_items(run["dataset_id"], payload["results_wanted"], 0)
    projected = _project(run["dataset_id"], _total, 0, payload["results_wanted"], items, DEFAULT_FIELDS, False)
    return {
        "actor": actor,
        "durationSeconds": notes.duration_seconds(run.get("started_at"), run.get("finished_at")),
        "note": run.get("note"),
        "fieldNotes": projected["fieldNotes"],
        "jobs": projected["items"],
    }


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

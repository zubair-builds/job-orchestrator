import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

import actors
import boards
import store

boards.register(actors)
mcp = MCPServer("job-orchestrator")


@mcp.tool(description="List runnable job actors.")
def list_actors() -> dict:
    return {"actors": [{"name": actor["name"], "title": actor["title"], "description": actor["description"]} for actor in actors.ACTORS]}


@mcp.tool(description="Get one actor, including its input schema.")
def get_actor(name: str) -> dict:
    actor = actors.actor_by_name(name)
    if not actor:
        raise ValueError("Actor not found")
    return actor


@mcp.tool(description="Start an actor run. Returns runId and datasetId, not the listings.")
def call_actor(name: str, input: dict) -> dict:
    if name == "linkedin-jobs":
        return actors.start_linkedin(input or {})
    if name == "indeed-jobs":
        return actors.start_indeed(input or {})
    if name == "glassdoor-jobs":
        return boards.start_glassdoor(input or {})
    if name == "google-jobs":
        return boards.start_google(input or {})
    raise ValueError("Actor is not runnable yet")


@mcp.tool(description="Get actor run status. Poll until SUCCEEDED or FAILED.")
def get_run(runId: str) -> dict:
    run = store.get_run(runId)
    if not run:
        raise ValueError("Run not found")
    return {"runId": run["id"], "actorName": run["actor_name"], "status": run["status"], "datasetId": run["dataset_id"], "jobsFound": run["jobs_found"], "errorMessage": run["error_message"]}


@mcp.tool(description="Read dataset items for a finished run.")
def get_dataset_items(datasetId: str, limit: int = 20, offset: int = 0) -> dict:
    total, items = store.get_items(datasetId, max(1, min(limit, 100)), max(0, offset))
    return {"datasetId": datasetId, "total": total, "offset": offset, "limit": limit, "items": items}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    store.init_db()
    async with mcp.session_manager.run():
        yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "fixture": os.getenv("ALLOW_FIXTURE") == "1"}


def transport_security() -> TransportSecuritySettings:
    extra = [host.strip() for host in os.getenv("MCP_ALLOWED_HOSTS", "").split(",") if host.strip()]
    hosts = ["job-orchestrator.onrender.com", "localhost:*", "127.0.0.1:*", *extra]
    origins = [f"https://{host}" for host in hosts if ":" not in host]
    return TransportSecuritySettings(enable_dns_rebinding_protection=True, allowed_hosts=hosts, allowed_origins=origins)


app.mount("/mcp", mcp.streamable_http_app(streamable_http_path="/", stateless_http=True, json_response=True, transport_security=transport_security()))


@app.middleware("http")
async def require_token(request: Request, call_next):
    expected = os.getenv("MCP_TOKEN")
    if expected and request.url.path.startswith("/mcp"):
        header = request.headers.get("authorization", "")
        token = header[7:].strip() if header.lower().startswith("bearer ") else request.headers.get("x-mcp-token", "")
        if token != expected:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return await call_next(request)

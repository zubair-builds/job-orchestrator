import json
import os
import time

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

BASE = os.getenv("MCP_URL", "https://job-orchestrator.onrender.com/mcp/")

async def main() -> None:
    async with httpx2.AsyncClient() as http_client:
        async with streamable_http_client(BASE, http_client=http_client) as streams:
            async with ClientSession(streams[0], streams[1]) as session:
                await session.initialize()
                started = time.perf_counter()
                run = _json(await session.call_tool("call_actor", {"name": "glassdoor-jobs", "input": {"search_term": "React", "location": "Berlin", "country": "Germany", "results_wanted": 5, "hours_old": 168}}))
                status = run
                while status.get("status") not in {"SUCCEEDED", "FAILED"}:
                    time.sleep(2)
                    status = _json(await session.call_tool("get_run", {"runId": run["runId"]}))
                items = _json(await session.call_tool("get_dataset_items", {"datasetId": status["datasetId"], "limit": 5, "includeDescription": False}))
                report = {
                    "actor": "glassdoor-jobs",
                    "clientSeconds": round(time.perf_counter() - started, 1),
                    "runSeconds": status.get("durationSeconds"),
                    "jobsFound": status.get("jobsFound"),
                    "note": status.get("note"),
                    "limitations": status.get("limitations"),
                    "fieldNotes": items.get("fieldNotes"),
                    "titles": [item.get("title") for item in items.get("items", [])],
                }
                print(json.dumps(report, indent=2))

def _json(result):
    return json.loads(result.content[0].text)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

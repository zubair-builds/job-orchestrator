import asyncio
import os
import time

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

BASE = os.getenv("MCP_URL", "http://127.0.0.1:8000/mcp")
TOKEN = os.getenv("MCP_TOKEN", "")


async def main() -> None:
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    async with httpx2.AsyncClient(headers=headers) as http_client:
        async with streamable_http_client(BASE, http_client=http_client) as streams:
            read, write = streams[0], streams[1]
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.call_tool("list_actors", {})
                names = _names(listed)
                if names != ["linkedin-jobs"]:
                    raise SystemExit(f"expected only linkedin-jobs, got {names}")

                started = await session.call_tool("call_actor", {
                    "name": "linkedin-jobs",
                    "input": {
                        "search_term": "Full Stack Developer",
                        "location": "Berlin",
                        "results_wanted": 5,
                        "fixture": True,
                    },
                })
                body = _json(started)
                run_id = body["runId"]
                dataset_id = body["datasetId"]

                run = body
                for _ in range(20):
                    run = _json(await session.call_tool("get_run", {"runId": run_id}))
                    if run["status"] in {"SUCCEEDED", "FAILED"}:
                        break
                    time.sleep(0.3)
                if run["status"] != "SUCCEEDED":
                    raise SystemExit(f"run did not succeed: {run}")

                dataset = _json(await session.call_tool("get_dataset_items", {"datasetId": dataset_id}))
                item = dataset["items"][0]
                if item.get("platform") != "linkedin" or not item.get("title") or not item.get("url"):
                    raise SystemExit(f"bad dataset item: {item}")
                print({"ok": True, "runId": run_id, "datasetId": dataset_id, "item": item})


def _json(result):
    import json
    text = result.content[0].text
    return json.loads(text)


def _names(result) -> list[str]:
    return [actor["name"] for actor in _json(result)["actors"]]


if __name__ == "__main__":
    asyncio.run(main())

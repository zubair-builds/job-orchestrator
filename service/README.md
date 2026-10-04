# Python MCP service

One process for the MVP. JobSpy and MCP live here. Postgres is Neon. Next.js is not required.

Tools: `list_actors`, `get_actor`, `call_actor`, `get_run`, `get_dataset_items`.

`call_actor` returns `runId` and `datasetId`, not the rows.

```bash
cd service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=postgresql://user:pass@host/db ALLOW_FIXTURE=1 uvicorn app:app --port 8000
```

MCP endpoint: `http://localhost:8000/mcp`

End-to-end, in another shell:

```bash
ALLOW_FIXTURE=1 DATABASE_URL=... MCP_URL=http://127.0.0.1:8000/mcp python e2e.py
```

A live LinkedIn run is the same `call_actor` input without `fixture`. Leave `ALLOW_FIXTURE` unset on Render.

Render start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Env: `DATABASE_URL`, optional `MCP_TOKEN`. Use the Neon pooled URL.

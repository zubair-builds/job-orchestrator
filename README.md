# Job orchestrator

MVP is one Python service: JobSpy and MCP in the same process. Postgres is Neon. Next.js is not required for this path.

- `/service` — FastAPI, LinkedIn actor, MCP at `/mcp`
- `/web` and `/mcp` — earlier split. Not used by the Python MVP.

```bash
cd service
pip install -r requirements.txt
DATABASE_URL=postgresql://... uvicorn app:app --port 8000
```

Actor: `linkedin-jobs`. `call_actor` returns `runId` and `datasetId`. Read rows with `get_dataset_items`.

## Author

[Syed Zubair Haider](https://github.com/zubair-builds) · [LinkedIn](https://www.linkedin.com/in/syed-zubair-haider/)

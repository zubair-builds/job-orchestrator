# MCP

Stdio server for the LinkedIn actor MVP. Tools: `list_actors`, `get_actor`, `call_actor`, `get_run`, `get_dataset_items`.

`call_actor` returns `runId` and `datasetId`, not the rows.

```bash
cd mcp
npm install
WEB_BASE_URL=http://localhost:3000 MCP_TOKEN=dev-token npm start
```

HTTP transport: `npm run http` on port 3333, path `/mcp`.

End-to-end, with the web app and scraper running and `ALLOW_FIXTURE=1` on the scraper:

```bash
WEB_BASE_URL=http://localhost:3000 MCP_TOKEN=dev-token npm run e2e
```

The e2e call sets `fixture: true` so it does not depend on LinkedIn. A live run is the same call with `fixture` omitted.

# Job orchestrator

Job-hunt pipeline. MVP client is MCP. One actor: `linkedin-jobs`.

- `/scraper` — FastAPI + JobSpy. `linkedin-jobs` forces LinkedIn.
- `/web` — Next.js actor runtime. Runs, dataset items, Postgres.
- `/mcp` — MCP server. `call_actor` returns ids. `get_dataset_items` returns rows.

## MVP

```bash
cd web
docker compose up -d
cp .env.example .env
npx prisma migrate dev
cd ..
ALLOW_FIXTURE=1 ./run.sh
```

In another shell:

```bash
cd mcp
npm install
WEB_BASE_URL=http://localhost:3000 MCP_TOKEN=dev-token npm run e2e
```

Live LinkedIn is the same `call_actor` input without `fixture`. Set `ALLOW_FIXTURE` only for the test.

Actor input: `search_term`, `location`, `results_wanted`, `hours_old`, `is_remote`. No country field.

## Author

[Syed Zubair Haider](https://github.com/zubair-builds) · [LinkedIn](https://www.linkedin.com/in/syed-zubair-haider/)

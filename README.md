# Job orchestrator

Job-hunt pipeline: a Python scraper pushes listings into a Next.js app that deduplicates them, stores them in Postgres, and triages with Gemini.

## Architecture

- `/scraper` — stateless FastAPI + JobSpy
- `/web` — Next.js 14 orchestrator (normalize, dedupe, AI triage, Prisma)
- Postgres via Docker Compose in `/web`

## What it stores

- Jobs and sources (LinkedIn, Indeed, etc.)
- Search profiles and scrape-run history
- Applications and resume variants from Gemini

## Setup

Needs Node 18+, Python 3.11+, Docker, and a Gemini API key.

```bash
cd web
docker compose up -d
cp .env.example .env   # or create .env
# DATABASE_URL, GEMINI_API_KEY, WEBHOOK_SECRET
npx prisma migrate dev --name init
cd ..
./run.sh
```

- Dashboard: http://localhost:3000
- Scraper: http://localhost:8000

`run.sh` installs deps if needed and starts both apps. Ctrl+C stops them.

Trigger a scrape:

```bash
curl -X POST http://localhost:8000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-scraper-secret: default_secret_for_dev" \
  -d '{"site_name": ["linkedin", "indeed"], "search_term": "Full Stack Developer", "location": "Berlin", "results_wanted": 10, "hours_old": 24}'
```

## Author

[Syed Zubair Haider](https://github.com/zubair-builds) · [LinkedIn](https://www.linkedin.com/in/syed-zubair-haider/)

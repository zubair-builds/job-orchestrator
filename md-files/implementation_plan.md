# Job Automation Pipeline Implementation Plan

This plan outlines the steps to build the Job Automation Pipeline, which consists of a Next.js orchestrator and a Python scraper service, as detailed in `plan.md`.

## User Review Required

> [!WARNING]
> We will need a Gemini API Key to implement the AI triage and tailoring features. Are you ready to provide one via environment variables?
> Also, please ensure you have PostgreSQL installed and running locally for development.

## Proposed Changes

We will create two completely independent projects within this directory to ensure they remain decoupled for separate deployments in the future.

### 1. Python Scraper Service (`/scraper`)
This service acts as the stateless extraction pipe. We will focus on local development first and defer Fly.io configuration (`fly.toml`, Dockerfile) to a later deployment phase.

#### [NEW] `scraper/main.py`
The FastAPI application containing the `POST /api/scrape` endpoint. It will trigger JobSpy in a background thread and POST results back to the Next.js webhook.
#### [NEW] `scraper/requirements.txt`
Dependencies including `fastapi`, `uvicorn`, `python-jobspy`, `tenacity`, `requests`.

### 2. Next.js Orchestrator (`/web`)
The main application managing state, UI, and AI integrations. We will use Tailwind CSS v3 and a local PostgreSQL database for the MVP. No authentication will be implemented for the local MVP, with Google Login planned for a future phase.

#### [NEW] Next.js Initialization
Run `npx -y create-next-app@latest ./web` (with Tailwind CSS v3 enabled) to set up the Next.js project.
#### [NEW] `web/prisma/schema.prisma`
Define the PostgreSQL data models: `Job`, `JobSource`, `SearchProfile`, and `Application`.
#### [NEW] `web/app/api/webhooks/jobs/route.ts`
The webhook receiver for the scraper to send data. Includes normalization, hashing, deduplication logic, and Prisma upserts.
#### [NEW] `web/app/api/triage/route.ts` (or integrated in webhook)
Integration with Gemini API to score the job against a Master Resume.
#### [NEW] `web/app/page.tsx`
The main Kanban dashboard UI using Tailwind CSS v3 to manage `SearchProfiles` and display jobs categorized by status (`DISCOVERED`, `TAILORING`, `APPLIED`).
#### [NEW] `web/app/api/tailor/route.ts`
The on-demand endpoint to generate custom resume bullets and cover letters using the Gemini API.

## Verification Plan

### Automated Tests
- Add basic API route testing in Next.js.
- Test the Python webhook payload handling by sending sample JobSpy JSON payloads directly to the Next.js local server.

### Manual Verification
- Run the Next.js app and Python app locally.
- Trigger a scrape via the Next.js UI or directly to the Python API.
- Verify the Python service returns a 202 and eventually sends a payload to the Next.js webhook.
- Check the local PostgreSQL database to confirm jobs are upserted without duplicates and triage scores are generated.
- Move a job on the UI to `TAILORING` and verify the tailored resume artifacts are generated correctly.

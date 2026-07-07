# Job Automation Pipeline Walkthrough

I have successfully implemented the MVP of the Job Automation Pipeline, setting up the decoupled architecture with a Next.js orchestrator and a Python scraper service.

## What Was Completed

### 1. Python Scraper Service (`/scraper`)
- Initialized a FastAPI application in `main.py`.
- Configured the background `run_scraper` task utilizing `python-jobspy`.
- Added a resilience layer using `tenacity` to retry POST requests to the Next.js webhook.

### 2. Next.js Orchestrator (`/web`)
- Initialized a Next.js 14 project configured with Tailwind CSS v3.
- Set up Prisma ORM with the complete PostgreSQL schema (`Job`, `JobSource`, `SearchProfile`, `Application`).
- Added a `docker-compose.yml` for quick Postgres initialization.
- Built the `POST /api/webhooks/jobs` endpoint that deduplicates incoming jobs (using a SHA256 hash), scores them using Gemini 1.5 Flash, and handles the `missedRuns` staleness logic.
- Built the Kanban dashboard UI in `app/page.tsx` for tracking roles and managing active `SearchProfiles`.
- Built the `POST /api/tailor` endpoint that triggers Gemini 1.5 Pro to rewrite resume bullet points and draft a cover letter when a job is moved into the **Tailoring** column.

## How to Verify (Action Required)

Since your local Docker daemon was not running during the setup, I couldn't automatically spin up PostgreSQL and run the database migrations. To run and verify the system, follow these steps:

> [!IMPORTANT]
> **Prerequisites:**
> 1. Start Docker Desktop (or your preferred local Postgres).
> 2. Ensure you have a valid Gemini API Key.

### 1. Start the Database & Run Migrations
Open a terminal, navigate to the `web` folder, and run:
```bash
cd web
docker compose up -d
npx prisma migrate dev --name init
```

### 2. Configure Environment Variables
In `/web/.env`, ensure you add your Gemini API Key:
```env
GEMINI_API_KEY="your_actual_api_key_here"
WEBHOOK_SECRET="default_secret_for_dev"
```

### 3. Start the Services
- **Next.js**: run `npm run dev` in `/web` (runs on port 3000)
- **FastAPI**: set up a virtual environment, run `pip install -r requirements.txt`, and then `uvicorn main:app --reload` in `/scraper` (runs on port 8000)

### 4. Test the Flow
- Open `http://localhost:3000` and create a Search Profile (e.g., "Full Stack Developer" in "New York").
- Trigger a scrape by sending a POST request to `http://localhost:8000/api/scrape` with the profile JSON (or using tools like Postman/curl).
- The Python service will scrape the jobs and send them to the Next.js webhook.
- Reload the dashboard to see the new jobs populated with AI-generated match scores!
- Move a job to **Tailoring** to automatically trigger the `tailor` API endpoint and generate targeted resume bullets.

# 🚀 Job Automation Pipeline

A decoupled job hunting automation pipeline. It consists of a stateless Python microservice that scrapes job boards and a Next.js orchestrator that deduplicates, persists, and triages the jobs using AI.

###   brew services info postgresql
# brew services start postgresql@17
# psql -d postgres -l


## 🏗 Architecture

*   **Ingestion Pipe (`/scraper`):** A stateless Python FastAPI service running JobSpy.
*   **The Orchestrator (`/web`):** A Next.js 14 application that owns data normalization, deduplication, AI triage, and database persistence.
*   **Persistence Layer:** PostgreSQL database managed via Prisma.
*   **AI Integration:** Google Gemini API for automated triage scoring and resume tailoring.

## 📝 Current Implementation

### Database Schema (Prisma)
- **Job & JobSource**: Stores deduplicated jobs and maps them to multiple sources (LinkedIn, Indeed, etc.).
- **SearchProfile & ScrapeRun**: Manages user search queries and tracks the status/history of background scrape jobs.
- **Application & UserResume**: Stores AI-tailored application materials (cover letters, customized resume bullets) and the user's base resume.

### API Endpoints (Next.js)
- `GET /api/jobs`: Fetches all tracked jobs, including their sources, ordered by newest first.
- `GET /api/profiles`: Retrieves configured search profiles along with their most recent scrape run status.
- `POST /api/profiles`: Creates a new search profile (requires `searchTerm` and `location`).
- `POST /api/webhooks/jobs`: (Ingestion) Receives new jobs from the Python scraper, handles deduplication, and stores them.


## ⚙️ Prerequisites

- **Node.js** (v18+)
- **Python** (v3.11+)
- **Docker** & **Docker Compose** (for running the local PostgreSQL database)
- **Google Gemini API Key**

## 🚀 Getting Started

### 1. Start the Database
The project uses PostgreSQL. A `docker-compose.yml` file is provided in the `/web` directory.
```bash
cd web
docker compose up -d
```

### 2. Configure Environment Variables
In the `/web` directory, create or update the `.env` file:
```env
# /web/.env
DATABASE_URL="postgresql://user:password@localhost:5432/jobhunt?schema=public"
GEMINI_API_KEY="your_google_gemini_api_key_here"
WEBHOOK_SECRET="default_secret_for_dev"
```

In the `/scraper` directory, the default secrets are used, but you can override them via environment variables:
```env
# /scraper/.env (Optional)
WEBHOOK_SECRET="default_secret_for_dev"
SCRAPER_SECRET="default_secret_for_dev"
NEXTJS_WEBHOOK_URL="http://localhost:3000/api/webhooks/jobs"
```

### 3. Start the Pipeline (Automated)
Once the database is running, you can boot up both the **Next.js Orchestrator** and the **Python Scraper** concurrently using the provided shell script. The script will automatically install missing dependencies, check the database connection, and start both services.

```bash
./run.sh
```
- The dashboard will be available at `http://localhost:3000`.
- The scraper API will be available at `http://localhost:8000`.
- Press `Ctrl+C` to gracefully shut down both services.

*(Note: If you haven't run database migrations yet, you'll still need to run `cd web && npx prisma migrate dev --name init` once.)*

## 🛠 Usage
1. Open the dashboard at `http://localhost:3000`.
2. Add a **Search Profile** (e.g., "Full Stack Developer" in "New York").
3. Trigger a scrape by sending a POST request to the Python scraper:
   ```bash
   curl -X POST http://localhost:8000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-scraper-secret: default_secret_for_dev" \
     -d '{"site_name": ["linkedin", "indeed", "glassdoor"], "search_term": "Full Stack Developer", "location": "New York", "results_wanted": 10, "hours_old": 24}'
   ```
4. The scraper will process jobs in the background and send them to the Next.js webhook.
5. Refresh the dashboard to see your new, deduplicated, and AI-scored jobs! Move a job to **Tailoring** to automatically generate custom resume bullet points and a cover letter paragraph.

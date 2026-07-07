# 🚀 Job Automation Pipeline (plan.md) - v2

## 🏗 Architecture Overview

The system strictly decouples web scraping from business logic. The Next.js application acts as the orchestrator and single source of truth, while a stateless Python container acts purely as an on-demand data extraction pipe.

*   **Ingestion Pipe (Python on Fly.io):** A stateless Dockerized microservice running FastAPI and JobSpy.
*   **The Orchestrator (Next.js & TypeScript):** Owns scheduling, data normalization, deduplication, AI triage, and database persistence.
*   **Persistence Layer (PostgreSQL):** Relational storage managed via Prisma, hosted on Neon or Supabase.

---

## 🛠 Phase 1: The Stateless Python Pipe (Docker / Fly.io)

**Goal:** Provide a reliable, secure HTTP endpoint for raw job board extraction. 

1.  **Deployment & Security:**
    *   Deploy the `python:3.11-slim` container to Fly.io (or a 24/7 VPS).
    *   Secure the trigger endpoint (`POST /api/scrape`) by requiring an `X-Scraper-Secret` header.
2.  **Execution Logic:**
    *   Next.js sends a POST request with active `SearchProfile` criteria.
    *   The Python service immediately returns `HTTP 202 { "status": "processing" }` to prevent Vercel serverless timeouts.
    *   JobSpy runs in a background thread. **Crucial:** `linkedin_fetch_description=True` must be set so the downstream AI has the full text to analyze.
3.  **Webhook Handoff with Resilience:**
    *   Upon completion, Python POSTs the raw JSON payload to the Next.js webhook (`/api/webhooks/jobs`), secured via an `X-Webhook-Secret` header.
    *   Wrap this outbound webhook call in a retry block (e.g., using the `tenacity` library) with exponential backoff to survive transient network drops.

---

## 🗄 Phase 2: Processing, Normalization & Schema (Next.js)

**Goal:** Centralize data cleaning, hash-based deduplication, and relational storage.

1.  **Data Normalization & Hashing:**
    *   The Next.js webhook receiver strips noise from job titles and companies to ensure consistent hashing across different platforms.
    *   Logic: Remove parentheticals (e.g., "(Remote)"), drop common suffixes (Inc., LLC), strip all non-alphanumeric characters, and lowercase the string.
    *   Unique ID Generation: $\text{job\_hash} = \text{SHA256}(\text{normalized\_company} + \text{normalized\_title} + \text{normalized\_location})$.
2.  **Database Persistence (Prisma):**
    *   **Bulk Upsert:** Use Prisma to efficiently upsert jobs into the `Job` table using the `job_hash`. 
    *   **Source Tracking:** Insert original URLs into a related `JobSource` table so the dashboard retains clickable links for every platform the job was found on.
3.  **Staleness Pruning (`missedRuns`):**
    *   Instead of a rigid time window, track active listings using a `missedRuns` integer.
    *   When the webhook processes a payload, reset `missedRuns = 0` for all included hashes.
    *   Increment `missedRuns` by 1 for any `DISCOVERED` job *not* in the payload. If `missedRuns >= 5`, transition the job status to `ARCHIVED`.

---

## 🖥 Phase 3: AI Triage & The Dashboard (Next.js)

**Goal:** Filter out noise automatically and provide a clean Kanban UI for the active pipeline.

1.  **Automated Triage (Gemini API):**
    *   During the webhook ingestion, pass new job descriptions through a lightweight, low-cost Gemini prompt to generate a `matchScore` (1-10) against your Master Resume.
    *   This prevents junior or irrelevant roles from cluttering the UI.
2.  **Dashboard Configuration:**
    *   Build a UI to manage dynamic `SearchProfiles` (keywords, locations) directly in the database, avoiding code deployments for search tweaks.
    *   Render a Kanban board filtering jobs by `matchScore` and `status` (`DISCOVERED` -> `TAILORING` -> `APPLIED`).

---

## 🧠 Phase 4: On-Demand AI Tailoring (Gemini API)

**Goal:** Generate highly customized application artifacts without burning API credits on jobs you won't apply to.

1.  **Trigger on Click:**
    *   AI tailoring is executed *only* when you manually move a job from `DISCOVERED` to `TAILORING` via the Next.js UI.
2.  **The Generation Flow:**
    *   **Extract:** Next.js sends the `Job.description` and your Markdown Master Resume to Gemini to extract overlapping keywords.
    *   **Generate:** Pass the extracted JSON back into Gemini to rewrite targeted bullet points and a custom cover letter paragraph, ensuring zero hallucinated metrics.
    *   **Save:** Store the generated artifact details in the `Application` table, linking it relationally to the original `Job`.
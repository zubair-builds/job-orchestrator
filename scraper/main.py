from fastapi import FastAPI, BackgroundTasks, Header, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
import logging
import requests
import os
import math
from tenacity import retry, wait_exponential, stop_after_attempt
import json

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "default_secret_for_dev")
SCRAPER_SECRET = os.getenv("SCRAPER_SECRET", "default_secret_for_dev")
NEXTJS_WEBHOOK_URL = os.getenv("NEXTJS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/jobs")
ALLOW_FIXTURE = os.getenv("ALLOW_FIXTURE") == "1"

class SearchProfile(BaseModel):
    site_name: list[str] = ["linkedin"]
    search_term: str
    location: str
    results_wanted: int = 10
    hours_old: int = 24
    job_type: Optional[List[str]] = None
    country_indeed: Optional[str] = None
    easy_apply: bool = False
    linkedin_fetch_description: bool = False
    is_remote: bool = False
    actor: Optional[str] = None
    run_id: Optional[str] = None
    fixture: bool = False

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5))
def post_to_webhook(payload: dict):
    logger.info(f"Sending payload to {NEXTJS_WEBHOOK_URL}")
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET
    }
    clean_payload = json.loads(json.dumps(payload, default=str))
    response = requests.post(NEXTJS_WEBHOOK_URL, json=clean_payload, headers=headers, timeout=20)
    response.raise_for_status()
    logger.info("Successfully posted to webhook.")

def fixture_jobs(profile: SearchProfile):
    return [{
        "site": "linkedin",
        "title": "Full Stack Developer",
        "company": "Example GmbH",
        "location": profile.location,
        "job_url": "https://www.linkedin.com/jobs/view/fixture-berlin-1",
        "description": "Fixture listing for the MCP end-to-end test.",
        "is_remote": profile.is_remote,
        "date_posted": "2026-10-04",
    }]

def run_scraper(profile: SearchProfile):
    logger.info(f"Starting {profile.actor or 'scrape'} for {profile.search_term} in {profile.location}")
    try:
        if profile.actor == "linkedin-jobs":
            profile.site_name = ["linkedin"]
        if profile.fixture:
            if not ALLOW_FIXTURE:
                raise RuntimeError("fixture requested but ALLOW_FIXTURE is not set")
            jobs_list = fixture_jobs(profile)
        else:
            from jobspy import scrape_jobs
            from jobspy.model import Country
            orig_from_string = Country.from_string
            def patched_from_string(cls, country_str):
                try:
                    return orig_from_string(country_str)
                except ValueError:
                    return Country.WORLDWIDE
            Country.from_string = classmethod(patched_from_string)
            jobs = scrape_jobs(
                site_name=profile.site_name,
                search_term=profile.search_term,
                location=profile.location,
                results_wanted=profile.results_wanted,
                hours_old=profile.hours_old,
                country_indeed=profile.country_indeed or "Germany",
                linkedin_fetch_description=profile.linkedin_fetch_description,
                job_type=profile.job_type,
                easy_apply=profile.easy_apply,
                is_remote=profile.is_remote
            )
            logger.info(f"Found {len(jobs)} jobs. Preparing to send to webhook...")
            jobs_list = jobs.to_dict(orient="records")
            for job in jobs_list:
                for key, value in job.items():
                    if isinstance(value, float) and math.isnan(value):
                        job[key] = None
                    if hasattr(value, "isoformat"):
                        job[key] = value.isoformat()

        post_to_webhook({
            "actor": profile.actor or "linkedin-jobs",
            "run_id": profile.run_id,
            "status": "SUCCEEDED",
            "search_term": profile.search_term,
            "location": profile.location,
            "jobs": jobs_list
        })
    except Exception as e:
        logger.error(f"Error during scraping or webhook delivery: {e}")
        if profile.run_id:
            try:
                post_to_webhook({
                    "actor": profile.actor or "linkedin-jobs",
                    "run_id": profile.run_id,
                    "status": "FAILED",
                    "error": str(e),
                    "jobs": []
                })
            except Exception as post_error:
                logger.error(f"Failed to report scraper error: {post_error}")

@app.post("/api/scrape", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scrape(
    profile: SearchProfile,
    background_tasks: BackgroundTasks,
    x_scraper_secret: str = Header(None)
):
    if x_scraper_secret != SCRAPER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if profile.actor and profile.actor != "linkedin-jobs":
        raise HTTPException(status_code=400, detail="Only linkedin-jobs is enabled")
    if profile.actor == "linkedin-jobs":
        profile.site_name = ["linkedin"]
    background_tasks.add_task(run_scraper, profile)
    return {"status": "processing", "actor": profile.actor or "linkedin-jobs", "run_id": profile.run_id}

@app.get("/health")
def health_check():
    return {"status": "ok", "fixture": ALLOW_FIXTURE}

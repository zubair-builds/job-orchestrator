import os
import uuid
from threading import Thread

import store

ALLOW_FIXTURE = os.getenv("ALLOW_FIXTURE") == "1"

ACTORS = [
    {
        "name": "linkedin-jobs",
        "title": "LinkedIn jobs",
        "description": "Search LinkedIn only. location is the place filter. There is no country field. call_actor returns runId and datasetId, not the rows.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["search_term", "location"],
            "properties": {
                "search_term": {"type": "string"},
                "location": {"type": "string", "description": "LinkedIn location text, e.g. Berlin."},
                "results_wanted": {"type": "integer", "default": 25, "description": "How many LinkedIn results to page through. Default 25, max 100."},
                "hours_old": {"type": "integer", "default": 24},
                "is_remote": {"type": "boolean", "default": False, "description": "If true, ask LinkedIn for remote jobs only."},
                "linkedin_fetch_description": {"type": "boolean", "default": True, "description": "Fetch each job page. Required for description and a direct apply URL. Slower."},
                "fixture": {"type": "boolean", "default": False, "description": "Test only. Requires ALLOW_FIXTURE=1."},
            },
        },
    }
]


def actor_by_name(name: str) -> dict | None:
    return next((actor for actor in ACTORS if actor["name"] == name), None)


def parse_linkedin(raw: dict) -> dict:
    search_term = str(raw.get("search_term") or "").strip()
    location = str(raw.get("location") or "").strip()
    if not search_term:
        raise ValueError("search_term is required")
    if not location:
        raise ValueError("location is required")
    return {
        "search_term": search_term,
        "location": location,
        "results_wanted": _clamp(raw.get("results_wanted"), 25, 1, 100),
        "hours_old": _clamp(raw.get("hours_old"), 24, 1, 720),
        "is_remote": bool(raw.get("is_remote")),
        "linkedin_fetch_description": raw.get("linkedin_fetch_description", True) is not False,
        "fixture": bool(raw.get("fixture")),
    }


def start_linkedin(raw: dict) -> dict:
    payload = parse_linkedin(raw)
    run_id = uuid.uuid4().hex
    dataset_id = f"ds_{uuid.uuid4().hex}"
    store.create_run(run_id, dataset_id, "linkedin-jobs", payload)
    Thread(target=_run_linkedin, args=(run_id, dataset_id, payload), daemon=True).start()
    return {"runId": run_id, "datasetId": dataset_id, "status": "RUNNING"}


def _run_linkedin(run_id: str, dataset_id: str, payload: dict) -> None:
    try:
        rows = _fixture(payload) if payload["fixture"] else _scrape(payload)
        items = []
        for row in rows:
            if str(row.get("site") or "linkedin").lower() != "linkedin":
                continue
            title = str(row.get("title") or "").strip()
            company = str(row.get("company") or "").strip()
            url = str(row.get("job_url") or row.get("job_url_direct") or "").strip()
            if not title or not company or not url:
                continue
            if _is_board_repost(company, url, str(row.get("job_url_direct") or "")):
                continue
            direct_url = str(row.get("job_url_direct") or "").strip()
            description = _clean(row.get("description"))
            items.append({
                "id": uuid.uuid4().hex,
                "data": {
                    "title": title,
                    "company": company,
                    "location": row.get("location"),
                    "url": url,
                    "directUrl": direct_url or None,
                    "platform": "linkedin",
                    "description": description,
                    "isRemote": _is_remote(row, title, description),
                },
            })
        store.add_items(run_id, dataset_id, items)
        store.finish_run(run_id, "SUCCEEDED", len(items))
    except Exception as exc:
        store.finish_run(run_id, "FAILED", 0, str(exc))


def _fixture(payload: dict) -> list[dict]:
    if not ALLOW_FIXTURE:
        raise RuntimeError("fixture requested but ALLOW_FIXTURE is not set")
    return [{
        "site": "linkedin",
        "title": "Full Stack Developer",
        "company": "Example GmbH",
        "location": payload["location"],
        "job_url": "https://www.linkedin.com/jobs/view/fixture-berlin-1",
        "description": "Fixture listing for the MCP end-to-end test.",
        "is_remote": payload["is_remote"],
    }]


def _scrape(payload: dict) -> list[dict]:
    from jobspy import scrape_jobs

    jobs = scrape_jobs(
        site_name=["linkedin"],
        search_term=payload["search_term"],
        location=payload["location"],
        results_wanted=payload["results_wanted"],
        hours_old=payload["hours_old"],
        linkedin_fetch_description=payload["linkedin_fetch_description"],
        fetch_description=payload["linkedin_fetch_description"],
        is_remote=payload["is_remote"],
    )
    return jobs.to_dict(orient="records")


BOARD_HOSTS = (
    "arbeitnow.com",
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "stepstone.de",
    "xing.com",
    "jooble.org",
    "talent.com",
    "jobrapido.com",
    "careerjet.com",
    "remoteok.com",
    "weworkremotely.com",
    "ziprecruiter.com",
)
BOARD_NAMES = ("arbeitnow", "jooble", "jobrapido", "careerjet", "remote ok", "we work remotely")


def _is_board_repost(company: str, url: str, direct_url: str) -> bool:
    name = company.lower()
    if any(board in name for board in BOARD_NAMES):
        return True
    host = _host(direct_url) or _host(url)
    return any(board in host for board in BOARD_HOSTS if board != "linkedin.com")


def _is_remote(row: dict, title: str, description: str | None) -> bool:
    if bool(row.get("is_remote")):
        return True
    text = " ".join(str(part or "") for part in (title, row.get("location"), description)).lower()
    return any(token in text for token in ("remote", "hybrid", "work from home", "homeoffice", "home office"))


def _host(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).netloc.lower().removeprefix("www.")


def _clean(value) -> str | None:
    text = str(value or "").strip()
    return text or None


def _clamp(value, fallback: int, low: int, high: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))

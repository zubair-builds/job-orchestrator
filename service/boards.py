import uuid
from threading import Thread

import store
from actors import _clean, _clamp, _is_board_repost, _workplace

GLASSDOOR_ACTOR = {
    "name": "glassdoor-jobs",
    "title": "Glassdoor jobs",
    "description": "Search Glassdoor only. country must be a Glassdoor country, default Germany. location is the city. call_actor returns runId and datasetId, not the rows.",
    "inputSchema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["search_term"],
        "properties": {
            "search_term": {"type": "string"},
            "location": {"type": "string"},
            "country": {"type": "string", "default": "Germany"},
            "results_wanted": {"type": "integer", "default": 25},
            "hours_old": {"type": "integer", "default": 72},
            "is_remote": {"type": "boolean", "default": False},
            "fixture": {"type": "boolean", "default": False},
        },
    },
}
GOOGLE_ACTOR = {
    "name": "google-jobs",
    "title": "Google jobs",
    "description": "Search Google Jobs only. Google has no location filter, so location and country are appended to the search string. call_actor returns runId and datasetId, not the rows.",
    "inputSchema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["search_term"],
        "properties": {
            "search_term": {"type": "string"},
            "location": {"type": "string"},
            "country": {"type": "string", "default": "Germany"},
            "results_wanted": {"type": "integer", "default": 25},
            "hours_old": {"type": "integer", "default": 72},
            "is_remote": {"type": "boolean", "default": False},
            "fixture": {"type": "boolean", "default": False},
        },
    },
}


def register(actors_module) -> None:
    names = {actor["name"] for actor in actors_module.ACTORS}
    for actor in (GLASSDOOR_ACTOR, GOOGLE_ACTOR):
        if actor["name"] not in names:
            actors_module.ACTORS.append(actor)


def start_glassdoor(raw: dict) -> dict:
    return _start("glassdoor-jobs", _parse(raw))


def start_google(raw: dict) -> dict:
    return _start("google-jobs", _parse(raw))


def _parse(raw: dict) -> dict:
    search_term = str(raw.get("search_term") or "").strip()
    if not search_term:
        raise ValueError("search_term is required")
    return {
        "search_term": search_term,
        "location": str(raw.get("location") or "").strip(),
        "country": str(raw.get("country") or "Germany").strip() or "Germany",
        "results_wanted": _clamp(raw.get("results_wanted"), 25, 1, 100),
        "hours_old": _clamp(raw.get("hours_old"), 72, 1, 720),
        "is_remote": bool(raw.get("is_remote")),
        "fixture": bool(raw.get("fixture")),
    }


def _start(actor_name: str, payload: dict) -> dict:
    run_id = uuid.uuid4().hex
    dataset_id = f"ds_{uuid.uuid4().hex}"
    store.create_run(run_id, dataset_id, actor_name, payload)
    Thread(target=_run, args=(actor_name, run_id, dataset_id, payload), daemon=True).start()
    return {"runId": run_id, "datasetId": dataset_id, "status": "RUNNING"}


def _run(actor_name: str, run_id: str, dataset_id: str, payload: dict) -> None:
    platform = "glassdoor" if actor_name == "glassdoor-jobs" else "google"
    try:
        rows = _fixture(platform, payload) if payload["fixture"] else _scrape(platform, payload)
        items = []
        for row in rows:
            if str(row.get("site") or platform).lower() != platform:
                continue
            title = str(row.get("title") or "").strip()
            company = str(row.get("company") or "").strip()
            url = str(row.get("job_url") or "").strip()
            direct_url = _clean(row.get("job_url_direct"))
            if not title or not company or not (url or direct_url):
                continue
            if _is_board_repost(company, url, direct_url or ""):
                continue
            description = _clean(row.get("description"))
            workplace = _workplace(title, row.get("location"), description, "remote" if row.get("is_remote") else None)
            items.append({
                "id": uuid.uuid4().hex,
                "data": {
                    "title": title,
                    "company": company,
                    "location": row.get("location"),
                    "url": url or direct_url,
                    "directUrl": direct_url,
                    "platform": platform,
                    "description": description,
                    "workplaceType": workplace,
                    "isRemote": workplace == "remote",
                },
            })
        store.add_items(run_id, dataset_id, items)
        store.finish_run(run_id, "SUCCEEDED", len(items))
    except Exception as exc:
        store.finish_run(run_id, "FAILED", 0, str(exc))


def _fixture(platform: str, payload: dict) -> list[dict]:
    if __import__("os").getenv("ALLOW_FIXTURE") != "1":
        raise RuntimeError("fixture requested but ALLOW_FIXTURE is not set")
    return [{
        "site": platform,
        "title": "Platform Engineer",
        "company": "Example AG",
        "location": payload["location"] or payload["country"],
        "job_url": f"https://example.com/{platform}/fixture-1",
        "job_url_direct": "https://example.com/jobs/fixture-1",
        "description": f"Fixture {platform} listing.",
        "is_remote": payload["is_remote"],
    }]


def _scrape(platform: str, payload: dict) -> list[dict]:
    from jobspy import scrape_jobs
    kwargs = {
        "site_name": [platform],
        "results_wanted": payload["results_wanted"],
        "hours_old": payload["hours_old"],
        "is_remote": payload["is_remote"],
    }
    if platform == "google":
        parts = [payload["search_term"], payload["location"], payload["country"]]
        kwargs["google_search_term"] = " ".join(part for part in parts if part)
    else:
        kwargs["search_term"] = payload["search_term"]
        kwargs["location"] = payload["location"] or None
        kwargs["country_indeed"] = payload["country"]
    return scrape_jobs(**kwargs).to_dict(orient="records")

import os
import re
import uuid
from threading import Thread
from urllib.parse import quote

import store
import linkedin_fields as lf

ALLOW_FIXTURE = os.getenv("ALLOW_FIXTURE") == "1"

ACTORS = [{
    "name": "linkedin-jobs",
    "title": "LinkedIn jobs",
    "description": "Search LinkedIn only, date-sorted. Agencies are dropped and counted on the run note. directUrl is null. company_info adds companySize and companyWebsite.",
    "inputSchema": {"type": "object", "additionalProperties": False, "required": ["search_term", "location"], "properties": {"search_term": {"type": "string"}, "location": {"type": "string"}, "results_wanted": {"type": "integer", "default": 25}, "hours_old": {"type": "integer", "default": 168}, "is_remote": {"type": "boolean", "default": False}, "linkedin_fetch_description": {"type": "boolean", "default": True}, "company_info": {"type": "boolean", "default": False}, "fixture": {"type": "boolean", "default": False}}},
}]

def actor_by_name(name: str):
    return next((actor for actor in ACTORS if actor["name"] == name), None)

def parse_linkedin(raw: dict) -> dict:
    search_term = str(raw.get("search_term") or "").strip()
    location = str(raw.get("location") or "").strip()
    if not search_term or not location:
        raise ValueError("search_term and location are required")
    return {"search_term": search_term, "location": location, "results_wanted": _clamp(raw.get("results_wanted"), 25, 1, 100), "hours_old": _clamp(raw.get("hours_old"), 168, 1, 720), "is_remote": bool(raw.get("is_remote")), "linkedin_fetch_description": raw.get("linkedin_fetch_description", True) is not False, "company_info": bool(raw.get("company_info")), "fixture": bool(raw.get("fixture"))}

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
        dropped = 0
        profiles = {}
        for row in rows:
            if len(items) >= payload["results_wanted"]:
                break
            title = str(row.get("title") or "").strip()
            company = str(row.get("company") or "").strip()
            url = str(row.get("job_url") or "").strip()
            if not title or not company or not url:
                continue
            page = lf.page_facts(url) if payload["linkedin_fetch_description"] else {}
            description = lf.strip_injection(page.get("description") or _clean(row.get("description")))
            if lf.is_agency(company, description):
                dropped += 1
                continue
            profile = _profile(page.get("companyUrl"), payload["company_info"], profiles)
            workplace = lf.workplace(title, row.get("location"), description, page.get("workplaceType"))
            job_id = lf.job_id(url)
            items.append({"id": lf.row_id(dataset_id, job_id) if job_id else uuid.uuid4().hex, "data": {"id": job_id, "title": title, "company": company, "location": row.get("location"), "url": url, "directUrl": None, "platform": "linkedin", "description": description, "workplaceType": workplace, "isRemote": workplace == "remote", "postedAt": page.get("postedAt") or _date(row.get("date_posted")), "applicantsCount": page.get("applicantsCount"), "employmentType": page.get("employmentType"), "seniorityLevel": page.get("seniorityLevel"), "industries": page.get("industries"), "salary": lf.salary(title), "companyUrl": page.get("companyUrl"), "companyLogo": page.get("companyLogo"), "companySize": profile.get("companySize") or page.get("companySize"), "companyWebsite": profile.get("companyWebsite")}})
        stored = lf.merge_cities(items)
        store.add_items(run_id, dataset_id, stored)
        store.finish_run(run_id, "SUCCEEDED", len(stored), note=f"dropped {dropped} agency rows")
    except Exception as exc:
        store.finish_run(run_id, "FAILED", 0, str(exc))

def _profile(url: str | None, enabled: bool, cache: dict) -> dict:
    if not enabled or not url:
        return {}
    if url not in cache:
        cache[url] = lf.company_profile(url)
    return cache[url]

def _date(value) -> str | None:
    text = str(value or "").strip()
    return text[:10] if text else None

def _fixture(payload: dict) -> list[dict]:
    if not ALLOW_FIXTURE:
        raise RuntimeError("fixture requested but ALLOW_FIXTURE is not set")
    return [{"site": "linkedin", "title": "Full Stack Developer", "company": "Example GmbH", "location": payload["location"], "job_url": "https://www.linkedin.com/jobs/view/1", "description": "Fixture listing."}]

def _scrape(payload: dict) -> list[dict]:
    rows = _guest_search(payload)
    return rows or _jobspy(payload)

def _guest_search(payload: dict) -> list[dict]:
    import requests
    seconds = payload["hours_old"] * 3600
    rows = []
    start = 0
    while len(rows) < payload["results_wanted"] + 10 and start < 50:
        url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" f"?keywords={quote(payload['search_term'])}&location={quote(payload['location'])}&f_TPR=r{seconds}&sortBy=DD&start={start}"
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        if response.status_code != 200:
            break
        cards = re.findall(r'data-entity-urn="urn:li:jobPosting:(\d+)"([\s\S]*?)</li>', response.text)
        if not cards:
            break
        for job_id, card in cards:
            title = _card_text(card, "base-search-card__title")
            company = _card_text(card, "hidden-nested-link")
            location = _card_text(card, "job-search-card__location")
            if title and company:
                rows.append({"title": title, "company": company, "location": location, "job_url": f"https://www.linkedin.com/jobs/view/{job_id}"})
        start += 10
    return rows

def _card_text(card: str, class_name: str) -> str:
    match = re.search(rf'{class_name}[^>]*>(.*?)</', card, re.S)
    if not match:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", match.group(1))).strip()

def _jobspy(payload: dict) -> list[dict]:
    from jobspy import scrape_jobs
    jobs = scrape_jobs(site_name=["linkedin"], search_term=payload["search_term"], location=payload["location"], results_wanted=payload["results_wanted"], hours_old=payload["hours_old"], linkedin_fetch_description=False, is_remote=payload["is_remote"])
    return jobs.to_dict(orient="records")

def _clean(value):
    text = str(value or "").strip()
    return text or None

def _clamp(value, fallback: int, low: int, high: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))

INDEED = {"name": "indeed-jobs", "title": "Indeed jobs", "description": "Search Indeed only. country defaults to Germany.", "inputSchema": {"type": "object", "additionalProperties": False, "required": ["search_term"], "properties": {"search_term": {"type": "string"}, "location": {"type": "string"}, "country": {"type": "string", "default": "Germany"}, "results_wanted": {"type": "integer", "default": 25}, "hours_old": {"type": "integer", "default": 72}, "is_remote": {"type": "boolean", "default": False}, "fixture": {"type": "boolean", "default": False}}}}
ACTORS.append(INDEED)

def start_indeed(raw: dict) -> dict:
    search_term = str(raw.get("search_term") or "").strip()
    if not search_term:
        raise ValueError("search_term is required")
    payload = {"search_term": search_term, "location": str(raw.get("location") or "").strip(), "country": str(raw.get("country") or "Germany").strip() or "Germany", "results_wanted": _clamp(raw.get("results_wanted"), 25, 1, 100), "hours_old": _clamp(raw.get("hours_old"), 72, 1, 720), "is_remote": bool(raw.get("is_remote")), "fixture": bool(raw.get("fixture"))}
    run_id = uuid.uuid4().hex
    dataset_id = f"ds_{uuid.uuid4().hex}"
    store.create_run(run_id, dataset_id, "indeed-jobs", payload)
    Thread(target=_run_indeed, args=(run_id, dataset_id, payload), daemon=True).start()
    return {"runId": run_id, "datasetId": dataset_id, "status": "RUNNING"}

def _run_indeed(run_id: str, dataset_id: str, payload: dict) -> None:
    try:
        from jobspy import scrape_jobs
        kwargs = {"site_name": ["indeed"], "search_term": payload["search_term"], "location": payload["location"] or None, "results_wanted": payload["results_wanted"], "country_indeed": payload["country"], "fetch_description": True}
        if payload["is_remote"]:
            kwargs["is_remote"] = True
        else:
            kwargs["hours_old"] = payload["hours_old"]
        rows = scrape_jobs(**kwargs).to_dict(orient="records")
        items = []
        for row in rows:
            title = str(row.get("title") or "").strip()
            company = str(row.get("company") or "").strip()
            url = str(row.get("job_url") or "").strip()
            if not title or not company or not url or lf.is_agency(company, row.get("description")):
                continue
            items.append({"id": uuid.uuid4().hex, "data": {"title": title, "company": company, "location": row.get("location"), "url": url, "directUrl": _clean(row.get("job_url_direct")), "platform": "indeed", "description": _clean(row.get("description")), "workplaceType": lf.workplace(title, row.get("location"), row.get("description"), None), "isRemote": bool(row.get("is_remote"))}})
        store.add_items(run_id, dataset_id, items)
        store.finish_run(run_id, "SUCCEEDED", len(items))
    except Exception as exc:
        store.finish_run(run_id, "FAILED", 0, str(exc))

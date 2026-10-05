import re
from datetime import date, timedelta
from html import unescape

AGENCY_NAMES = (
    "computer futures", "sthree", "jobgether", "darwin recruitment", "rebel recruiting",
    "arbeitnow", "jooble", "jobrapido", "careerjet", "randstad", "ferchau", "instaffo",
)

def job_id(url: str) -> str | None:
    match = re.search(r"/jobs/view/(\d+)", url)
    return match.group(1) if match else None

def row_id(dataset_id: str, job_id_value: str | None) -> str:
    return f"{dataset_id}:{job_id_value}" if job_id_value else f"{dataset_id}:row"

def is_agency(company: str, description: str | None) -> bool:
    name = company.lower()
    if any(board in name for board in AGENCY_NAMES):
        return True
    return "acting as an employment agency" in (description or "").lower()

def workplace(title: str, location, description: str | None, from_page: str | None) -> str | None:
    if from_page in {"remote", "hybrid", "on-site"}:
        return from_page
    text = " ".join(part for part in re.split(r"[.\n]", f"{title} {location or ''} {description or ''}".lower()) if "do not apply if" not in part and "not remote" not in part)
    if re.search(r"100\s*%\s*vor ort|\d+\s*tage\s*vor ort", text):
        return "on-site"
    if "hybrid" in text or "remote-option" in text or "remote option" in text or re.search(r"\d+\s*days?(?:\s+per\s+week)?\s+in(?:\s+the)?\s+office", text):
        return "hybrid"
    if any(phrase in text for phrase in ("in person", "on-site", "onsite", "vor ort")):
        return "on-site"
    remote_text = text.replace("remote-friendly", "").replace("remote friendly", "")
    if any(phrase in remote_text for phrase in ("100% remote", "fully remote", "remote-first", "remote role", "remote position", "work remotely", "remote")):
        return "remote"
    return None

def salary(title: str, description: str | None = None) -> str | None:
    match = re.search(r"(?:bis|up to|to)?\s*(\d{2,3}(?:[.\s]\d{3})+)\s*€", title or "", re.I)
    return f"{match.group(1)} €" if match else None

def strip_injection(text: str | None) -> str | None:
    if not text:
        return None
    kept = [part.strip() for part in re.split(r"[.\n]", text) if part.strip() and "ignore all previous instructions" not in part.lower()]
    return ". ".join(kept) or None

def page_facts(url: str) -> dict:
    html = _get(url)
    if not html:
        return {}
    applicants = re.search(r"(\d[\d,]*)\s+applicants|first\s+(\d[\d,]*)\s+applicants", html, re.I)
    count = (applicants.group(1) or applicants.group(2) or "").replace(",", "") or None if applicants else None
    return {
        "workplaceType": (_criteria(html, "Workplace type") or _criteria(html, "Arbeitsplatztyp") or "").lower() or None,
        "postedAt": _posted_at(html),
        "applicantsCount": count,
        "employmentType": _criteria(html, "Employment type") or _criteria(html, "Beschäftigungsart"),
        "seniorityLevel": _criteria(html, "Seniority level") or _criteria(html, "Karrierestufe"),
        "industries": _criteria(html, "Industries") or _criteria(html, "Branchen"),
        "companyUrl": _company_url(html),
        "companyLogo": _logo(html),
        "companySize": _criteria(html, "Company size") or _criteria(html, "Unternehmensgröße"),
    }

def company_profile(url: str) -> dict:
    html = _get(url)
    if not html:
        return {}
    size = re.search(r'"numberOfEmployees"\s*:\s*\{"value"\s*:\s*(\d+)', html)
    site = re.search(r'"sameAs"\s*:\s*"(https?://[^"]+)"', html)
    website = site.group(1) if site and "linkedin.com" not in site.group(1) else None
    return {"companySize": size.group(1) if size else None, "companyWebsite": website}

def _get(url: str) -> str:
    import requests
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        response.raise_for_status()
    except Exception:
        return ""
    return response.text

def _posted_at(html: str) -> str | None:
    match = re.search(r'posted-time-ago__text[^>]*>(.*?)</span>', html, re.I | re.S)
    if not match:
        return None
    text = re.sub(r"\s+", " ", match.group(1)).strip().lower()
    if "hour" in text or "just now" in text or "minute" in text:
        return date.today().isoformat()
    amount = re.search(r"(\d+)", text)
    count = int(amount.group(1)) if amount else 1
    if "day" in text:
        return (date.today() - timedelta(days=count)).isoformat()
    if "week" in text:
        return (date.today() - timedelta(days=7 * count)).isoformat()
    if "month" in text:
        return (date.today() - timedelta(days=30 * count)).isoformat()
    return None

def _company_url(html: str) -> str | None:
    match = re.search(r'topcard__org-name-link[^>]*href="([^"]+)"', html)
    if not match:
        return None
    return match.group(1).split("?")[0]

def _logo(html: str) -> str | None:
    match = re.search(r'data-delayed-url="(https://media\.licdn\.com/[^"]*company-logo[^"]*)"', html)
    if not match:
        return None
    return unescape(match.group(1))

def _criteria(html: str, label: str) -> str | None:
    match = re.search(rf"{re.escape(label)}\s*</h3>\s*<span[^>]*>\s*([^<]+)", html, re.I | re.S)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else None

def merge_cities(items: list[dict]) -> list[dict]:
    merged, index = [], {}
    for item in items:
        data = item["data"]
        key = f"{data.get('company', '').lower()}|{data.get('title', '').lower()}"
        if key not in index:
            data["locations"] = [data.get("location")] if data.get("location") else []
            index[key] = item
            merged.append(item)
            continue
        current = index[key]["data"]
        locations = current.setdefault("locations", [])
        if data.get("location") and data.get("location") not in locations:
            locations.append(data.get("location"))
        current["location"] = ", ".join(str(part) for part in locations if part)
    return merged

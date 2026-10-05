import re
from urllib.parse import urlparse

AGENCY_NAMES = (
    "computer futures", "sthree", "jobgether", "darwin recruitment", "rebel recruiting",
    "arbeitnow", "jooble", "jobrapido", "careerjet", "randstad", "ferchau", "instaffo",
)

def job_id(url: str) -> str | None:
    match = re.search(r"/jobs/view/(\d+)", url)
    return match.group(1) if match else None

def is_agency(company: str, description: str | None) -> bool:
    name = company.lower()
    if any(board in name for board in AGENCY_NAMES):
        return True
    return "acting as an employment agency" in (description or "").lower()

def workplace(title: str, location, description: str | None, from_page: str | None) -> str | None:
    if from_page in {"remote", "hybrid", "on-site"}:
        return from_page
    text = " ".join(part for part in re.split(r"[.\n]", f"{title} {location or ''} {description or ''}".lower()) if "do not apply if" not in part and "not remote" not in part)
    if re.search(r"100\s*%\s*vor ort|\d+\s*tage\s*vor ort", text) or any(p in text for p in ("in person", "on-site", "onsite", "vor ort")):
        return "on-site"
    if "hybrid" in text or "remote-option" in text or "remote option" in text or re.search(r"\d+\s*days? in the office|\d+\s*days? in office", text):
        return "hybrid"
    if any(p in text for p in ("100% remote", "fully remote", "remote-first", "remote role", "remote position", "work remotely", "remote")) and "remote-friendly" not in text:
        return "remote"
    return None

def salary(title: str, description: str | None) -> str | None:
    match = re.search(r"(?:bis|up to|to)\s*(\d[\d\.]*)\s*€", f"{title} {description or ''}", re.I)
    return f"{match.group(1)} €" if match else None

def strip_injection(text: str | None) -> str | None:
    if not text:
        return None
    kept = [part.strip() for part in re.split(r"[.\n]", text) if part.strip() and "ignore all previous instructions" not in part.lower()]
    return ". ".join(kept) or None

def page_facts(url: str) -> dict:
    import requests
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        response.raise_for_status()
    except Exception:
        return {}
    html = response.text
    posted = re.search(r'<time[^>]*datetime="([^"]+)"', html)
    applicants = re.search(r"(\d[\d,]*)\s+applicants|first\s+(\d[\d,]*)\s+applicants", html, re.I)
    return {
        "workplaceType": (_criteria(html, "Workplace type") or _criteria(html, "Arbeitsplatztyp") or "").lower() or None,
        "postedAt": posted.group(1) if posted else None,
        "applicantsCount": (applicants.group(1) or applicants.group(2) or "").replace(",", "") or None if applicants else None,
        "employmentType": _criteria(html, "Employment type") or _criteria(html, "Beschäftigungsart"),
        "seniorityLevel": _criteria(html, "Seniority level") or _criteria(html, "Karrierestufe"),
        "industries": _criteria(html, "Industries") or _criteria(html, "Branchen"),
        "companyUrl": (re.search(r'href="(https://www.linkedin.com/company/[^"]+)"', html) or [None, None])[1],
        "companyLogo": (re.search(r'data-delayed-url="(https://[^"]+)"', html) or [None, None])[1],
        "companySize": _criteria(html, "Company size") or _criteria(html, "Unternehmensgröße"),
    }

def _criteria(html: str, label: str) -> str | None:
    match = re.search(rf"{re.escape(label)}</h3>\s*<span[^>]*>\s*([^<]+)", html, re.I | re.S)
    return match.group(1).strip() if match else None

def merge_cities(items: list[dict]) -> list[dict]:
    merged, index = [], {}
    for item in items:
        data = item["data"]
        key = data.get("id") or f"{data['company'].lower()}|{data['title'].lower()}"
        if key not in index:
            index[key] = item
            merged.append(item)
            continue
        current = index[key]["data"]
        locations = current.get("locations") or [current.get("location")]
        if data.get("location") and data.get("location") not in locations:
            locations.append(data.get("location"))
        current["locations"] = locations
        current["location"] = ", ".join(str(part) for part in locations if part)
    return merged

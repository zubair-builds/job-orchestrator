LIMITS = {
    "linkedin-jobs": {
        "speed": "About 15 seconds per job, because each guest page is fetched.",
        "empty": {
            "directUrl": "Always null. The public page has no apply link.",
            "salary": "Null unless the title contains a figure such as bis 75.000 €.",
            "companySize": "Null unless company_info is true.",
            "companyWebsite": "Null unless company_info is true.",
            "workplaceType": "Null when the page and text have no workplace phrase.",
            "applicantsCount": "200+ is the public cap, not an exact count.",
        },
        "sample": {"search_term": "React", "location": "Germany", "hours_old": 168, "results_wanted": 5},
    },
    "indeed-jobs": {
        "speed": "Usually faster than LinkedIn. hours_old is ignored when is_remote is true.",
        "empty": {
            "directUrl": "Null when Indeed has no external apply link.",
            "salary": "Not parsed on this actor.",
        },
        "sample": {"search_term": "React", "location": "Berlin", "country": "Germany", "results_wanted": 5},
    },
    "glassdoor-jobs": {
        "speed": "A 5-job run is usually under 30 seconds.",
        "empty": {
            "description": "Always null. JobSpy does not return Glassdoor posting text.",
            "directUrl": "Null when Glassdoor has no external apply link.",
            "salary": "Null unless the title contains a figure.",
            "workplaceType": "Null unless the title says remote or hybrid.",
        },
        "sample": {"search_term": "React", "location": "Berlin", "country": "Germany", "results_wanted": 5},
    },
}

def limits(name: str) -> dict:
    return LIMITS.get(name, {"speed": "Unknown actor.", "empty": {}, "sample": {}})

def field_notes(items: list[dict]) -> list[str]:
    notes = []
    if not items:
        return ["No rows. Check the run note for dropped agency rows."]
    platforms = {item.get("platform") for item in items}
    if "linkedin" in platforms and all(item.get("directUrl") is None for item in items):
        notes.append("directUrl is null on every LinkedIn row because the public page has no apply link.")
    if "glassdoor" in platforms and all(not item.get("description") for item in items):
        notes.append("description is null on every Glassdoor row. This actor is a finder, not a full record.")
    if all(item.get("salary") is None for item in items):
        notes.append("salary is null. It is filled only when the title contains an amount.")
    if any(item.get("applicantsCount") == "200+" for item in items):
        notes.append("200+ is LinkedIn's public cap, not an exact applicant count.")
    return notes

def duration_seconds(started, finished) -> float | None:
    if not started or not finished:
        return None
    return round((finished - started).total_seconds(), 1)

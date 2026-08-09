#!/usr/bin/env python3
"""
ResearchMap per-section fetcher.

Bulk API (/KazumasaFUJIWARA) drops items in published_papers / presentations /
teaching_experience, so we fetch each section via its dedicated endpoint and
rebuild json/data.json from scratch.

Optional secrets: copy updater/.env.example to updater/.env, or run via Infisical:
  infisical run --env=dev -- python update_merge.py

No third-party dependencies — uses stdlib urllib only.
"""

import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from env import get_openalex_mailto, get_researchmap_api_key, load_env

load_env()

BASE = "https://api.researchmap.jp/KazumasaFUJIWARA"
OUTPUT = Path(__file__).parent.parent / "json" / "data.json"
SUPPLEMENTAL_PAPERS = Path(__file__).parent.parent / "json" / "supplemental_papers.json"

SECTIONS = [
    "research_interests",
    "research_areas",
    "research_experience",
    "education",
    "committee_memberships",
    "awards",
    "published_papers",
    "presentations",
    "teaching_experience",
    "association_memberships",
    "research_projects",
    "social_contribution",
]

# Top-level profile fields to carry over from the root endpoint.
# The root API is reliable for these; only @graph sections are broken.
PROFILE_KEYS = [
    "@context", "@id", "@type",
    "rm:user_id", "rm:creator_id", "rm:creator_type",
    "rm:created", "rm:modifier_id", "rm:modifier_type", "rm:modified",
    "permalink", "family_name", "given_name",
    "display_name_kana", "display_nickname", "display_image",
    "contact_point", "display_contact_point",
    "affiliations", "degrees", "profile", "display_profile",
    "see_also", "display_url", "identifiers",
    "rm:erad_id_verified", "rm:orc_id_verified",
    "display_erad_id", "display_orc_id",
    "display_researcher_id", "display_j_global_id",
]


def fetch_json(url: str) -> dict:
    headers = {"Accept": "application/json", "User-Agent": f"mypage-updater/1.0 (mailto:{get_openalex_mailto()})"}
    api_key = get_researchmap_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = Request(url, headers=headers)
    with urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def fetch_all_items(section: str) -> list:
    """Fetch all items for a section, handling pagination."""
    items = []
    limit = 100
    offset = 0
    while True:
        url = f"{BASE}/{section}?limit={limit}&offset={offset}"
        data = fetch_json(url)
        page = data.get("items", [])
        items.extend(page)
        total = data.get("total_items", len(items))
        if len(items) >= total or len(page) == 0:
            break
        offset += limit
    return items


def redact_contact(data: dict) -> None:
    """Remove email addresses from exported data.json."""
    if "contact_point" in data:
        data.pop("contact_point", None)
    data["display_contact_point"] = "undisclosed"


def paper_dois(item: dict) -> set[str]:
    return {doi.lower() for doi in (item.get("identifiers") or {}).get("doi") or []}


def merge_supplemental_papers(items: list) -> list:
    """Append local papers missing from ResearchMap, deduped by DOI."""
    if not SUPPLEMENTAL_PAPERS.exists():
        return items

    payload = json.loads(SUPPLEMENTAL_PAPERS.read_text(encoding="utf-8"))
    supplemental = payload.get("items", [])
    if not supplemental:
        return items

    existing_dois = set()
    for item in items:
        existing_dois |= paper_dois(item)

    added = []
    for paper in supplemental:
        dois = paper_dois(paper)
        if dois and dois & existing_dois:
            continue
        added.append(paper)

    if not added:
        return items

    merged = items + added
    merged.sort(key=lambda item: item.get("publication_date") or "", reverse=True)
    print(f"  supplemental_papers... +{len(added)} items")
    return merged


def main():
    print("Fetching profile metadata from root endpoint...")
    try:
        root = fetch_json(BASE)
    except (URLError, HTTPError) as e:
        print(f"ERROR: failed to fetch root profile: {e}")
        raise SystemExit(1)

    data = {k: root[k] for k in PROFILE_KEYS if k in root}
    redact_contact(data)
    data["@graph"] = []

    errors = []
    for section in SECTIONS:
        print(f"  {section}...", end=" ", flush=True)
        try:
            items = fetch_all_items(section)
            if section == "published_papers":
                items = merge_supplemental_papers(items)
            data["@graph"].append({"@type": section, "items": items})
            print(f"{len(items)} items")
        except (URLError, HTTPError) as e:
            print(f"ERROR: {e}")
            errors.append(section)

    if errors:
        print(f"\nWARNING: failed sections (kept previous data): {errors}")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {OUTPUT}")


if __name__ == "__main__":
    main()

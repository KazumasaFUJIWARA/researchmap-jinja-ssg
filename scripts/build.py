#!/usr/bin/env python3
"""Render the site from json/ + templates/ into dist/, driven by site.json.

Ported from the browser-side modules under js/. The DOM those modules produce is
the specification; scripts/domdump.mjs diffs this output against it.

Usage:
    python scripts/build.py [--out dist]
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
JSON_DIR = ROOT / "json"

SITE = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))

LANGS = tuple(SITE["languages"])
NAV = SITE["nav"]
STRINGS = SITE["strings"]
PAGES = SITE["pages"]
THESES = SITE["theses"]

# Pages that exist only in Japanese; their language switch falls back to the
# English top page (js/header.js).
JA_ONLY = set(SITE["ja_only_pages"])

# Files copied verbatim into dist/, relative to the repository root.
VERBATIM = tuple(SITE["verbatim_assets"])

# (source, destination) for files the site links to but does not keep beside
# the pages. The thesis PDFs were left behind in the archived tree when the
# current site was built, which is why those links 404 today.
RELOCATED = tuple(tuple(pair) for pair in SITE.get("relocated_assets", []))


def load_json(name: str) -> dict:
    with (JSON_DIR / name).open(encoding="utf-8") as fh:
        return json.load(fh)


def graph_items(data: dict, type_name: str) -> list:
    for section in data.get("@graph", []):
        if section.get("@type") == type_name:
            return section.get("items") or []
    return []


def lang_switch(filename: str, lang: str) -> str:
    """Ported from js/header.js, extended for pages nested below ja/."""
    if lang != "ja":
        return f"ja/{filename}"
    depth = filename.count("/")
    if depth or filename in JA_ONLY:
        # No English counterpart: fall back to the English top page.
        return "../" * (depth + 1) + "index.html"
    return f"../{filename}"


def build_index_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    affiliation = data["affiliations"][0]
    profile_text = (data.get("profile") or {}).get(lang)

    interest_keywords = []
    if not profile_text:
        interest_keywords = [
            item["keyword"][lang] for item in graph_items(data, "research_interests")
        ]

    address = profile["address"]
    contact = {
        "office": address["office"][lang],
        "location": address["location"][lang],
        # js/index.js prefixes the Japanese postal code with 〒.
        "postal_code": ("〒" if lang == "ja" else "") + str(address["postal_code"]),
        "phone": address.get("phone") if lang == "ja" else None,
        "form": None,
    }
    form = (profile.get("contact") or {}).get("google_form")
    if form:
        contact["form"] = {
            "url": form.get("url"),
            "label": (form.get("label") or {}).get(lang),
            "note": (form.get("note") or {}).get(lang),
        }

    see_also = [
        {"label": item["label"], "url": item["@id"]}
        for item in (data.get("see_also") or [])
        if item.get("label") and item["label"].upper() not in {"URL", "URL_EN"}
    ]

    return {
        "affiliation": {
            "job": affiliation["job"][lang],
            "section": affiliation["section"][lang],
            "affiliation": affiliation["affiliation"][lang],
        },
        "profile_text": profile_text,
        "interest_keywords": interest_keywords,
        "news": [{"date": n["date"], "content": n["content"][lang]} for n in news],
        "contact": contact,
        "external_ids": see_also,
        "researchmap_url": profile["researchmap"]["url"][lang],
    }


EN_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def format_talk_date(raw: str, lang: str) -> str:
    """Reproduce toLocaleDateString(lang, {year,month:'long',day}) from js/talks.js.

    The browser parses a date-only string as UTC and formats it in the viewer's
    timezone, so the rendered day currently shifts for viewers west of UTC. We
    format the literal date instead, which matches UTC and JST and no longer
    depends on who is looking.
    """
    parts = raw.split("T")[0].replace("/", "-").split("-")
    year, month, day = (int(p) for p in parts[:3])
    if lang == "ja":
        return f"{year}年{month}月{day}日"
    return f"{EN_MONTHS[month - 1]} {day}, {year}"


def talk_sort_key(talk: dict) -> str:
    for field in ("from_event_date", "event_date", "invited_date", "created"):
        if talk.get(field):
            return str(talk[field])
    return ""


def pick(value: dict | None, lang: str) -> str:
    """`x?.[lang] || x?.en || x?.ja || ''`, the accessor used throughout js/."""
    if not value:
        return ""
    return value.get(lang) or value.get("en") or value.get("ja") or ""


def format_presenters(presenters: dict | None, lang: str) -> str:
    if not presenters:
        return ""
    ja_list = presenters.get("ja") or []
    en_list = presenters.get("en") or []
    people = (ja_list or en_list) if lang == "ja" else (en_list or ja_list)
    rendered = []
    for person in people:
        name = person.get("name") or ""
        affiliation = person.get("affiliation") or ""
        rendered.append(f"{name} ({affiliation})" if affiliation else name)
    return ("、" if lang == "ja" else ", ").join(rendered)


def build_talk(talk: dict, lang: str) -> dict:
    raw_date = talk_sort_key(talk)
    venue = pick(talk.get("event"), lang)
    location = pick(talk.get("location"), lang)
    separator = "、" if lang == "ja" else ", "
    return {
        "title": pick(talk.get("presentation_title"), lang)
        or ("タイトルなし" if lang == "ja" else "Untitled"),
        "authors": format_presenters(talk.get("presenters"), lang),
        "venue_line": venue + (separator + location if location else ""),
        "date": format_talk_date(raw_date, lang)
        if raw_date else ("日付未指定" if lang == "ja" else "Date not specified"),
        "slide_url": (talk.get("dataset") or {}).get("access_url"),
        "is_poster": talk.get("presentation_type") == "poster_presentation",
    }


def build_talks_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    presentations = graph_items(data, "presentations")
    international = [t for t in presentations if t.get("is_international_presentation") is True]
    domestic = [t for t in presentations if t.get("is_international_presentation") is not True]
    order = lambda group: sorted(group, key=talk_sort_key, reverse=True)
    return {
        "international": [build_talk(t, lang) for t in order(international)],
        "domestic": [build_talk(t, lang) for t in order(domestic)],
    }


def build_links_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    researcher = [
        {"label": link["label"][lang], "url": link["url"]}
        for link in (profile.get("researcher_links") or [])
    ]
    institution = [
        {
            "label": link["label"][lang],
            "url": link.get("url"),
            "children": [
                {"label": child["label"][lang], "url": child["url"]}
                for child in (link.get("children") or [])
            ],
        }
        for link in (profile.get("institution_links") or [])
    ]
    github_groups = profile.get("github") or []
    return {
        "researcher_links": researcher,
        "institution_links": institution,
        "github_groups": github_groups,
        # js/links.js renders the GitHub *tab* for both languages but only emits
        # the section for Japanese. Ported as-is; static/js/tabs.js tolerates the
        # missing target instead of throwing.
        "github_section": bool(github_groups) and lang == "ja",
        "warning": (profile.get("warning") or {}).get(lang, ""),
    }


def thesis_bibtex(spec: dict, degrees: list) -> str:
    """Build the entry from the matching ResearchMap degree record."""
    wanted = {"doctor": "doctor", "master": "master"}[spec["kind"]]
    degree = next(
        (d for d in degrees if wanted in d["degree"]["en"].lower()), None
    ) or {}
    school = (degree.get("degree_institution") or {}).get("en", "")
    year = (degree.get("degree_date") or "").split("-")[0]
    return (
        f"@{spec['entry_type']}{{{spec['cite_key']},\n"
        f"    author = {{{spec['bibtex_author']}}},\n"
        f"    title = {{{spec['title']['en']}}},\n"
        f"    school = {{{school}}},\n"
        f"    year = {{{year}}},\n"
        f"    type = {{{spec['label']['en']}}}\n}}"
    )


def author_names(authors: dict | None, key: str) -> list[str]:
    return [a.get("name", "") for a in ((authors or {}).get(key) or [])]


def cite_key_name(full_name: str, known_family: set[str]) -> str:
    """Family name for a BibTeX key.

    ResearchMap stores author names inconsistently -- "Kazumasa Fujiwara",
    "Fujiwara Kazumasa" and "K. Fujiwara" all occur -- so a positional rule
    alone is wrong for some records. Prefer a token matching a known family
    name, else fall back to the "First Last" convention.
    """
    if "," in full_name:
        family = full_name.split(",")[0]
    else:
        tokens = full_name.split()
        if not tokens:
            return "anonymous"
        family = next(
            (tok for tok in tokens if tok.lower() in known_family), tokens[-1]
        )
    key = re.sub(r"[^0-9a-z]", "", family.lower())
    return key or "anonymous"


def generate_bibtex(paper: dict, known_family: set[str], cite_key: str) -> str:
    """Ported from generateBibtex() in js/articles.js, with the key corrected."""
    en_authors = author_names(paper.get("authors"), "en")
    year = (paper.get("publication_date") or "").split("-")[0]
    volume, number = paper.get("volume") or "", paper.get("number") or ""
    start, end = paper.get("starting_page"), paper.get("ending_page")
    pages = f"{start}--{end}" if start and end else ""
    doi = ((paper.get("identifiers") or {}).get("doi") or [""])[0]

    entry = (
        f"@article{{{cite_key},\n"
        f"    author = {{{' and '.join(en_authors)}}},\n"
        f"    title = {{{(paper.get('paper_title') or {}).get('en', '')}}},\n"
        f"    journal = {{{(paper.get('publication_name') or {}).get('en', '')}}},\n"
        f"    year = {{{year}}}"
    )
    for label, value in (("volume", volume), ("number", number), ("pages", pages), ("doi", doi)):
        if value:
            entry += f",\n    {label} = {{{value}}}"
    return entry + "\n}"


def assign_cite_keys(papers: list, known_family: set[str]) -> list[str]:
    """Family+year keys, suffixed a/b/c where a pair would otherwise collide.

    BibTeX requires keys to be unique within a bibliography, and this author
    published five times in 2015.
    """
    base_keys = []
    for paper in papers:
        authors = author_names(paper.get("authors"), "en")
        family = cite_key_name(authors[0], known_family) if authors else "anonymous"
        base_keys.append(f"{family}{(paper.get('publication_date') or '').split('-')[0]}")

    counts: dict[str, int] = {}
    for key in base_keys:
        counts[key] = counts.get(key, 0) + 1

    seen: dict[str, int] = {}
    resolved = []
    for key in base_keys:
        if counts[key] == 1:
            resolved.append(key)
            continue
        index = seen.get(key, 0)
        seen[key] = index + 1
        resolved.append(f"{key}{chr(ord('a') + index)}")
    return resolved


def build_paper(paper: dict, lang: str, known_family: set[str], cite_key: str) -> dict:
    journal = pick(paper.get("publication_name"), lang)
    year = (paper.get("publication_date") or "").split("-")[0]
    volume, number = paper.get("volume") or "", paper.get("number") or ""
    start, end = paper.get("starting_page"), paper.get("ending_page")

    citation = journal
    if volume:
        citation += f", Vol. {volume}"
    if number:
        citation += f", No. {number}"
    if start and end:
        citation += f", pp. {start}--{end}"
    if year:
        citation += f" ({year})"

    ja_authors = author_names(paper.get("authors"), "ja")
    en_authors = author_names(paper.get("authors"), "en")
    if lang == "ja":
        authors = "、".join(ja_authors) if ja_authors else ", ".join(en_authors)
    else:
        authors = ", ".join(en_authors) if en_authors else "、".join(ja_authors)

    # ResearchMap is the source of truth for abstracts, so read its `description`
    # field. The legacy page read `paper_abstract`, which was injected by an
    # external collector that was never wired into update_merge.py.
    description = paper.get("description") or {}

    return {
        "title": pick(paper.get("paper_title"), lang)
        or ("タイトルなし" if lang == "ja" else "Untitled"),
        "authors": authors,
        "abstract": description.get(lang) or description.get("en") or "",
        "citation": citation,
        "doi": ((paper.get("identifiers") or {}).get("doi") or [""])[0],
        "bibtex": generate_bibtex(paper, known_family, cite_key),
    }


def build_articles_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    papers = graph_items(data, "published_papers")
    known_family = {v.lower() for v in data["family_name"].values() if isinstance(v, str)}
    cite_keys = assign_cite_keys(papers, known_family)

    journal, proceedings = [], []
    for paper, cite_key in zip(papers, cite_keys):
        target = journal if paper.get("published_paper_type") == "scientific_journal" else proceedings
        target.append(build_paper(paper, lang, known_family, cite_key))
    return {
        "journal_papers": journal,
        "proceedings_papers": proceedings,
        "theses": [
            {
                "title": spec["title"][lang],
                "authors": spec["authors"][lang],
                "label": spec["label"][lang],
                # The PDFs live at the site root, so ja/ pages reach up a level.
                "pdf": ("../" if lang == "ja" else "") + spec["pdf"],
                "bibtex": thesis_bibtex(spec, data["degrees"]),
            }
            for spec in THESES
        ],
    }


MONTH_NUMBERS = {name.lower(): i + 1 for i, name in enumerate(EN_MONTHS)}
MONTH_NUMBERS.update({name[:3].lower(): i + 1 for i, name in enumerate(EN_MONTHS)})

JA_DATE = re.compile(r"(\d{4})年(\d{1,2})月?(\d{1,2})?日?")
EN_DATE = re.compile(r"(\d{1,2})? ?([A-Za-z]+) (\d{4})")
YEAR_ONLY = re.compile(r"(\d{4})")


def date_sort_number(text: str) -> int:
    """Ported from extractDateNum() in js/cv.js, including its fallbacks."""
    if not text:
        return 0
    match = JA_DATE.search(text)
    if match:
        year, month, day = match.group(1), match.group(2), match.group(3)
        return int(f"{year}{int(month):02d}{int(day):02d}" if day else f"{year}{int(month):02d}99")
    match = EN_DATE.search(text)
    if match:
        day, name, year = match.group(1), match.group(2), match.group(3)
        month = MONTH_NUMBERS.get(name.lower())
        if month is None:
            # `new Date("<junk> 1, 2000").getMonth()` is NaN, and the template
            # literal then yields e.g. "2020NaN99", which parseInt truncates to
            # the year alone.
            return int(year)
        return int(f"{year}{month:02d}{int(day):02d}" if day else f"{year}{month:02d}99")
    match = YEAR_ONLY.search(text)
    return int(f"{match.group(1)}9999") if match else 0


def by_start_then_ongoing(items: list, text_of) -> list:
    """finished first, then ongoing -- both newest first (js/cv.js)."""
    ongoing = [i for i in items if "--" in text_of(i)]
    finished = [i for i in items if "--" not in text_of(i)]
    order = lambda group: sorted(group, key=lambda i: date_sort_number(text_of(i)), reverse=True)
    return order(finished) + order(ongoing)


def build_grant(item: dict, profile: dict, lang: str) -> dict:
    override = next(
        (g for g in (profile.get("grants") or []) if g.get("rm:id") == item.get("rm:id")), None
    ) or {}

    system = f"{item['system_name'][lang]} ({item['category'][lang]})"
    grant_number = ((item.get("identifiers") or {}).get("grant_number") or [""])[0]
    if grant_number:
        system += f" {grant_number}"
    institution = (override.get("institution") or {}).get(lang)

    see_also = None
    if (override.get("see_also") or {}).get("label"):
        see_also = {"label": override["see_also"]["label"][lang], "url": override["see_also"]["url"]}
    elif (item.get("see_also") or [{}])[0].get("label"):
        first = item["see_also"][0]
        see_also = {"label": first["label"].upper(), "url": first["@id"]}

    to_date = item.get("to_date")
    return {
        "title": item["research_project_title"][lang],
        "system": system,
        "institution": institution,
        "institution_label": "受入れ研究機関" if lang == "ja" else "Institution",
        "see_also": see_also,
        "note": override.get("note"),
        "dates": f"{item['from_date']} -- {to_date}" if to_date and to_date != "9999" else item["from_date"],
    }


def build_cv_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    other = "en" if lang == "ja" else "ja"
    labels = (
        ["姓", "名", "性別", "学位"] if lang == "ja"
        else ["Family Name", "Given Name", "Sex", "Degree"]
    )
    personal_info = [
        {"label": labels[0], "value": f"{data['family_name'][lang]} ({data['family_name'][other]})"},
        {"label": labels[1], "value": f"{data['given_name'][lang]} ({data['given_name'][other]})"},
        {"label": labels[2], "value": profile["personal_info"]["sex"][lang]},
        {"label": labels[3], "value": data["degrees"][0]["degree"][lang]},
    ]

    degrees = []
    for degree in data["degrees"]:
        english = degree["degree"]["en"].lower()
        kind = next((k for k in ("doctor", "master", "bachelor") if k in english), None)
        override = next((d for d in profile["degrees"] if d.get("type") == kind), None) or {}
        degrees.append({
            "name": degree["degree"][lang],
            "institution": degree["degree_institution"][lang],
            "supervisor": (override.get("supervisor") or {}).get(lang),
            "date": override.get("date") or degree.get("degree_date"),
        })

    positions = []
    experience = [
        exp for exp in graph_items(data, "research_experience")
        if (exp.get("job") or {}).get("en", "").strip()
        and (((exp.get("affiliation") or {}).get("en", "").strip())
             or ((exp.get("section") or {}).get("en", "").strip()))
    ]
    for exp in sorted(experience, key=lambda e: e["from_date"], reverse=True):
        override = next((j for j in profile["job"] if j.get("rm:id") == exp.get("rm:id")), None) or {}
        to_date = exp.get("to_date")
        positions.append({
            "title": exp["job"][lang],
            "affiliation": exp["affiliation"][lang],
            "section": (exp.get("section") or {}).get(lang, ""),
            "note": override.get("note"),
            "dates": f"{exp['from_date']} -- {to_date}" if to_date and to_date != "9999" else exp["from_date"],
        })

    projects = graph_items(data, "research_projects")
    grants = {
        role: [build_grant(p, profile, lang) for p in projects
               if p.get("research_project_owner_role") == role]
        for role in ("principal_investigator", "coinvestigator", "others")
    }

    org_text = lambda item: (item.get("date") or {}).get(lang) or (item.get("date") or {}).get("en") or ""
    organization = [
        {
            "label": (item["label"].get(lang) or item["label"]["en"]),
            "date": org_text(item),
            "place": (item.get("place") or {}).get(lang),
        }
        for item in by_start_then_ongoing(profile["organization"], org_text)
    ]

    return {
        "personal_info": personal_info,
        "research_areas": [
            {"discipline": a["discipline"]["en"], "field": a["research_field"]["en"],
             "keyword": a["research_keyword"]["en"]}
            for a in graph_items(data, "research_areas")
        ],
        "research_interests": [i["keyword"][lang] for i in graph_items(data, "research_interests")],
        # js/cv.js reverses the membership list in place before rendering.
        "memberships": [
            m["academic_society_name"][lang]
            for m in reversed(graph_items(data, "association_memberships"))
        ],
        "degrees": degrees,
        "positions": positions,
        "has_grants": lang == "ja",
        "grants_principal": grants["principal_investigator"],
        "grants_collaborator": grants["coinvestigator"],
        "grants_other": grants["others"],
        "organization": organization,
        "has_regional_support": lang == "ja",
        # Rendered for Japanese only, and some entries carry no English text.
        "regional_support": [
            {"title": item["social_contribution_title"][lang],
             "event": (item.get("event") or {}).get(lang, ""),
             "promoter": (item.get("promoter") or {}).get(lang, ""),
             "dates": f"{item['from_event_date']} -- {item['to_event_date']}"}
            for item in (graph_items(data, "social_contribution") if lang == "ja" else [])
        ],
    }


def subject_label(item: dict, lang: str) -> str:
    name = item.get("subject_name") or {}
    return name.get(lang) or name.get("ja") or name.get("en") or "（科目名不明）"


def group_by_subject(lectures: list, lang: str) -> list:
    grouped: dict[str, list] = {}
    for item in lectures:
        grouped.setdefault(subject_label(item, lang), []).append(item)

    groups = []
    for subject in sorted(grouped):
        entries = []
        for item in sorted(grouped[subject], key=lambda i: i.get("from_date") or "", reverse=True):
            institution = item.get("institution_name") or {}
            name = institution.get(lang) or institution.get("ja") or institution.get("en") or ""
            start, end = item.get("from_date") or "", item.get("to_date") or ""
            period = f"{start} ～ {end}" if start and end else start
            syllabus = next(
                (link["@id"] for link in (item.get("see_also") or []) if link.get("label") == "url"),
                None,
            )
            entries.append({
                "text": f"{name} ({period})" if period else name,
                "syllabus": syllabus,
            })
        groups.append({"subject": subject, "entries": entries})
    return groups


def academic_year(from_date: str | None) -> int | None:
    """Japanese academic years start in April (js/lectures.js)."""
    if not from_date:
        return None
    parts = from_date.split("-")
    try:
        year = int(parts[0])
    except (ValueError, IndexError):
        return None
    month = int(parts[1]) if len(parts) > 1 and parts[1] else 4
    return year if month >= 4 else year - 1


def build_lectures_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    # js/lectures.js split ongoing from past against the clock in the reader's
    # browser. A static page freezes that split at build time, so the site needs
    # a periodic rebuild for the boundary to keep moving.
    today = date.today()
    now_key = f"{today.year}-{today.month:02d}"

    ongoing, past = [], []
    for item in graph_items(data, "teaching_experience"):
        to_date = item.get("to_date")
        target = ongoing if (not to_date or to_date == "9999" or to_date >= now_key) else past
        target.append(item)

    buckets: dict[str, list] = {}
    for item in past:
        key = academic_year(item.get("from_date"))
        buckets.setdefault("unknown" if key is None else str(key), []).append(item)

    years = sorted(
        buckets, key=lambda k: (k == "unknown", -int(k) if k != "unknown" else 0)
    )

    hours = profile.get("office_hours") or []
    form = (profile.get("contact") or {}).get("google_form") or {}
    form_url = form.get("url")
    form_label = (form.get("label") or {}).get(lang) or "お問い合わせフォーム"
    note = (
        f'※事前に<a href="{form_url}" target="_blank" rel="noopener noreferrer">{form_label}</a>よりご予約ください。'
        if form_url else "※事前に連絡フォームよりご予約ください。"
    )

    return {
        "office_hours": [f"{h['day']}: {h['time']}" for h in hours],
        "appointment_note": note,
        "ongoing": group_by_subject(ongoing, lang),
        "past_years": [
            {"label": "年度不明" if key == "unknown" else f"{key}年度",
             "groups": group_by_subject(buckets[key], lang)}
            for key in years
        ],
    }


CALENDAR_BASE = (
    "https://calendar.google.com/calendar/embed"
    "?wkst=1&bgcolor=%23616161&ctz=Asia%2FTokyo"
)


def build_schedule_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    calendars = profile.get("google_calendar") or []

    src = CALENDAR_BASE
    for cal in calendars:
        src += f"&src={quote(cal['id'], safe='')}"
        if cal.get("color"):
            src += f"&color={quote(cal['color'], safe='')}"

    return {
        "calendar_src": src,
        "calendars": [
            {
                "name": cal.get("name", ""),
                "color": cal.get("color") or "#888",
                "note": cal.get("note"),
                "link": cal.get("link"),
                "url": "https://calendar.google.com/calendar/u/0?cid="
                       + quote(cal["id"], safe=""),
            }
            for cal in calendars if not cal.get("freeBusyOnly")
        ],
    }


def build_empty_context(lang: str, data: dict, profile: dict, news: list) -> dict:
    return {}


BUILDERS = {
    "index": build_index_context,
    "note_differentiability": build_empty_context,
    "notes": build_empty_context,
    "schedule": build_schedule_context,
    "articles": build_articles_context,
    "cv": build_cv_context,
    "lectures": build_lectures_context,
    "talks": build_talks_context,
    "links": build_links_context,
}


def render_all(out_dir: Path) -> list[Path]:
    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=True,
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )

    data = load_json("data.json")
    profile = load_json("profile.json")
    news = sorted(load_json("news.json"), key=lambda n: n["date"], reverse=True)

    family, given = data["family_name"], data["given_name"]
    year = date.today().year
    written: list[Path] = []

    for name, spec in PAGES.items():
        for lang in LANGS:
            if lang not in spec:
                continue
            depth = spec["filename"].count("/")
            base = "../" * (depth + 1) if lang == "ja" else "../" * depth
            page = dict(spec[lang])
            page["nav_key"] = spec["nav_key"]
            page["lang_switch"] = lang_switch(spec["filename"], lang)
            page["rule"] = spec.get("rule", True)

            context = {
                "lang": lang,
                "base": base,
                "page": page,
                "nav": NAV[lang],
                "nav_base": "../" * depth,
                "t": STRINGS[lang],
                "year": year,
                "display_name": (
                    f"{family['ja']} {given['ja']}" if lang == "ja"
                    else f"{given['en']} {family['en']}"
                ),
                "theme_label_light": SITE["theme_label_light"][lang],
                "lang_switch_label": SITE["lang_switch_label"][lang],
                "footer_name": SITE["footer_name"][lang],
                "to_top_label": SITE["to_top_label"][lang],
            }
            context.update(BUILDERS[name](lang, data, profile, news))

            target = out_dir / ("ja" if lang == "ja" else "") / spec["filename"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(env.get_template(spec["template"]).render(**context), encoding="utf-8")
            written.append(target)

    copy_static(out_dir)
    return written


def copy_static(out_dir: Path) -> None:
    for item in VERBATIM:
        source = ROOT / item
        if not source.exists():
            print(f"warning: missing static asset {item}", file=sys.stderr)
            continue
        target = out_dir / item
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    for source_name, dest_name in RELOCATED:
        source = ROOT / source_name
        if not source.exists():
            print(f"warning: missing static asset {source_name}", file=sys.stderr)
            continue
        shutil.copy2(source, out_dir / dest_name)
    if (STATIC / "js").is_dir():
        shutil.copytree(STATIC / "js", out_dir / "js", dirs_exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="dist")
    args = parser.parse_args()

    final = ROOT / args.out
    # Build into a sibling temp dir and swap, so a failure never leaves a
    # half-written dist/ behind.
    staging = Path(tempfile.mkdtemp(prefix=".build-", dir=ROOT))
    previous = final.with_name(final.name + ".old")
    try:
        written = render_all(staging)
        # Move the old tree aside rather than deleting it first: on DrvFs a
        # rename into a just-removed directory fails with EACCES.
        shutil.rmtree(previous, ignore_errors=True)
        if final.exists():
            final.rename(previous)
        staging.rename(final)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    finally:
        shutil.rmtree(previous, ignore_errors=True)

    print(f"built {len(written)} page(s) -> {final.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())

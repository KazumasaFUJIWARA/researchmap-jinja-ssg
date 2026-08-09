#!/usr/bin/env python3
"""Gate the build output before it reaches the deploy branch.

Everything checked here is something that would otherwise ship silently: a page
that vanished, a section that rendered empty because upstream data was
truncated, a stray reference to json/ that would force the raw data onto the
public site, or a broken relative link.

Usage:
    python scripts/verify.py [dist]
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent

SITE = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))

EXPECTED_PAGES = [
    ("ja/" if lang == "ja" else "") + spec["filename"]
    for spec in SITE["pages"].values()
    for lang in SITE["languages"]
    if lang in spec
] + SITE.get("extra_expected_pages", [])

ALLOWED_SUFFIXES = {".html", ".css", ".js", ".ico", ".png", ".pdf", ".svg", ".jpg", ".webp"}

# Lower bounds, not exact counts: they catch a truncated upstream fetch without
# needing an update every time a paper is added.
MINIMUM_ITEMS = [
    (page, marker, int(minimum)) for page, marker, minimum in SITE.get("minimum_items", [])
]

# Redirect stubs carry no site chrome.
CHROME_EXEMPT = set(SITE.get("chrome_exempt_pages", []))


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        wanted = {"a": "href", "link": "href", "script": "src", "img": "src", "iframe": "src"}
        key = wanted.get(tag)
        if not key:
            return
        for name, value in attrs:
            if name == key and value:
                self.links.append(value)


def check(dist: Path) -> list[str]:
    problems: list[str] = []

    for page in EXPECTED_PAGES:
        if not (dist / page).is_file():
            problems.append(f"missing page: {page}")

    for path in dist.rglob("*"):
        if path.is_file() and path.suffix.lower() not in ALLOWED_SUFFIXES:
            problems.append(f"unexpected file type in output: {path.relative_to(dist)}")

    for page in EXPECTED_PAGES:
        target = dist / page
        if not target.is_file():
            continue
        html = target.read_text(encoding="utf-8")

        # The deploy branch carries no json/, so nothing may still fetch it.
        if re.search(r"""["'(]\.{0,2}/?json/""", html):
            problems.append(f"{page}: still references json/")

        if page not in CHROME_EXEMPT:
            if not re.search(r"<title>\s*\S", html):
                problems.append(f"{page}: no title")
            if 'id="main-nav"' not in html:
                problems.append(f"{page}: no navigation container")
            elif re.search(r'id="main-nav"[^>]*>\s*</div>', html):
                problems.append(f"{page}: navigation is empty")

        collector = LinkCollector()
        collector.feed(html)
        for link in collector.links:
            parsed = urlparse(link)
            if parsed.scheme or parsed.netloc or link.startswith("#") or not link:
                continue
            resolved = (target.parent / unquote(parsed.path)).resolve()
            if not resolved.exists():
                problems.append(f"{page}: broken link {link}")

    for page, marker, minimum in MINIMUM_ITEMS:
        target = dist / page
        if not target.is_file():
            continue
        found = target.read_text(encoding="utf-8").count(f'class="{marker}"')
        if found < minimum:
            problems.append(f"{page}: only {found} .{marker} (expected at least {minimum})")

    return problems


def main() -> int:
    dist = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist"
    if not dist.is_dir():
        print(f"no such directory: {dist}", file=sys.stderr)
        return 2

    problems = check(dist)
    for problem in problems:
        print(f"FAIL {problem}", file=sys.stderr)
    if problems:
        print(f"\n{len(problems)} problem(s)", file=sys.stderr)
        return 1

    pages = sum(1 for _ in dist.rglob("*.html"))
    print(f"ok: {pages} pages verified in {dist}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

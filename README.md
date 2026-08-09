# researchmap-jinja-ssg

The source of a researcher's personal homepage. Academic records come from the
[researchmap](https://researchmap.jp/) API; Jinja renders them to HTML at build
time; only the finished HTML is published.

Nothing on the site fetches JSON in the browser. The publication list, CV and
talk list exist in the served HTML, and `json/` never leaves this repository.

If you want the same setup for your own site, read
[`docs/ADAPTING.md`](docs/ADAPTING.md).

## Build

```console
$ pip install -r requirements-build.txt
$ python scripts/build.py
built 14 page(s) -> dist/
$ python scripts/verify.py
ok: 16 pages verified
```

`dist/` is the complete site. Serve it from any static host.

## Layout

```
json/                  researchmap data plus hand-maintained profile and news
site.json              navigation, page metadata, per-language strings
templates/             Jinja templates, shared across both languages
static/js/             the JavaScript that stays in the browser
scripts/build.py       json/ + templates/ -> dist/
scripts/verify.py      gates dist/ before anything is published
scripts/domdump.mjs    renders a page under jsdom and dumps a normalised DOM
updater/               refreshes json/data.json from the researchmap API
```

Two things stay client-side on purpose: tab switching, theme toggling and the
BibTeX dialogue, which need no data; and the numerical simulations on the notes
page, which are the point of that page.

## Publishing

`.github/workflows/build-deploy.yml` builds on every push to `main`, runs
`verify.py`, and force-pushes `dist/` to an orphan `deploy` branch. The web
server pulls that branch and serves it directly — it never builds, and never
receives `json/`, `templates/` or `scripts/`.

Because `deploy` is replaced wholesale rather than appended to, a server
following it needs

```console
$ git fetch --depth 1 && git reset --hard origin/deploy
```

`git pull` cannot follow a rewritten history.

`.github/workflows/update-researchmap.yml` refreshes `json/data.json` on demand.
The researchmap API needs no credentials, so neither workflow uses a secret.

## Verification

`verify.py` fails the build if a page is missing, an internal link is broken, a
list holds implausibly few items, or — the check that matters most — if any
generated page still refers to `json/`. That last one is what keeps the raw data
off the public site; one overlooked `fetch` would put it back.

`domdump.mjs` exists for migrations. It renders a page under jsdom, executes its
scripts against a filesystem-backed `fetch` shim, and prints a normalised DOM
tree. Running the same normaliser over generated HTML turns "does the new page
match the old one" into a diff. It was written to move this site off
client-side rendering and is kept for the next such change.

## Licence

MIT for the code. The content under `json/`, `ja/note/` and the thesis PDFs is
the author's own work and is not covered by that licence.

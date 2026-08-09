# Repository guide for agents

A researcher's personal homepage, rendered from JSON to static HTML at build
time. No server-side code, no client-side data fetching.

For the reasoning behind the design, and for the pitfalls of a migration like
this, read [`docs/ADAPTING.md`](docs/ADAPTING.md).

## Build and check

```bash
pip install -r requirements-build.txt
python scripts/build.py     # json/ + templates/ -> dist/
python scripts/verify.py    # gates dist/; run this before publishing anything
```

`verify.py` must pass. It is not advisory: the deploy workflow runs it, and a
failure leaves the previous site live rather than publishing a broken one.

## Where things live

| Path | Role |
|------|------|
| `json/data.json` | researchmap dump. **Do not hand-edit** — regenerate with `updater/update_merge.py` |
| `json/profile.json` | hand-maintained: contact, office hours, links, per-record overrides |
| `json/news.json` | hand-maintained news entries |
| `site.json` | navigation, per-page `<head>` metadata, UI strings, thesis records, asset lists |
| `templates/` | Jinja. `base.jinja` holds the shell; each page extends it |
| `static/` | publishable assets (CSS, favicon, PDFs, home stubs, notes); public URLs via `relocated_assets` |
| `static/js/` | JavaScript that stays in the browser |
| `scripts/build.py` | one context builder per page type, dispatched through `BUILDERS` |
| `scripts/verify.py` | output gate |
| `scripts/domdump.mjs` | normalised DOM dumper, for verifying rendering changes |
| `updater/` | refreshes `json/data.json` from the API |

## Invariants

- **No generated page may reference `json/`.** The deploy branch carries no
  data files; a stray `fetch` would put the raw dump back on the public site.
  `verify.py` enforces this and it must stay enforced.
- **Adding a page** means: a template, an entry in `site.json`'s `pages`, and a
  builder in `BUILDERS`. A page with no data needs `build_empty_context`.
- **Jinja autoescaping is on.** Use `|safe` only for fields documented as
  containing author-written HTML — `data.profile`, and the note fields in
  `profile.json`.
- **`StrictUndefined` is on.** A missing context key fails the build rather
  than rendering blank.
- **Rendering is time-dependent in one place.** The ongoing/past lecture split
  is decided against the build date, which is why `build-deploy.yml` also runs
  monthly. Do not add more build-time clock dependencies without saying so.

## Changing how a page renders

Change the template or the builder, rebuild, then diff against the previous
output before and after:

```bash
node scripts/domdump.mjs --static dist/articles.html > before.txt
# ...make the change, rebuild...
node scripts/domdump.mjs --static dist/articles.html > after.txt
diff before.txt after.txt
```

Every line of that diff should be a change you meant. `domdump.mjs` needs jsdom,
which is not a repository dependency: install it anywhere and point `JSDOM_PATH`
at the directory containing `node_modules`.

## Deployment

`main` → GitHub Actions builds and verifies → force-push `dist/` to the orphan
`deploy` branch → the web server pulls that branch.

`deploy` is replaced wholesale, so a server following it uses
`git fetch --depth 1 && git reset --hard origin/deploy`, not `git pull`.

Neither workflow needs a secret: the researchmap API is unauthenticated and
publishing uses the built-in token. The server needs a read-only deploy key.

## Notes

- `updater/update_merge.py` fetches each section from its own endpoint. The
  combined endpoint silently truncates several sections; do not "simplify" it
  back to one request.
- Paper abstracts come from researchmap's `description` field. There is no
  external abstract collection step — an earlier one existed and was retired.
- If this repository is public, keep personal data that no page displays out of
  `json/`.

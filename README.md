# researchmap-jinja-ssg

Pre-render a researcher's personal site from [researchmap](https://researchmap.jp/) API
data with Jinja, and publish only the finished HTML.

Many academic homepages fetch a JSON dump in the browser and build the page with
JavaScript. That works, but it means the publication list does not exist until
scripts run, and the raw dump has to be served alongside the site. This repository
moves that rendering to build time and keeps the JSON on the source branch.

It is a worked example rather than a framework: the templates are a real site's
templates, and `site.json` holds the parts that differ between sites.

## What is here

```
scripts/build.py       json/ + templates/  ->  dist/
scripts/verify.py      gates dist/ before it is published
scripts/domdump.mjs    renders a page under jsdom and dumps a normalised DOM
templates/             Jinja templates for both languages
static/js/             the JavaScript that stays in the browser
site.json              navigation, page metadata, per-language strings
json/                  sample data in the shape the researchmap API returns
```

```console
$ pip install -r requirements-build.txt
$ python scripts/build.py
built 12 page(s) -> dist/
$ python scripts/verify.py
ok: 12 pages verified
```

## Migrating from client-side rendering

The hard part of this move is not writing templates. It is proving that the new
page renders what the old one did, across every branch of the old rendering code,
in every language, for data you did not hand-pick.

`scripts/domdump.mjs` makes that mechanical. It loads a legacy page under jsdom,
executes its module scripts against a filesystem-backed `fetch` shim, waits for
the DOM to settle, and prints a normalised tree — attributes sorted, whitespace
collapsed, `<script>` dropped. The same normaliser runs over generated HTML, so
the two are directly comparable:

```console
$ node scripts/domdump.mjs --render legacy/articles.html > before.txt
$ node scripts/domdump.mjs --static dist/articles.html   > after.txt
$ diff before.txt after.txt
```

An empty diff means the port is faithful. A non-empty diff is a list of decisions
you have to justify one by one, which is exactly the review you want.

Two things worth knowing if you try this:

- The legacy modules run in Node's context, so their `console.log` lands on
  stdout beside the dump. Stub `console` while they execute.
- Anything the old code computed from the reader's clock or timezone — a
  "current versus past" split, a locale-formatted date — becomes fixed at build
  time. Decide deliberately what that should freeze to, and schedule a periodic
  rebuild if the boundary must keep moving.

Defects tend to surface during the comparison, because a diff shows behaviour
that no one had checked against reality. Expect to find some.

## Publishing

`.github/workflows/build-deploy.yml` renders the site and force-pushes `dist/`
to an orphan `deploy` branch. A server then pulls that branch and serves it
directly — it never builds anything, and never receives `json/`, `templates/`
or `scripts/`.

Because `deploy` is an orphan branch that is replaced wholesale, a server
following it wants

```console
$ git fetch --depth 1 && git reset --hard origin/deploy
```

rather than `git pull`, which cannot follow a rewritten history.

`verify.py` is what makes that contract real. Alongside checking that every
expected page exists, that internal links resolve, and that each list holds a
plausible number of items, it fails the build if any generated page still refers
to `json/`. Without that check, one overlooked `fetch` quietly puts the raw data
back on the public site.

## Adapting it

`site.json` carries the navigation, per-page `<head>` metadata, UI strings and
the small set of per-language labels. `scripts/build.py` has one context builder
per page type; a page whose data does not come from researchmap just needs a
builder that returns what its template expects.

The sample data in `json/` is synthetic and only exercises the fields the
templates read. Real data comes from `https://api.researchmap.jp/<permalink>`.
Fetch each section from its own endpoint rather than the combined one, which
returns incomplete lists for `published_papers`, `presentations` and
`teaching_experience`.

## Licence

MIT. The stylesheets and templates describe one particular site; treat them as a
starting point rather than something to deploy unchanged.

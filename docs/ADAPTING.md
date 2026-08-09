# Building the same thing for your own site

This repository is one researcher's homepage, not a framework. Nothing here is
parameterised enough to drop into another site unchanged: the templates encode
one person's page structure, and `site.json` encodes their navigation and
wording.

That is fine, because copying files is not the useful part. What transfers is
the shape of the solution and the handful of decisions that are easy to get
wrong. Read this repository as a worked example, then regenerate rather than
fork — a coding agent pointed at these files can produce the equivalent for a
different site far faster than you can adapt them by hand.

What follows is what such an agent, or you, needs to know.

## The shape

```
researchmap API ──(updater/)──> json/ ──┐
                                        ├──(scripts/build.py)──> dist/ ──> deploy branch ──> server
site.json, templates/, static/ ─────────┘
```

Three properties are worth preserving, and they are independent of Jinja,
Python, or researchmap:

1. **The server does not build.** It pulls a finished tree. A build failure
   cannot take the site down; it can only leave it stale.
2. **The published artefact contains no source data.** No JSON dump, no
   templates, no scripts. This is enforced mechanically, not by discipline —
   see "The check that matters" below.
3. **Interactive behaviour stays in the browser.** Prerendering is for content,
   not for tab switches and canvas animations. Trying to eliminate all
   client-side JavaScript is how this kind of migration turns into a rewrite.

## The researchmap API

`updater/update_merge.py` is worth reading before you write your own.

Fetch each section from its own endpoint — `https://api.researchmap.jp/<permalink>/published_papers`,
`/presentations`, `/teaching_experience`, and so on. The combined endpoint at
`https://api.researchmap.jp/<permalink>` **returns incomplete lists** for at
least those three sections. This is not documented, and the truncation is silent:
you get a valid response with fewer items.

No authentication is needed for public profiles, which is why the refresh
workflow needs no secret.

Two field-level surprises:

- `description` on a paper is the abstract, but it is free-form. Some records
  hold a bibliographic note ("preprint, arXiv:...") instead. If you render it
  behind a "Show abstract" control, that is what the reader will see.
- Author names are stored inconsistently within a single profile — "Jane
  Researcher", "Researcher Jane" and "J. Researcher" all appear. Any rule that
  picks the family name by position alone will be wrong for some records. See
  `cite_key_name()` in `scripts/build.py`.

## Migrating an existing client-rendered site

This is the part that actually takes the time, and the part where a mistake is
invisible.

Writing templates is mechanical. Proving that the new page renders what the old
one did — across every branch of the old rendering code, in both languages, for
data you did not hand-pick — is not. Eyeballing a few pages will not find a
sort predicate that you ported backwards.

`scripts/domdump.mjs` makes it a diff:

```console
$ node scripts/domdump.mjs --render legacy/articles.html > before.txt
$ node scripts/domdump.mjs --static dist/articles.html   > after.txt
$ diff before.txt after.txt
```

It loads the legacy page under jsdom, rewrites its module specifiers to absolute
file URLs, executes them against a `fetch` shim backed by the filesystem, waits
for the DOM to settle, and prints a tree with attributes sorted, whitespace
collapsed and `<script>` removed. The same normaliser runs over generated HTML,
so both sides are directly comparable.

Work page by page until the diff is empty, or until every remaining line is a
change you can name. Both outcomes are good; an unexplained line is not.

Four things that will bite:

- **Console output pollutes the dump.** The legacy modules run in Node's
  context, so their `console.log` lands on stdout beside the DOM. Stub `console`
  while they execute. One page here logged its entire dataset.
- **Time-dependent rendering freezes.** Anything the old code computed from the
  reader's clock — an "ongoing versus past" split, a relative date — is decided
  at build time now. Decide what it should freeze to, and schedule a periodic
  rebuild if the boundary must keep moving. This repository rebuilds monthly for
  exactly that reason.
- **Timezone-dependent formatting silently changes meaning.** `new Date("2024-03-01")`
  parses as UTC and `toLocaleDateString` renders it in the reader's zone, so the
  displayed day differs west of UTC. Prerendering has to pick one interpretation.
  Formatting the literal date is usually what was meant.
- **The old output is the specification, including its bugs.** A diff cannot
  tell a faithful port from a replicated defect. Decide the line between "spec"
  and "bug" before you start, port faithfully, and fix in separate commits so
  the diff stays meaningful.

Expect the comparison to surface real defects. Code that renders plausible
output accumulates errors that nobody notices; a diff against reality is often
the first time anyone checks. In this repository it found wrong data in
generated BibTeX entries, malformed and colliding citation keys, links to files
that had never been committed, and a control that threw when clicked in one
language.

## The check that matters

`scripts/verify.py` runs between the build and the publish step. Most of it is
routine — expected pages exist, internal links resolve, lists are not
implausibly short.

One check is load-bearing:

```python
if re.search(r"""["'(]\.{0,2}/?json/""", html):
    problems.append(f"{page}: still references json/")
```

The entire "no source data in the published artefact" property rests on this. A
single leftover `fetch('../json/profile.json')` in one template would put the
dump back on the public site, and nothing else would notice. If you keep one
idea from this repository, keep this one: make the invariant a test, not a rule.

The minimum item counts matter more than they look, too. They are what stops a
truncated API response from quietly publishing a half-empty publication list.

## What to change first

Working outward from the least site-specific:

- `scripts/` — usually fine as-is; `build.py` has one context builder per page
  type, so add or remove builders to match your pages.
- `site.json` — navigation, `<head>` metadata, per-language labels, which pages
  exist in which language, and which `static/` files are copied where
  (`relocated_assets`).
- `templates/` — your page structure. Everything else follows from these.
- `static/` — CSS, favicon, PDFs and other publishable files; `static/js/`
  holds only what genuinely needs the browser.
- `json/profile.json` — hand-maintained: contact details, office hours, links
  and any field researchmap does not carry.

Keep private data out of `json/` if the repository is public. A date of birth
sat in this one for a while, displayed on no page, purely because the file was
built by copying a profile export.

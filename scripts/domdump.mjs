#!/usr/bin/env node
/**
 * Normalized DOM dumper — the migration oracle.
 *
 * Two modes, one normalizer, so both sides are comparable byte-for-byte:
 *
 *   --render  Load a legacy CSR page, execute its inline module script against
 *             a jsdom document with a filesystem-backed fetch shim, wait for
 *             quiescence, then dump. This is the reference (current behaviour).
 *
 *   --static  Load an already-complete HTML file (Jinja output) and dump.
 *
 * Usage:
 *   node scripts/domdump.mjs --render index.html
 *   node scripts/domdump.mjs --static dist/index.html
 *
 * jsdom is not a repo dependency; point NODE_PATH at wherever it is installed.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function loadJsdom() {
  const require = createRequire(import.meta.url);
  for (const base of [process.env.JSDOM_PATH, ROOT, process.cwd()].filter(Boolean)) {
    const candidate = path.join(base, 'node_modules', 'jsdom');
    if (existsSync(candidate)) return require(candidate);
  }
  return require('jsdom');
}

/** Attributes that legitimately differ between runs or carry no layout meaning. */
const IGNORED_ATTRS = new Set(['data-reactroot']);

/**
 * Serialize an element subtree to a stable line-oriented form.
 * Attribute order is normalized; whitespace-only text is dropped; runs of
 * whitespace inside text collapse to a single space.
 */
function dumpNode(node, depth, out) {
  const NODE_TEXT = 3;
  const NODE_ELEMENT = 1;
  const pad = '  '.repeat(depth);

  if (node.nodeType === NODE_TEXT) {
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    if (text) out.push(`${pad}#text ${text}`);
    return;
  }
  if (node.nodeType !== NODE_ELEMENT) return;

  const tag = node.tagName.toLowerCase();
  if (tag === 'script') return; // behaviour, not content

  const attrs = [...node.attributes]
    .filter((a) => !IGNORED_ATTRS.has(a.name))
    .map((a) => [a.name, a.value.replace(/\s+/g, ' ').trim()])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => (v === '' ? k : `${k}="${v}"`))
    .join(' ');

  out.push(`${pad}<${tag}${attrs ? ' ' + attrs : ''}>`);
  for (const child of node.childNodes) dumpNode(child, depth + 1, out);
}

function dumpDocument(document) {
  const out = [];
  dumpNode(document.body, 0, out);
  return out.join('\n') + '\n';
}

/** fetch shim: resolve request URLs against the page directory on disk. */
function makeFetchShim(pageDir, state) {
  return async function fetchShim(resource) {
    const url = String(resource);
    const rel = url.replace(/^[a-z]+:\/\/[^/]+/i, '');
    const file = path.resolve(pageDir, rel.replace(/^\//, '').startsWith('json/') ? rel.replace(/^\//, '') : rel);
    state.pending += 1;
    try {
      const body = await readFile(file, 'utf8');
      return {
        ok: true,
        status: 200,
        async json() { return JSON.parse(body); },
        async text() { return body; },
      };
    } catch (err) {
      state.errors.push(`fetch failed: ${url} -> ${file}: ${err.message}`);
      return { ok: false, status: 404, async json() { throw err; }, async text() { return ''; } };
    } finally {
      state.pending -= 1;
    }
  };
}

/** Rewrite bare-relative module specifiers to absolute file URLs. */
function absolutizeImports(code, pageDir) {
  return code.replace(/(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (_m, prefix, quote, spec) => {
      const abs = pathToFileURL(path.resolve(pageDir, spec)).href;
      return `${prefix}${quote}${abs}${quote}`;
    });
}

async function settle(state, { quietTurns = 5, maxTurns = 400 } = {}) {
  let quiet = 0;
  for (let i = 0; i < maxTurns && quiet < quietTurns; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
    quiet = state.pending === 0 ? quiet + 1 : 0;
  }
}

async function renderLegacy(file) {
  const { JSDOM, VirtualConsole } = loadJsdom();
  const pageDir = path.dirname(path.resolve(file));
  const html = await readFile(file, 'utf8');

  const relFromRoot = path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, {
    url: `https://local.invalid/${relFromRoot}`,
    // Pages mix classic <script> (theme bootstrap, schedule's calendar builder)
    // with <script type="module">. jsdom runs the former natively; the latter it
    // cannot, so those are imported by hand below.
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const state = { pending: 0, errors: [] };
  const { window } = dom;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
  }));

  const previous = {};
  const globals = {
    window, document: window.document, location: window.location,
    localStorage: window.localStorage, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Node: window.Node, Event: window.Event,
    CustomEvent: window.CustomEvent, getComputedStyle: window.getComputedStyle,
    matchMedia: window.matchMedia, fetch: makeFetchShim(pageDir, state),
  };
  for (const [k, v] of Object.entries(globals)) {
    previous[k] = globalThis[k];
    globalThis[k] = v;
  }
  window.fetch = globals.fetch;

  // The modules run in Node's context, so their console output would land in
  // the dump on stdout. js/lectures.js logs the whole of data.json.
  const realConsole = globalThis.console;
  const silent = new Proxy({}, { get: () => () => {} });
  globalThis.console = silent;
  window.console = silent;

  try {
    const scripts = [...window.document.querySelectorAll('script[type="module"]')];
    for (const script of scripts) {
      const code = absolutizeImports(script.textContent, pageDir);
      await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`);
    }
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    await settle(state);
    return { dump: dumpDocument(window.document), errors: state.errors };
  } finally {
    globalThis.console = realConsole;
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

async function renderStatic(file) {
  const { JSDOM } = loadJsdom();
  const dom = new JSDOM(await readFile(file, 'utf8'));
  return { dump: dumpDocument(dom.window.document), errors: [] };
}

const [mode, target] = process.argv.slice(2);
if (!['--render', '--static'].includes(mode) || !target) {
  console.error('usage: domdump.mjs --render|--static <html-file>');
  process.exit(2);
}

const { dump, errors } = mode === '--render'
  ? await renderLegacy(target)
  : await renderStatic(target);

if (errors.length) {
  for (const e of errors) console.error(`[warn] ${e}`);
}
process.stdout.write(dump);

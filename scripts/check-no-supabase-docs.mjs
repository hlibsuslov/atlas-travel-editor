#!/usr/bin/env node
// Guard: docs must not imply Supabase is still REQUIRED.
//
// Atlas is local-first; Supabase was removed from the app entirely. Bare
// historical mentions of the word "Supabase" are fine, but tokens that imply a
// live Supabase setup (env vars, CLI commands, migration paths, service keys)
// must not appear in current-facing docs.
//
// Exclusions:
//   - docs/STRATEGY.md            — explicitly superseded historical doc.
//   - any ADR region under a "Superseded" banner — preserved history.
//
// Exits 1 and prints offending file:line on any hit; exits 0 otherwise.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Files / globs to scan.
const EXPLICIT_FILES = ['README.md', 'CONTRIBUTING.md', path.join('server', 'README.md')];
const DOCS_DIR = path.join(ROOT, 'docs');

// Whole-file exclusions (relative to ROOT, posix-normalized).
const EXCLUDED_FILES = new Set(['docs/STRATEGY.md']);

// Forbidden token patterns. Each is tested per-line, case-insensitive where safe.
const FORBIDDEN = [
  /\bVITE_SUPABASE\w*\b/i,
  /supabase\s+db\s+push/i,
  /supabase\s+gen\s+types/i,
  /supabase\/migrations/i,
  /service_role/i,
  /\banon[ _-]?key\b/i,
];

// A line marks the start of a "Superseded" region inside an ADR when it is a
// heading or a bold/blockquote banner containing the word "Superseded".
const SUPERSEDED_BANNER = /^\s*(?:>+\s*)?(?:#{1,6}\s*|\*\*|__)?[^\n]*\bsuperseded\b/i;

function toPosix(rel) {
  return rel.split(path.sep).join('/');
}

async function collectDocsMarkdown(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectDocsMarkdown(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function isAdrFile(relPosix) {
  return relPosix.startsWith('docs/adr/');
}

function scanLines(content, { adr }) {
  const lines = content.split(/\r?\n/);
  const hits = [];
  let inSuperseded = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (adr) {
      // Once an ADR enters a Superseded region, everything below it is treated
      // as preserved history and exempt. (ADRs are append-only; a Superseded
      // banner near the bottom shields the historical text under it.)
      if (SUPERSEDED_BANNER.test(line)) {
        inSuperseded = true;
      }
      if (inSuperseded) continue;
    }

    for (const re of FORBIDDEN) {
      if (re.test(line)) {
        hits.push({ line: i + 1, text: line.trim(), token: re.source });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  const targets = [];

  for (const rel of EXPLICIT_FILES) {
    const full = path.join(ROOT, rel);
    if (existsSync(full)) targets.push(full);
  }

  targets.push(...(await collectDocsMarkdown(DOCS_DIR)));

  let failed = false;

  for (const full of targets) {
    const relPosix = toPosix(path.relative(ROOT, full));
    if (EXCLUDED_FILES.has(relPosix)) continue;

    let content;
    try {
      content = await readFile(full, 'utf8');
    } catch {
      continue;
    }

    const hits = scanLines(content, { adr: isAdrFile(relPosix) });
    for (const hit of hits) {
      failed = true;
      console.error(`${relPosix}:${hit.line}: forbidden token /${hit.token}/  ->  ${hit.text}`);
    }
  }

  if (failed) {
    console.error('\nDocs guard failed: remove the Supabase-required references above.');
    console.error('(Bare historical mentions of the word "Supabase" are allowed.)');
    process.exit(1);
  }

  console.log('check:docs OK — no Supabase-required tokens in current-facing docs.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

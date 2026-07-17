#!/usr/bin/env node

/** Fail CI when a repository-local Markdown link points at a missing file. */

import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

async function collectMarkdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectMarkdown(full)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(full);
  }
  return files;
}

function localTarget(raw) {
  let value = raw.trim();
  if (value.startsWith('<') && value.includes('>')) value = value.slice(1, value.indexOf('>'));
  else value = value.split(/\s+["']/)[0] ?? value;
  if (!value || value.startsWith('#') || /^[a-z][a-z+.-]*:/i.test(value)) return null;
  value = value.split('#')[0]?.split('?')[0] ?? '';
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const failures = [];
for (const file of await collectMarkdown(ROOT)) {
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(LINK_RE)) {
    const target = localTarget(match[1] ?? '');
    if (!target) continue;
    const resolved = target.startsWith('/')
      ? path.join(ROOT, target.slice(1))
      : path.resolve(path.dirname(file), target);
    try {
      await access(resolved);
    } catch {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${path.relative(ROOT, file)}:${line} -> ${target}`);
    }
  }
}

if (failures.length) {
  console.error('Broken repository-local Markdown links:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('check:links OK — all repository-local Markdown targets exist.');

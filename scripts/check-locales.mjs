#!/usr/bin/env node
// Locale-completeness guard.
//
// en.json is the canonical key set. Every other locale must contain EVERY key
// present in en.json. Missing keys are reported per-locale and cause a non-zero
// exit so CI fails loudly rather than shipping an incomplete translation.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const CANONICAL = 'en';
const OTHERS = ['de', 'es', 'fr', 'it', 'pt', 'ru', 'uk'];

/** Recursively flatten a nested object into a set of dotted keys (leaves only). */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

function load(locale) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8'));
}

const canonicalKeys = flatten(load(CANONICAL));

let failed = false;
for (const locale of OTHERS) {
  const keys = flatten(load(locale));
  const missing = [...canonicalKeys].filter((k) => !keys.has(k));
  if (missing.length > 0) {
    failed = true;
    console.error(`\n[${locale}] missing ${missing.length} key(s):`);
    for (const k of missing.sort()) console.error(`  - ${k}`);
  } else {
    console.log(`[${locale}] OK (${keys.size} keys)`);
  }
}

if (failed) {
  console.error('\nLocale completeness check FAILED.');
  process.exit(1);
}

console.log(`\nAll locales complete against ${CANONICAL} (${canonicalKeys.size} keys).`);

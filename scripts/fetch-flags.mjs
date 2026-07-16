#!/usr/bin/env node
/**
 * Vendor circular country flags into `public/flags/<iso>.svg`.
 *
 * Source: HatScripts/circle-flags (MIT) — pre-cropped circular SVGs derived from
 * the canonical Wikimedia Commons / Wikipedia flag files. Bundling them keeps the
 * app fully local-first / offline (the PWA precaches every bundled .svg), while
 * still showing the authentic Wikipedia flag artwork inside each status disc.
 *
 * Re-run any time: it overwrites existing files and reports what it fetched.
 *   node scripts/fetch-flags.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'flags');

// ISO 3166-1 alpha-2 codes that the country picker knows about (mirrors
// src/domain/countries.ts ISO_CODES), lowercased for circle-flags' filenames.
const CODES = [
  'ad',
  'ae',
  'af',
  'ag',
  'al',
  'am',
  'ao',
  'ar',
  'at',
  'au',
  'az',
  'ba',
  'bb',
  'bd',
  'be',
  'bf',
  'bg',
  'bh',
  'bi',
  'bj',
  'bn',
  'bo',
  'br',
  'bs',
  'bt',
  'bw',
  'by',
  'bz',
  'ca',
  'cd',
  'cf',
  'cg',
  'ch',
  'ci',
  'cl',
  'cm',
  'cn',
  'co',
  'cr',
  'cu',
  'cv',
  'cy',
  'cz',
  'de',
  'dj',
  'dk',
  'dm',
  'do',
  'dz',
  'ec',
  'ee',
  'eg',
  'er',
  'es',
  'et',
  'fi',
  'fj',
  'fm',
  'fr',
  'ga',
  'gb',
  'gd',
  'ge',
  'gh',
  'gm',
  'gn',
  'gq',
  'gr',
  'gt',
  'gw',
  'gy',
  'hn',
  'hr',
  'ht',
  'hu',
  'id',
  'ie',
  'il',
  'in',
  'iq',
  'ir',
  'is',
  'it',
  'jm',
  'jo',
  'jp',
  'ke',
  'kg',
  'kh',
  'ki',
  'km',
  'kn',
  'kp',
  'kr',
  'kw',
  'kz',
  'la',
  'lb',
  'lc',
  'li',
  'lk',
  'lr',
  'ls',
  'lt',
  'lu',
  'lv',
  'ly',
  'ma',
  'mc',
  'md',
  'me',
  'mg',
  'mh',
  'mk',
  'ml',
  'mm',
  'mn',
  'mr',
  'mt',
  'mu',
  'mv',
  'mw',
  'mx',
  'my',
  'mz',
  'na',
  'ne',
  'ng',
  'ni',
  'nl',
  'no',
  'np',
  'nr',
  'nz',
  'om',
  'pa',
  'pe',
  'pg',
  'ph',
  'pk',
  'pl',
  'pt',
  'pw',
  'py',
  'qa',
  'ro',
  'rs',
  'ru',
  'rw',
  'sa',
  'sb',
  'sc',
  'sd',
  'se',
  'sg',
  'si',
  'sk',
  'sl',
  'sm',
  'sn',
  'so',
  'sr',
  'ss',
  'st',
  'sv',
  'sy',
  'sz',
  'td',
  'tg',
  'th',
  'tj',
  'tl',
  'tm',
  'tn',
  'to',
  'tr',
  'tt',
  'tv',
  'tw',
  'tz',
  'ua',
  'ug',
  'us',
  'uy',
  'uz',
  'va',
  'vc',
  've',
  'vn',
  'vu',
  'ws',
  'ye',
  'za',
  'zm',
  'zw',
];

// jsDelivr mirror of the circle-flags gh-pages branch (reliable, no GH rate limit).
const CDN = 'https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags';

async function fetchOne(code, attempt = 1) {
  try {
    const res = await fetch(`${CDN}/${code}.svg`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();
    if (!svg.includes('<svg')) throw new Error('not an SVG');
    await writeFile(join(OUT, `${code}.svg`), svg, 'utf8');
    return true;
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return fetchOne(code, attempt + 1);
    }
    console.error(`  ✗ ${code}: ${err.message}`);
    return false;
  }
}

await mkdir(OUT, { recursive: true });
let ok = 0;
// Small concurrency pool so we don't hammer the CDN but still finish quickly.
const POOL = 12;
for (let i = 0; i < CODES.length; i += POOL) {
  const batch = CODES.slice(i, i + POOL);
  const results = await Promise.all(batch.map((c) => fetchOne(c)));
  ok += results.filter(Boolean).length;
}
console.log(`\nFlags vendored: ${ok}/${CODES.length} → public/flags/`);
if (ok < CODES.length) process.exitCode = 1;

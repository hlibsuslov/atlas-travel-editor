# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who keep a life-long record of where they have been born, lived and
travelled. Two jobs carry equal weight: keeping a private record for themselves
(opened after a trip, or to look back), and showing that record to friends
through a public map, profile and friends feed.

## Product Purpose

Atlas turns a person's travel history into one world map and one portable
document. The map is the primary surface: people open Atlas to see and paint
their world, and editing countries, cities, repeat visits and stays happens
around the map. Success is a map that is accurate and pleasant to look at, and
a record that is fast to keep up to date.

## Positioning

Local-first and account-free: the whole record is one validated `TravelData`
JSON document the person owns, stored in the browser by default, exportable at
any time, and optionally synced to a self-hosted Atlas Server for sharing.

## Operating Context

- Used on desktop and phone browsers, installable as a PWA, works offline.
- Typical session: open the map, mark a new country or visit, add cities and
  dates, glance at stats, sometimes export an image or the JSON.
- People visit the same country several times across years; the record must
  express repeat visits naturally.

## Capabilities and Constraints

- Country statuses: visited, lived, birthplace, capital visited.
- Timelines in `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, `YYYY-YYYY`; cities with
  visited years; stays/diary with dates, notes and costs.
- Eight locales (en, de, es, fr, it, pt, ru, uk); English canonical.
- Crimea is part of Ukraine on every map Atlas draws.
- GitHub, WebDAV, Google Drive, Dropbox storage are placeholders, not usable.

## Brand Commitments

- Product name "Atlas". The current visual identity is not binding (confirmed
  2026-11-20); the look may be fully replaced.
- User request: sans-serif typography throughout.

## Evidence on Hand

No testimonials, user counts or press. Sample travel data in the app is
demonstration data only.

## Product Principles

1. The map is the home: everything else is reached from it.
2. The person owns one clean document; never lose local edits.
3. Entering a trip should take seconds, including the tenth visit to the same country.
4. Honest numbers: the world is 193 UN member states.
5. Works without an account, a backend, or a network.

## Accessibility & Inclusion

Keyboard and screen-reader support for interactive components; reduced motion
respected; Cyrillic locales are first-class.

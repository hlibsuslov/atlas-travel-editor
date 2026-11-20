---
version: 1
slug: "src-features-map-mappage-tsx"
primary_target: "src/features/map/MapPage.tsx"
related_targets: ["src/components/AppShell.tsx","src/index.css"]
---

# Atlas app shell and map (Operate)

Scope: the whole signed-in app shell, with the full-screen map as home (`/`), Countries (`/countries`), Stats, Friends. Visitor mode: Operate.
Audience and job: people keeping a life-long travel record; open the map, mark or open a country, log a repeat visit with cities, glance at totals, export image or JSON.
Constraints: local-first, eight locales incl. Cyrillic, keyboard and screen reader, reduced motion, Crimea is Ukraine.

## Direction contract

THESIS: Every country is a ticket stub and the full-screen map is the departures hall. Refuses the boxed map inside an editorial page with serif headings on cream.

OWN-WORLD: Cool card-stock white panels on a pale blue-grey sea; a navy band (#10203A) carries the shell; gate-sign yellow (#FFD23F) marks only the current place (active tab, selected country outline). Status data colours: visited green, lived blue, birthplace orange, capital pale blue. One sans family (Onest) with tabular figures everywhere; ISO codes set large and heavy as the stub headline; a perforated rule separates a stub's head from its legs. Radii 10 to 14px, one floating shadow.

STORY: The person sees their whole world painted, clicks a country, and its stub docks: status, every visit as a dated leg with its cities, and a one-step form to log another visit. Totals sit in a small corner card.

FIRST VIEWPORT: 56px navy band (wordmark, tabs Map/Countries/Stats/Friends, save status, language). Below it the map runs edge to edge. Mode bar floats top-left (Select, Cycle, status brushes, Erase); import and image export float top-right; totals and legend card bottom-left; the stub panel docks right at 380px when a country is open, a bottom sheet under 720px.

FORM: Boarding Pass, position 6 of 7 on the ordered list, seed:b767d04664b03954. Signature move: the country stub (ISO code headline, perforation, visits as legs) used in the map panel and the Countries list.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

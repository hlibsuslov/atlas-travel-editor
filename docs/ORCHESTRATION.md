# Orchestration — one planner, many executors, an endless stream

This describes how the work in [ROADMAP.md](./ROADMAP.md) is executed by a fleet
of agents: **one planner writes the plan, executors implement it, verifiers prove
it**, and a critic refills the backlog so the stream never runs dry.

```
                    ┌──────────────────────────────────────────────┐
                    │                  CYCLE (repeats)               │
                    │                                                │
   ROADMAP.md ─────▶│  1. PLANNER                                    │
   (backlog)        │     reads repo + backlog, emits the next       │
        ▲           │     batch of small, independent, ordered tasks │
        │           │                 │                              │
        │           │                 ▼                              │
        │           │  2. EXECUTORS (fan-out, 1 task each)           │
        │           │     implement task → write tests               │
        │           │                 │                              │
        │           │                 ▼                              │
        │           │  3. VERIFIERS (adversarial)                    │
        │           │     run `npm run ci`, review diff, refute      │
        │           │                 │                              │
        │           │                 ▼                              │
        └───────────│  4. CRITIC: "what's missing / broke?"          │
       new tasks    │     appends discoveries back into ROADMAP.md   │
                    └──────────────────────────────────────────────┘
```

## Roles

- **Planner** — owns the plan. Reads the codebase and the backlog, breaks epics
  into tasks that are **small** (≤ ~1 file-area), **independent** (no two parallel
  tasks touch the same file), and **ordered** by value÷size. Emits a structured
  task list (schema below). Does not write feature code.
- **Executors** — each takes exactly one task, implements it with tests, and keeps
  the change self-contained. Prefer creating new files; when editing shared files
  (e.g. `index.css`, locale JSON, `App.tsx`) the planner serializes those tasks so
  only one executor touches a given file per cycle.
- **Verifiers** — adversarial. Run `npm run ci`, read the diff, and try to refute
  the change (missing tests, broken i18n, a11y regressions, type holes). A task is
  accepted only if CI is green and no verifier refutes it.
- **Critic** — after each cycle asks "what did we miss or break?" and writes new
  items back into the backlog, sustaining the stream.

## Task schema (planner output)

```json
{
  "id": "A3",
  "title": "Drag-and-drop reordering of countries",
  "epic": "A",
  "size": "M",
  "files": ["src/features/editor/components/CountryList.tsx"],
  "depends_on": [],
  "acceptance": [
    "Reorder persists to the document",
    "Keyboard-accessible (no mouse required)",
    "Unit/interaction test added",
    "npm run ci passes"
  ]
}
```

## Guardrails (so an autonomous stream stays safe)

1. **Green-or-revert** — a task that can't make `npm run ci` pass is reverted, not
   merged. The main branch is always releasable.
2. **No file collisions per cycle** — the planner guarantees parallel tasks edit
   disjoint files; shared-file tasks run sequentially.
3. **Small batches** — default 3–6 executors per cycle; review between cycles.
4. **Budget bound** — the loop runs until a token budget or a "max cycles" limit;
   "infinite" means *self-refilling*, not *unbounded* — there is always a stop.
5. **Human checkpoints** — each cycle's diff is summarized for review; risky epics
   (auth, RLS, migrations) require explicit human approval before execution.

## Running it

The runnable workflow lives at
[`scripts/traveleditor-stream.workflow.js`](../scripts/traveleditor-stream.workflow.js).
It implements PLAN → EXECUTE → VERIFY → CRITIC and loops until the turn's token
budget is exhausted (or a fixed cycle count). Launch it from Claude Code with the
Workflow tool:

```
Workflow({ scriptPath: "scripts/traveleditor-stream.workflow.js", args: "Epic A" })
```

Because each run mutates the repository, treat a launch as opting into autonomous
changes: review the per-cycle summary, then continue or stop.

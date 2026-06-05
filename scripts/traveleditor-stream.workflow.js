// Runnable orchestration workflow for the Travel Editor backlog.
//
// This is a TEMPLATE for the Workflow tool (planner → executors → verifier →
// critic loop, bounded by the token budget). It is intentionally stored under
// scripts/ (not .claude/) so it is a reviewable artifact, not auto-wired agent
// config. Launch it deliberately from Claude Code:
//
//   Workflow({ scriptPath: "scripts/traveleditor-stream.workflow.js", args: "Epic A" })
//
// Each launch mutates the repository, so treat it as opting into autonomous
// changes and review the per-cycle summary. See docs/ORCHESTRATION.md.

export const meta = {
  name: 'traveleditor-stream',
  description: 'Continuous planner→executor→verifier→critic loop over the Travel Editor backlog',
  whenToUse:
    'Autonomously advance docs/ROADMAP.md. Optionally pass a focus area as args (e.g. "Epic A").',
  phases: [
    { title: 'Plan', detail: 'one planner emits the next batch of small, disjoint tasks' },
    { title: 'Execute', detail: 'one executor per task implements it with tests' },
    { title: 'Verify', detail: 'a single serialized npm run ci + adversarial review' },
    { title: 'Critic', detail: 'refill the backlog with discovered work' },
  ],
};

// ---- Structured outputs ----------------------------------------------------
const TASK_BATCH = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'files', 'acceptance'],
      },
    },
  },
  required: ['tasks'],
};

const EXEC_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    summary: { type: 'string' },
    filesTouched: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'summary'],
};

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ciGreen: { type: 'boolean' },
    rejected: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['ciGreen', 'rejected', 'notes'],
};

const CRITIC = {
  type: 'object',
  additionalProperties: false,
  properties: { newTasks: { type: 'array', items: { type: 'string' } } },
  required: ['newTasks'],
};

// ---- Loop ------------------------------------------------------------------
const focus =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : 'the highest value/size items across all epics';
// With an explicit token budget ("+Nk"), run until it is nearly spent; otherwise
// do a small, supervised batch so an un-budgeted launch can't run away.
const MAX_CYCLES = budget.total ? 100 : 3;

for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
  // Self-refilling but bounded: stop when the token budget is nearly spent.
  if (budget.total && budget.remaining() < 120_000) {
    log(`Stopping: token budget nearly exhausted after ${cycle - 1} cycle(s).`);
    break;
  }

  phase('Plan');
  const plan = await agent(
    [
      'You are the PLANNER for the Travel Editor repository.',
      'Read docs/ROADMAP.md, docs/ORCHESTRATION.md and the codebase.',
      `Emit the next batch of 3-5 SMALL, INDEPENDENT tasks focused on: ${focus}.`,
      'Hard rules: skip items already marked done; parallel tasks MUST touch DISJOINT files;',
      'each task is small and has concrete acceptance criteria ending with "npm run ci passes".',
      'Do not write feature code yourself.',
    ].join(' '),
    { phase: 'Plan', schema: TASK_BATCH },
  );

  const tasks = (plan?.tasks ?? []).slice(0, 5);
  if (!tasks.length) {
    log('Planner produced no tasks - the stream is drained.');
    break;
  }
  log(`Cycle ${cycle}: planning ${tasks.length} task(s) -> ${tasks.map((t) => t.id).join(', ')}`);

  // Executors run concurrently; the planner guarantees disjoint files so they
  // don't collide. They implement + test but do NOT run the build (a single
  // serialized verify below avoids concurrent `npm run ci` clobbering each other).
  const results = await parallel(
    tasks.map(
      (task) => () =>
        agent(
          [
            'You are an EXECUTOR. Implement exactly this one task end-to-end with tests.',
            'All user-facing strings must go through i18n (src/i18n/locales).',
            `Confine edits to: ${task.files?.join(', ') || 'new files only'}.`,
            `Task ${task.id}: ${task.title}. Acceptance: ${(task.acceptance ?? []).join('; ')}.`,
            'Do NOT run the production build; the verifier will. Return a concise summary.',
          ].join(' '),
          { label: `exec:${task.id}`, phase: 'Execute', schema: EXEC_RESULT },
        ),
    ),
  );
  const completed = results.filter(Boolean);
  log(`Cycle ${cycle}: ${completed.length}/${tasks.length} executor(s) reported completion.`);

  // Single serialized verification for the whole cycle.
  phase('Verify');
  const verdict = await agent(
    [
      'You are the VERIFIER. Run `npm run ci` (Bash) exactly once and read the git diff.',
      'Adversarially check: failing CI, missing tests, broken/missing i18n keys, type holes, a11y.',
      "Fix trivial issues; for anything you cannot safely fix, revert that task's changes so the",
      'working tree stays green, and list the reverted task ids in `rejected`.',
      `Tasks this cycle: ${tasks.map((t) => `${t.id} (${t.title})`).join(' | ')}.`,
    ].join(' '),
    { phase: 'Verify', schema: VERDICT },
  );
  log(
    `Cycle ${cycle}: CI ${verdict?.ciGreen ? 'GREEN' : 'RED'}; rejected: ${
      (verdict?.rejected ?? []).join(', ') || 'none'
    }.`,
  );

  // Refill the backlog so the stream continues.
  phase('Critic');
  const critic = await agent(
    [
      'You are the COMPLETENESS CRITIC. Given the changes just made, identify what is now missing,',
      'newly broken, or worth doing next. Append concrete new items to docs/ROADMAP.md under the right',
      'epic (use Edit), and mark completed items as done. Return the new task titles.',
    ].join(' '),
    { phase: 'Critic', schema: CRITIC },
  );
  log(`Cycle ${cycle}: critic added ${critic?.newTasks?.length ?? 0} backlog item(s).`);
}

return { stopped: true };

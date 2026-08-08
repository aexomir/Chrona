---
name: test-gate
description: "Post-implementation test gate for this repo. Runs the existing Jest suite, reads the diff, checks that no existing test was weakened just to make it pass, then writes and runs new Jest/Maestro tests for the feature or fix and reports pass/fail with evidence. Use right after implementing a new feature or bug fix in this project, before calling the work done. Keywords: test gate, run tests, verify my change, write tests for this."
---

# Test Gate

A hard checkpoint to run after implementing a feature or fix in this repo, before considering it done. Five steps, in this exact order. Do not skip ahead to writing new tests before finishing the audit — a weakened existing test is a bug you'd otherwise ship silently.

## Step 1 — Run the existing suite

```bash
bun run test
```

Capture the full output (pass/fail counts, any failures). If anything fails that isn't related to the change you just made, stop and surface it to the user — don't paper over a pre-existing broken test by proceeding.

## Step 2 — Read the diff

Determine what's actually in scope:

- Uncommitted work: `git diff` (plus `git diff --stat` for a quick map of touched files)
- Committed on a branch: `git diff main...HEAD`

Read the full diff, not just the file list. You need to know exactly what behavior changed before you can judge whether tests were honestly adjusted or gamed.

## Step 3 — Audit for weakened tests

Look specifically at the diff hunks inside `__tests__/*.test.ts(x)` files and `.maestro/*.yaml` files. Flag any of the following as a hard stop — report it to the user and do not proceed to Step 4 until resolved:

- A test was deleted or an `it(...)` / `test(...)` block was removed instead of fixed
- `.skip`, `xit`, `xdescribe`, `test.skip`, or an `optional: true` added to a Maestro assertion that wasn't there before, where the change isn't justified by genuinely non-deterministic behavior (see `.maestro/timer_stop_flow.yaml` for a legitimate use of `optional: true` — branching app state, not a dodge)
- An assertion was loosened (`toBe` → `toBeTruthy`/`toBeDefined`, an exact value → a regex or range) without the underlying behavior actually becoming less precise
- Expected values were changed to match whatever the new code happens to output, rather than what the code *should* output
- Timeouts, thresholds, or retry counts were raised to paper over flakiness or a performance regression
- An assertion line was commented out or removed rather than updated

If nothing was weakened — including if no existing tests touched the changed code at all — say so explicitly and move on.

## Step 4 — Write new tests for the change

Only after Step 3 is clean. Match this repo's existing conventions, don't invent new patterns:

**Jest (logic, hooks, pure functions, components)** — colocate in `__tests__/` next to the feature, e.g. `features/<x>/__tests__/<thing>.test.ts(x)`. Follow the style in [features/timer/__tests__/timer-utils.test.ts](features/timer/__tests__/timer-utils.test.ts) and [features/analytics/__tests__/stats-utils.test.ts](features/analytics/__tests__/stats-utils.test.ts) — plain `describe`/`it`, one behavior per assertion, descriptive `it()` names that read as a sentence. No comments in test code unless a non-obvious constraint demands one.

**Maestro (end-to-end UI flows)** — only when the feature is a user-facing flow spanning screens/taps, not something a unit test already covers. Add a new `.maestro/<flow_name>.yaml`. Follow the shape of [.maestro/timer_stop_flow.yaml](.maestro/timer_stop_flow.yaml): a header comment explaining the scenario and any known limitations (e.g. state Maestro can't control), `appId: com.aexomir.Chrona`, `waitForAnimationToEnd` after navigation, and `optional: true` only for genuinely branching app state — not as a way to dodge a flaky assertion.

Cover the golden path plus the edge cases the diff actually introduces (empty/zero states, boundary values, the branch conditions you saw in Step 2) — don't pad with redundant cases.

## Step 5 — Run the new tests and report

```bash
bun run test              # full suite, or:
npx jest path/to/new.test.ts   # just the new file, while iterating
```

For Maestro flows, running them requires a booted simulator with the custom dev build (`npx expo run:ios`) — if that's not available in the current environment, say so explicitly rather than claiming the flow passed. Don't fabricate a pass/fail you didn't actually observe.

Report back to the user with:
- Pass/fail status for the full existing suite (Step 1)
- Any weakened-test findings from Step 3, resolved or still open
- The list of new test files/flows added
- Pass/fail status for each new test, with the actual terminal output attached as evidence — not a paraphrase of what you expect it to say

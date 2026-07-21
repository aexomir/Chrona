---
name: branch-review
description: "Manual-only, end-to-end code review of the current branch's changes against main. Delegates the actual judgment to a freshly spawned subagent with no visibility into this conversation, so the review isn't colored by the implementer's own rationalizations. Only run when explicitly invoked — '/branch-review', 'review this branch', 'code review my changes'. Never trigger this automatically after implementing a feature or fix."
---

# Branch Review

**Manual only.** Do not run this proactively after finishing a feature or fix — that's [test-gate](../test-gate/SKILL.md)'s job, not this skill's. Only run when the user explicitly asks for a branch review.

The whole point of this skill is that the reviewer must not be you-in-this-conversation. You (or the user) may have talked yourselves into believing a shortcut was fine, glossed over an edge case, or built up assumptions over the session that no longer match the code. A subagent spawned fresh has none of that — it only sees the repo and the diff. Don't shortcut this by reviewing the diff yourself inline.

## Step 1 — Establish scope

```bash
git branch --show-current
git status --porcelain
git merge-base main HEAD   # BASE
```

If `main` doesn't exist locally, fall back to `master` or whatever `git symbolic-ref refs/remotes/origin/HEAD` reports.

Scope is **everything on the branch, committed or not** — the diff from `BASE` to the current working tree, not just to `HEAD`. If there's uncommitted work, it's still part of "the branch's changes" for this review.

## Step 2 — Objective signals first

Run these yourself, cheaply, before handing off — they're deterministic and don't need judgment:

```bash
bun run lint
git diff --stat $BASE
```

Note any lint failures and the shape of the change (files touched, +/- lines) so you can sanity-check the subagent's report against reality afterward.

## Step 3 — Delegate the actual review to a fresh subagent

Spawn an `Agent` (`subagent_type: general-purpose`, `run_in_background: false` — you need the result before responding). Do **not** paste the full diff into the prompt; give it the repo path, branch name, and `BASE` ref, and let it run `git diff $BASE` and `Read` files itself with its own tools. Keep the prompt self-contained per the Agent tool's guidance, and explicitly tell it:

- To evaluate strictly from the current state of the repo and the diff — not from any memory, prior session context, or assumptions about intent it wasn't given here.
- The repo's own conventions live in `CLAUDE.md` and `.claude/conventions/*.md` — check the diff against those (uniwind/`className` styling, `heroui-native` usage, `EXPO_OS` over `Platform.OS`, `React.use`, no `StyleSheet.create`, no manual `useMemo`/`useCallback` given React Compiler is on, etc.) since those are checked-in project docs, not chat memory.
- Review dimensions: correctness/bugs, security, adherence to those conventions, test coverage (new code without new/updated tests, or tests that look weakened), unnecessary complexity, naming/readability.
- Report using the `ReportFindings` tool, most severe first, each with `file`, `line`, a concrete `failure_scenario` (not a vague code-smell), and `verdict` if it can verify the issue actually reproduces.

## Step 4 — Relay, don't filter

Report the subagent's findings back to the user verbatim (via its `ReportFindings` output), plus a one-paragraph synthesis of your own — but don't soften, dismiss, or fix anything on the subagent's behalf. This is a review, not a review-and-patch: if the user wants fixes applied afterward, that's a separate, explicit follow-up.

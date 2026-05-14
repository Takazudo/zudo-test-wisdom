---
name: verify-ui-ai
description: >-
  AI-based visual confirmation that a problem is resolved — Level 6 (final-resort) testing. Use
  ONLY when /verify-ui (mechanical computed-styles or screenshot pixel-diff) cannot reach the
  assertion AND writing an E2E (Playwright) is intractable — e.g. canvas-driven photo-editors,
  zoomable surfaces, free-form drawing tools, multi-layer compositing with resizable objects. NOT
  for constant or repeated verification. NEVER for CI gates. AI verdicts are non-deterministic,
  cost-bearing, and not reproducible across runs. The skill (1) authors a project-scope test-flow
  skill capturing the procedure + verdict criteria, then (2) dispatches a verification subagent via
  the Agent tool that loads the test-flow skill plus a browser-driving skill (/verify-ui primary,
  /headless-browser fallback). Triggers: 'verify ui ai', 'AI verify', 'L6 verify', 'final resort
  test', 'AI-based visual confirmation'. NEVER uses `claude -p` — subagent dispatch goes through
  the Agent tool exclusively.
---

# verify-ui-ai

**Level 6 (final resort) visual verification.** AI subagent + project-scope test-flow skill produces a structured PASS/FAIL on whether a problem is visually resolved.

## When to use

ALL of the following must hold. If any one fails, this skill is the wrong tool:

1. The change is on a **surface L5 cannot reach** — typically a `<canvas>` element with no stable DOM child, where computed styles don't apply and screenshot pixel-diff is too noisy (anti-aliasing, sub-pixel rendering, in-flight animation).
2. **L4 (Playwright E2E) is intractable** — the surface is multi-camera, zoom/pan stateful, or canvas-driven such that writing a clean spec is genuinely infeasible, not just "harder than usual."
3. The user explicitly wants AI judgment as the verdict, accepting that the result is **one-time evidence**, not a reproducible test.

If the surface has a DOM element with computed styles → use `/verify-ui` (L5).
If the flow can be driven by Playwright → write a `.spec.ts` (L4).
If the change is logic only → use a unit test (L1).

## Hard rules

- **NEVER for CI.** AI verdicts are non-deterministic. A passing CI run on Tuesday tells you nothing about Wednesday's run.
- **NEVER use `claude -p`.** Subagent dispatch goes through the **Agent tool** exclusively. The Agent tool returns a structured result into the parent's context, respects session permissions and skills, and is observable in the conversation. `claude -p` is opaque — it produces stdout text the parent must re-parse, starts a fresh process that may not see project skills, and stalls without clean error signaling.
- **NEVER inline verdict criteria into ad-hoc prompts.** The criteria live in the test-flow skill so they survive across runs and across team members.

## Prefer project-scope test-flow skills

The test-flow skill MUST be authored under `.claude/skills/test-flow-<topic>/SKILL.md` (project-scope, checked into the repo), **not** under `$HOME/.claude/skills/test-flow-<topic>/` (personal-only).

Why this matters:

- The verdict procedure is part of the codebase's testing strategy. Teammates need to see it, review it, and update it as the UI evolves.
- Personal-only skills create verdict drift — a teammate running the "same" test against a different procedure produces incomparable results.
- Project-scope skills are picked up by the repo's `setup:doc-skill` script and symlinked into `~/.claude/skills/` on each developer's machine.
- The test-flow skill is the durable artifact of an L6 run. Losing it loses the test.

If you find yourself authoring a test-flow skill under `$HOME/.claude/skills/`, stop and re-author it under the project's `.claude/skills/`. Then commit it in the PR alongside the code that motivated it.

## Workflow

Two halves: author the test-flow skill, then dispatch the verification subagent.

### Half 1 — author the test-flow skill

A test-flow skill at `.claude/skills/test-flow-<topic>/SKILL.md` captures:

- **What scenario** to drive (the exact user-reproduce flow — open template, drop fixture, click button, etc.)
- **What to capture** (which screenshots, which DOM measurements, which evidence)
- **The verdict criteria** (specifically: what counts as PASS vs FAIL, tolerance numbers, threshold ratios). Make these mechanical wherever possible. Only the genuinely subjective part remains AI judgment.
- **The output format** (a JSON-like structured result with named fields the subagent must return)

The skill is **per-task**, not per-app. A project will accumulate multiple test-flow skills.

#### Authoring checklist

- [ ] Name follows convention: `test-flow-<short-topic-slug>` (e.g. `test-flow-composer-image-same-size`).
- [ ] Description includes the trigger keywords plus a one-line "use when" — the test-flow skill is triggered by the verification subagent's prompt, so it must load when the subagent reads its instructions.
- [ ] Body is **self-contained** — the subagent starts fresh with NO conversation history. Everything needed to drive and verdict the test goes in the body.
- [ ] Procedure is numbered and concrete — exact selectors, exact URLs, exact viewport sizes, exact fixture paths.
- [ ] Verdict criteria are mechanical where possible (tolerance numbers, pixel deltas) and AI-judgment-only where unavoidable.
- [ ] Output schema is explicit — what fields the subagent must return (e.g. `pgenImageWidth`, `composerImageWidth`, `ratio`, `verdict`, `summary`, `screenshotPaths`).
- [ ] Skill is committed to the repo (project-scope), not left in `$HOME/.claude/skills/`.

Use the `skill-creator` skill's `init_skill.py` to scaffold the new test-flow skill, then write its body.

### Half 2 — dispatch the verification subagent

After the test-flow skill is written, dispatch a subagent via the Agent tool:

```
Agent({
  subagent_type: "general-purpose",
  description: "<short description>",
  prompt: `<self-contained brief — see template below>`,
})
```

The subagent's prompt must include:

- **Goal:** one sentence describing what verdict to produce.
- **Skills to load:** invoke `/test-flow-<topic>` (the just-authored skill) AND a browser-driving skill — `/verify-ui` for computed-styles / screenshot capture, or `/headless-browser` for multi-step interactive flows.
- **Inputs:** per-run inputs the test-flow skill needs (preview URL, fixture path, viewport size).
- **Output contract:** match the output schema declared in the test-flow skill.

#### Subagent prompt template

```
You are a verification subagent. Produce a structured verdict using the test-flow skill below.

## Goal
{one-sentence verdict goal, e.g. "Determine whether the composer-side image visually matches the pgen-side image at default landing viewport."}

## Skills to load
- /test-flow-<topic>  — the test procedure and verdict criteria. Read this first.
- /verify-ui          — primary browser-driving skill (computed-styles + screenshots).
- /headless-browser   — fallback if /verify-ui doesn't fit the task shape.

## Inputs
- Preview URL: <resolved URL — pass from the parent>
- Fixture: <path or asset reference>
- Viewport: <e.g. 1440x900>
- Any other per-run knobs the test-flow skill expects

## Output contract
Return a structured result message containing exactly these fields:
{ <list each field from the test-flow skill's output schema> }

Plus a `summary` field with a one-line human-readable verdict.

## Don'ts
- Don't improvise the test procedure — follow /test-flow-<topic> exactly.
- Don't change the verdict tolerance — it is locked in /test-flow-<topic>.
- Don't post anywhere — return the result to me; I (the parent agent) handle posting.
```

### After the subagent returns

The parent receives the structured result and decides what to do with it: attach to the PR as evidence, write to a tracked evidence directory, gate a workflow step, etc. The test-flow skill stays on disk for reuse — next time the same test class is needed, the existing skill is invoked without re-authoring.

## Archive results for auditability

Because L6 verdicts are non-repeatable, **archive the evidence after every run**:

- Screenshots from the run
- The structured verdict (the full output schema, not just PASS/FAIL)
- The exact prompt the subagent ran
- Any internal-state dumps captured during the run

Attach them to the PR comment, write them to an evidence directory under the project log dir, or both. A future maintainer asking "did this ever actually pass?" needs to find the artifact, not re-run the test.

## Choosing the browser-driving skill — primary vs fallback

| Skill | Best for | When to fall back |
|---|---|---|
| `/verify-ui` | Deterministic computed-style checks; pure pgen-vs-composer parity; CSS / layout assertions | Cannot drive multi-step UI flows beyond single-page reads |
| `/headless-browser` | Multi-step interactive flows (drag-drop a file, click → screenshot → click → screenshot); element bounding-rect reads via Playwright CLI | Slightly heavier; only use when /verify-ui can't reach the test surface |

The test-flow skill should name BOTH so the subagent picks based on the task shape. If `/verify-ui` returns "cannot perform this flow" the subagent switches to `/headless-browser` without re-prompting the parent.

## Reusability — the test-flow skill outlives the test

A test-flow skill is **not** a one-shot scaffold for a single PR. It is a permanent artifact that captures "how to verify this class of behavior in this codebase." When a similar test is needed later (regression check, repeated verification across PRs), invoke the same test-flow skill — the AI subagent gets the same context and produces consistent verdicts.

Sign that you're using this pattern correctly:

- The test-flow skill is checked into the project's `.claude/skills/` (project-scope, shared with the team).
- Subsequent invocations DO NOT re-author the skill — they just dispatch a fresh subagent that loads it.
- Updates to the procedure happen by editing the test-flow skill, not by inlining new instructions in the subagent prompt.

## Risks and limitations

- **Non-deterministic.** Same flow, different verdicts across runs. A single PASS is one data point.
- **Cost-bearing.** Each run spawns a subagent, drives a browser, consumes tokens. Cost is non-trivial even locally; on CI it compounds rapidly and unpredictably.
- **Hallucination risk.** An AI judge can confidently report PASS on a broken UI if criteria are vague. Tighten criteria with explicit thresholds wherever possible.
- **Verdict drift across model versions.** Edge cases may judge differently as models change. Lock procedure in the test-flow skill; don't inline criteria into ad-hoc prompts.
- **Not reproducible.** A failed run cannot be replayed deterministically. The output schema must include screenshots and internal-state dumps so failures are investigable even when not reproducible.

## Example skeleton — what a real test-flow skill looks like

```markdown
---
name: test-flow-composer-image-same-size
description: Verify the composer-side image visually matches the pgen-side image at default landing viewport. Use when /verify-ui-ai dispatches a subagent for issue #1678 / composer-image-same-size verification.
---

# Test flow: composer image same size as pgen

## Scenario
1. Open <preview URL from inputs> at viewport 1440x900.
2. Click the first template card.
3. Click "Start cropping the pattern".
4. Drop `packages/pattern-gen-viewer/e2e/fixtures/red-100-fits-composition.png` on the pgen canvas-layer.
5. Capture screenshot A (pgen with image visible).
6. Click "Commit selection and open Composer".
7. Wait for composer mount (composer-art-canvas visible).
8. Capture screenshot B (composer with image visible).

## Measurements
- pgen image width (CSS px): read via `__pgenLayerState.getSelectedLayerTransform()` + pgen canvas CSS scale.
- composer image width (CSS px): read via `__composerTest.getState()` + cameraZoom + composer canvas CSS rect.
- ratio = composer / pgen.

## Verdict
PASS if ratio ∈ [0.95, 1.05] (±5%). FAIL otherwise.

## Output schema
{
  pgenImageWidth: number,
  composerImageWidth: number,
  ratio: number,
  delta: number,
  verdict: "PASS" | "FAIL",
  summary: string,
  pgenScreenshot: string (path),
  composerScreenshot: string (path),
  toolUsed: "verify-ui" | "headless-browser"
}
```

The example shows the shape; the verification subagent reads this and follows the procedure verbatim. See the documentation page [Level 6: AI-Based Visual Verification](../../../src/content/docs/testing-levels/level-6-ai-based-verification.mdx) for the broader testing-strategy context.

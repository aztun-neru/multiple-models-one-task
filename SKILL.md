---
name: multiple-models-one-task
description: Run ONE task through MULTIPLE specialized models in parallel — a coder model writes code, a strong generalist critiques it, a reasoner synthesizes — then a judge checks before it reaches you. Fixes the single-model blind spot: when one LLM does everything, its weaknesses are your bugs. Use when a task benefits from different models each doing what they're best at, instead of one model role-playing every role.
---

# Multiple Models, One Task

## Context — why this exists

A single LLM told to "act as a coder, then a reviewer, then a judge" is still ONE model with ONE set of strengths and ONE set of blind spots. When the "coder" and the "reviewer" are the same weights, the reviewer cannot catch what the coder missed — they share the same blind spot.

This skill replaces that illusion with reality: each role runs on a different model that is genuinely good at that role.

## Concept — how it works

```
                        TASK
                          │   (Planner decomposes the task into roles)
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   RESEARCH          CODER            CRITIC
  reasoner-model    coder-model    strong-generalist
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                       JUDGE   ← checks each answer against the task
                          │
                          ▼
                      SYNTHESIS → one final answer
```

Model assignment is **per expert**: the coder expert is wired to a coding model, the critic to a strong generalist, the synthesizer to a reasoner. Independent experts run in parallel; dependencies (`dependsOn`) and `priority` control order.

## Benefit — example before/after (single run, not a benchmark)

| | One model doing everything | Multiple models + judge |
|---|---|---|
| Code review | nobody checks the code | critic finds real bugs before you ship |
| Blind spots | one model's weakness = your bug | a different model catches it |
| Real example | `parseClusterConfig` validated fields but allowed duplicate machines + reserved IPs | critic found 8 issues → synthesis fixed them → production-grade |

In the measured run: a local coder model wrote clean field validation in seconds, a second model found 8 concrete problems the coder missed (duplicate names/IPs allowed, `0.0.0.0`/`127.x` accepted, array-as-element), and the synthesis produced the fixed version. **The combination beat either model alone.**

## Architecture (what the code implements)

- **Planner** — decompose the task into expert roles + instructions
- **Expert Registry** — declare experts (`allowedModels`, `enabled`)
- **Model Assignment** — map each expert → a specific model (per-expert, not global)
- **Dependency Graph** — order via `dependsOn` + `priority`; detect cycles
- **Execution** — parallel / sequential / hybrid
- **Judge** — evaluate outputs against the task
- **Synthesis** — combine judged outputs into one answer
- **Policy / Observability / Evaluation** — guardrails, `runId` events, test harness

## Pitfalls

- **Don't fake it with one model** — role-playing N experts is prompt engineering, not this pattern.
- **Validate before execute** — unknown/disabled expert or model outside `allowedModels` → fail fast.
- **Fact-check outputs** — the judge verifies against docs; models hallucinate API names.
- **Architecture ≠ implementation** — integrate with your existing orchestrator, don't re-implement it.

## When NOT to use it

- **Single-step, low-risk tasks** — one model is enough and the overhead (multiple calls, latency, cost) isn't justified.
- **Sensitive data without isolation** — routing PII across several models multiplies exposure; keep such tasks on one trusted model.
- **Tight budget** — every expert is a separate model call, so cost scales with the number of roles.

## Minimal example (the shape, not the full code)

```ts
const plan = {
  task: "Analyze the architecture and propose improvements.",
  executionMode: "hybrid",
  experts: [
    { id: "research", expertId: "researcher", instruction: "Analyze existing patterns." },
    { id: "coder",    expertId: "coder",      instruction: "Identify concrete code changes." },
    { id: "critic",   expertId: "critic",     instruction: "Find weaknesses.", dependsOn: ["research", "coder"] },
  ],
  assignments: [
    { expertId: "researcher", modelId: "reasoner-model" },
    { expertId: "coder",      modelId: "coder-model" },
    { expertId: "critic",     modelId: "strong-generalist" },
  ],
  judgeExpertId: "judge",
  synthesisExpertId: "synthesis",
}
```

## Request for verification

This is a draft extracted from a long design conversation and re-assembled. If you try it: does the per-expert assignment actually improve your results vs a single model? Does the judge catch real bugs? Please open an issue with your before/after — especially on tasks where you *expected* a single strong model to be enough.

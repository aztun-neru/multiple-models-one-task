---
name: mixture-of-agents
description: Mixture-of-Agents (MoA) — route one task through MULTIPLE specialized models (a coder model writes code, a strong generalist critiques it, a reasoner synthesizes), each doing what it's best at, then a judge checks before it reaches the user. Turns "one model pretending to be N experts" into genuinely parallel per-expert model assignment. Use when a task benefits from different models collaborating instead of a single model role-playing.
---

# Mixture-of-Agents (MoA)

## What it solves, and why it matters

A single LLM told to "be 3 people" is still one model with one set of strengths and one set of blind spots — the "experts" are just text. MoA makes the experts *real*: each role runs on the model that's actually good at that role, and a separate judge checks the result before it's delivered.

The concrete payoff (measured in practice):

| | Single model | MoA (coder + critic + judge) |
|---|---|---|
| Code correctness | coder writes, nobody checks | critic finds real bugs before you ship |
| Model weaknesses | one model's blind spot = your bug | a different model catches what the coder missed |
| Example result | `parseClusterConfig` passed fields but allowed duplicate machines + reserved IPs | critic flagged 8 issues → synthesis produced production-grade validation |

## Before vs after

**Before (fake MoA):**
```
TASK └── one model └── "act as 4 experts" (one blind spot, one bias, one hallucination)
```

**After (real MoA):**
```
                        TASK
                          │  (Planner decomposes)
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   RESEARCH          CODER            CRITIC
  reasoner-model    coder-model    strong-generalist
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                       JUDGE   ← checks against the task
                          │
                          ▼
                      SYNTHESIS → final answer
```

Each arrow is a genuinely different model. Dependencies (`dependsOn`) and priority control order; independent experts run in parallel.

## Architecture

**Compose layer**
- **Planner** — decompose the task into expert roles + instructions
- **Expert Registry** — declare experts (id, `allowedModels`, `enabled`)
- **Model Assignment** — map each expert → a specific model (per-expert, not global)
- **Dependency Graph** — order via `dependsOn` + `priority`
- **Execution** — parallel / sequential / hybrid (dependency-respecting)
- **Judge** — evaluate expert outputs against the task
- **Synthesis** — combine judged outputs into one final answer
- **Policy** — guardrails (allowed models, disabled experts, cycle detection)
- **Plan Versioning / Observability / Evaluation** — experiments, `runId` events, test harness

**Runtime layer**
- **Model Registry** — known models + capabilities/cost
- **Resource Placement** — GPU / RAM / CPU / cloud
- **Auto GPU tuning + Benchmarking** — quant/context per hardware, tok/s per model
- **Backends** — llama.cpp / Ollama / cloud API

## Core pattern — per-expert model assignment

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

## Pitfalls
- **Don't fake MoA with one model** — role-playing N experts is prompt engineering, not MoA.
- **Validate before execute** — unknown/disabled expert or model outside `allowedModels` → fail fast.
- **Architecture ≠ implementation** — integrate with your existing orchestrator (Planner/Executor/Judge/Synthesizer), don't re-implement them.
- **Fact-check model output** — the judge verifies against docs; experts hallucinate API names.
- **Heterogeneous models ≠ one sharded model** — each worker keeps its own model locally; you exchange prompts/results (KB), never weights.

## Real example (coder → critic → judge)

Task: `parseClusterConfig(json)` — parse + validate a cluster config.
1. **Coder** (local Qwen 27B) produced clean field validation — but no uniqueness, no reserved-IP check.
2. **Critic** (a different model) found 8 issues (duplicate names/IPs, `0.0.0.0`/`127.x` passing, array-as-element).
3. **Synthesis** produced the fixed, production-grade version.

Result: the combination beat either model alone — the coder's speed + the critic's different blind spot = better than one model doing both.

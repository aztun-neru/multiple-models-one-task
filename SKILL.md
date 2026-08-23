---
name: moa-mixture-of-agents
description: Mixture-of-Agents (MoA) composition — decompose a task into expert roles, assign a DIFFERENT model to each expert, execute via a dependency graph (parallel/sequential/hybrid), then judge + synthesize. Use when you need multiple specialized models (coder, researcher, critic) collaborating on one task, instead of a single model role-playing several experts.
---

# MoA — Mixture-of-Agents Composition

## What it is
MoA runs MULTIPLE models as specialized experts on one task, instead of one model pretending to be several roles. Each expert gets its OWN model (a coder expert runs a coding model, a critic runs a strong generalist), experts can depend on each other, and a judge + synthesizer combine their outputs into one answer.

The key distinction from "one model + prompt engineering":
- MoA = **different models per role**, genuinely parallel, then judged + synthesized.
- Fake MoA = one model role-playing N experts (that's just a long prompt, no value).

## When to use
- A task benefits from genuinely different models (coder + researcher + critic) working in parallel.
- You have heterogeneous models (a fast coder + a strong reasoner) and want to route each sub-task to the best one.
- You want a defensible "judge" step that checks the experts' work before synthesis.

## Architecture

### Compose layer
| Module | Responsibility |
|---|---|
| Planner | Decompose the task into expert roles + per-role instructions |
| Expert Registry | Declare experts (id, role, `allowedModels`, `enabled`) |
| Model Assignment | Map each expert → a specific model (**per-expert**, not global) |
| Dependency Graph | Order experts via `dependsOn` + `priority` |
| Execution | parallel / sequential / hybrid (dependency-respecting) |
| Judge | Evaluate expert outputs against the task |
| Synthesis | Combine judged outputs into one final answer |
| Policy / Safety | Guardrails: allowed models, disabled experts, cycle detection |
| Plan Versioning | Version the composition plan (experiment store) |
| Observability | Emit `expert-start`/`expert-end`/`composition-error` + `runId` |
| Evaluation | Test harness + feedback loop for optimization |

### Runtime layer
| Module | Responsibility |
|---|---|
| Model Registry | Known models + capabilities/cost |
| Resource Placement | Place models on GPU / RAM / CPU / cloud |
| Auto GPU tuning | Choose quant + context per hardware |
| Benchmarking | Measure tok/s + quality per model |
| Backends | llama.cpp / Ollama / cloud API |

## Core pattern — per-expert model assignment

```
TASK
 ├── RESEARCH → reasoner-model
 ├── CODER    → coder-model
 ├── CRITIC   → strong-generalist
 └── SYNTH    → another-model
```

NOT:
```
TASK └── one model └── pretending to be 4 experts
```

A `CompositionPlan` captures this:
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

## Execution modes
- **sequential** — run experts one by one (strict ordering).
- **hybrid (dependency graph)** — respect `dependsOn`, run independent experts in parallel up to `maxParallelism`, order by `priority`. Detect cycles / missing dependencies and fail fast.

## Pitfalls
- **Don't fake MoA with one model** — the value is genuinely different models per role; one model role-playing N experts is just prompt engineering.
- **Validate before execute** — unknown expert, disabled expert, or model not in `allowedModels` → throw, don't run.
- **Architecture ≠ implementation** — a complete module list doesn't mean it's wired into your orchestrator. Integrate + test before calling it done.
- **Fact-check model output** — models hallucinate API/event names; the judge should verify against docs, not trust the experts.
- **Heterogeneous models ≠ one sharded model** — each worker keeps its own model locally; you exchange prompts + results (KB of text), never weights.

## Minimal skeleton (integration points)
The modules that must already exist in your orchestrator (don't re-implement them): Planner, ExpertExecutor, Judge, Synthesizer. MoA adds on top: Expert Registry, Model Assignment (per-expert), Dependency Graph executor, Observability, Evaluation. Integrate with the existing pieces rather than replacing them — otherwise you get two parallel implementations of the same mechanism.

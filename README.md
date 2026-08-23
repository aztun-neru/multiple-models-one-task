# Multiple Models, One Task

## The problem

Ask any LLM to "write some code, then review your own work." It will cheerfully do both — and miss the same bugs in both passes. The reviewer and the coder are the same weights, so they are blind to exactly the same things. A hallucinated API name, an edge case the model never considered, a validation gap: the "review" is theater, because the model cannot disagree with itself.

This is not a quality problem with a specific model. It is a structural property of asking **one set of weights** to be both author and auditor. No prompt fixes it: role-play ("you are now a code reviewer") does not create independence — it creates a costume.

## The idea

Instead of one model playing every role, give each role to a **different model**, and run them against each other:

```
                        TASK
                          │   the Planner splits the task into roles
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   RESEARCH          CODER            CRITIC
  reasoner-model    coder-model    strong-generalist
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                       JUDGE      ← checks each answer against the task
                          │          (not against each other)
                          ▼
                      SYNTHESIS → one final answer
```

![diagram](diagram.svg)

The key move: **model assignment is per expert, not global.** The coder role is wired to a model that is actually good at coding. The critic runs on a different model, with different training, different strengths, different blind spots. When the critic's blind spots don't overlap the coder's, it catches what the coder missed. That is the entire point — and it only works if the models are genuinely different.

## What it caught in practice

A concrete run (a `parseClusterConfig` function — parse and validate a cluster config):

The coder produced clean, working field validation: IPv4 syntax, role enum, non-negative integer GPU count, leading-zero rejection, clear error messages. On its own this looked done.

The critic — a *different* model — found eight problems the coder never saw:

1. **Duplicate machines allowed.** Two entries with the same `name` or `ip` pass through. In a real cluster that's a routing conflict.
2. **Reserved IPs accepted.** `0.0.0.0`, `127.0.0.1`, `255.255.255.255` pass as machine addresses.
3. **Array-as-element.** `typeof [] === "object"`, so an array slips past the object check and fails with a misleading error about `name`.
4. **Unsafe cast.** `as Record<string, unknown>` applied before type validation.
5. **Whitespace leak.** `name` is validated after `trim()` but stored raw — `"  node1  "` survives.
6. **No orchestrator requirement.** An empty cluster, or one with no orchestrator, passes.
7. **Misleading error.** "Invalid JSON" when the JSON is fine and the *shape* is wrong.
8. **Dead code + missing bounds.** `num < 0` is unreachable (regex excludes it); no upper bound on GPU count.

The synthesis applied the fixes. The result was production-grade — and **neither model alone produced it.** The coder didn't see the gaps; the critic wouldn't have written the code as fast. Two models with different blind spots beat one model doing both jobs.

## The architecture

The system has two layers. The **composition layer** decides *what runs*; the **runtime layer** decides *where*.

**Composition layer**

| Module | What it does |
|---|---|
| **Planner** | Decomposes the task into expert roles + per-role instructions |
| **Expert Registry** | Declares experts: `id`, `allowedModels`, `enabled` |
| **Model Assignment** | Maps each expert → a specific model (per-expert, not global) |
| **Dependency Graph** | Orders experts via `dependsOn` + `priority`; detects cycles |
| **Execution** | `parallel` / `sequential` / `hybrid` (dependency-respecting) |
| **Judge** | Evaluates outputs against the task, not against each other |
| **Synthesis** | Combines judged outputs into one answer |
| **Policy** | Guardrails: allowed models, disabled experts, cycle detection |
| **Observability** | `expert-start` / `expert-end` / `composition-error` + `runId` |
| **Evaluation** | Test harness + feedback loop |

**Runtime layer**

| Module | What it does |
|---|---|
| **Model Registry** | Known models + capabilities/cost |
| **Resource Placement** | GPU / RAM / CPU / cloud |
| **Auto GPU tuning** | Quant + context per hardware |
| **Benchmarking** | tok/s + quality per model |
| **Backends** | llama.cpp / Ollama / cloud API |

The reference implementation in `src/` is 20 TypeScript files and compiles clean under `tsc --strict`.

## A minimal plan

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

`executionMode: "hybrid"` runs independent experts in parallel and respects `dependsOn`. `sequential` runs them one by one. A dependency cycle or missing dependency throws rather than hangs.

## When NOT to use it

- **Single-step, low-risk tasks.** One model is enough; the extra calls, latency and cost aren't justified.
- **Sensitive data without isolation.** Routing PII across several models multiplies exposure.
- **Tight budget.** Every expert is a separate model call; cost scales with the number of roles.
- **You only have one model.** Two copies of the same weights are still the same blind spot. This only helps with *different* models.

## Read further

- **[SKILL.md](SKILL.md)** — the full operating manual: doctrine, state machine, gates, pitfalls, the verification commands that were actually run.
- **[references/](references/)** — the complete doctrine (106KB), the full example corpus, and the API reference.

## Verify it yourself

Does per-expert assignment beat one strong model on *your* task? Does the judge catch real bugs? Open an issue with your before/after — especially where you expected a single model to be enough.

MIT

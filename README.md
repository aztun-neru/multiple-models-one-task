# Multiple Models, One Task

Run one task through several *specific* language models — a Qwen for code, a GLM or Claude for critique, a DeepSeek for research — and combine their answers through a judge so no single model's blind spot survives into the result.

This repo exists because one model doing everything is one set of blind spots. When the coder and the reviewer are the same weights, the reviewer misses exactly what the coder missed. The fix is not a better prompt — it is giving each role to a genuinely different model. Below, the concrete setup this was built and tested against.

## The models, concretely

The assignment is per-role, and it uses real models — not placeholders:

| Role | Model | Why it |
|---|---|---|
| **CODER** | Qwen3.8-27B (local, dense) | a dense 27B that is strong at code; runs at 122–256 tok/s on a single RTX 3090 via vLLM |
| **CRITIC** | GLM-5.2 (OpenRouter) | a different family and training set, so its blind spots don't overlap the coder's |
| **RESEARCHER** | DeepSeek (reasoner) | strong at surveying a problem and the relevant patterns before code is written |
| **JUDGE** | Claude (or DeepSeek) | checks each answer against the task, not against the other experts |
| **SYNTHESIS** | a strong generalist | combines the judged answers into one final result |

```
                        TASK
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   RESEARCH          CODER            CRITIC
    DeepSeek       Qwen3.8-27B        GLM-5.2
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                       JUDGE   (Claude / DeepSeek)
                          │
                          ▼
                      SYNTHESIS → final answer
```

![Multiple Models, One Task — architecture](diagram.svg)

The point of the table and the diagram is that the models are **different** — different families, different training, different failure modes. Two copies of the same weights still share the same blind spot no matter how many roles you hand them. The whole value of this pattern depends on the models being genuinely unlike each other.

## How it works

A task enters through a planner, which decomposes it into roles and writes a per-role instruction. The experts declare dependencies (`dependsOn`) and priorities, and the engine runs them **sequential**, **parallel**, or **hybrid** (dependencies respected, independent experts in parallel up to a concurrency limit). A dependency cycle or a missing expert fails immediately instead of hanging.

After the experts answer, a judge evaluates each answer against the original task. Only answers that pass reach the synthesis step, which combines them into one final answer. The judge is the gate — nothing reaches the user without passing it.

## What it caught in practice

A concrete run: a `parseClusterConfig` function that parses and validates a cluster config.

The coder (Qwen3.8-27B) produced a clean, working implementation — IPv4 syntax with leading-zero rejection, role enum, non-negative integer GPU count, indexed error messages. On its own it looked finished.

The critic (GLM-5.2) then found eight problems the coder had not seen:

1. **Duplicate machines allowed** — two entries with the same name or IP pass; a routing conflict in a real cluster.
2. **Reserved addresses accepted** — `0.0.0.0`, `127.0.0.1`, `255.255.255.255` pass as machine IPs.
3. **Array slips past the object check** — `typeof [] === "object"`, so an array passes and fails later with a misleading error.
4. **Unsafe cast** — `as Record<string, unknown>` applied before type validation.
5. **Whitespace leak** — name validated after `trim()` but stored raw.
6. **No orchestrator required** — an empty cluster, or one with no orchestrator, passes.
7. **Misleading error** — "Invalid JSON" when the JSON was fine and the shape was wrong.
8. **Dead code and missing bounds** — unreachable `num < 0`, no upper bound on GPU count.

The synthesis applied the fixes. The result was production-grade, and neither model alone produced it: the coder did not see the gaps, and the critic would not have written the code as fast. Different blind spots beat one model doing both jobs.

## The architecture in detail

Two layers. The **composition layer** decides what runs: Planner (decompose the task), Expert Registry (experts with `allowedModels` and `enabled`), Model Assignment (per-expert, not global), Dependency Graph (`dependsOn` + `priority`, cycle detection), Execution (parallel/sequential/hybrid), Judge (evaluate against the task), Synthesis (combine), plus Policy, Observability, and Evaluation around them.

The **runtime layer** decides where it runs: Model Registry (available models and cost), Resource Placement (GPU/RAM/CPU/cloud), Auto GPU tuning (quant and context per hardware), Benchmarking (tok/s and quality per model), and backends (llama.cpp, Ollama, cloud APIs).

The reference implementation is twenty TypeScript files in `src/` and compiles under `tsc --strict`. The full doctrine, example corpus, and API reference are in `references/` and `SKILL.md`.

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
    { expertId: "researcher", modelId: "deepseek-reasoner" },
    { expertId: "coder",      modelId: "qwen3.8-27b" },
    { expertId: "critic",     modelId: "glm-5.2" },
  ],
  judgeExpertId: "judge",
  synthesisExpertId: "synthesis",
};
```

## When not to use it

**Single-step, low-risk tasks** don't justify the extra calls, latency, and cost. **Sensitive data without isolation** is a poor fit — routing PII across several models multiplies exposure. **Tight budgets** are a poor fit — every expert is a separate call. And this only helps with *different* models: two copies of the same weights are still the same blind spot.

## Try it and tell us

Does per-expert assignment with a judge beat one strong model on your task? Does the critic catch real bugs the coder would have shipped? Open an issue with your before-and-after.

MIT

# Multiple Models, One Task

**A system for running a single task through several different language models — each doing the part it is good at — and combining their answers through a judge so that the weaknesses of any one model do not survive into the final result.**

## The problem this addresses

Language models are capable of writing code, and they are capable of reviewing code. The trouble begins when the same model is asked to do both. A model that writes a function and then reviews its own work is reading its own output through the same weights that produced it. It is blind to exactly the mistakes it is prone to make — the hallucinated library name, the edge case it never considered, the validation check it quietly omitted. When the "reviewer" shares every blind spot with the "author," the review does not add information; it adds confidence.

This is not a deficiency of any particular model. It is a structural consequence of asking a single set of weights to be both the person who writes the answer and the person who checks the answer. You cannot prompt your way out of it. Telling a model to "act as a code reviewer" changes the costume, not the underlying blind spots. The only way to get genuine, independent criticism is to bring in a genuinely different model — one trained on different data, with different strengths, different failure modes, and therefore different blind spots.

That is the entire idea behind this project: instead of one model playing every role in a conversation, give each role to a different model, run them against each other, and let a judge decide what survives.

## How it works

A task enters through a **planner**, which decomposes it into roles. A typical decomposition for a coding task is three experts: a **researcher** that surveys the problem and the relevant patterns, a **coder** that produces the implementation, and a **critic** that attacks the result. Each expert is wired to a different model — the coder to a model that is strong at code, the critic to a strong generalist with different training, and so on.

```
                        TASK
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   RESEARCH          CODER            CRITIC
  reasoner-model    coder-model    strong-generalist
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                       JUDGE      ← checks against the task
                          │
                          ▼
                      SYNTHESIS → final answer
```

The experts do not run in a fixed order. Each expert declares its dependencies (`dependsOn`) and a priority, and the engine runs them in one of three modes: **sequential** (one after another), **parallel** (all at once), or **hybrid** (respect the dependencies, run everything independent in parallel up to a concurrency limit). A dependency cycle or a reference to a missing expert fails immediately rather than hanging.

After the experts produce their answers, a **judge** evaluates each one against the original task — not against the other experts, but against what was actually asked. Only the answers that pass reach the **synthesis** step, which combines them into a single final answer. The judge is the gate: nothing reaches the user that did not pass.

## A concrete example

Consider a small but realistic task: a `parseClusterConfig` function that parses a JSON description of a machine cluster and validates every field — machine name, IPv4 address, role, and GPU count.

The coder produced a clean, working implementation. It validated the IP syntax (including rejecting leading zeros), enforced the role enum, required a non-negative integer GPU count, and threw clear, indexed error messages. Taken on its own, it looked finished.

The critic — a different model — then produced eight findings that the coder had not seen:

1. **Duplicate machines were allowed.** Two entries with the same name or IP passed validation. In a real cluster that is a routing conflict that breaks deployment.
2. **Reserved addresses were accepted as machine IPs.** `0.0.0.0`, `127.0.0.1`, and `255.255.255.255` passed, though none of them is a meaningful machine address.
3. **An array slipped past the object check.** Because `typeof [] === "object"`, a JSON array passed the "is it an object" test and then failed later with a misleading message about a missing `name`.
4. **An unsafe type cast.** The code cast each item to `Record<string, unknown>` before validating its type, which is a type-safety hole even when a runtime check happens to guard it.
5. **Whitespace leaked into names.** The name was validated after `trim()` but stored in its raw form, so `"  node1  "` survived into the result.
6. **No orchestrator was required.** An empty cluster, or a cluster with no orchestrator role, passed validation even though a real cluster needs at least one.
7. **A misleading error message.** The code reported "Invalid JSON" when the JSON was in fact valid and the problem was the shape of the data.
8. **Dead code and missing bounds.** The `num < 0` check was unreachable (the regex already excluded minus signs), and there was no upper bound on the GPU count.

The synthesis step applied the fixes. The result was production-grade, and — this is the point — **neither model alone produced it.** The coder did not see the gaps; the critic would not have written the code as quickly or as cleanly. Two models with different blind spots produced a better result than either could alone, and the judge is what guarantees the criticism actually reaches the output rather than being silently ignored.

## The architecture in detail

The system is divided into two layers. The **composition layer** decides what runs; the **runtime layer** decides where it runs.

**Composition layer.** The **Planner** decomposes the task into expert roles and writes a per-role instruction for each. The **Expert Registry** holds the known experts, each with its id, its allowed models, and whether it is enabled. The **Model Assignment** maps each expert to a specific model — this is per-expert, not global, which is the core of the idea. The **Dependency Graph** orders the experts by their dependencies and priorities and detects cycles. The **Execution** engine runs them in the chosen mode. The **Judge** evaluates outputs against the task. The **Synthesis** combines the judged outputs. Around these sit **Policy** (guardrails such as allowed models, disabled experts, and cycle detection), **Observability** (events such as `expert-start`, `expert-end`, and `composition-error`, each tagged with a run id), and **Evaluation** (a test harness and a feedback loop for tuning the composition).

**Runtime layer.** The **Model Registry** knows which models are available and what they cost. **Resource Placement** decides where each model runs — GPU, RAM, CPU, or cloud. **Auto GPU tuning** chooses a quantization and context size appropriate to the hardware. **Benchmarking** measures tokens-per-second and quality per model so the placement decisions are grounded in numbers rather than guesses. The **backends** are llama.cpp, Ollama, and cloud APIs.

The reference implementation in `src/` is twenty TypeScript files and compiles cleanly under `tsc --strict`. The complete doctrine, the full example corpus, and the API reference live in the `references/` directory and in `SKILL.md`.

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
};
```

## When not to use it

This pattern is not free, and it is not always the right tool. **Single-step, low-risk tasks** do not justify the extra calls, latency, and cost — one good model is enough. **Sensitive data without isolation** is a poor fit, because routing personally identifiable information across several models multiplies the exposure surface. **Tight budgets** are a poor fit, because every expert is a separate model call and cost scales with the number of roles. And it is worth repeating: this only helps with *different* models. Two copies of the same weights still share the same blind spot, no matter how many roles you give them.

## Try it and tell us what you found

This is a reference implementation and a doctrine, not a claim of superiority over any specific single model. The question worth testing is: on your own task, does per-expert assignment with a judge actually beat one strong model doing everything? Does the critic catch real bugs that the coder would have shipped? Open an issue with your before-and-after — especially on tasks where you expected a single strong model to be enough.

MIT

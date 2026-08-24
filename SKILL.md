---
name: multiple-models-one-task
description: Run ONE task through MULTIPLE specialized experts — researcher, independent architecture candidates, adversarial critic, judge, synthesizer — with per-expert model assignment, staged parallel/sequential execution, evidence verification and a consensus gate, so no single model's blind spot becomes your bug. Use when a coding/architecture task is high-risk, when one model both writes and approves its own work, when hallucinated APIs must be caught before merge, or when comparing independent candidates beats one confident answer. NOT for trivial single-step tasks.
---

# Multiple Models, One Task — Composition Engine + Orchestration Doctrine

Complete skill for the NERU/Hermes MoA system. Source of truth:
the `moa/` package — `src/` (compiling TypeScript,
`tsc --strict` passes), `docs.md` (1979 lines of doctrine), `examples.md`
(1356 lines of concrete configs/prompts), `tests.md` (gate logic).
This SKILL.md is the operating manual; `references/` holds the full material.

- `references/architecture.md` — the complete orchestration doctrine
  (task lifecycle, state machine, roles, evidence rules, gates, memory).
- `references/examples.md` — the full example corpus (role prompts,
  evidence packs, routing decisions, JSON output schemas, disagreements).
- `references/api-reference.md` — every type, class, method and formula
  in `src/`, plus the ports you must implement to wire real models.

---

## 1. WHY THIS EXISTS — the problem, in full

A single LLM asked to "act as a coder, then a reviewer, then a judge" is
still **one model with one set of blind spots**. When the coder and the
reviewer share weights, the reviewer systematically fails to catch what
the coder missed — they are blind to the same things. Role-play is not
independence.

Two failure modes dominate single-model engineering work:

1. **Hallucinated identifiers.** The model invents plausible APIs,
   events, types (`NormalizedEvent`, `step.start`, `security.violation`)
   that do not exist in the repository. Code compiles in the model's
   imagination and fails in `tsc`.
2. **Omissions.** Documentation says 5 views / 14 panels / 24 nodes; the
   model implements 3 views and reports success. Nobody recounts.

The classic "Mixture of Agents" answer — five copies of the same model
invent five solutions and majority-vote — is explicitly rejected by this
system (docs.md §37): *"We do NOT tell five models to invent solutions
and vote. That would be weak and waste VRAM/tokens."* Agreement between
LLMs is not evidence (§562: five agents claiming `security.violation`
exists does not make it exist).

What replaces voting:

- **Pass isolation** — each role gets its own context, output contract
  and system instruction; reviewers never inherit the implementer's
  conclusions as facts.
- **Evidence before inference** — every repository-specific claim must
  be verified against source/docs/tools; `UNKNOWN` is a valid and
  required answer; guessing is forbidden.
- **Deterministic verification over LLM judgment** — compiler, tests,
  grep and documentation indexes answer "does it exist?"; the model only
  answers "what should we do with it?" (§169).
- **Hard gates** — invented critical API, missing mandatory requirement,
  failing test ⇒ REJECT, regardless of quality scores (§139, §313).

The five core rules (docs.md §168–172), verbatim:

1. MORE MODELS ≠ MORE TRUTH. More independent reasoning + better
   evidence + targeted verification + strict judging = more reliable
   output.
2. Never ask an LLM to verify what a deterministic tool can verify more
   reliably. LLM: architecture, reasoning, tradeoffs, implementation.
   TOOLS: existence, syntax, types, imports, exports, tests, diffs,
   paths, exact strings.
3. Never let synthesis hide disagreement. Disagreement stays visible
   until resolved; a clean final answer is not worth more than the
   uncertainty that produced it.
4. The Judge is not an oracle. Judge → implementation → audit →
   validation stays in place.
5. The final validator can reject the entire MoA result — even if 3
   architects agree, the judge says PASS and the implementer says PASS —
   when evidence contradicts the result.

And the quality principle (§599): the goal is NOT "find the smartest
model", it is "construct the strongest **verified** workflow from the
available models". A model at 120 tok/s with 10% hallucination is worse
than 50 tok/s with 2% (§322). The model proposes; Hermes decides; tools
verify; the compiler validates types; tests validate behavior; memory
stores only verified knowledge (§40).

The measured motivation (single run, from the project history): a local
coder model wrote clean field validation in seconds; a second model
found 8 concrete problems the coder missed (duplicate machine names
allowed, `0.0.0.0`/`127.x` accepted as machine IPs, array-as-element);
synthesis produced the fixed, production-grade version. The combination
beat either model alone.

## 2. WHAT IT IS — two layers, one system

```
LAYER A: COMPOSITION ENGINE (src/, TypeScript, compiles, this repo)
         ExpertRegistry → CompositionEngine → stages → Aggregator
         → ConsensusEngine → VerificationEngine → CompositionResult
         (+ scheduling, security, evaluation, experiments, optimization)

LAYER B: ORCHESTRATION DOCTRINE (docs.md — how Hermes drives Layer A
         for real engineering tasks)
         INTAKE → CLASSIFY → RESEARCH/EVIDENCE → CANDIDATES →
         FACT CHECK → JUDGE → PLAN → IMPLEMENT → AUDITS → REPAIR →
         VALIDATE → MEMORY
```

Layer A is generic infrastructure: it executes **any** staged expert
plan with retries, fallbacks, budgets, resource scheduling, aggregation,
consensus scoring and documentation verification. Layer B is the NERU/
Hermes doctrine that instantiates Layer A into a coding pipeline with 19
roles, evidence packs, and anti-hallucination gates. You can use Layer A
alone (e.g. pure answer-quality MoA) or both together.

### 2.1 The doctrine pipeline (full form)

```
                        TASK
                          ▼
                    RESEARCHER
                          ▼
                  EVIDENCE PACK
                          ▼
              REQUIREMENT ANALYSIS
                     ┌────┴────┐
                     ▼         ▼
                  Analyst A  Analyst B
                     └────┬────┘
                          ▼
                  REQUIREMENT JUDGE
                          ▼
                VERIFIED REQUIREMENTS
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           ARCH-A      ARCH-B      ARCH-C     ← independent candidates,
              │           │           │          A never sees B or C
              └───────────┼───────────┘
                          ▼
                ARCHITECTURE REVIEW
                          ▼
                  DISAGREEMENT MAP
                          ▼
                    TARGETED CHECKS
                          ▼
                        JUDGE
                          ▼
                 SELECTED ARCHITECTURE
                          ▼
                        PLAN
                          ▼
                    IMPLEMENTER
                          ▼
              ┌───────────┴───────────┐
              ▼                       ▼
         API AUDITOR          COMPLETENESS AUDITOR
              │                       │
              └───────────┬───────────┘
                          ▼
                     CODE REVIEW
                          ▼
                       REPAIR
                          ▼
                  STATIC VALIDATION
                          ▼
                       TESTS
                          ▼
                  FINAL VALIDATOR
                          ▼
                  MEMORY CURATOR
                          ▼
                      COMPLETE
```

### 2.2 The engine at a glance

`CompositionEngine.execute(task, plan, seed)` walks `plan.stages` in
order. Each stage runs its experts `"parallel"` (Promise.all) or
`"sequential"` (output of expert N becomes context of expert N+1), then
the stage's `aggregation` collapses proposals into a stage output which
becomes the context for the next stage. After the last stage,
`finalAggregation` produces the task output, `VerificationEngine`
checks it against a `DocumentationProvider`, and `ConsensusEngine`
scores all proposals. Success requires: every stage succeeded (or
failed without findings), verification passed, and the consensus score
met `plan.minimumConsensus` — plus no `BUDGET_EXCEEDED`.

Everything is deterministic and replayable: `runFingerprint(task, plan,
seed)` = sha256 of stable-stringified `{task, plan, seed}`; identical
inputs hit the `ExperimentStore` fingerprint cache with **zero** extra
model calls (verified in the example run).

## 3. MODULES — what each one does (Layer A)

### ExpertRegistry (`src/ExpertRegistry.ts`)
Catalog of experts. An `Expert` = **role bound to ONE model**:
`id, role, modelId, workerPreference?, capabilities, specializations,
reliability (0..1), status, resourceRequirements?, fallbackExpertIds?,
metadata?`. `register()` throws on duplicate id and validates
`reliability ∈ [0,1]` and `modelId` present; `upsert()` for updates;
`get()`/`list()` return defensive clones. Assignment is **per-expert**
— the coder expert is wired to a coding model, the critic to a strong
generalist, the synthesizer to a reasoner. This is the whole point:
different models doing what each is best at.

### CompositionEngine (`src/core/CompositionEngine.ts`)
The orchestrator loop (252 lines, the heart). Per stage: execute
experts (parallel: `Promise.all`; sequential: chain context as
`{previousExpert, previousOutput}`, abort on failure unless
`required:false`), collect `Proposal`s (success/failure, confidence,
latencyMs, tokens, cost, evidence, failures), accumulate failures and
costs, aggregate stage output. On expert failure with
`stage.fallbackOnFailure`, walks `expert.fallbackExpertIds` in order
until one succeeds. Budget check after every stage (`maxTokens`,
`maxCost`, `maxLatencyMs`, `maxExpertCalls`) → `BUDGET_EXCEEDED` is
fatal. Final: aggregate → verify → consensus → success gate. Returns
`CompositionResult` with `stages`, all `proposals`, totals,
`fingerprint`, `runId` and `metadata.consensus/verification`.

### ExpertExecutor (`src/core/ExpertExecutor.ts`)
Runs ONE expert with production hardening: optional `router.health()`
check first; reserves worker capacity through `ResourceProvider` (using
`expert.resourceRequirements`, honoring `workerPreference` order);
executes via `ModelRouter.execute` wrapped in `withTimeout` (→
`TIMEOUT`, retryable); classifies errors via `normalizeFailure` into
`TIMEOUT | OOM | WORKER_FAILURE | MODEL_FAILURE` (OOM is NOT retryable);
retries up to `maxRetries` (default 2) with backoff
(`250ms * (attempt+1)`); always releases the reservation in `finally`.
Success proposal carries `confidence = expert.reliability`, tokens and
cost. Failure proposal carries the classified `Failure`.

### Aggregator (`src/core/Aggregator.ts`)
Six strategies, all ignore failed proposals and return `undefined` when
none succeeded:
- `best` — highest-confidence proposal's output.
- `weighted` — `[{expertId, weight: confidence, output}]` (defer the
  choice downstream).
- `consensus` — the candidate-set: all outputs with expert ids (feeds a
  judge stage).
- `evidence` — outputs plus their evidence lists (feeds verification).
- `synthesis` — calls `SynthesisExecutor.synthesize("Synthesize a final
  solution… do not invent APIs, facts or requirements", …)`.
- `judge` — calls `SynthesisExecutor.synthesize("Judge the proposals
  against requirements. Identify contradictions and unsupported claims.
  Return the best candidate and reasons", …)`.
`synthesis`/`judge` REQUIRE a `SynthesisExecutor` — the constructor
throws without one when those strategies are used.

### ConsensusEngine (`src/core/ConsensusEngine.ts`)
Scores agreement WITHOUT majority-vote semantics:
`score = agreement*0.45 + evidenceScore*0.40 + independentSupport*0.15`
where `agreement` = largest identical-output group (stable-stringified)
/ valid proposals, `evidenceScore` = mean over proposals of mean of
`(verified ? confidence : 0)` per evidence item, `independentSupport` =
distinct expertIds / valid proposals. Practical consequence (verified
in the example run): independent architecture candidates with different
outputs and no evidence attached score ~0.375 — a `minimumConsensus:
0.5` gate REJECTS them. Attach evidence or lower the gate for candidate
stages.

### VerificationEngine (`src/core/VerificationEngine.ts`)
Ground-truth check of the final output against a `DocumentationProvider`
(`verify(query, candidate) → {verified, score, evidence[], failures[]}`).
**Pitfall: with NO DocumentationProvider configured, every run FAILs**
with `DOCUMENTATION_MISMATCH: "No authoritative documentation provider
configured"`. This is deliberate — the doctrine refuses unverified
success. A real provider checks every API/event/type name in the output
against the repo/docs index and returns `API_HALLUCINATION` failures for
identifiers that are absent.

### InMemoryResourceScheduler (`src/scheduling/ResourceScheduler.ts`)
`ResourceProvider` implementation for heterogeneous workers (RTX 3090 /
Mac M4 / Mac M2…). `registerWorker({id, name, resources, capacity,
status})`; `reserve(requirements, preferredWorkers)` picks online
workers with free capacity (`activeJobs < capacity`), sorted by
preference order, matching every `ResourceRequirement.minimum` against
`resources[key ?? type]`; `release()` decrements. Requirements are
typed: `vram | ram | cpu | gpu | worker | custom`. The doctrine
(§175): never force symmetry — assign work by capability, memory, model
availability and load.

### StaticToolPolicy (`src/security/ToolPolicy.ts`)
`canUse(tool, expertId, task)` = tool ∈ `allowed[expertId]`. Matches the
doctrine's tool matrix: researcher `{read, search}`, coder
`{read, search, write, execute}`, reviewer `{read, search, execute}`.
Destructive commands never run on model text alone.

### EvaluationEngine + Evaluators (`src/evaluation/`)
Post-run scoring: weighted mean of `Evaluator` criteria, each returning
`{score 0..1, passed, evidence?, failure?}`. `passed = score ≥ 0.8 AND
every criterion passed`. Built-ins: `ExecutionEvaluator` (weight 1,
composition success), `APIAccuracyEvaluator` (weight 3 — **fails loudly
until you connect it to real docs/source**; it refuses to fake a pass),
`RequirementCoverageEvaluator` (weight 2, placeholder — replace with a
domain checker). Diagnostics only: a high score never overrides hard
gates.

### BenchmarkRunner + ResultCache + InMemoryExperimentStore (`src/experiments/`)
`BenchmarkRunner.run(benchmarkId, tasks[], plan, seed=42)`: per task —
fingerprint → store lookup → cached? reuse : execute + evaluate → save
`ExperimentResult`. Aggregates `averageScore, passRate, averageLatencyMs,
averageTokens, totalCost`. `ResultCache(store, ttlMs=24h)` wraps the
same fingerprint lookup with TTL. The in-memory store keeps experiments,
fingerprints and benchmarks; implement the `ExperimentStore` port for
persistence.

### OptimizationEngine (`src/optimization/OptimizationEngine.ts`)
Plan search: `generateVariants(base)` produces 4 plan variants —
`-critic`, `-consensus` (adds `minimumConsensus: 0.8`), `-verification`,
`-budgeted` (caps `maxExpertCalls: 8`). Benchmark each, then
`rank(candidates, constraints)` filters by `minimumScore/passRate`,
`maximumLatencyMs/Tokens/Cost` and sorts by
`utility = score*0.55 + passRate*0.30 + 1/(1+latencyMs/10⁴)*0.10 +
1/(1+tokens/10⁴)*0.05`. `best()` returns the winner. This is how the
plan itself becomes a tuned artifact instead of a guess.

### VersionManager (`src/optimization/VersionManager.ts`)
Promote/rollback for plans: `initialize`, `promote` (push history),
`rollback` (pop to previous — throws if none), `list`, `getActive`.
Superseded versions stay in history, matching the doctrine's
"SUPERSEDED, not DELETED" rule.

### Hash utilities (`src/utils/Hash.ts`)
`stableStringify` (recursively key-sorted JSON), `sha256`,
`runFingerprint(task, plan, seed)`. Same task + same plan + same seed ⇒
same fingerprint ⇒ cache hits and reproducible comparisons.

### AuditLogger (`src/observability/AuditLogger.ts`)
`emit(AuditEvent{timestamp, runId?, type, data})`. The in-memory
impl just collects; wire it to your event bus for
`task.created / phase.started / review.completed / repair.started /
task.blocked` telemetry.

### Ports to implement (`src/adapters/Interfaces.ts`)
`ModelRouter` (execute + optional health — your vLLM/Ollama/OpenRouter
call), `ResourceProvider` (reserve/release), `DocumentationProvider`
(verify), `MemoryProvider` (retrieve), `ToolPolicy`, `ExperimentStore`.
The engine never talks to a concrete model — only to these ports.

## 4. ORCHESTRATION DOCTRINE — the parts you must know (Layer B)

(Full version with all rules: `references/architecture.md`.)

**Routing matrix** — classify BEFORE calling any model:
TRIVIAL → direct response; LOW → single pass; MEDIUM → research →
reasoning → validation; HIGH → evidence → architecture → independent
review → implementation → validation; VERY_HIGH → evidence → multiple
reasoning → architecture candidates → judge → implementation →
multi-review → repair → validation; CRITICAL → full pipeline + explicit
approval gates. The classifier may never pick the cheapest route to
save tokens (§ Classify, docs.md).

**Task modes**: `simple` (ANALYZE→IMPLEMENT→VALIDATE), `standard`
(RESEARCH→ANALYZE→ARCHITECT→IMPLEMENT→REVIEW→REPAIR→VALIDATE),
`architecture` (+ ARCHITECT_REVIEW, PLAN, API/Completeness/Code
reviews), `large_refactor` (phased, validate after each phase; never
one giant generation).

**Evidence Pack** is the central object between stages (versioned
EP-01→EP-02, never silently mutated): verified files/symbols/types/
events/components/config, documentation facts, contradictions,
unknowns, `DO NOT ASSUME` list. Absence is evidence (`NOT_FOUND` is a
result, not a gap). Every API gets a confidence level A–X
(A = definition+usage+tests … X = not found, unusable). Source
priority: runtime > tests > source > config > current docs > versioned
docs > memory > model knowledge.

**Roles** (19): RESEARCHER, REQUIREMENT_ANALYST, ARCHITECT,
ARCHITECT_REVIEWER, ALTERNATIVE_ARCHITECT, ARCHITECT_JUDGE, PLANNER,
IMPLEMENTER, API_AUDITOR, COMPLETENESS_AUDITOR, CODE_REVIEWER,
TEST_ANALYST, REPAIRER, FINAL_VALIDATOR, MEMORY_CURATOR (+optional
DEBUGGER, SECURITY/PERFORMANCE/DOCUMENTATION_REVIEWER). Same model may
hold several roles, but each role gets a different system instruction,
minimal role-specific context, different output contract; reviewers
never see the implementer's conclusions (blind review). Full role
prompts are in `references/examples.md`.

**Pass types**: PARALLEL (same task+evidence, no cross-visibility —
kills anchoring), SEQUENTIAL (next sees previous artifact), DEPENDENT
(needs a specific artifact first), VERIFICATION (CLAIM+SOURCE+TOOL
OUTPUT → supported?), JUDGE (evaluate candidates before comparing;
RETURN_FOR_RESEARCH if none is verified), SYNTHESIS (only after
evaluation+conflict analysis; may combine compatible verified elements,
never merge contradictions), REPAIR (fix verified findings only).

**Temperatures**: classifier/api_verifier/judge/reviewer 0.0,
researcher 0.1, coder/repairer 0.1–0.2, planner 0.2, architect 0.3–0.4,
alternative architect/candidate generator 0.5–0.6. Diversity for
candidates, determinism for verification.

**Retry vs Repair**: retry = model produced invalid output (bad JSON) —
same pass again; repair = valid output, wrong implementation — targeted
fix pass. Max 2 retries/pass, 3 repair cycles (5 for critical), then
BLOCKED — never infinite regeneration, never the same prompt after the
same failure (diagnose → change strategy → retry).

**Hard fail conditions** (any ⇒ REJECT): nonexistent API used as a
dependency; mandatory requirement missing; compilation error; mandatory
test failing; architecture contradicting verified repo structure;
unjustified security-critical assumption; destructive change without
authorization. Quality score can NEVER override these.

**Stop conditions** (§143): stop when requirements are stable +
critical disagreements resolved + candidate quality converges + gates
pass. Do not run more agents just because more agents are available.
Default cost envelope for an architecture task: 1 research, 2
requirement analysts, 3 architecture candidates, 1 judge, 1 planner,
1 implementer, 3 audits, 1 repair, 1 final validation (§147) — and not
every stage needs the biggest model.

## 5. MINIMAL WORKING EXAMPLE

Full runnable file: `example/minimal-example.ts` (uses the real
library, mock ports; `npx tsx example/minimal-example.ts`). Shape:

```ts
const registry = new ExpertRegistry();
registry.register(expert("researcher",  "research",  "qwen-27b",     0.9));
registry.register(expert("architect-a", "architect", "glm-4.7",      0.85, { workerPreference: ["m4-mini"] }));
registry.register(expert("architect-b", "architect", "deepseek-v4",  0.85, { workerPreference: ["m4-mini"] }));
registry.register(expert("critic",      "critic",    "glm-4.7",      0.8));

const scheduler = new InMemoryResourceScheduler();
scheduler.registerWorker({ id: "m4-mini",  name: "Mac mini M4",    resources: { vram: 32, ram: 32 }, capacity: 2 });
scheduler.registerWorker({ id: "m2-air",  name: "MacBook Air M2", resources: { vram: 16, ram: 16 }, capacity: 1 });

const engine = new CompositionEngine(
  registry,
  new ExpertExecutor(router, scheduler, { maxRetries: 1 }),
  new Aggregator(new MockSynthesis()),       // backs judge/synthesis
  new ConsensusEngine(),
  { router, resources: scheduler },
  new VerificationEngine(new MockDocs())     // WITHOUT a provider every run FAILS
);

const plan: CompositionPlan = {
  id: "arch-review-plan", version: "1.0.0",
  stages: [
    { id: "research",               strategy: "parallel",   experts: ["researcher"],                aggregation: "best",      required: true, timeoutMs: 10_000 },
    { id: "candidate-architectures", strategy: "parallel",  experts: ["architect-a", "architect-b"], aggregation: "consensus", timeoutMs: 20_000 }, // A never sees B
    { id: "adversarial-review",     strategy: "sequential", experts: ["critic"],                    aggregation: "best",      fallbackOnFailure: true }
  ],
  finalAggregation: "judge",
  minimumConsensus: 0.3,   // 0.5 REJECTS independent candidates without evidence (score 0.375)
  budget: { maxExpertCalls: 10, maxCost: 0.5 }
};

const result = await engine.execute(task, plan, 42);
```

Actual verified output (2026-08-23, `tsc --noEmit` strict PASS):

```
run 1 (minimumConsensus = 0.5)
  success: false   → REJECTED by the consensus gate: score 0.375 < 0.5
  stages: research → candidate-architectures → adversarial-review
  consensus: { agreement: 0.5, evidenceScore: 0, independentSupport: 1, score: 0.375 }
run 2 (minimumConsensus = 0.3)
  success: true, contributors: researcher, architect-a, architect-b, critic
benchmark: { score: 1, passRate: 1 }
cached rerun: 0 extra model calls — fingerprint cache hit
```

For real plans, configs, role prompts and routing decisions taken from
the project corpus, read `references/examples.md` before composing your
first plan.

## 6. PITFALLS (found in source + verified in runs)

1. **No DocumentationProvider ⇒ guaranteed failure.** VerificationEngine
   returns `passed:false` (`DOCUMENTATION_MISMATCH`) for every run.
   Wire a real provider (repo/docs index) or accept that unverified
   output fails — by design.
2. **Consensus gate vs independent candidates.** Independent
   architecture candidates intentionally disagree (`agreement` low) and
   router-returned outputs carry no `Proposal.evidence` (the executor
   does not inject it), so `evidenceScore` stays 0 and score ≈ 0.375.
   `minimumConsensus: 0.5` rejects them. Use a judge stage instead of a
   consensus gate for candidate stages, or attach evidence.
3. **`APIAccuracyEvaluator` always fails until connected** to real
   documentation/source. That is intentional — it refuses to fake
   verification. Do not "fix" it by lowering its weight; connect it.
4. **Plan changes change the fingerprint.** Any field edited
   (`minimumConsensus`, budget, stages) ⇒ new fingerprint ⇒ cache miss
   ⇒ fresh model calls. Deterministic caching is per exact plan.
5. **`judge`/`synthesis` without a SynthesisExecutor throws** at
   aggregation time. Construct `new Aggregator(synthesisExecutor)`.
6. **OOM is not retryable** (normalizeFailure). Retrying an OOM worker
   just burns time — the scheduler should route elsewhere (fallbacks,
   different worker).
7. **`structuredClone` everywhere** — registry/scheduler/store return
   copies. Mutating a returned expert does nothing; use `upsert`.
8. **Sequential stage context is lossy by design**: it forwards only
   `{previousExpert, previousOutput}`. Rich multi-artifact context
   belongs in `task.context` or the doctrine's evidence pack, not in
   chained stage outputs.
9. **Budget is checked between stages, not during** — one stage can
   overshoot `maxTokens` before the engine notices. Set per-expert
   timeouts and model-side limits too.
10. **The ladder of authority is absolute**: tool output > model text;
    compiler > LLM; tests > LLM. "Model said the type is compatible"
    loses to `tsc` saying it is not. Never let a model self-certify.

## 7. WHEN NOT TO USE

- **Trivial/low-risk tasks** — rename, typo, one-line answer: single
  pass, `moa_required: false`. The pipeline's overhead (multiple calls,
  latency, cost) buys nothing there (doctrine: "do not waste 8 passes
  on a trivial change").
- **When a deterministic tool answers the question.** Existence,
  syntax, types, imports, paths, exact strings — grep/tsc/tests are
  cheaper AND more reliable than any model pass (§169).
- **Sensitive data without isolation** — routing PII across several
  models/providers multiplies exposure; keep such tasks on one trusted
  model.
- **Hard budget/latency ceilings** — every expert is a separate model
  call; cost and latency scale with roles. Use the budget fields and
  `OptimizationEngine` constraints, or don't start.
- **When consensus is already guaranteed by construction** — if you
  only ever need one canonical transformation with a verified input
  schema, a single pass + compiler check is the right size.

## If you already have a model router — skip the runtime layer

The runtime layer (Model Registry, Resource Placement, Benchmarking) is **OPTIONAL**. If your system already routes models — like NERU's `ModelOrchestrator` (L1/L2/L3, cost/latency routing, circuit breaker, failover) — do **not** implement it: it duplicates your router.

Integrate as a thin layer on top:

1. Implement only the `ModelRouter` port as an adapter that calls your router: `ModelOrchestrator.run(prompt, { preferLayer, requiresStructured })`.
2. Treat `Expert.modelId` as a **routing hint** (the role), not a hard pin — the router picks the actual model per call.
3. Drop `health()` — your router's circuit breaker already handles health/failover.

Reference adapter: `NeruModelRouterAdapter` (NERU repo) does exactly this — composition is the value, runtime is delegated to the router.

## 8. VERIFY (commands that were actually run)

```bash
cd /Users/nerudek/Downloads/NERU_Agent/moa
npm install                 # typescript ^5, @types/node ^22 (3 pkgs)
npx tsc --noEmit            # === TSC PASS (strict, ES2022)
npx -y tsx example/minimal-example.ts   # output in section 5
```

## 9. SOURCE MAP

```
moa/
├── src/                        # Layer A — the engine (compiles, strict)
│   ├── index.ts                # barrel export
│   ├── types.ts                # ALL types: Expert..CompositionResult, ports
│   ├── ExpertRegistry.ts       # expert catalog
│   ├── core/CompositionEngine.ts   # staged orchestration loop
│   ├── core/ExpertExecutor.ts      # hardened single-expert execution
│   ├── core/Aggregator.ts          # 6 aggregation strategies
│   ├── core/ConsensusEngine.ts     # agreement*0.45+evidence*0.40+indep*0.15
│   ├── core/VerificationEngine.ts  # docs ground-truth gate
│   ├── scheduling/ResourceScheduler.ts  # heterogeneous workers
│   ├── security/ToolPolicy.ts     # per-expert tool allowlist
│   ├── evaluation/{EvaluationEngine,Evaluators}.ts
│   ├── experiments/{BenchmarkRunner,Deduplication,ExperimentStore}.ts
│   ├── optimization/{OptimizationEngine,VersionManager}.ts
│   ├── observability/AuditLogger.ts
│   ├── utils/Hash.ts              # stableStringify/sha256/fingerprint
│   └── adapters/Interfaces.ts     # ports to implement
├── example/minimal-example.ts  # verified end-to-end run (section 5)
├── docs.md                     # Layer B doctrine (1979 lines)
├── examples.md                 # example corpus (1356 lines)
├── tests.md                    # gate/consensus test logic
├── neru/integration.ts         # Hermes kernel/orchestrator reference
└── references/                 # THIS SKILL's full material
    ├── architecture.md         # complete doctrine
    ├── examples.md             # complete examples
    └── api-reference.md        # complete API
```

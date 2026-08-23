# Multiple Models, One Task

**Your LLM reviews its own code — and misses the same bugs it wrote. This splits one task across *different* models so a coder writes, a critic catches, a judge checks. No single model's blind spot becomes your bug.**

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
                       JUDGE   ← verifies against the task
                          │
                          ▼
                      SYNTHESIS → final answer
```

![diagram](diagram.svg)

## Why this matters

One model doing everything is one set of blind spots. In a real run:

```typescript
// coder produced this — clean field validation
// critic (a DIFFERENT model) caught what it missed:
//   ✗ duplicate machines allowed
//   ✗ 0.0.0.0 / 127.0.0.1 accepted as machine IPs
//   ✗ array-as-element gives a misleading error
// synthesis produced the fixed, production-grade version
```

The critic found 8 real issues the coder couldn't see — because they're **different models, not one model role-playing.**

## What you get

- **Per-expert model assignment** — coder runs a coding model, critic a generalist, judge a reasoner. Not one model pretending.
- **Dependency graph** — experts run in parallel, respect `dependsOn`, converge on a judge.
- **Consensus gate** — nothing reaches you without passing the judge.
- **Compiling reference implementation** — `src/`, 20 files, `tsc --strict` passes.

## Read the manual

- **[SKILL.md](SKILL.md)** — the operating manual (architecture, doctrine, working example, pitfalls)
- **[references/](references/)** — full doctrine (106KB) + example corpus + API reference

## Try it, then tell us

Does per-expert assignment actually beat one strong model? Does the judge catch real bugs? Open an issue with your before/after.

MIT

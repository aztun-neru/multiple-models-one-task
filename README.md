# Mixture-of-Agents (MoA)

**Stop asking one model to "pretend to be 3 people." Route each role to the model that's actually good at it — then judge the result before it ships.**

MoA decomposes a task into expert roles (researcher, coder, critic), assigns a *different* model to each, runs them in parallel through a dependency graph, and a judge + synthesizer produce the final answer.

## Why it matters

A single LLM role-playing multiple experts is still **one model with one blind spot**. When the "coder" and the "critic" are the same weights, the critic can't catch what the coder missed — they share the same blind spot.

MoA makes the experts real:

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
                       JUDGE
                          │
                          ▼
                      SYNTHESIS → final answer
```

## Before vs after (measured)

| | One model pretending | MoA (coder + critic + judge) |
|---|---|---|
| Code review | nobody checks the code | critic finds real bugs before you ship |
| Blind spots | one model's weakness = your bug | a different model catches it |
| Example | `parseClusterConfig` passed fields but allowed duplicate machines + reserved IPs | critic flagged 8 issues → synthesis fixed them → production-grade |

## Real example

Task: `parseClusterConfig(json)` — parse + validate a cluster config.

1. **Coder** (a local Qwen 27B) wrote clean field validation in 3s — but no uniqueness check, no reserved-IP rejection.
2. **Critic** (a different model) found 8 concrete issues: duplicate names/IPs allowed, `0.0.0.0`/`127.0.0.1` accepted as machine addresses, array-as-element giving a misleading error.
3. **Synthesis** produced the fixed version.

**The combination beat either model alone** — the coder's speed plus the critic's different blind spot = better than one model doing both jobs.

## Contents

- `SKILL.md` — the full skill (architecture, per-expert assignment, execution modes, pitfalls)
- `references/diagram-prompt.md` — a prompt to generate the diagram with a local image model (SDXL/Flux/ComfyUI)
- `diagram.svg` — ready-to-use dark SVG diagram (below)

![Mixture-of-Agents diagram](diagram.svg)

## Install

```bash
cp -r . ~/.hermes/skills/mixture-of-agents/
```

## License

MIT

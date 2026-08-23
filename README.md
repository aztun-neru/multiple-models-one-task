# moa-mixture-of-agents

A Hermes Agent skill describing the **Mixture-of-Agents (MoA)** pattern: decompose a task into expert roles, assign a *different* model to each expert, execute them via a dependency graph (parallel / sequential / hybrid), then judge + synthesize the result.

## What it solves

A single LLM role-playing several experts ("you are now 3 people") is just prompt engineering. MoA actually routes each sub-task to the model best suited for it — a coder model writes code, a strong generalist critiques it, a reasoner synthesizes — then a judge checks the output before it reaches the user.

## Core idea

```
TASK
 ├── RESEARCH → reasoner-model
 ├── CODER    → coder-model
 ├── CRITIC   → strong-generalist
 └── SYNTH    → another-model
```

Model assignment is **per expert**, not global.

## Contents

- `SKILL.md` — the full skill: architecture (compose + runtime layers), the per-expert assignment pattern, execution modes, pitfalls, and a minimal integration skeleton.

## Install

```bash
# copy into your Hermes skills directory
cp SKILL.md ~/.hermes/skills/moa-mixture-of-agents/
```

## License

MIT — see the parent project (NERU) for details.

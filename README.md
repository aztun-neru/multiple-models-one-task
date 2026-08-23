# Multiple Models, One Task

Run one task through multiple specialized models — researcher, coder, critic, judge, synthesizer — each on a different model, with a consensus gate before the answer reaches you.

The full operating manual is in [`SKILL.md`](SKILL.md). The reference material (complete orchestration doctrine, the full example corpus, and the API reference) is in [`references/`](references/). A compiling TypeScript implementation is in [`src/`](src/).

## Layout

- `SKILL.md` — the operating manual: why this exists, the two-layer architecture, every module, the orchestration doctrine, a minimal working example, pitfalls, and the verification commands that were actually run.
- `references/architecture.md` — the complete doctrine: task lifecycle, state machine, roles, evidence rules, consensus gates, memory.
- `references/examples.md` — the full example corpus: role prompts, evidence packs, routing decisions, JSON schemas, disagreements.
- `references/api-reference.md` — every export in `src/`.
- `src/` — 20 TypeScript files; `tsc --noEmit` passes with `--strict`.

## Verification

If you try this: does per-expert assignment beat a single model? Does the judge catch real bugs? Open an issue with your before/after — especially on tasks where you *expected* one strong model to be enough.

## License

MIT

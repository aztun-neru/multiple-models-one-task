import { AggregationStrategy, Proposal } from "../types";

export interface SynthesisExecutor {
  synthesize(
    instruction: string,
    proposals: Proposal[],    context?: unknown
  ): Promise<unknown>;
}

export class Aggregator {
  constructor(private readonly synthesis?: SynthesisExecutor) {}

  async aggregate(
    strategy: AggregationStrategy | undefined,
    proposals: Proposal[],
    context?: unknown
  ): Promise<unknown> {
    const valid = proposals.filter(p => p.success);
    if (!valid.length) return undefined;

    if (strategy === "best") {
      return [...valid].sort(
        (a, b) => b.confidence - a.confidence
      )[0].output;
    }

    if (strategy === "weighted") {
      return valid.map(p => ({
        expertId: p.expertId,
        weight: p.confidence,
        output: p.output
      }));
    }

    if (strategy === "consensus") {
      return {
        type: "candidate-set",
        proposals: valid.map(p => ({
          expertId: p.expertId,
          output: p.output
        }))
      };
    }

    if (strategy === "evidence") {
      return valid.map(p => ({
        expertId: p.expertId,
        output: p.output,
        evidence: p.evidence ?? []
      }));
    }

    if (
      strategy === "synthesis" ||
      strategy === "judge"
    ) {
      if (!this.synthesis) {
        throw new Error("SynthesisExecutor is required for this strategy");
      }

      return this.synthesis.synthesize(
        strategy === "judge"
          ? "Judge the proposals against requirements. Identify contradictions and unsupported claims. Return the best candidate and reasons."
          : "Synthesize a final solution from the proposals. Preserve verified evidence and do not invent APIs, facts or requirements.",
        valid,
        context
      );
    }

    return valid[0].output;
  }
}
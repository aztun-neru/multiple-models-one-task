import {
  BenchmarkResult,
  Candidate,
  CompositionPlan
} from "../types";

export interface OptimizationConstraints {
  minimumScore?: number;
  minimumPassRate?: number;
  maximumLatencyMs?: number;
  maximumTokens?: number;
  maximumCost?: number;
}

export class OptimizationEngine {
  rank(
    candidates: Candidate[],
    constraints: OptimizationConstraints = {}
  ): Candidate[] {
    return candidates
      .filter(c => this.accepted(c.benchmark, constraints))
      .sort(
        (a, b) => this.utility(b.benchmark) - this.utility(a.benchmark)
      );
  }

  best(
    candidates: Candidate[],
    constraints: OptimizationConstraints = {}
  ): Candidate | undefined {
    return this.rank(candidates, constraints)[0];
  }

  generateVariants(base: CompositionPlan): CompositionPlan[] {
    const clone = () => structuredClone(base);

    return [
      { ...clone(), version: `${base.version}-critic` },
      {
        ...clone(),
        version: `${base.version}-consensus`,
        minimumConsensus: base.minimumConsensus ?? 0.8
      },
      { ...clone(), version: `${base.version}-verification` },
      {
        ...clone(),
        version: `${base.version}-budgeted`,
        budget: {
          ...base.budget,
          maxExpertCalls: base.budget?.maxExpertCalls ?? 8
        }
      }
    ];
  }

  private accepted(
    b: BenchmarkResult,
    c: OptimizationConstraints
  ): boolean {
    if (c.minimumScore !== undefined && b.averageScore < c.minimumScore) return false;
    if (c.minimumPassRate !== undefined && b.passRate < c.minimumPassRate) return false;
    if (c.maximumLatencyMs !== undefined && b.averageLatencyMs > c.maximumLatencyMs) return false;
    if (c.maximumTokens !== undefined && b.averageTokens > c.maximumTokens) return false;
    if (c.maximumCost !== undefined && b.totalCost > c.maximumCost) return false;
    return true;
  }

  private utility(b: BenchmarkResult): number {
    return (
      b.averageScore * 0.55 +
      b.passRate * 0.30 +
      (1 / (1 + b.averageLatencyMs / 10000)) * 0.10 +
      (1 / (1 + b.averageTokens / 10000)) * 0.05
    );
  }
}
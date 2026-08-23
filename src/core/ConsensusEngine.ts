import { Proposal } from "../types";
import { stableStringify } from "../utils/Hash";

export interface ConsensusResult {
  score: number;
  agreement: number;
  evidenceScore: number;
  independentSupport: number;
}

export class ConsensusEngine {
  evaluate(proposals: Proposal[]): ConsensusResult {
    const valid = proposals.filter(p => p.success);

    if (!valid.length) {
      return { score: 0, agreement: 0, evidenceScore: 0, independentSupport: 0 };
    }

    const counts = new Map<string, number>();
    for (const p of valid) {
      const key = stableStringify(p.output);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const agreement = Math.max(...counts.values()) / valid.length;

    const evidenceScore = valid.reduce((sum, p) => {
      const e = p.evidence ?? [];
      if (!e.length) return sum;
      return sum + e.reduce(
        (x, item) => x + (item.verified ? (item.confidence ?? 1) : 0),
        0
      ) / e.length;
    }, 0) / valid.length;

    const independentSupport =
      new Set(valid.map(p => p.expertId)).size / valid.length;

    return {
      agreement,
      evidenceScore,
      independentSupport,
      score:
        agreement * 0.45 +
        evidenceScore * 0.40 +
        independentSupport * 0.15
    };
  }
}
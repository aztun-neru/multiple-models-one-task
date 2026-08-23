import {
  CompositionResult,
  DocumentationProvider,
  Failure,
  Proposal
} from "../types";

export interface VerificationReport {
  passed: boolean;
  score: number;
  failures: Failure[];
  evidence: unknown[];
}

export class VerificationEngine {
  constructor(
    private readonly docs?: DocumentationProvider
  ) {}

  async verify(
    result: CompositionResult,
    query: string
  ): Promise<VerificationReport> {
    if (!this.docs) {
      return {
        passed: false,
        score: 0,
        failures: [{
          code: "DOCUMENTATION_MISMATCH",
          message: "No authoritative documentation provider configured",
          retryable: false
        }],
        evidence: []
      };
    }

    const verification =
      await this.docs.verify(query, result.output);

    return {
      passed: verification.verified,
      score: verification.score,
      failures: verification.failures,
      evidence: verification.evidence
    };
  }
}
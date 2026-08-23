import {
  CompositionResult,
  Evaluator,
  EvaluationCriterion,
  EvaluationResult,
  Task
} from "../types";

export class EvaluationEngine {
  constructor(private readonly evaluators: Evaluator[]) {}

  async evaluate(
    task: Task,
    result: CompositionResult
  ): Promise<EvaluationResult> {
    const criteria: EvaluationCriterion[] = [];

    for (const evaluator of this.evaluators) {
      const value = await evaluator.evaluate(task, result);

      criteria.push({
        id: evaluator.id,
        score: Math.max(0, Math.min(1, value.score)),
        weight: evaluator.weight,
        passed: value.passed,
        evidence: value.evidence
      });
    }

    const totalWeight =
      criteria.reduce((s, c) => s + c.weight, 0);

    const score = totalWeight
      ? criteria.reduce(
          (s, c) => s + c.score * c.weight, 0
        ) / totalWeight
      : 0;

    return {
      score,
      passed: score >= 0.8 && criteria.every(c => c.passed),
      criteria,
      failures: criteria
        .filter(c => !c.passed)
        .map(c => c.id)
    };
  }
}
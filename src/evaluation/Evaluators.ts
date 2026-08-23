import { Evaluator } from "../types";

export const ExecutionEvaluator: Evaluator = {
  id: "execution-success",
  weight: 1,
  async evaluate(_task, result) {
    return {
      score: result.success ? 1 : 0,
      passed: result.success
    };
  }
};

export const APIAccuracyEvaluator: Evaluator = {
  id: "api-accuracy",
  weight: 3,
  async evaluate() {
    return {
      score: 0,
      passed: false,
      evidence: {
        reason:
          "Connect this evaluator to authoritative documentation/source."
      },
      failure: "Authoritative API verification is not configured."
    };
  }
};

export const RequirementCoverageEvaluator: Evaluator = {
  id: "requirement-coverage",
  weight: 2,
  async evaluate(task, result) {
    if (!result.success) {
      return { score: 0, passed: false };
    }

    return {
      score: task.expected === undefined ? 0.8 : 0.7,
      passed: true,
      evidence: {
        note:
          "Replace with a domain-specific requirement checker for production."
      }
    };
  }
};
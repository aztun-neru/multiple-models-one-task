import {
  BenchmarkResult,
  CompositionPlan,
  ExperimentResult,
  ExperimentStore,
  Task
} from "../types";
import { CompositionEngine } from "../core/CompositionEngine";
import { EvaluationEngine } from "../evaluation/EvaluationEngine";
import { runFingerprint } from "../utils/Hash";

export class BenchmarkRunner {
  constructor(
    private readonly composition: CompositionEngine,
    private readonly evaluation: EvaluationEngine,
    private readonly store: ExperimentStore
  ) {}

  async run(
    benchmarkId: string,
    tasks: Task[],
    plan: CompositionPlan,
    seed = 42
  ): Promise<BenchmarkResult> {
    const started = performance.now();
    const results: ExperimentResult[] = [];

    for (const task of tasks) {
      const fingerprint = runFingerprint(task, plan, seed);
      const cached = await this.store.getByFingerprint(fingerprint);

      if (cached) {
        results.push(cached);
        continue;
      }

      const composition =
        await this.composition.execute(task, plan, seed);

      const evaluation =
        await this.evaluation.evaluate(task, composition);

      const experiment: ExperimentResult = {
        experimentId: crypto.randomUUID(),
        taskId: task.id,
        planId: plan.id,
        planVersion: plan.version,
        fingerprint,
        composition,
        evaluation,
        timestamp: Date.now()
      };

      await this.store.saveExperiment(experiment);
      results.push(experiment);
    }

    const averageScore = results.length
      ? results.reduce((s, r) => s + r.evaluation.score, 0) / results.length
      : 0;

    const passRate = results.length
      ? results.filter(r => r.evaluation.passed).length / results.length
      : 0;

    const benchmark: BenchmarkResult = {
      benchmarkId,
      planId: plan.id,
      planVersion: plan.version,
      tasks: results,
      averageScore,
      passRate,
      averageLatencyMs: results.length
        ? results.reduce(
            (s, r) => s + r.composition.durationMs, 0
          ) / results.length
        : 0,
      averageTokens: results.length
        ? results.reduce(
            (s, r) => s + r.composition.totalTokens, 0
          ) / results.length
        : 0,
      totalCost: results.reduce(
        (s, r) => s + r.composition.totalCost, 0
      ),
      totalDurationMs: performance.now() - started
    };

    await this.store.saveBenchmark(benchmark);
    return benchmark;
  }
}
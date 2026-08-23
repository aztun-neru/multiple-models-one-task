import {
  CompositionDependencies,
  CompositionPlan,
  CompositionResult,
  Failure,
  Proposal,
  Task
} from "../types";
import { ExpertRegistry } from "../ExpertRegistry";
import { ExpertExecutor } from "./ExpertExecutor";
import { Aggregator } from "./Aggregator";
import { ConsensusEngine } from "./ConsensusEngine";
import { VerificationEngine } from "./VerificationEngine";
import { runFingerprint } from "../utils/Hash";

export class CompositionEngine {
  constructor(
    private readonly registry: ExpertRegistry,
    private readonly executor: ExpertExecutor,
    private readonly aggregator: Aggregator,
    private readonly consensus: ConsensusEngine,
    private readonly dependencies: CompositionDependencies,
    private readonly verifier: VerificationEngine
  ) {}

  async execute(
    task: Task,
    plan: CompositionPlan,
    seed: number
  ): Promise<CompositionResult> {
    const runId = crypto.randomUUID();
    const fingerprint = runFingerprint(task, plan, seed);
    const started = performance.now();

    const stages = [];
    const proposals: Proposal[] = [];
    const failures: Failure[] = [];
    let context: unknown = task.context;
    let totalTokens = 0;
    let totalCost = 0;
    let expertCalls = 0;

    for (const stage of plan.stages) {
      const stageProposals: Proposal[] = [];

      if (stage.strategy === "parallel") {
        const results = await Promise.all(
          stage.experts.map(async id => {
            const expert = this.registry.get(id);
            expertCalls++;

            const p = await this.executor.execute(
              expert,
              task.prompt,
              context,
              stage.timeoutMs,
              seed
            );

            if (!p.success && stage.fallbackOnFailure) {
              return this.executeFallback(
                expert.fallbackExpertIds ?? [],
                task.prompt,
                context,
                stage.timeoutMs,
                seed
              );
            }

            return p;
          })
        );
        stageProposals.push(...results);
      } else {
        for (const id of stage.experts) {
          const expert = this.registry.get(id);
          expertCalls++;

          let p = await this.executor.execute(
            expert,
            task.prompt,
            context,
            stage.timeoutMs,
            seed
          );

          if (!p.success && stage.fallbackOnFailure) {
            p = await this.executeFallback(
              expert.fallbackExpertIds ?? [],
              task.prompt,
              context,
              stage.timeoutMs,
              seed
            );
          }

          stageProposals.push(p);

          if (p.success) {
            context = {
              previousExpert: p.expertId,
              previousOutput: p.output
            };
          }

          if (!p.success && stage.required !== false) break;
        }
      }

      proposals.push(...stageProposals);

      const stageFailures = stageProposals.flatMap(
        p => p.failures ?? []
      );
      failures.push(...stageFailures);

      totalTokens += stageProposals.reduce(
        (s, p) => s + (p.tokens ?? 0), 0
      );
      totalCost += stageProposals.reduce(
        (s, p) => s + (p.cost ?? 0), 0
      );

      const output = await this.aggregator.aggregate(
        stage.aggregation,
        stageProposals,
        context
      );

      if (output !== undefined) context = output;

      stages.push({
        stageId: stage.id,
        proposals: stageProposals,
        output,
        success: stageProposals.some(p => p.success),
        failures: stageFailures
      });

      if (
        !this.withinBudget(
          plan,
          totalTokens,
          totalCost,
          performance.now() - started,
          expertCalls
        )
      ) {
        failures.push({
          code: "BUDGET_EXCEEDED",
          message: "Composition budget exceeded",
          retryable: false
        });
        break;
      }
    }

    let output = await this.aggregator.aggregate(
      plan.finalAggregation,
      proposals,
      context
    );

    let verification = await this.verifier.verify(
      { taskId: task.id, planId: plan.id, planVersion: plan.version,
        runId, fingerprint, seed, success: true, output, stages,
        proposals, durationMs: 0, totalTokens, totalCost, failures },
      task.prompt
    );

    if (!verification.passed) {
      failures.push(...verification.failures);
    }

    const consensus = this.consensus.evaluate(proposals);

    const success =
      stages.every(s => s.success || s.failures.length === 0) &&
      verification.passed &&
      (
        plan.minimumConsensus === undefined ||
        consensus.score >= plan.minimumConsensus
      ) &&
      failures.every(f => f.code !== "BUDGET_EXCEEDED");

    return {
      taskId: task.id,
      planId: plan.id,
      planVersion: plan.version,
      runId,
      fingerprint,
      seed,
      success,
      output,
      stages,
      proposals,
      durationMs: performance.now() - started,
      totalTokens,
      totalCost,
      failures,
      metadata: {
        consensus,
        verification
      }
    };
  }

  private async executeFallback(
    ids: string[],
    prompt: string,
    context: unknown,
    timeoutMs: number | undefined,
    seed: number
  ): Promise<Proposal> {
    let last: Proposal | undefined;

    for (const id of ids) {
      const expert = this.registry.get(id);
      last = await this.executor.execute(
        expert, prompt, context, timeoutMs, seed
      );
      if (last.success) return last;
    }

    return last ?? {
      expertId: "fallback",
      success: false,
      confidence: 0,
      latencyMs: 0,
      failures: [{
        code: "MODEL_FAILURE",
        message: "No fallback expert available",
        retryable: false
      }]
    };
  }

  private withinBudget(
    plan: CompositionPlan,
    tokens: number,
    cost: number,
    latency: number,
    calls: number
  ): boolean {
    const b = plan.budget;
    if (!b) return true;
    if (b.maxTokens !== undefined && tokens > b.maxTokens) return false;
    if (b.maxCost !== undefined && cost > b.maxCost) return false;
    if (b.maxLatencyMs !== undefined && latency > b.maxLatencyMs) return false;
    if (b.maxExpertCalls !== undefined && calls > b.maxExpertCalls) return false;
    return true;
  }
}
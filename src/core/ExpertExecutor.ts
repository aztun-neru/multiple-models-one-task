import {
  Expert, Failure, ModelRouter, Proposal, ResourceProvider
} from "../types";
import { requirementsForExpert } from "../scheduling/ResourceScheduler";

export interface ExecutorOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

export class ExpertExecutor {
  constructor(
    private readonly router: ModelRouter,
    private readonly resources?: ResourceProvider,
    private readonly options: ExecutorOptions = {}
  ) {}

  async execute(
    expert: Expert,
    prompt: string,
    context: unknown,
    timeoutMs: number | undefined,
    seed: number
  ): Promise<Proposal> {
    const started = performance.now();
    const maxRetries = this.options.maxRetries ?? 2;
    let lastFailure: Failure = {
      code: "UNKNOWN",
      message: "Execution failed"
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let reservationId: string | undefined;

      try {
        if (this.router.health) {
          const healthy = await this.router.health(
            expert.modelId,
            expert.workerPreference?.[0]
          );
          if (!healthy) {
            throw failure("WORKER_FAILURE", "Model/worker health check failed", true);
          }
        }

        if (this.resources) {
          const reservation = await this.resources.reserve(
            requirementsForExpert(expert),
            expert.workerPreference
          );

          if (!reservation) {
            throw failure(
              "WORKER_FAILURE",
              "No compatible worker capacity available",
              true
            );
          }

          reservationId = reservation.id;
        }

        const workerId = reservationId
          ? (await this.resources!.listWorkers()).find(
              w => w.activeJobs > 0
            )?.id
          : expert.workerPreference?.[0];

        const response = await withTimeout(
          this.router.execute({
            modelId: expert.modelId,
            workerId,
            prompt,
            context,
            timeoutMs,
            seed
          }),
          timeoutMs
        );

        return {
          expertId: expert.id,
          modelId: expert.modelId,
          workerId,
          success: true,
          output: response.output,
          confidence: expert.reliability,
          latencyMs: performance.now() - started,
          tokens: response.tokens,
          cost: response.cost,
          metadata: response.metadata
        };
      } catch (error) {
        lastFailure = normalizeFailure(error);

        if (
          !lastFailure.retryable ||
          attempt === maxRetries
        ) break;

        await sleep(this.options.retryDelayMs ?? 250 * (attempt + 1));
      } finally {
        if (reservationId && this.resources) {
          await this.resources.release(reservationId);
        }
      }
    }

    return {
      expertId: expert.id,
      modelId: expert.modelId,
      success: false,
      confidence: 0,
      latencyMs: performance.now() - started,
      failures: [lastFailure]
    };
  }
}

function failure(
  code: Failure["code"],
  message: string,
  retryable = false
): Error & { failure: Failure } {
  const e = new Error(message) as Error & { failure: Failure };
  e.failure = { code, message, retryable };
  return e;
}

function normalizeFailure(error: unknown): Failure {
  if (
    error &&
    typeof error === "object" &&
    "failure" in error
  ) {
    return (error as { failure: Failure }).failure;
  }

  const message = error instanceof Error ? error.message : String(error);
  const code: Failure["code"] =
    /timeout/i.test(message) ? "TIMEOUT" :
    /oom|out of memory/i.test(message) ? "OOM" :
    /worker|capacity|health/i.test(message) ? "WORKER_FAILURE" :
    "MODEL_FAILURE";

  return {
    code,
    message,
    retryable: code !== "OOM"
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs?: number
): Promise<T> {
  if (!timeoutMs) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(failure(
        "TIMEOUT",
        `Execution timeout after ${timeoutMs}ms`,
        true
      )),
      timeoutMs
    );

    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
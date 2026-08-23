import {
  Expert,
  ResourceProvider,
  ResourceRequirement,
  WorkerReservation
} from "../types";

export class InMemoryResourceScheduler implements ResourceProvider {
  private workers = new Map<string, {
    id: string;
    name: string;
    resources: Record<string, number>;
    capacity: number;
    activeJobs: number;
    status: "online" | "offline" | "degraded";
  }>();

  private reservations = new Map<string, string>();

  registerWorker(worker: {
    id: string;
    name: string;
    resources: Record<string, number>;
    capacity: number;
    activeJobs?: number;
    status?: "online" | "offline" | "degraded";
  }): void {
    this.workers.set(worker.id, {
      ...worker,
      activeJobs: worker.activeJobs ?? 0,
      status: worker.status ?? "online"
    });
  }

  async listWorkers() {
    return [...this.workers.values()].map(x => structuredClone(x));
  }

  async reserve(
    requirements: ResourceRequirement[],
    preferredWorkers: string[] = []
  ): Promise<WorkerReservation | undefined> {
    const candidates = [...this.workers.values()]
      .filter(w => w.status !== "offline" && w.activeJobs < w.capacity)
      .sort((a, b) => {
        const ap = preferredWorkers.indexOf(a.id);
        const bp = preferredWorkers.indexOf(b.id);
        return (ap < 0 ? 999 : ap) - (bp < 0 ? 999 : bp);
      });

    for (const worker of candidates) {
      if (!this.matches(worker.resources, requirements)) continue;

      worker.activeJobs++;
      const id = crypto.randomUUID();
      this.reservations.set(id, worker.id);
      return { id, workerId: worker.id };
    }

    return undefined;
  }

  async release(reservationId: string): Promise<void> {
    const workerId = this.reservations.get(reservationId);
    if (!workerId) return;

    const worker = this.workers.get(workerId);
    if (worker) worker.activeJobs = Math.max(0, worker.activeJobs - 1);

    this.reservations.delete(reservationId);
  }

  private matches(
    resources: Record<string, number>,
    requirements: ResourceRequirement[]
  ): boolean {
    return requirements.every(req => {
      if (!req.minimum) return true;
      const key = req.key ?? req.type;
      return (resources[key] ?? 0) >= req.minimum;
    });
  }
}

export function requirementsForExpert(
  expert: Expert
): ResourceRequirement[] {
  return expert.resourceRequirements ?? [];
}
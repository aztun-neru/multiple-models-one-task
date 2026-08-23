import { Expert } from "./types";

export class ExpertRegistry {
  private experts = new Map<string, Expert>();

  register(expert: Expert): void {
    if (this.experts.has(expert.id)) {
      throw new Error(`Expert already registered: ${expert.id}`);
    }
    this.validate(expert);
    this.experts.set(expert.id, structuredClone(expert));
  }

  upsert(expert: Expert): void {
    this.validate(expert);
    this.experts.set(expert.id, structuredClone(expert));
  }

  get(id: string): Expert {
    const expert = this.experts.get(id);
    if (!expert) throw new Error(`Expert not found: ${id}`);
    return structuredClone(expert);
  }

  list(): Expert[] {
    return [...this.experts.values()].map(x => structuredClone(x));
  }

  private validate(e: Expert): void {
    if (e.reliability < 0 || e.reliability > 1) {
      throw new Error(`Reliability must be 0..1: ${e.id}`);
    }
    if (!e.modelId) throw new Error(`Missing modelId: ${e.id}`);
  }
}
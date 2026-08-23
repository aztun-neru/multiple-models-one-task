import { CompositionPlan } from "../types";

export class VersionManager {
  private active?: CompositionPlan;
  private history: CompositionPlan[] = [];

  initialize(plan: CompositionPlan): void {
    if (this.active) throw new Error("Already initialized");
    this.promote(plan);
  }

  getActive(): CompositionPlan {
    if (!this.active) throw new Error("No active plan");
    return structuredClone(this.active);
  }

  promote(plan: CompositionPlan): void {
    this.active = structuredClone(plan);
    this.history.push(structuredClone(plan));
  }

  rollback(): CompositionPlan {
    if (this.history.length < 2) {
      throw new Error("No previous plan version");
    }

    this.history.pop();
    this.active =
      structuredClone(this.history[this.history.length - 1]);

    return this.getActive();
  }

  list(): CompositionPlan[] {
    return this.history.map(x => structuredClone(x));
  }
}
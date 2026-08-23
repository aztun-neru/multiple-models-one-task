import { ExperimentResult, ExperimentStore } from "../types";

export class ResultCache {
  constructor(
    private readonly store: ExperimentStore,
    private readonly ttlMs = 24 * 60 * 60 * 1000
  ) {}

  async get(
    fingerprint: string
  ): Promise<ExperimentResult | undefined> {
    const result = await this.store.getByFingerprint(fingerprint);
    if (!result) return undefined;

    if (
      Date.now() - result.timestamp > this.ttlMs
    ) return undefined;

    return result;
  }
}
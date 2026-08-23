import {
  BenchmarkResult,
  ExperimentResult,
  ExperimentStore as Contract
} from "../types";

export class InMemoryExperimentStore implements Contract {
  private experiments = new Map<string, ExperimentResult>();
  private fingerprints = new Map<string, string>();
  private benchmarks: BenchmarkResult[] = [];

  async saveExperiment(result: ExperimentResult): Promise<void> {
    this.experiments.set(result.experimentId, structuredClone(result));
    this.fingerprints.set(
      result.fingerprint,
      result.experimentId
    );
  }

  async saveBenchmark(result: BenchmarkResult): Promise<void> {
    this.benchmarks.push(structuredClone(result));
  }

  async getByFingerprint(
    fingerprint: string
  ): Promise<ExperimentResult | undefined> {
    const id = this.fingerprints.get(fingerprint);
    if (!id) return undefined;
    return this.getExperiment(id);
  }

  async getExperiment(
    id: string
  ): Promise<ExperimentResult | undefined> {
    const result = this.experiments.get(id);
    return result ? structuredClone(result) : undefined;
  }

  async listBenchmarks(id?: string): Promise<BenchmarkResult[]> {
    return this.benchmarks
      .filter(b => !id || b.benchmarkId === id)
      .map(x => structuredClone(x));
  }
}
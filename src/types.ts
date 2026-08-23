export type AggregationStrategy =
  | "best"
  | "weighted"
  | "consensus"
  | "synthesis"
  | "judge"
  | "evidence";

export type ExecutionStrategy = "parallel" | "sequential";

export type ExpertStatus =
  | "available"
  | "busy"
  | "offline"
  | "degraded";

export type FailureCode =
  | "TIMEOUT"
  | "OOM"
  | "WORKER_FAILURE"
  | "MODEL_FAILURE"
  | "INVALID_OUTPUT"
  | "API_HALLUCINATION"
  | "MISSING_REQUIREMENT"
  | "ARCHITECTURE_ERROR"
  | "IMPLEMENTATION_ERROR"
  | "DOCUMENTATION_MISMATCH"
  | "CONTEXT_LOSS"
  | "TOOL_POLICY_DENIED"
  | "SECURITY_VIOLATION"
  | "BUDGET_EXCEEDED"
  | "LOW_CONFIDENCE"
  | "CONFLICTING_EXPERTS"
  | "UNKNOWN";

export interface ResourceRequirement {
  type: "vram" | "ram" | "cpu" | "gpu" | "worker" | "custom";
  minimum?: number;
  unit?: string;
  key?: string;
}

export interface Worker {
  id: string;
  name: string;
  resources: Record<string, number>;
  capacity: number;
  activeJobs: number;
  status: "online" | "offline" | "degraded";
  metadata?: Record<string, unknown>;
}

export interface Expert {
  id: string;
  role: string;
  modelId: string;
  workerPreference?: string[];
  capabilities: string[];
  specializations: string[];
  reliability: number;
  status: ExpertStatus;
  resourceRequirements?: ResourceRequirement[];
  fallbackExpertIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  category: string;
  prompt: string;
  expected?: unknown;
  context?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Evidence {
  source: string;
  claim?: string;
  confidence?: number;
  verified?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Failure {
  code: FailureCode;
  message: string;
  expertId?: string;
  workerId?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Proposal {
  expertId: string;
  modelId?: string;
  workerId?: string;
  success: boolean;
  output?: unknown;
  confidence: number;
  latencyMs: number;
  tokens?: number;
  cost?: number;
  evidence?: Evidence[];
  failures?: Failure[];
  metadata?: Record<string, unknown>;
}

export interface CompositionStage {
  id: string;
  strategy: ExecutionStrategy;
  experts: string[];
  aggregation?: AggregationStrategy;
  required?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  fallbackOnFailure?: boolean;
}

export interface CompositionPlan {
  id: string;
  version: string;
  stages: CompositionStage[];
  finalAggregation: AggregationStrategy;
  maxIterations?: number;
  minimumConsensus?: number;
  budget?: Budget;
  metadata?: Record<string, unknown>;
}

export interface Budget {
  maxTokens?: number;
  maxCost?: number;
  maxLatencyMs?: number;
  maxExpertCalls?: number;
}

export interface StageResult {
  stageId: string;
  proposals: Proposal[];
  output?: unknown;
  success: boolean;
  failures: Failure[];
}

export interface CompositionResult {
  taskId: string;
  planId: string;
  planVersion: string;
  runId: string;
  fingerprint: string;
  seed: number;
  success: boolean;
  output?: unknown;
  stages: StageResult[];
  proposals: Proposal[];
  durationMs: number;
  totalTokens: number;
  totalCost: number;
  failures: Failure[];
  metadata?: Record<string, unknown>;
}

export interface EvaluationCriterion {
  id: string;
  score: number;
  weight: number;
  passed: boolean;
  evidence?: unknown;
}

export interface Evaluator {
  id: string;
  weight: number;
  evaluate(
    task: Task,
    result: CompositionResult
  ): Promise<{
    score: number;
    passed: boolean;
    evidence?: unknown;
    failure?: string;
  }>;
}

export interface EvaluationResult {
  score: number;
  passed: boolean;
  criteria: EvaluationCriterion[];
  failures: string[];
  notes?: string[];
}

export interface ExperimentResult {
  experimentId: string;
  taskId: string;
  planId: string;
  planVersion: string;
  fingerprint: string;
  composition: CompositionResult;
  evaluation: EvaluationResult;
  timestamp: number;
}

export interface BenchmarkResult {
  benchmarkId: string;
  planId: string;
  planVersion: string;
  tasks: ExperimentResult[];
  averageScore: number;
  passRate: number;
  averageLatencyMs: number;
  averageTokens: number;
  totalCost: number;
  totalDurationMs: number;
}

export interface Candidate {
  plan: CompositionPlan;
  benchmark: BenchmarkResult;
}

export interface ModelExecutionRequest {
  modelId: string;
  workerId?: string;
  prompt: string;
  context?: unknown;
  timeoutMs?: number;
  seed?: number;
  metadata?: Record<string, unknown>;
}

export interface ModelExecutionResponse {
  output: unknown;
  tokens?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

export interface ModelRouter {
  execute(request: ModelExecutionRequest): Promise<ModelExecutionResponse>;
  health?(modelId: string, workerId?: string): Promise<boolean>;
}

export interface ResourceProvider {
  listWorkers(): Promise<Worker[]>;
  reserve(
    requirements: ResourceRequirement[],
    preferredWorkers?: string[]
  ): Promise<WorkerReservation | undefined>;
  release(reservationId: string): Promise<void>;
}

export interface WorkerReservation {
  id: string;
  workerId: string;
}

export interface MemoryProvider {
  retrieve(query: string, limit?: number): Promise<unknown>;
}

export interface DocumentationProvider {
  verify(
    query: string,
    candidate: unknown
  ): Promise<DocumentationVerification>;
}

export interface DocumentationVerification {
  verified: boolean;
  score: number;
  evidence: Evidence[];
  failures: Failure[];
}

export interface ToolPolicy {
  canUse(
    tool: string,
    expertId: string,
    task: Task
  ): Promise<boolean>;
}

export interface ExperimentStore {
  saveExperiment(result: ExperimentResult): Promise<void>;
  saveBenchmark(result: BenchmarkResult): Promise<void>;
  getByFingerprint(fingerprint: string): Promise<ExperimentResult | undefined>;
  getExperiment(id: string): Promise<ExperimentResult | undefined>;
  listBenchmarks(id?: string): Promise<BenchmarkResult[]>;
}

export interface CacheEntry {
  fingerprint: string;
  result: ExperimentResult;
  createdAt: number;
  expiresAt?: number;
}

export interface RunPolicy {
  seed?: number;
  deterministic?: boolean;
  cache?: boolean;
  cacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface CompositionDependencies {
  router: ModelRouter;
  resources?: ResourceProvider;
  memory?: MemoryProvider;
  docs?: DocumentationProvider;
  tools?: ToolPolicy;
}

export interface AuditEvent {
  timestamp: number;
  runId?: string;
  type: string;
  data: Record<string, unknown>;
}
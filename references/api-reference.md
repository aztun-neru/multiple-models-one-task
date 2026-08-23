# API Reference — every export in src/


## ExpertRegistry.ts

- `ExpertRegistry`

## core/Aggregator.ts

- `SynthesisExecutor`
- `Aggregator`

## core/CompositionEngine.ts

- `CompositionEngine`

## core/ConsensusEngine.ts

- `ConsensusResult`
- `ConsensusEngine`

## core/ExpertExecutor.ts

- `ExecutorOptions`
- `ExpertExecutor`

## core/VerificationEngine.ts

- `VerificationReport`
- `VerificationEngine`

## evaluation/EvaluationEngine.ts

- `EvaluationEngine`

## evaluation/Evaluators.ts

- `ExecutionEvaluator`
- `APIAccuracyEvaluator`
- `RequirementCoverageEvaluator`

## experiments/BenchmarkRunner.ts

- `BenchmarkRunner`

## experiments/Deduplication.ts

- `ResultCache`

## experiments/ExperimentStore.ts

- `InMemoryExperimentStore`

## observability/AuditLogger.ts

- `AuditLogger`
- `InMemoryAuditLogger`

## optimization/OptimizationEngine.ts

- `OptimizationConstraints`
- `OptimizationEngine`

## optimization/VersionManager.ts

- `VersionManager`

## scheduling/ResourceScheduler.ts

- `InMemoryResourceScheduler`
- `requirementsForExpert`

## security/ToolPolicy.ts

- `StaticToolPolicy`

## types.ts

- `AggregationStrategy`
- `ExecutionStrategy`
- `ExpertStatus`
- `FailureCode`
- `ResourceRequirement`
- `Worker`
- `Expert`
- `Task`
- `Evidence`
- `Failure`
- `Proposal`
- `CompositionStage`
- `CompositionPlan`
- `Budget`
- `StageResult`
- `CompositionResult`
- `EvaluationCriterion`
- `Evaluator`
- `EvaluationResult`
- `ExperimentResult`
- `BenchmarkResult`
- `Candidate`
- `ModelExecutionRequest`
- `ModelExecutionResponse`
- `ModelRouter`
- `ResourceProvider`
- `WorkerReservation`
- `MemoryProvider`
- `DocumentationProvider`
- `DocumentationVerification`
- `ToolPolicy`
- `ExperimentStore`
- `CacheEntry`
- `RunPolicy`
- `CompositionDependencies`
- `AuditEvent`

## utils/Hash.ts

- `stableStringify`
- `sha256`
- `runFingerprint`

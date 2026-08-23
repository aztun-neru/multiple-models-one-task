export type {
  ModelRouter,
  ResourceProvider,
  MemoryProvider,
  DocumentationProvider,
  ExperimentStore,
  ToolPolicy
} from "../types";

/*
Implement these interfaces in Hermes adapters.

Example:

class HermesModelRouter implements ModelRouter {
  async execute(request) {
    // call Hermes ModelOrchestrator / provider registry
  }
}
*/

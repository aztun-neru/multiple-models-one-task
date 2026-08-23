import { Task, ToolPolicy } from "../types";

export class StaticToolPolicy implements ToolPolicy {
  constructor(
    private readonly allowed: Record<string, string[]>
  ) {}

  async canUse(
    tool: string,
    expertId: string,
    _task: Task
  ): Promise<boolean> {
    return (this.allowed[expertId] ?? []).includes(tool);
  }
}
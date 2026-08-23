import { AuditEvent } from "../types";

export interface AuditLogger {
  emit(event: AuditEvent): Promise<void>;
}

export class InMemoryAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  async emit(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}
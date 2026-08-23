import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(
    key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`
  ).join(",")}}`;
}

export function sha256(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

export function runFingerprint(task: unknown, plan: unknown, seed: number): string {
  return sha256({ task, plan, seed });
}

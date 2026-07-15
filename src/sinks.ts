import { appendFileSync } from 'node:fs';
import type { AuditEvent } from './types.js';

/**
 * Append every audit event to a file as one JSON object per line (JSONL) —
 * greppable, jq-able, and ready for any log shipper.
 */
export function jsonlAudit(path: string): (event: AuditEvent) => void {
  return (event) => appendFileSync(path, JSON.stringify(event) + '\n');
}

/** Human-readable audit lines on stdout, for local development. */
export function consoleAudit(): (event: AuditEvent) => void {
  return (event) =>
    console.log(
      `[reins] ${event.decision.toUpperCase().padEnd(7)} ${event.agent} ${event.action} — ${event.reason}`,
    );
}

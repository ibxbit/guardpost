export { createGuard } from './guard.js';
export type { Guard } from './guard.js';
export { allow, deny } from './policy.js';
export type { RuleOptions } from './policy.js';
export { guardTools } from './tools.js';
export type { GuardableTool } from './tools.js';
export { consoleAudit, jsonlAudit } from './sinks.js';
export { DeniedError } from './errors.js';
export type {
  ApprovalRequest,
  AuditEvent,
  CheckResult,
  Effect,
  GuardConfig,
  RateLimit,
  Rule,
} from './types.js';

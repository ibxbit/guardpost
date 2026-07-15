export { createGuard } from './guard.js';
export type { Guard } from './guard.js';
export { allow, deny } from './policy.js';
export type { RuleOptions } from './policy.js';
export { DeniedError } from './errors.js';
export type {
  AuditEvent,
  CheckResult,
  Effect,
  GuardConfig,
  Rule,
} from './types.js';

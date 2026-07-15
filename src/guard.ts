import { DeniedError } from './errors.js';
import { createLimiter } from './limits.js';
import { defaultResult, evaluate } from './policy.js';
import type { AuditEvent, CheckResult, GuardConfig } from './types.js';

export interface Guard {
  /** Check an action against the policies without executing anything. */
  check(action: string, input?: unknown): CheckResult;
  /**
   * Enforce the policies around a tool call: checks the action (including
   * rate limits and human approval), runs `fn` if allowed, throws
   * `DeniedError` if not. Every call is audited.
   */
  execute<T>(action: string, input: unknown, fn: () => T | Promise<T>): Promise<T>;
  /** Wrap a tool function so every call goes through `execute`. */
  protect<I, T>(action: string, fn: (input: I) => T | Promise<T>): (input: I) => Promise<T>;
}

export function createGuard(config: GuardConfig): Guard {
  const {
    agent,
    policies,
    defaultEffect = 'deny',
    audit = () => {},
    logInput = true,
    onApproval,
  } = config;
  const limiter = createLimiter();

  function emit(event: Omit<AuditEvent, 'timestamp' | 'agent'>): void {
    audit({
      timestamp: new Date().toISOString(),
      agent,
      ...event,
      ...(logInput ? {} : { input: undefined }),
    });
  }

  function check(action: string, input?: unknown): CheckResult {
    const rule = evaluate(policies, action, input);
    if (rule === undefined) return defaultResult(defaultEffect);
    if (rule.effect === 'allow' && limiter.wouldExceed(rule)) {
      return {
        decision: 'deny',
        rule,
        reason: `rate limit exceeded (max ${rule.limit!.max} per ${rule.limit!.per})`,
      };
    }
    return {
      decision: rule.effect,
      rule,
      reason: rule.reason ?? `matched rule "${rule.action}" (${rule.effect})`,
    };
  }

  function denied(action: string, input: unknown, reason: string): DeniedError {
    emit({ action, decision: 'denied', reason, input });
    return new DeniedError(agent, action, reason);
  }

  async function execute<T>(
    action: string,
    input: unknown,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const result = check(action, input);

    if (result.decision === 'deny') {
      throw denied(action, input, result.reason);
    }

    if (result.rule?.approval) {
      if (onApproval === undefined) {
        throw denied(action, input, 'approval required but no onApproval handler is configured');
      }
      if (!(await onApproval({ agent, action, input, reason: result.reason }))) {
        throw denied(action, input, 'approval rejected by human');
      }
    }

    if (result.rule !== undefined) limiter.consume(result.rule);

    const started = performance.now();
    try {
      const value = await fn();
      emit({
        action,
        decision: 'allowed',
        reason: result.reason,
        input,
        durationMs: Math.round(performance.now() - started),
      });
      return value;
    } catch (err) {
      emit({
        action,
        decision: 'error',
        reason: result.reason,
        input,
        durationMs: Math.round(performance.now() - started),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  function protect<I, T>(
    action: string,
    fn: (input: I) => T | Promise<T>,
  ): (input: I) => Promise<T> {
    return (input: I) => execute(action, input, () => fn(input));
  }

  return { check, execute, protect };
}

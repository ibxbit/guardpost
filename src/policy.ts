import type { Effect, RateLimit, Rule } from './types.js';

export interface RuleOptions {
  when?: (input: unknown) => boolean;
  approval?: boolean;
  limit?: RateLimit;
  reason?: string;
}

/** Create a rule that permits an action. */
export function allow(action: string, options: RuleOptions = {}): Rule {
  return { action, effect: 'allow', ...options };
}

/** Create a rule that blocks an action. */
export function deny(action: string, options: RuleOptions = {}): Rule {
  return { action, effect: 'deny', ...options };
}

/**
 * Match an action name against a rule pattern.
 * Exact match, `*` (everything), or a trailing wildcard segment like `calendar.*`.
 */
export function matchesAction(pattern: string, action: string): boolean {
  if (pattern === '*' || pattern === action) return true;
  if (pattern.endsWith('.*')) {
    return action.startsWith(pattern.slice(0, -1));
  }
  return false;
}

/** Find the first rule that matches the action (and passes its condition). */
export function evaluate(
  policies: Rule[],
  action: string,
  input: unknown,
): Rule | undefined {
  return policies.find(
    (rule) =>
      matchesAction(rule.action, action) &&
      (rule.when === undefined || rule.when(input)),
  );
}

/** Fallback used when no rule matches. */
export function defaultResult(effect: Effect): { decision: Effect; reason: string } {
  return {
    decision: effect,
    reason:
      effect === 'deny'
        ? 'no rule matched (default deny)'
        : 'no rule matched (default allow)',
  };
}

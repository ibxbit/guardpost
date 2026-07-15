import type { Rule } from './types.js';

const WINDOW_MS: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

export interface Limiter {
  /** True if running the rule's action now would exceed its rate limit. */
  wouldExceed(rule: Rule): boolean;
  /** Record one execution of the rule's action. */
  consume(rule: Rule): void;
}

/** Sliding-window rate limiter, tracked per rule. */
export function createLimiter(): Limiter {
  const history = new Map<Rule, number[]>();

  function recent(rule: Rule): number[] {
    const limit = rule.limit;
    if (limit === undefined) return [];
    const cutoff = Date.now() - WINDOW_MS[limit.per];
    const pruned = (history.get(rule) ?? []).filter((t) => t > cutoff);
    history.set(rule, pruned);
    return pruned;
  }

  return {
    wouldExceed(rule) {
      if (rule.limit === undefined) return false;
      return recent(rule).length >= rule.limit.max;
    },
    consume(rule) {
      if (rule.limit === undefined) return;
      history.set(rule, [...recent(rule), Date.now()]);
    },
  };
}

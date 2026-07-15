/** The effect a rule has when it matches an action. */
export type Effect = 'allow' | 'deny';

/** How many times a rule's action may run within a time window. */
export interface RateLimit {
  max: number;
  per: 'second' | 'minute' | 'hour' | 'day';
}

/**
 * A single permission rule.
 *
 * `action` is a dot-separated name like `calendar.create`. Wildcards are
 * supported as a trailing segment: `calendar.*` matches every calendar
 * action, and `*` matches everything.
 */
export interface Rule {
  action: string;
  effect: Effect;
  /** Optional condition — the rule only matches when this returns true. */
  when?: (input: unknown) => boolean;
  /** Require a human to approve each call before it runs (allow rules only). */
  approval?: boolean;
  /** Cap how often this action may run, e.g. `{ max: 5, per: 'minute' }`. */
  limit?: RateLimit;
  /** Human-readable explanation, included in audit events and errors. */
  reason?: string;
}

/** The outcome of checking an action against a guard's policies. */
export interface CheckResult {
  decision: Effect;
  /** The rule that decided the outcome, or undefined if the default applied. */
  rule?: Rule;
  reason: string;
}

/** Passed to `onApproval` when a rule requires human sign-off. */
export interface ApprovalRequest {
  agent: string;
  action: string;
  input: unknown;
  reason: string;
}

/** One entry in the audit trail. Every check produces exactly one event. */
export interface AuditEvent {
  timestamp: string;
  agent: string;
  action: string;
  decision: 'allowed' | 'denied' | 'error';
  reason: string;
  input?: unknown;
  /** Wall-clock time of the tool execution, present for executed actions. */
  durationMs?: number;
  /** Error message, present when the tool itself threw. */
  error?: string;
}

export interface GuardConfig {
  /** Identifies the agent in audit events, e.g. `email-assistant`. */
  agent: string;
  /** Evaluated in order — the first matching rule decides. */
  policies: Rule[];
  /** Applied when no rule matches. Defaults to `deny`. */
  defaultEffect?: Effect;
  /** Receives every audit event. Defaults to no-op. */
  audit?: (event: AuditEvent) => void;
  /** Include tool input in audit events. Defaults to true. */
  logInput?: boolean;
  /**
   * Called when a matched rule has `approval: true`. Return true to let the
   * call run. Wire this to a CLI prompt, Slack message, dashboard — anything.
   * If a rule requires approval and no handler is configured, the call is denied.
   */
  onApproval?: (request: ApprovalRequest) => boolean | Promise<boolean>;
}

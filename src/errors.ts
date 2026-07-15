/** Thrown by `guard.execute` when an action is denied by policy. */
export class DeniedError extends Error {
  readonly action: string;
  readonly reason: string;

  constructor(agent: string, action: string, reason: string) {
    super(`guardpost denied "${action}" for agent "${agent}": ${reason}`);
    this.name = 'DeniedError';
    this.action = action;
    this.reason = reason;
  }
}

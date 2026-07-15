import type { Guard } from './guard.js';

/** A tool in the shape most agent frameworks use: a name plus a handler. */
export interface GuardableTool<I = never, T = unknown> {
  name: string;
  handler: (input: I) => T | Promise<T>;
  [key: string]: unknown;
}

/**
 * Wrap a set of agent tools so every handler call goes through the guard.
 * The tool's `name` becomes the action checked against the policies; all
 * other properties (description, input schema, …) pass through untouched.
 */
export function guardTools<Tool extends GuardableTool<never>>(
  guard: Guard,
  tools: Tool[],
): Tool[] {
  return tools.map((tool) => ({
    ...tool,
    handler: guard.protect(tool.name, tool.handler),
  }));
}

# reins

**Permissions and audit logging for AI agents.**

Your agent has your user's credentials. Technically it can do *anything* the user can — delete emails, spend money, leak data. reins is the layer that says what it's *actually allowed* to do, and records everything it does.

Not a scanner. Not a proxy. A tiny, zero-dependency library that lives inside your agent's code.

```bash
npm install reins
```

## Quickstart

```ts
import { createGuard, allow, deny } from 'reins';

const guard = createGuard({
  agent: 'email-assistant',
  policies: [
    allow('calendar.read'),
    allow('calendar.create', {
      when: (input) => input.durationMinutes <= 60,
      reason: 'meetings up to 60 minutes are allowed',
    }),
    deny('email.*', { reason: 'this agent may never send email' }),
  ],
  audit: (event) => console.log(event), // send to your logger / DB
});

// Wrap any tool call:
const events = await guard.execute('calendar.read', undefined, () =>
  calendarApi.listEvents(),
);

// Or wrap a tool function once and reuse it:
const createEvent = guard.protect('calendar.create', calendarApi.createEvent);
```

If a call violates policy, reins throws a `DeniedError` — the tool never runs. Every call, allowed or not, produces one audit event:

```json
{
  "timestamp": "2026-07-15T10:32:01.481Z",
  "agent": "email-assistant",
  "action": "email.send",
  "decision": "denied",
  "reason": "this agent may never send email",
  "input": { "to": "boss@company.com" }
}
```

## Human-in-the-loop approvals

Some actions should never run without a human saying yes:

```ts
const guard = createGuard({
  agent: 'shopper',
  policies: [
    allow('payments.send', { approval: true }),
  ],
  onApproval: async (req) => {
    // Wire this to anything: CLI prompt, Slack message, dashboard…
    return askHuman(`Agent wants to ${req.action}: ${JSON.stringify(req.input)}. Allow?`);
  },
});
```

The tool only runs if the handler returns `true`. Rejections are audited like any other denial.

## Rate limits

Cap how often an agent may do something, per rule:

```ts
allow('search.web', { limit: { max: 10, per: 'minute' } })
allow('email.send', { limit: { max: 20, per: 'day' } })
```

Calls beyond the cap are denied (and audited) until the window slides.

## Wrap all your tools at once

Most agent frameworks define tools as `{ name, handler, ... }`. Guard them in one call — names become actions, everything else passes through:

```ts
import { guardTools } from 'reins';

const safeTools = guardTools(guard, [
  { name: 'calendar.read', description: '…', handler: listEvents },
  { name: 'email.send', description: '…', handler: sendEmail },
]);
```

## Audit sinks

```ts
import { consoleAudit, jsonlAudit } from 'reins';

createGuard({ ..., audit: consoleAudit() });          // readable lines in dev
createGuard({ ..., audit: jsonlAudit('audit.jsonl') }); // one JSON line per event
```

Or pass any function `(event) => …` to ship events to your own logger or database.

## How rules work

- Actions are dot-separated names: `calendar.create`, `email.send` — you choose them.
- Patterns: exact match, `namespace.*`, or `*` for everything.
- Rules are evaluated **in order; the first match wins.**
- If nothing matches, the default is **deny** (configurable via `defaultEffect`).
- `when` conditions let a rule match only for certain inputs (amounts, durations, recipients…).

## Why this exists

Agent frameworks give you tools. Nothing standard answers:

- What is this agent allowed to do, on whose behalf?
- How do I stop it from doing everything else?
- What exactly did it do last Tuesday?

Every team deploying agents rebuilds this by hand. reins is that layer, done once, done right.

## Roadmap

- [x] Policy rules + conditions
- [x] Audit trail (custom sinks, JSONL, console)
- [x] Human-in-the-loop approvals
- [x] Rate limits per rule
- [x] One-call tool wrapping (`guardTools`)
- [ ] Agent identity (acting-on-behalf-of, delegation chains)
- [ ] First-class adapters: MCP servers, Claude tool use, Vercel AI SDK
- [ ] Hosted audit dashboard

## License

MIT

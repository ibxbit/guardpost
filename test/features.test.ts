import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  allow,
  createGuard,
  DeniedError,
  guardTools,
  jsonlAudit,
  type ApprovalRequest,
  type AuditEvent,
} from '../src/index.js';

// --- Approvals -------------------------------------------------------------

test('approval: approved calls run', async () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('payments.refund', { approval: true })],
    onApproval: () => true,
  });
  assert.equal(await guard.execute('payments.refund', { amount: 10 }, () => 'refunded'), 'refunded');
});

test('approval: rejected calls throw and never run', async () => {
  let ran = false;
  const guard = createGuard({
    agent: 'a',
    policies: [allow('payments.refund', { approval: true })],
    onApproval: () => false,
  });
  await assert.rejects(
    guard.execute('payments.refund', {}, () => {
      ran = true;
    }),
    DeniedError,
  );
  assert.equal(ran, false);
});

test('approval: missing onApproval handler denies the call', async () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('payments.refund', { approval: true })],
  });
  await assert.rejects(guard.execute('payments.refund', {}, () => 'x'), DeniedError);
});

test('approval: handler receives the full request', async () => {
  let received: ApprovalRequest | undefined;
  const guard = createGuard({
    agent: 'shopper',
    policies: [allow('cart.checkout', { approval: true })],
    onApproval: (req) => {
      received = req;
      return true;
    },
  });
  await guard.execute('cart.checkout', { total: 99 }, () => 'ok');
  assert.equal(received?.agent, 'shopper');
  assert.equal(received?.action, 'cart.checkout');
  assert.deepEqual(received?.input, { total: 99 });
});

test('approval: async handlers are awaited', async () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('x', { approval: true })],
    onApproval: async () => false,
  });
  await assert.rejects(guard.execute('x', {}, () => 'x'), DeniedError);
});

// --- Rate limits -----------------------------------------------------------

test('rate limit: blocks after max calls in window', async () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('search.web', { limit: { max: 2, per: 'minute' } })],
  });
  await guard.execute('search.web', {}, () => 1);
  await guard.execute('search.web', {}, () => 2);
  await assert.rejects(guard.execute('search.web', {}, () => 3), (err: DeniedError) => {
    assert.match(err.reason, /rate limit exceeded/);
    return true;
  });
});

test('rate limit: check() reports the denial without consuming', () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('x', { limit: { max: 1, per: 'minute' } })],
  });
  assert.equal(guard.check('x').decision, 'allow');
  assert.equal(guard.check('x').decision, 'allow'); // still allowed — check consumes nothing
});

test('rate limit: denied calls do not consume the budget', async () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('x', { limit: { max: 1, per: 'minute' }, approval: true })],
    onApproval: () => false,
  });
  await assert.rejects(guard.execute('x', {}, () => 1), DeniedError);
  // The rejected call must not have used up the single slot:
  assert.equal(guard.check('x').decision, 'allow');
});

// --- guardTools ------------------------------------------------------------

test('guardTools wraps handlers and preserves other properties', async () => {
  const guard = createGuard({ agent: 'a', policies: [allow('math.double')] });
  const [double, triple] = guardTools(guard, [
    { name: 'math.double', description: 'doubles', handler: (n: number) => n * 2 },
    { name: 'math.triple', description: 'triples', handler: (n: number) => n * 3 },
  ]);
  assert.equal(await double!.handler(21), 42);
  assert.equal(double!.description, 'doubles');
  await assert.rejects(Promise.resolve(triple!.handler(1)), DeniedError); // no rule → denied
});

// --- Audit sinks -----------------------------------------------------------

test('jsonlAudit writes one JSON line per event', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'reins-')), 'audit.jsonl');
  const guard = createGuard({ agent: 'a', policies: [allow('x')], audit: jsonlAudit(path) });
  await guard.execute('x', { q: 1 }, () => 'ok');
  await assert.rejects(guard.execute('y', {}, () => 'no'), DeniedError);

  const lines = readFileSync(path, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  const events = lines.map((l) => JSON.parse(l) as AuditEvent);
  assert.equal(events[0]!.decision, 'allowed');
  assert.equal(events[1]!.decision, 'denied');
});

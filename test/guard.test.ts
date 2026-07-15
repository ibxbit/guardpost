import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allow, createGuard, deny, DeniedError, type AuditEvent } from '../src/index.js';

test('default deny when no rule matches', () => {
  const guard = createGuard({ agent: 'a', policies: [] });
  assert.equal(guard.check('anything').decision, 'deny');
});

test('exact allow rule matches', () => {
  const guard = createGuard({ agent: 'a', policies: [allow('calendar.read')] });
  assert.equal(guard.check('calendar.read').decision, 'allow');
  assert.equal(guard.check('calendar.delete').decision, 'deny');
});

test('wildcard matches whole namespace', () => {
  const guard = createGuard({ agent: 'a', policies: [deny('email.*'), allow('*')] });
  assert.equal(guard.check('email.send').decision, 'deny');
  assert.equal(guard.check('calendar.read').decision, 'allow');
});

test('first matching rule wins', () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('email.read'), deny('email.*')],
  });
  assert.equal(guard.check('email.read').decision, 'allow');
  assert.equal(guard.check('email.send').decision, 'deny');
});

test('when-condition gates the rule', () => {
  const guard = createGuard({
    agent: 'a',
    policies: [allow('pay', { when: (i) => (i as { amount: number }).amount <= 50 })],
  });
  assert.equal(guard.check('pay', { amount: 20 }).decision, 'allow');
  assert.equal(guard.check('pay', { amount: 500 }).decision, 'deny');
});

test('execute runs the tool when allowed and audits it', async () => {
  const events: AuditEvent[] = [];
  const guard = createGuard({
    agent: 'a',
    policies: [allow('greet')],
    audit: (e) => events.push(e),
  });
  const result = await guard.execute('greet', { name: 'x' }, () => 'hello');
  assert.equal(result, 'hello');
  assert.equal(events.length, 1);
  assert.equal(events[0]!.decision, 'allowed');
});

test('execute throws DeniedError and audits the denial', async () => {
  const events: AuditEvent[] = [];
  const guard = createGuard({ agent: 'a', policies: [], audit: (e) => events.push(e) });
  await assert.rejects(
    guard.execute('secret.read', undefined, () => 'nope'),
    DeniedError,
  );
  assert.equal(events[0]!.decision, 'denied');
});

test('execute audits tool errors and rethrows', async () => {
  const events: AuditEvent[] = [];
  const guard = createGuard({
    agent: 'a',
    policies: [allow('boom')],
    audit: (e) => events.push(e),
  });
  await assert.rejects(
    guard.execute('boom', undefined, () => {
      throw new Error('exploded');
    }),
  );
  assert.equal(events[0]!.decision, 'error');
  assert.equal(events[0]!.error, 'exploded');
});

test('protect wraps a tool function', async () => {
  const guard = createGuard({ agent: 'a', policies: [allow('math.double')] });
  const double = guard.protect('math.double', (n: number) => n * 2);
  assert.equal(await double(21), 42);
});

test('logInput false strips input from audit events', async () => {
  const events: AuditEvent[] = [];
  const guard = createGuard({
    agent: 'a',
    policies: [allow('x')],
    logInput: false,
    audit: (e) => events.push(e),
  });
  await guard.execute('x', { password: 'hunter2' }, () => true);
  assert.equal(events[0]!.input, undefined);
});

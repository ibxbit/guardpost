/**
 * Demo: an email-assistant agent with reins enforcing its permissions.
 * Run with: npm run demo
 */
import { allow, createGuard, deny, DeniedError, type AuditEvent } from '../src/index.js';

// --- Fake tools standing in for real API calls ---------------------------
const calendarApi = {
  listEvents: async () => ['Standup 9:00', 'Investor call 14:00'],
  createEvent: async (event: { title: string; durationMinutes: number }) =>
    `created "${event.title}" (${event.durationMinutes} min)`,
};
const emailApi = {
  send: async (to: string) => `sent email to ${to}`,
};

// --- The guard: this is the whole product ---------------------------------
const auditLog: AuditEvent[] = [];

const guard = createGuard({
  agent: 'email-assistant',
  policies: [
    allow('calendar.read'),
    allow('calendar.create', {
      when: (input) => (input as { durationMinutes: number }).durationMinutes <= 60,
      reason: 'meetings up to 60 minutes are allowed',
    }),
    deny('email.*', { reason: 'this agent may never send email' }),
  ],
  audit: (event) => {
    auditLog.push(event);
    console.log(
      `  [audit] ${event.decision.toUpperCase().padEnd(7)} ${event.action} — ${event.reason}`,
    );
  },
});

// --- Agent makes tool calls, reins decides ----------------------------
console.log('\n1. Reading the calendar (allowed):');
const events = await guard.execute('calendar.read', undefined, calendarApi.listEvents);
console.log(`  -> ${events.join(', ')}`);

console.log('\n2. Creating a 30-minute meeting (allowed by condition):');
const created = await guard.execute('calendar.create', { title: 'Coffee chat', durationMinutes: 30 }, () =>
  calendarApi.createEvent({ title: 'Coffee chat', durationMinutes: 30 }),
);
console.log(`  -> ${created}`);

console.log('\n3. Creating a 3-hour meeting (blocked — fails the condition):');
try {
  await guard.execute('calendar.create', { title: 'Offsite', durationMinutes: 180 }, () =>
    calendarApi.createEvent({ title: 'Offsite', durationMinutes: 180 }),
  );
} catch (err) {
  if (err instanceof DeniedError) console.log(`  -> blocked: ${err.message}`);
}

console.log('\n4. Trying to send an email (blocked by deny rule):');
try {
  await guard.execute('email.send', { to: 'boss@company.com' }, () =>
    emailApi.send('boss@company.com'),
  );
} catch (err) {
  if (err instanceof DeniedError) console.log(`  -> blocked: ${err.message}`);
}

console.log(`\nAudit trail captured ${auditLog.length} events. Every action, accounted for.\n`);

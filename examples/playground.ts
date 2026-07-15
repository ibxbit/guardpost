/**
 * PLAYGROUND — your file to experiment with reins.
 * Change the rules, change the calls, rerun, watch what happens.
 *
 * Run with: npx tsx examples/playground.ts
 */
import { allow, consoleAudit, createGuard, deny, DeniedError } from '../src/index.js';

const guard = createGuard({
  agent: 'my-test-agent',

  // ── EDIT THESE RULES ──────────────────────────────────────────────
  policies: [
    allow('files.read'),
    allow('files.write', { when: (input) => (input as { path: string }).path.startsWith('drafts/') }),
    allow('search.web', { limit: { max: 3, per: 'minute' } }),
    allow('payments.send', { approval: true }),
    deny('files.delete', { reason: 'deletion is never allowed' }),
  ],
  // ──────────────────────────────────────────────────────────────────

  audit: consoleAudit(),
  // Approval handler — pretend the human says yes. Change to false and see.
  onApproval: (req) => {
    console.log(`  [approval needed] ${req.action} with input ${JSON.stringify(req.input)} -> approving`);
    return false;
  },
});

// ── EDIT THESE CALLS — each one either runs or gets blocked ─────────
const attempts: Array<[string, unknown]> = [
  ['files.read', { path: 'notes.txt' }],
  ['files.write', { path: 'drafts/idea.md' }],
  ['files.write', { path: 'C:/Windows/system32.dll' }], // fails the when-condition
  ['files.delete', { path: 'notes.txt' }],              // deny rule
  ['payments.send', { to: 'alice', amount: 20 }],       // needs approval
  ['search.web', { q: 'one' }],
  ['search.web', { q: 'two' }],
  ['search.web', { q: 'three' }],
  ['search.web', { q: 'four' }],                        // 4th within a minute → rate limited
  ['email.send', { to: 'boss' }],                       // no rule at all → default deny
];

for (const [action, input] of attempts) {
  try {
    await guard.execute(action, input, () => '(tool ran)');
  } catch (err) {
    if (!(err instanceof DeniedError)) throw err;
  }
}

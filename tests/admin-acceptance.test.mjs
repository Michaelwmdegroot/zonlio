import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceMarkup } from '../src/admin-acceptance.mjs';

test('owner acceptance announces a paused mail outbox before a click, without claiming inbox delivery', () => {
  const markup = acceptanceMarkup({ email: 'admin@example.invalid', mailStatus: { configured: true, paused: true } });
  assert.match(markup, /Mailverzending is gepauzeerd/);
  assert.match(markup, /geen berichten verstuurd/);
  assert.match(markup, /acceptance-mail-state warning/);
  assert.match(markup, /id="acceptance-error" class="form-message error hidden"/);
  assert.doesNotMatch(markup, /Eigenaarstest opgeslagen/);
});

test('owner acceptance shows a persistent accessible error with safe escaping', () => {
  const markup = acceptanceMarkup({ email: 'admin@example.invalid', error: 'Beveiligde aanvraag niet opgeslagen: <script>alert(1)</script>', mailStatus: { configured: true, paused: false } });
  assert.match(markup, /id="acceptance-error" class="form-message error" role="alert" aria-live="assertive"/);
  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>alert/);
  assert.match(markup, /twee berichten in de wachtrij/);
});

test('owner acceptance success never confuses queued versus delivered SMTP', () => {
  const markup = acceptanceMarkup({
    email: 'admin@example.invalid',
    result: { reference: 'ZON-TEST', id: 'synthetic', mailPaused: true, duplicate: false },
  });
  assert.match(markup, /Eigenaarstest opgeslagen/);
  assert.match(markup, /mailpauze is actief/);
  assert.match(markup, /role="status"/);
  assert.doesNotMatch(markup, /Inbox ontvangen|SMTP bezorgd/);
});

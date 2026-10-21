import test from 'node:test';
import assert from 'node:assert/strict';
import { canHostStart, countryHint, guestKinds, needsSavedProgressRestart } from '../src/core/lobby';
import { fixtureSnapshot } from '../src/dev/fixtures';
import { appInviteUrl } from '../src/core/invites';
import { recoveryMessage } from '../src/core/recovery';
import { ApiFailure } from '../src/core/errors';

test('country hints stay optional and guest kinds never guess saved show progress', () => {
  assert.equal(countryHint('de-DE'), 'DE'); assert.equal(countryHint('en'), null); assert.equal(countryHint('bad_locale'), null);
  assert.deepEqual(guestKinds(), ['movie', 'show_start']);
});
test('host start can express only own readiness; others and all screens still gate it', () => {
  const room = fixtureSnapshot(); room.shared.constraints.kinds = guestKinds();
  assert.equal(room.shared.participants[0].ready, false); assert.equal(canHostStart(room), true);
  room.shared.participants[1].ready = false; assert.equal(canHostStart(room), false);
  room.shared.participants[1].ready = true; room.shared.screens[1].confirmed = false; assert.equal(canHostStart(room), false);
  room.shared.screens[1].confirmed = true; room.shared.constraints.kinds.push('show_continue'); assert.equal(canHostStart(room), false);
});
test('public invitations use app origins independently of API endpoints and reject redirected paths', () => {
  assert.equal(appInviteUrl('/r/ISOLATED-CODE', 'http://127.0.0.1:8101'), 'http://127.0.0.1:8101/r/ISOLATED-CODE');
  assert.equal(appInviteUrl('/r/ISOLATED-CODE', 'https://yepwatch.com'), 'https://yepwatch.com/r/ISOLATED-CODE');
  assert.throws(() => appInviteUrl('//evil.example/r/code')); assert.throws(() => appInviteUrl('/r/code?token=bad')); assert.throws(() => appInviteUrl('/r/code', 'http://public.example'));
});
test('incomplete availability/search and verified no matches have distinct actionable explanations', () => {
  const details = { type: 'deck' as const, reason: 'scan_limit' as const, reasons: ['scan_limit' as const], actions: ['retry' as const], scannedTitles: 20, poolSize: 100, scanComplete: false, uncertainTitles: 0, noMatchTitles: 0, missingMetadataTitles: 0, missingEpisodeTitles: 0, screens: [] };
  assert.match(recoveryMessage(new ApiFailure('catalog_unavailable', 'Raw internal message', undefined, 503, details)), /search did not finish/);
  assert.match(recoveryMessage(new ApiFailure('no_intersection', 'Raw internal message', undefined, 409, { ...details, reason: 'verified_no_intersection' })), /No titles matched across/);
  assert.match(recoveryMessage(new ApiFailure('member_required', 'Raw')), /Sign-in is not connected yet/);
});

test('legacy recovery follows actual active continuation deck, including completed own state and shortlist', () => {
  const room = fixtureSnapshot(); room.shared.phase = 'voting'; room.shared.round = { version: 1, rosterVersion: 1, contextVersion: 1, candidateCount: 3, completed: false };
  assert.equal(needsSavedProgressRestart(room), true);
  room.own.roundCompleted = true; assert.equal(needsSavedProgressRestart(room), true);
  room.shared.phase = 'shortlist'; assert.equal(needsSavedProgressRestart(room), true);
  room.shared.phase = 'decided'; assert.equal(needsSavedProgressRestart(room), false);
  room.shared.phase = 'voting'; room.shared.candidates = room.shared.candidates.filter(c => c.identity.kind !== 'show_continue');
  assert.equal(room.shared.constraints.kinds.includes('show_continue'), true); assert.equal(needsSavedProgressRestart(room), false);
});

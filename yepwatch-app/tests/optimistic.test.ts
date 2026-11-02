import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { awaitsServer, overlayRoom, previewCommand } from '../src/core/continuous/optimistic';
import { continuousFixture } from './continuous-fixture';

function room(): RoomSnapshot {
  const s = continuousFixture();
  s.shared.phase = 'setup';
  s.shared.screens = [{ id: 'room', label: 'Our room', country: 'DE', serviceIds: [8], confirmed: true }];
  s.shared.participants = [{ participantId: 'host', nickname: '', screenId: 'room', ready: true, serviceIds: [8] }];
  s.shared.hostParticipantId = 'host';
  s.shared.ideas = [{ id: 'i1', text: 'cheer me up', authorId: 'host', on: true, attributes: [] }];
  s.own.participantId = 'host';
  s.own.canHost = true;
  return s;
}
const fixed = (command: RoomCommand, commandId = 'c1') => ({ commandId, build: () => command });

test('an added idea has its real id at once, and a broadcast of it does not double it', () => {
  const s = room();
  const shown = previewCommand(s, 'cmd-1', { type: 'add_idea', text: 'space adventure' });
  assert.deepEqual(shown.shared.ideas.at(-1), { id: 'cmd-1', text: 'space adventure', authorId: 'host', on: true, attributes: [] });
  assert.equal(previewCommand(shown, 'cmd-1', { type: 'add_idea', text: 'space adventure' }), shown);
  s.own.canHost = false;
  assert.equal(previewCommand(s, 'cmd-2', { type: 'add_idea', text: 'a suggestion' }).shared.ideas.at(-1)?.on, false, 'friends suggest, off');
});

test('edits, switches and removals show at once and leave the confirmed room untouched', () => {
  const s = room();
  const before = JSON.stringify(s);
  assert.equal(previewCommand(s, 'c', { type: 'edit_idea', ideaId: 'i1', text: 'something funny' }).shared.ideas[0].text, 'something funny');
  assert.equal(previewCommand(s, 'c', { type: 'set_idea', ideaId: 'i1', on: false }).shared.ideas[0].on, false);
  assert.deepEqual(previewCommand(s, 'c', { type: 'remove_idea', ideaId: 'i1' }).shared.ideas, []);
  assert.equal(JSON.stringify(s), before);
});

test('commands queued behind each other stack, including an edit of an idea still being added', () => {
  const s = room();
  const shown = overlayRoom(s, { commandId: 'a', sequence: 1, command: { type: 'add_idea', text: 'first' } }, [
    fixed({ type: 'edit_idea', ideaId: 'a', text: 'second' }, 'b'),
    fixed({ type: 'set_idea', ideaId: 'i1', on: false }, 'c'),
  ]);
  assert.deepEqual(shown.shared.ideas.map((i) => [i.text, i.on]), [['cheer me up', false], ['second', true]]);
});

test('name, your services, service switches, seen titles, country and kinds', () => {
  const s = room();
  assert.equal(previewCommand(s, 'c', { type: 'rename', nickname: 'Alp' }).shared.participants[0].nickname, 'Alp');
  assert.deepEqual(previewCommand(s, 'c', { type: 'set_services', serviceIds: [8, 9] }).shared.participants[0].serviceIds, [8, 9]);
  const off = previewCommand(s, 'c', { type: 'set_service_enabled', serviceIds: [8], enabled: false });
  assert.deepEqual(off.shared.disabledServiceIds, [8]);
  assert.deepEqual(previewCommand(off, 'c', { type: 'set_service_enabled', serviceIds: [8], enabled: true }).shared.disabledServiceIds, []);
  assert.equal(previewCommand(s, 'c', { type: 'set_show_seen', show: true }).own.showSeen, true);
  s.shared.screens = [];
  const configured = previewCommand(s, 'c', { type: 'configure', expectedContextVersion: 1, country: 'US', constraints: { ...s.shared.constraints, kinds: ['movie'] } });
  assert.equal(configured.shared.screens[0].country, 'US');
  assert.deepEqual(configured.shared.constraints.kinds, ['movie']);
});

test('a vote moves on to the next card; undo brings it back; other rounds do not count', () => {
  const s = room();
  s.shared.phase = 'choosing';
  const [card] = s.shared.candidates;
  const vote = { type: 'vote', generation: s.shared.generation, candidateId: card.id, expectedVoteRevision: 0, value: 'watch', activeExposureMs: 1200 } as const;
  const voted = previewCommand(s, 'c', vote);
  assert.deepEqual(voted.own.votes.map((v) => [v.candidateId, v.value, v.revision, v.timingSource]), [[card.id, 'watch', 1, 'active_exposure']]);
  const undone = previewCommand(voted, 'c', { ...vote, expectedVoteRevision: 1, value: null, activeExposureMs: null });
  assert.equal(undone.own.nextCandidateId, card.id);
  assert.equal(undone.own.votes[0].value, null);
  assert.equal(previewCommand(s, 'c', { ...vote, generation: s.shared.generation + 1 }), s);
});

test('agreeing counts once, even when a broadcast already counted it', () => {
  const s = room();
  s.shared.proposal = { candidateId: 'x', version: 1, previousCandidateId: null, agreeCount: 1, requiredCount: 2 } as typeof s.shared.proposal;
  const agree = { type: 'agree', generation: 1, expectedRosterVersion: 1, expectedProposalVersion: 1, candidateId: 'x', expectedOwnAgreementRevision: 0, agreed: true } as const;
  const shown = previewCommand(s, 'c', agree);
  assert.equal(shown.shared.proposal?.agreeCount, 2);
  assert.equal(shown.own.agreement.agreed, true);
  assert.equal(previewCommand(shown, 'c', agree), shown);
  s.shared.proposal!.agreeCount = 2;
  assert.equal(previewCommand(s, 'c', agree).shared.proposal?.agreeCount, 2, 'never above the room');
});

test('what the server decides waits for its answer; everything else shows at once', () => {
  assert.equal(awaitsServer({ type: 'leave' }), true);
  assert.equal(awaitsServer({ type: 'start', expectedRosterVersion: 1, expectedContextVersion: 1, hostReady: true }), true);
  assert.equal(awaitsServer({ type: 'edit_idea', ideaId: 'i', text: 'x' }), false);
  const s = room();
  assert.equal(previewCommand(s, 'c', { type: 'leave' }), s);
});

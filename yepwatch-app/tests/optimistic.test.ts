import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { awaitsServer, overlayRoom, previewCommand, proposingCandidate } from '../src/core/continuous/optimistic';
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

test('idea text is published only after confirmation; switches still react immediately', () => {
  const s = room();
  const before = JSON.stringify(s);
  for (const command of [
    { type: 'add_idea', text: 'space adventure' },
    { type: 'edit_idea', ideaId: 'i1', text: 'something funny' },
    { type: 'remove_idea', ideaId: 'i1' },
  ] as const) {
    assert.equal(previewCommand(s, 'c', command), s);
    assert.equal(awaitsServer(command), true);
  }
  assert.equal(previewCommand(s, 'c', { type: 'set_idea', ideaId: 'i1', on: false }).shared.ideas[0].on, false);
  assert.equal(JSON.stringify(s), before);
});

test('a queued mood interpretation cannot flash an unconfirmed room label', () => {
  const s = room();
  const shown = overlayRoom(s, { commandId: 'a', sequence: 1, command: { type: 'add_idea', text: 'first' } }, [
    fixed({ type: 'edit_idea', ideaId: 'a', text: 'second' }, 'b'),
    fixed({ type: 'set_idea', ideaId: 'i1', on: false }, 'c'),
  ]);
  assert.deepEqual(shown.shared.ideas.map((i) => [i.text, i.on]), [['cheer me up', false]]);
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
  assert.equal(shown.own.agreement.revision, 1, 'the revision moves as the server moves it, so a withdrawal queued behind aims at it');
  assert.equal(shown.own.votes.find((v) => v.candidateId === 'x')?.value, 'watch', 'agreeing makes your answer a Yep');
  assert.equal(previewCommand(shown, 'c', agree), shown);
  s.shared.proposal!.agreeCount = 2;
  assert.equal(previewCommand(s, 'c', agree).shared.proposal?.agreeCount, 2, 'never above the room');
});

test('what the server decides waits for its answer; everything else shows at once', () => {
  assert.equal(awaitsServer({ type: 'leave' }), true);
  assert.equal(awaitsServer({ type: 'start', expectedRosterVersion: 1, expectedContextVersion: 1, hostReady: true }), true);
  assert.equal(awaitsServer({ type: 'edit_idea', ideaId: 'i', text: 'x' }), true);
  const s = room();
  assert.equal(previewCommand(s, 'c', { type: 'leave' }), s);
});

test('a propose in flight: the room showing that title doesn\'t make it this device\'s own until the server says so', () => {
  const s = continuousFixture();
  const command = { type: 'propose', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId: 'c1' } as RoomCommand;
  assert.deepEqual(previewCommand(s, 'p1', command), s);
  // A poll brought the shared room with a proposal of the same title before this device's answer: it may be
  // someone else's (proposed at the same moment). Nothing here claims it.
  const ahead: RoomSnapshot = { ...s, shared: { ...s.shared, proposalVersion: s.shared.proposalVersion + 1, proposal: { candidateId: 'c1', version: s.shared.proposalVersion + 1, agreeCount: 1, requiredCount: 2 } as RoomSnapshot['shared']['proposal'] } };
  assert.deepEqual(previewCommand(ahead, 'p1', command), ahead);
  // What the screen needs to hold the space: which title this device is proposing.
  assert.equal(proposingCandidate(ahead, { commandId: 'p1', sequence: 1, command }, []), 'c1');
  assert.equal(proposingCandidate(ahead, null, [{ commandId: 'p2', build: () => command }]), 'c1');
  assert.equal(proposingCandidate(ahead, null, []), null);
});

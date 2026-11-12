import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogMetadata, RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { bringers, fitSize, ideasLabel, roomCommands, roomView, showsProposal, statusLine } from '../src/features/room/model';
import { firstTiles, namesLine, rankServices, servicesIn, toggleService } from '../src/features/room/services';
import { continuousFixture } from './continuous-fixture';

function room(): RoomSnapshot {
  const s = continuousFixture();
  s.shared.phase = 'setup';
  s.shared.participants = [
    { participantId: 'host', nickname: 'Alp', screenId: 'tv', ready: true, serviceIds: [8, 9] },
    { participantId: 'mia', nickname: 'Mia', screenId: 'tv', ready: true, serviceIds: [8, 337] },
    { participantId: 'sam', nickname: 'Sam', screenId: null, ready: false, serviceIds: null },
  ];
  s.shared.ideas = [
    { id: 'i1', text: 'cheer me up', authorId: 'host', on: true, attributes: [] },
    { id: 'i2', text: 'space adventure', authorId: 'mia', on: false, attributes: [] },
  ];
  s.shared.disabledServiceIds = [9];
  return s;
}

test('room view: ideas, labels and new suggestions for the host only', () => {
  const s = room();
  const host = roomView(s);
  assert.equal(host.label, 'cheer me up');
  assert.equal(host.title, 'cheer me up');
  assert.equal(host.newSuggestions, 1);
  assert.deepEqual(host.ideas.map((i) => [i.id, i.mine, i.fresh, i.author?.nickname]), [['i1', true, false, 'Alp'], ['i2', false, true, 'Mia']]);
  s.own.participantId = 'mia';
  s.own.canHost = false;
  const friend = roomView(s);
  assert.equal(friend.newSuggestions, 0, 'only the host sees NEW');
  assert.equal(friend.ideas[1].mine, true);
  assert.equal(ideasLabel([]), 'Anything');
  assert.equal(ideasLabel([{ text: 'a' }, { text: 'b' }, { text: 'c' }]), 'a +2');
});

test('room view: per-person services merge, host switches, who brings what, who still picks', () => {
  const v = roomView(room());
  assert.deepEqual(v.roomServiceIds.sort((a, b) => a - b), [8, 9, 337]);
  assert.deepEqual(v.enabledServiceIds.sort((a, b) => a - b), [8, 337]);
  assert.deepEqual(v.myServiceIds, [8, 9]);
  assert.deepEqual(bringers(v, [8]).map((p) => p.nickname), ['Alp', 'Mia']);
  assert.deepEqual(v.picking.map((p) => p.nickname), ['Sam']);
  assert.equal(v.canStart, true);
});

test('room view: a guest host without a name cannot start; nor without a service', () => {
  const s = room();
  s.shared.participants[0].nickname = '';
  assert.equal(roomView(s).needName, true);
  assert.equal(roomView(s).canStart, false);
  assert.equal(roomView(s).faces[0].nickname, 'You');
  const t = room();
  t.shared.participants.forEach((p) => { p.serviceIds = [9]; });
  assert.equal(roomView(t).canStart, false, 'every service is switched off');
});

test('room view: no ideas reads as Anything; seen-titles switch for linked members only', () => {
  const s = continuousFixture();
  const v = roomView(s);
  assert.equal(v.label, 'Anything');
  assert.deepEqual(v.myServiceIds, [8]);
  assert.equal(v.showSeen, null, 'guests have no seen-titles switch');
  s.own.member = { state: 'linked', prefill: null };
  s.own.showSeen = true;
  assert.equal(roomView(s).showSeen, true);
  s.shared.participants[0].serviceIds = null;
  assert.equal(roomView(s).myServiceIds, null, 'not picked yet');
  assert.deepEqual(roomView(s).enabledServiceIds, [], 'null picks contribute nothing');
});

test('proposal: shown to everyone in the round until set aside for that version; never who proposed', () => {
  const s = room();
  s.shared.phase = 'choosing';
  s.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
  s.shared.proposalVersion = 3;
  s.shared.proposal = { candidateId: 'c2', version: 3, previousCandidateId: null, agreeCount: 1, requiredCount: 2, averageYepMs: null };
  const v = roomView(s);
  assert.equal(v.proposal?.mine, false);
  assert.equal(v.proposal?.candidate?.id, 'c2');
  assert.equal(showsProposal(v, null), true);
  assert.equal(showsProposal(v, 3), false, 'Keep swiping on this device');
  assert.equal(showsProposal(v, 2), true, 'a new proposal shows again');
  assert.equal(statusLine(v), 'Proposed: Isolated test c2');
  s.own.participantId = 'sam';
  assert.equal(showsProposal(roomView(s), null), false, 'not in the round');
  assert.equal(Object.keys(v.proposal!).some((k) => /proposer|by|who/i.test(k)), false);
});

test('commands carry the redesigned names and the latest versions', async () => {
  const s = room();
  s.shared.contextVersion = 7;
  const sent: RoomCommand[] = [];
  const cmd = roomCommands(async (c) => { const command = typeof c === 'function' ? c(s) : c; if (command) sent.push(command); return true; }, () => s);
  await cmd.addIdea('  rainy day whodunit ');
  await cmd.setIdea('i2', true);
  await cmd.setServices([337, 8, 8]);
  await cmd.setServiceEnabled([9], true);
  await cmd.configure({ country: 'DE' });
  await cmd.rename(' Alp ');
  await cmd.setShowSeen(true);
  await cmd.start();
  assert.deepEqual(sent.map((c) => c as unknown), [
    { type: 'add_idea', text: 'rainy day whodunit' },
    { type: 'set_idea', ideaId: 'i2', on: true },
    { type: 'set_services', serviceIds: [8, 337] },
    { type: 'set_service_enabled', serviceIds: [9], enabled: true },
    { type: 'configure', expectedContextVersion: 7, country: 'DE' },
    { type: 'rename', nickname: 'Alp' },
    { type: 'set_show_seen', show: true },
    { type: 'start', expectedGeneration: 1, expectedRosterVersion: 1, expectedContextVersion: 7, hostReady: true },
  ]);
});

test('idea rows fit text to length: one line when it fits, else two, never below 17 px', () => {
  assert.equal(fitSize('cheer me up', 300, 40), 40);
  assert.ok(fitSize('a much longer idea about a rainy day whodunit with twists', 300, 40) >= 17);
  assert.equal(fitSize('x'.repeat(200), 300, 40), 17);
});

const meta: CatalogMetadata = {
  countries: [{ code: 'DE', name: 'Germany' }],
  services: [
    { id: 1, name: 'Amazon Video', logoUrl: null }, { id: 9, name: 'Amazon Prime Video', logoUrl: 'p' }, { id: 10, name: 'Amazon Prime Video with Ads', logoUrl: null },
    { id: 8, name: 'Netflix', logoUrl: 'n' }, { id: 50, name: 'MagentaTV', logoUrl: null }, { id: 60, name: 'Rakuten TV', logoUrl: null },
  ],
  providerGroups: [
    { id: 8, name: 'Netflix', logoUrl: 'n', selectionIds: [8], minor: false },
    { id: 9, name: 'Prime Video', logoUrl: 'p', selectionIds: [9, 10], minor: false },
    { id: 50, name: 'MagentaTV', logoUrl: null, selectionIds: [50], minor: false },
    { id: 60, name: 'Rakuten TV', logoUrl: null, selectionIds: [60], minor: true },
  ],
  moods: [],
};

test('service tiles: the catalog’s groups, names and order; toggles select whole groups', () => {
  const all = rankServices(meta);
  assert.deepEqual(all.map((s) => s.name), ['Netflix', 'Prime Video', 'MagentaTV', 'Rakuten TV']);
  assert.equal(all.at(-1)?.minor, true);
  assert.deepEqual(rankServices(undefined), []);
  assert.deepEqual(toggleService([8], all[1]), [8, 9, 10]);
  assert.deepEqual(toggleService([8, 9, 10], all[1]), [8]);
  assert.equal(namesLine(servicesIn(all, [8, 9, 50, 60])), 'Netflix, Prime Video +2');
  assert.equal(firstTiles(all, [60]).some((s) => s.id === 60), true, 'picked minor tiles stay visible');
});

test('room view: NEW is a friend idea not yet acknowledged on this device, switched on or off', () => {
  const s = room();
  s.shared.ideas[1].on = true;
  // Friend ideas arrive switched on: still NEW for the host until seen.
  assert.equal(roomView(s).ideas[1].on, true);
  assert.equal(roomView(s).newSuggestions, 1);
  // Seen in the room (or switched): no longer NEW.
  assert.equal(roomView(s, new Set(['i2'])).newSuggestions, 0);
  assert.equal(roomView(s, new Set(['i2'])).ideas[1].fresh, false);
  // Switched off by the host: dealt with, it doesn't come back as NEW.
  s.shared.ideas[1].on = false;
  assert.equal(roomView(s, new Set(['i2'])).newSuggestions, 0);
  // An idea that is off and unseen (older rooms) is NEW too.
  assert.equal(roomView(s).newSuggestions, 1);
  // A different friend idea arriving later is NEW again; the host's own ideas never are.
  s.shared.ideas.push({ id: 'i3', text: 'heist', authorId: 'sam', on: true, attributes: [] });
  assert.deepEqual(roomView(s, new Set(['i2'])).ideas.filter((i) => i.fresh).map((i) => i.id), ['i3']);
});

test('a queued tap keeps what it was aimed at: a new proposal or round drops it, own version bumps do not', async () => {
  const s = room();
  s.shared.phase = 'choosing';
  s.shared.proposal = { candidateId: 'a', version: 2, previousCandidateId: null, agreeCount: 1, requiredCount: 2 } as typeof s.shared.proposal;
  s.shared.proposalVersion = 2;
  const queued: ((snapshot: RoomSnapshot) => RoomCommand | null)[] = [];
  const cmd = roomCommands(async (c) => { if (typeof c === 'function') queued.push(c); return true; }, () => s);
  await cmd.agree(true);
  await cmd.vote('c1', true, null);
  const agree = queued[0], vote = queued[1];
  assert.equal(agree({ ...s, shared: { ...s.shared, contextVersion: 99 } })?.type, 'agree');
  const replaced = { ...s, shared: { ...s.shared, proposalVersion: 3, proposal: { ...s.shared.proposal!, candidateId: 'b', version: 3 } } };
  assert.equal(agree(replaced), null, 'never agrees to a title nobody tapped');
  assert.equal(vote({ ...s, shared: { ...s.shared, generation: s.shared.generation + 1 } }), null);
});

/** A choosing room where this device already voted on c1 (revision 1). */
function voted(value: 'watch' | 'pass' | null = 'pass', revision = 1): RoomSnapshot {
  const s = room();
  s.shared.phase = 'choosing';
  s.own.votes = [{ candidateId: 'c1', value, revision, activeExposureMs: null, timingSource: 'unavailable' }];
  return s;
}
const capture = (s: () => RoomSnapshot, view?: () => RoomSnapshot) => {
  const queued: ((snapshot: RoomSnapshot) => RoomCommand | null)[] = [];
  const cmd = roomCommands(async (c) => { if (typeof c === 'function') queued.push(c); return true; }, s, view);
  return { cmd, queued };
};

test('a vote keeps the revision it was tapped on: a newer choice from another device is never overwritten', async () => {
  const tapped = voted(null, 0);
  const { cmd, queued } = capture(() => tapped);
  await cmd.vote('c1', false, null);
  // Another device of yours changed this card to Yep meanwhile: the 409 brings revision 1.
  const fresh = voted('watch', 1);
  assert.equal(queued[0](fresh), null, 'the delayed Nope resolves to the newer Yep instead of overwriting it');
  assert.deepEqual(queued[0](tapped), { type: 'vote', generation: 1, candidateId: 'c1', expectedVoteRevision: 0, value: 'pass', activeExposureMs: null });
});

test('Undo keeps the revision it was tapped on', async () => {
  const tapped = voted('pass', 1);
  const { cmd, queued } = capture(() => tapped);
  await cmd.undo('c1');
  assert.equal(queued[0](voted('watch', 2)), null, 'an Undo never takes back a choice made later on another device');
  assert.equal((queued[0](tapped) as { expectedVoteRevision: number }).expectedVoteRevision, 1);
});

test('agreement withdrawal keeps the agreement revision it was tapped on', async () => {
  const s = voted('watch', 1);
  s.shared.proposal = { candidateId: 'c1', version: 2, previousCandidateId: null, agreeCount: 1, requiredCount: 2, averageYepMs: null };
  s.shared.proposalVersion = 2;
  s.own.agreement = { proposalVersion: 2, agreed: true, revision: 3, isProposer: false };
  const { cmd, queued } = capture(() => s);
  await cmd.agree(false);
  // Another device withdrew and agreed again meanwhile.
  const fresh = { ...s, own: { ...s.own, agreement: { ...s.own.agreement, revision: 5 } } };
  assert.equal(queued[0](fresh), null);
  assert.equal((queued[0](s) as { expectedOwnAgreementRevision: number }).expectedOwnAgreementRevision, 3);
});

test('a vote and its Undo queued together: the Undo is aimed at the vote this device just made', async () => {
  const confirmed = voted(null, 0);
  // What the person sees: the confirmed room with the unconfirmed vote on top.
  let view: RoomSnapshot = confirmed;
  const { cmd, queued } = capture(() => confirmed, () => view);
  await cmd.vote('c1', true, 900);
  view = voted('watch', 1);
  await cmd.undo('c1');
  // The vote landed: the confirmed room now has revision 1, and the Undo goes out against it.
  assert.equal((queued[1](voted('watch', 1)) as { expectedVoteRevision: number }).expectedVoteRevision, 1);
});

test('Start and Start again name the round they were pressed in; a later round drops them', async () => {
  const s = room();
  s.shared.generation = 4;
  const { cmd, queued } = capture(() => s);
  await cmd.start();
  await cmd.restart();
  assert.equal((queued[0](s) as { expectedGeneration?: number }).expectedGeneration, 4);
  assert.equal((queued[1](s) as { expectedGeneration?: number }).expectedGeneration, 4);
  const later = { ...s, shared: { ...s.shared, generation: 5 } };
  assert.equal(queued[0](later), null);
  assert.equal(queued[1](later), null);
});

test('agree then withdraw queued together: the withdrawal is aimed at the agreement this device just made', async () => {
  const { overlayRoom } = await import('../src/core/continuous/optimistic');
  const s = voted('watch', 1);
  s.shared.proposal = { candidateId: 'c1', version: 2, previousCandidateId: null, agreeCount: 0, requiredCount: 2, averageYepMs: null };
  s.shared.proposalVersion = 2;
  const entries: { commandId: string; build: (snapshot: RoomSnapshot) => RoomCommand | null }[] = [];
  const cmd = roomCommands(async (c) => { if (typeof c === 'function') entries.push({ commandId: String(entries.length), build: c }); return true; }, () => s, () => overlayRoom(s, null, entries));
  await cmd.agree(true);
  await cmd.agree(false);
  const landed = { ...s, own: { ...s.own, agreement: { ...s.own.agreement, proposalVersion: 2, agreed: true, revision: 1 } } };
  assert.equal((entries[1].build(landed) as { expectedOwnAgreementRevision: number }).expectedOwnAgreementRevision, 1);
});

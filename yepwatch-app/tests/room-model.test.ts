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
  const cmd = roomCommands(async (c) => { sent.push(c); return true; }, () => s);
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
    { type: 'start', expectedRosterVersion: 1, expectedContextVersion: 7, hostReady: true },
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

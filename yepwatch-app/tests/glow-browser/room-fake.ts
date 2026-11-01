/**
 * An isolated fake of the redesigned room API for browser tests: ideas, per-person services, host
 * switches, rename, seen titles, and the existing voting, proposal and agreement commands. Friends
 * are participants the test edits directly (`f.room`, then `f.push()` to bump the revision).
 */
import type { Page, Route } from '@playwright/test';
import type { CatalogMetadata, CommandEnvelope, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from '../continuous-fixture';

export interface Idea { id: string; text: string; authorId: string; on: boolean; attributes: [] }
export type FakeParticipant = RoomSnapshot['shared']['participants'][number] & { serviceIds?: number[] | null };
export type FakeSnapshot = {
  shared: Omit<RoomSnapshot['shared'], 'participants'> & { ideas: Idea[]; disabledServiceIds: number[]; participants: FakeParticipant[] };
  own: RoomSnapshot['own'] & { showSeen?: boolean };
};

export const metadata: CatalogMetadata = {
  countries: [{ code: 'DE', name: 'Germany' }, { code: 'US', name: 'United States' }],
  services: [
    { id: 8, name: 'Netflix', logoUrl: null }, { id: 9, name: 'Amazon Prime Video', logoUrl: null }, { id: 337, name: 'Disney Plus', logoUrl: null },
    { id: 350, name: 'Apple TV+', logoUrl: null }, { id: 531, name: 'Paramount Plus', logoUrl: null }, { id: 1899, name: 'HBO Max', logoUrl: null },
  ],
  providerGroups: [
    { id: 8, name: 'Netflix', logoUrl: null, selectionIds: [8] }, { id: 9, name: 'Amazon Prime Video', logoUrl: null, selectionIds: [9] },
    { id: 337, name: 'Disney Plus', logoUrl: null, selectionIds: [337] }, { id: 350, name: 'Apple TV+', logoUrl: null, selectionIds: [350] },
    { id: 531, name: 'Paramount Plus', logoUrl: null, selectionIds: [531] }, { id: 1899, name: 'HBO Max', logoUrl: null, selectionIds: [1899] },
  ],
  moods: [],
};

/** A fresh room as the server creates it: setup, no ideas, a host without a name or services. */
export function newRoom(): FakeSnapshot {
  const s = continuousFixture() as unknown as FakeSnapshot;
  s.shared.phase = 'setup';
  s.shared.screens = [{ id: 'room', label: 'Our room', country: null, serviceIds: [], confirmed: false }];
  s.shared.participants = [{ participantId: 'host', nickname: '', screenId: 'room', ready: true, serviceIds: [] }];
  s.shared.ideas = [];
  s.shared.disabledServiceIds = [];
  s.shared.stream = { version: 1, state: 'ready', reason: null };
  return s;
}
/** A room already choosing: named host with Netflix, an idea, two cards. */
export function choosingRoom(): FakeSnapshot {
  const s = newRoom();
  s.shared.phase = 'choosing';
  s.shared.screens = [{ id: 'room', label: 'Our room', country: 'DE', serviceIds: [8], confirmed: true }];
  s.shared.participants = [
    { participantId: 'host', nickname: 'Alp', screenId: 'room', ready: true, serviceIds: [8] },
    { participantId: 'mia', nickname: 'Mia', screenId: 'room', ready: true, serviceIds: [8, 337] },
  ];
  s.shared.ideas = [{ id: 'i1', text: 'cheer me up', authorId: 'host', on: true, attributes: [] }];
  return s;
}

const union = (s: FakeSnapshot) => [...new Set(s.shared.participants.filter((p) => !p.dropped).flatMap((p) => p.serviceIds ?? []))].filter((id) => !s.shared.disabledServiceIds.includes(id));

export async function fakeRoom(page: Page, room: FakeSnapshot = newRoom(), opts: { invite?: string } = {}) {
  const commands: CommandEnvelope[] = [];
  const receipts = new Set<string>();
  let loseNext = false;
  let ideaSeq = room.shared.ideas.length;
  const me = () => room.shared.participants.find((p) => p.participantId === room.own.participantId)!;
  const bump = () => { room.shared.revision++; };
  const nextCard = () => room.shared.candidates.find((c) => !room.own.votes.some((v) => v.candidateId === c.id && v.value !== null))?.id ?? null;
  function apply(body: CommandEnvelope) {
    const c = body.command as CommandEnvelope['command'] | { type: string; [k: string]: unknown };
    bump();
    room.own.nextSequence++;
    switch (c.type) {
      case 'add_idea': room.shared.ideas.push({ id: `i${++ideaSeq}`, text: String(c.text), authorId: room.own.participantId, on: room.own.canHost, attributes: [] }); break;
      case 'edit_idea': room.shared.ideas = room.shared.ideas.map((i) => (i.id === c.ideaId ? { ...i, text: String(c.text) } : i)); break;
      case 'remove_idea': room.shared.ideas = room.shared.ideas.filter((i) => i.id !== c.ideaId); break;
      case 'set_idea': room.shared.ideas = room.shared.ideas.map((i) => (i.id === c.ideaId ? { ...i, on: Boolean(c.on) } : i)); break;
      case 'set_services': me().serviceIds = c.serviceIds as number[]; break;
      case 'set_service_enabled': {
        const ids = c.serviceIds as number[];
        room.shared.disabledServiceIds = c.enabled ? room.shared.disabledServiceIds.filter((id) => !ids.includes(id)) : [...new Set([...room.shared.disabledServiceIds, ...ids])];
        break;
      }
      case 'configure':
        if (c.country) room.shared.screens[0] = { ...room.shared.screens[0], country: String(c.country), confirmed: true };
        if (c.constraints) room.shared.constraints = c.constraints as RoomSnapshot['shared']['constraints'];
        room.shared.contextVersion++;
        break;
      case 'rename': me().nickname = String(c.nickname); break;
      case 'set_show_seen': room.own.showSeen = Boolean(c.show); break;
      case 'start': room.shared.phase = 'choosing'; break;
      case 'vote': {
        const v = c as Extract<CommandEnvelope['command'], { type: 'vote' }>;
        const old = room.own.votes.find((x) => x.candidateId === v.candidateId);
        room.own.votes = room.own.votes.filter((x) => x.candidateId !== v.candidateId);
        room.own.votes.push({ candidateId: v.candidateId, value: v.value, revision: (old?.revision ?? 0) + 1, activeExposureMs: v.activeExposureMs ?? null, timingSource: v.activeExposureMs == null ? 'unavailable' : 'active_exposure' });
        room.own.nextCandidateId = nextCard();
        break;
      }
      case 'propose': {
        room.shared.proposalVersion++;
        room.shared.proposal = { candidateId: String(c.candidateId), version: room.shared.proposalVersion, previousCandidateId: room.shared.proposal?.candidateId ?? null, agreeCount: 1, requiredCount: room.shared.participants.filter((p) => !p.dropped).length, averageYepMs: null };
        room.own.agreement = { proposalVersion: room.shared.proposalVersion, agreed: true, revision: room.own.agreement.revision + 1, isProposer: true };
        break;
      }
      case 'agree':
        room.own.agreement = { proposalVersion: room.shared.proposalVersion, agreed: Boolean(c.agreed), revision: room.own.agreement.revision + 1, isProposer: room.own.agreement.isProposer };
        if (room.shared.proposal) room.shared.proposal.agreeCount += c.agreed ? 1 : -1;
        break;
      case 'restart':
        Object.assign(room.shared, { phase: 'setup', decision: null, proposal: null, matches: [] });
        room.shared.generation++;
        room.own.votes = [];
        room.own.nextCandidateId = room.shared.candidates[0]?.id ?? null;
        break;
      case 'leave': room.own.left = true; break;
      case 'assign_screen': me().screenId = String(c.screenId); room.shared.rosterVersion++; break;
      case 'ready': me().ready = Boolean(c.ready); break;
      // No more cards in this fixture: the stream says so (the app keeps showing Finding more).
      case 'refill': room.shared.stream = { version: room.shared.stream.version + 1, state: 'exhausted', reason: 'catalog_end' }; break;
    }
    room.shared.screens[0].serviceIds = union(room);
  }
  const handler = async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/catalog/metadata')) return route.fulfill({ json: metadata });
    if (path.endsWith('/member/start') || path.endsWith('/realtime-ticket'))
      return route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'Not in this fixture', retryable: false } } });
    if (path.endsWith('/guest/resolve-invite')) return route.fulfill({ json: { roomId: room.shared.roomId } });
    if (route.request().method() === 'POST' && (path.endsWith('/rooms') || path.endsWith('/join'))) {
      const body = route.request().postDataJSON() as { nickname: string };
      if (path.endsWith('/join')) {
        room.own.participantId = 'guest';
        room.own.canHost = false;
        room.shared.participants.push({ participantId: 'guest', nickname: body.nickname, screenId: null, ready: false, serviceIds: null });
      } else me().nickname = body.nickname;
      bump();
      return route.fulfill({ json: { credential: { roomId: room.shared.roomId, participantId: room.own.participantId, token: 'fixture', expiresAt: room.shared.expiresAt }, invite: { code: opts.invite ?? 'K7QX', path: `/r/${opts.invite ?? 'K7QX'}` }, snapshot: room } });
    }
    if (path.endsWith('/commands')) {
      const body = route.request().postDataJSON() as CommandEnvelope;
      commands.push(body);
      if (!receipts.has(body.commandId)) { receipts.add(body.commandId); apply(body); }
      if (loseNext) { loseNext = false; return route.abort(); }
      return route.fulfill({ json: { receipt: {}, snapshot: room } });
    }
    if (route.request().method() === 'GET' && path.endsWith(`/rooms/${room.shared.roomId}`)) {
      room.shared.screens[0].serviceIds = union(room);
      return route.fulfill({ json: room });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'Not in this fixture', retryable: false } } });
  };
  await page.route('**/api/yepwatch/v1/proposal/**', handler);
  return {
    room,
    commands,
    sent: () => commands.map((c) => c.command.type as string),
    lose: () => { loseNext = true; },
    /** A friend's change: bump the revision; the page sees it on its next read. */
    push: () => bump(),
  };
}

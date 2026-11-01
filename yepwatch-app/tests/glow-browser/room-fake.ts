/**
 * An isolated fake of the redesigned room API for browser tests: ideas, per-person services, host
 * switches, rename, seen titles, and the existing voting, proposal and agreement commands. Friends
 * are participants the test edits directly (`f.room`, then `f.push()` to bump the revision).
 */
import type { Page, Route } from '@playwright/test';
import type { CatalogMetadata, CommandEnvelope, InvitePreview, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from '../continuous-fixture';

export type FakeSnapshot = RoomSnapshot;

export const metadata: CatalogMetadata = {
  countries: [{ code: 'DE', name: 'Germany' }, { code: 'US', name: 'United States' }],
  services: [
    { id: 8, name: 'Netflix', logoUrl: null }, { id: 9, name: 'Amazon Prime Video', logoUrl: null }, { id: 337, name: 'Disney Plus', logoUrl: null },
    { id: 350, name: 'Apple TV+', logoUrl: null }, { id: 531, name: 'Paramount Plus', logoUrl: null }, { id: 1899, name: 'HBO Max', logoUrl: null },
  ],
  // As the server sends them: named after the subscription, big ones first.
  providerGroups: [
    { id: 8, name: 'Netflix', logoUrl: null, selectionIds: [8], minor: false }, { id: 9, name: 'Prime Video', logoUrl: null, selectionIds: [9], minor: false },
    { id: 337, name: 'Disney+', logoUrl: null, selectionIds: [337], minor: false }, { id: 1899, name: 'HBO Max', logoUrl: null, selectionIds: [1899], minor: false },
    { id: 350, name: 'Apple TV+', logoUrl: null, selectionIds: [350], minor: false }, { id: 531, name: 'Paramount+', logoUrl: null, selectionIds: [531], minor: false },
  ],
  moods: [],
};

/** A fresh room as the server creates it: setup, no ideas, no country yet, a host without a name or services. */
export function newRoom(): FakeSnapshot {
  const s = continuousFixture();
  s.shared.phase = 'setup';
  s.shared.screens = [];
  s.shared.participants = [{ participantId: 'host', nickname: '', screenId: null, ready: false, serviceIds: null }];
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

/**
 * `member: 'return'`: Continue with GoodWatch "signs in" at once: the account is linked and the
 * browser comes straight back to the room (as the real round trip does, a full page load).
 */
export async function fakeRoom(page: Page, room: FakeSnapshot = newRoom(), opts: { invite?: string; interpretations?: number; preview?: 'fail'; member?: 'return' } = {}) {
  // The room's lifetime idea searches (24 on the server); removing an idea doesn't give one back.
  let interpretations = opts.interpretations ?? 0;
  const commands: CommandEnvelope[] = [];
  const receipts = new Set<string>();
  let loseNext = false;
  let refuseRefills = 0;
  /** Commands of these types wait for the test to release them (another command in flight). */
  const gates = new Map<string, Promise<void>>();
  const me = () => room.shared.participants.find((p) => p.participantId === room.own.participantId)!;
  const bump = () => { room.shared.revision++; };
  const nextCard = () => room.shared.candidates.find((c) => !room.own.votes.some((v) => v.candidateId === c.id && v.value !== null))?.id ?? null;
  /** The server's refusals the app answers in place; null when the command applies. */
  function refuse(c: CommandEnvelope['command']): { status: number; code: string; message: string } | null {
    if ((c.type === 'set_services' || c.type === 'set_service_enabled') && !room.shared.screens[0]?.country) return { status: 409, code: 'needs_context', message: 'Choose a country first' };
    if (c.type === 'refill' && !union(room).length) return { status: 409, code: 'needs_context', message: 'Nobody brings a service' };
    if (c.type === 'add_idea' && room.shared.ideas.length >= 8) return { status: 409, code: 'limit_reached', message: 'At most eight ideas' };
    if ((c.type === 'add_idea' || c.type === 'edit_idea') && interpretations >= 24) return { status: 409, code: 'limit_reached', message: 'Room interpretation budget reached' };
    if ((c.type === 'set_idea' || c.type === 'set_service_enabled' || c.type === 'configure') && !room.own.canHost) return { status: 403, code: 'forbidden', message: 'Only the host can change this setting' };
    return null;
  }
  function apply(body: CommandEnvelope) {
    const c = body.command;
    bump();
    room.own.nextSequence++;
    switch (c.type) {
      // The command id becomes the idea's id; the host's ideas start on.
      case 'add_idea': interpretations++; room.shared.ideas.push({ id: body.commandId, text: c.text, authorId: room.own.participantId, on: room.own.canHost, attributes: [] }); break;
      case 'edit_idea': interpretations++; room.shared.ideas = room.shared.ideas.map((i) => (i.id === c.ideaId ? { ...i, text: c.text } : i)); break;
      case 'remove_idea': room.shared.ideas = room.shared.ideas.filter((i) => i.id !== c.ideaId); break;
      case 'set_idea': room.shared.ideas = room.shared.ideas.map((i) => (i.id === c.ideaId ? { ...i, on: c.on } : i)); break;
      case 'set_services': me().serviceIds = c.serviceIds; break;
      case 'set_service_enabled': {
        const ids = c.serviceIds;
        room.shared.disabledServiceIds = c.enabled ? room.shared.disabledServiceIds.filter((id) => !ids.includes(id)) : [...new Set([...room.shared.disabledServiceIds, ...ids])];
        break;
      }
      case 'configure':
        if (c.country) room.shared.screens[0] = { ...(room.shared.screens[0] ?? { id: 'room', label: 'Our room', serviceIds: [] }), country: c.country, confirmed: true };
        if (c.constraints) room.shared.constraints = c.constraints;
        room.shared.contextVersion++;
        break;
      case 'rename': me().nickname = c.nickname; break;
      case 'set_show_seen': room.own.showSeen = c.show; break;
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
        room.shared.proposal = { candidateId: c.candidateId, version: room.shared.proposalVersion, previousCandidateId: room.shared.proposal?.candidateId ?? null, agreeCount: 1, requiredCount: room.shared.participants.filter((p) => !p.dropped).length, averageYepMs: null };
        room.own.agreement = { proposalVersion: room.shared.proposalVersion, agreed: true, revision: room.own.agreement.revision + 1, isProposer: true };
        break;
      }
      case 'agree':
        room.own.agreement = { proposalVersion: room.shared.proposalVersion, agreed: c.agreed, revision: room.own.agreement.revision + 1, isProposer: room.own.agreement.isProposer };
        if (room.shared.proposal) room.shared.proposal.agreeCount += c.agreed ? 1 : -1;
        break;
      case 'restart':
        Object.assign(room.shared, { phase: 'setup', decision: null, proposal: null, matches: [] });
        room.shared.generation++;
        room.own.votes = [];
        room.own.nextCandidateId = room.shared.candidates[0]?.id ?? null;
        break;
      case 'leave': room.own.left = true; break;
      case 'assign_screen': me().screenId = c.screenId; room.shared.rosterVersion++; break;
      case 'ready': me().ready = c.ready; break;
      // No more cards in this fixture: the stream says so (the app keeps showing Finding more).
      case 'refill': room.shared.stream = { version: room.shared.stream.version + 1, state: 'exhausted', reason: 'catalog_end' }; break;
    }
    // Like the server: room settings keep one shared screen, and everyone present is on it.
    if (['add_idea', 'edit_idea', 'remove_idea', 'set_idea', 'set_services', 'set_service_enabled', 'configure', 'rename', 'set_show_seen'].includes(c.type) && room.shared.screens[0])
      for (const p of room.shared.participants) Object.assign(p, { screenId: room.shared.screens[0].id, ready: true });
    if (room.shared.screens[0]) room.shared.screens[0].serviceIds = union(room);
  }
  const handler = async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/catalog/metadata')) return route.fulfill({ json: metadata });
    if (path.endsWith('/member/start') && opts.member === 'return') {
      room.own.member = { state: 'linked', prefill: null };
      bump();
      return route.fulfill({ json: { authorizeUrl: new URL(`/room/${room.shared.roomId}`, route.request().headers().referer ?? 'http://127.0.0.1:8097').href, state: 'fixture-state', expiresAt: Date.now() + 600_000 } });
    }
    if (path.endsWith('/member/start') || path.endsWith('/realtime-ticket'))
      return route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'Not in this fixture', retryable: false } } });
    // The public invite preview, as the server builds it: switched-on ideas only, people who haven't left.
    if (path.endsWith('/invites/preview')) {
      if (opts.preview === 'fail') return route.fulfill({ status: 503, json: { error: { code: 'catalog_unavailable', message: 'Preview unavailable', retryable: false } } });
      const preview: InvitePreview = {
        roomId: room.shared.roomId.padEnd(32, '0').slice(0, 32),
        hostName: room.shared.participants.find((p) => p.participantId === 'host')?.nickname || null,
        ideas: room.shared.ideas.filter((i) => i.on).map((i) => ({ text: i.text })),
        kinds: room.shared.constraints.kinds,
        phase: room.shared.phase === 'setup' || room.shared.phase === 'decided' ? room.shared.phase : 'choosing',
        people: room.shared.participants.filter((p) => !p.dropped).length,
      };
      return route.fulfill({ json: preview });
    }
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
      const gate = gates.get(body.command.type);
      if (gate) await gate;
      if (body.command.type === 'refill' && refuseRefills > 0 && !receipts.has(body.commandId)) {
        refuseRefills--;
        return route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'Try again', retryable: false }, snapshot: room } });
      }
      const refused = receipts.has(body.commandId) ? null : refuse(body.command);
      if (refused) return route.fulfill({ status: refused.status, json: { error: { code: refused.code, message: refused.message, retryable: false }, snapshot: room } });
      if (!receipts.has(body.commandId)) { receipts.add(body.commandId); apply(body); }
      if (loseNext) { loseNext = false; return route.abort(); }
      return route.fulfill({ json: { receipt: {}, snapshot: room } });
    }
    if (route.request().method() === 'GET' && path.endsWith(`/rooms/${room.shared.roomId}`)) {
      if (room.shared.screens[0]) room.shared.screens[0].serviceIds = union(room);
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
    /** Holds commands of one type in flight until the returned release is called. */
    hold: (type: string) => {
      let release = () => {};
      gates.set(type, new Promise<void>((r) => { release = () => { gates.delete(type); r(); }; }));
      return () => release();
    },
    /** The next n refills are refused (the app's send returns false). */
    refuseRefills: (n: number) => { refuseRefills = n; },
  };
}

/**
 * The room as the redesigned screens see it, and the commands they send: ideas, per-person
 * services, host switches, rename and seen titles, straight from contract 3.
 */
import type { Candidate, RoomCommand, RoomConstraints, RoomIdea, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

export type Kind = 'movie' | 'show_start';
export const IDEA_LIMITS = { min: 2, max: 200, perRoom: 8 } as const;
export const NAME_MAX = 40;

export interface RoomPerson {
  id: string;
  nickname: string;
  self: boolean;
  host: boolean;
  dropped: boolean;
  /** Null: not picked yet. */
  serviceIds: number[] | null;
  /** Part of the current round (needed for matches and agreement). */
  inRound: boolean;
}
export interface Face { id: string; nickname: string; self?: boolean; dropped?: boolean }
export interface IdeaView {
  id: string;
  text: string;
  on: boolean;
  author: RoomPerson | null;
  mine: boolean;
  /** A friend's suggestion the host hasn't switched on (shown as NEW to the host). */
  fresh: boolean;
}
export interface ProposalView {
  candidateId: string;
  candidate: Candidate | null;
  version: number;
  agreeCount: number;
  requiredCount: number;
  mine: boolean;
  agreed: boolean;
}

export interface RoomView {
  roomId: string;
  phase: RoomSnapshot['shared']['phase'];
  generation: number;
  isHost: boolean;
  me: RoomPerson;
  host: RoomPerson | null;
  /** The host's name, or '' while a guest host hasn't named themselves. */
  hostName: string;
  /** Everyone still in the room. */
  people: RoomPerson[];
  faces: Face[];
  ideas: IdeaView[];
  activeIdeas: IdeaView[];
  /** Short room name: "cheer me up +1", or "Anything". */
  label: string;
  /** Every switched-on idea: "cheer me up · space adventure", or "Anything". */
  title: string;
  /** New suggestions waiting for the host (0 for everyone else). */
  newSuggestions: number;
  canAddIdea: boolean;
  kinds: Kind[];
  country: string | null;
  myServiceIds: number[] | null;
  /** Everyone's services together, before the host's switches. */
  roomServiceIds: number[];
  disabledServiceIds: number[];
  enabledServiceIds: number[];
  /** Friends who still pick their services. */
  picking: RoomPerson[];
  needName: boolean;
  canStart: boolean;
  member: boolean;
  /** Linked members only: seen titles show again. Null for guests. */
  showSeen: boolean | null;
  matches: Candidate[];
  proposal: ProposalView | null;
  decision: Candidate | null;
}

export function ideasLabel(active: readonly { text: string }[]) {
  return active.length === 0 ? 'Anything' : active.length === 1 ? active[0].text : `${active[0].text} +${active.length - 1}`;
}

export function roomView(snapshot: RoomSnapshot): RoomView {
  const { shared, own } = snapshot;
  const all: RoomPerson[] = shared.participants.map((p) => ({
    id: p.participantId,
    nickname: p.nickname.trim(),
    self: p.participantId === own.participantId,
    host: p.participantId === shared.hostParticipantId,
    dropped: Boolean(p.dropped),
    serviceIds: p.serviceIds,
    inRound: Boolean(p.screenId) && !p.dropped,
  }));
  const me = all.find((p) => p.self) ?? { id: own.participantId, nickname: '', self: true, host: own.canHost, dropped: Boolean(own.left), serviceIds: null, inRound: false };
  const host = all.find((p) => p.host) ?? null;
  const people = all.filter((p) => !p.dropped);
  const isHost = own.canHost;
  const screen = shared.screens[0];
  const disabled = shared.disabledServiceIds;
  const roomServiceIds = [...new Set(people.flatMap((p) => p.serviceIds ?? []))];
  const enabledServiceIds = roomServiceIds.filter((id) => !disabled.includes(id));
  const ideas = shared.ideas.map((i: RoomIdea): IdeaView => {
    const author = all.find((p) => p.id === i.authorId) ?? null;
    return { id: i.id, text: i.text, on: i.on, author, mine: i.authorId === own.participantId, fresh: !i.on && i.authorId !== shared.hostParticipantId };
  });
  const activeIdeas = ideas.filter((i) => i.on);
  const kinds = shared.constraints.kinds.filter((k): k is Kind => k === 'movie' || k === 'show_start');
  const country = screen?.country ?? null;
  const candidate = (id: string | null | undefined) => shared.candidates.find((c) => c.id === id) ?? null;
  const proposalOwn = own.agreement.proposalVersion === shared.proposalVersion;
  const member = own.member.state === 'linked';
  return {
    roomId: shared.roomId,
    phase: shared.phase,
    generation: shared.generation,
    isHost,
    me,
    host,
    hostName: host?.nickname ?? '',
    people,
    faces: people.map((p) => ({ id: p.id, nickname: p.nickname || (p.self ? 'You' : '?'), self: p.self })),
    ideas,
    activeIdeas,
    label: ideasLabel(activeIdeas),
    title: activeIdeas.map((i) => i.text).join(' · ') || 'Anything',
    newSuggestions: isHost ? ideas.filter((i) => i.fresh).length : 0,
    canAddIdea: ideas.length < IDEA_LIMITS.perRoom,
    kinds,
    country,
    myServiceIds: me.serviceIds,
    roomServiceIds,
    disabledServiceIds: disabled,
    enabledServiceIds,
    picking: people.filter((p) => !p.self && p.serviceIds === null),
    needName: !me.nickname,
    canStart: isHost && Boolean(me.nickname) && enabledServiceIds.length > 0 && kinds.length > 0 && Boolean(country),
    member,
    showSeen: member ? own.showSeen : null,
    matches: shared.matches.map((m) => candidate(m.candidateId)).filter((c): c is Candidate => Boolean(c)),
    proposal: shared.proposal ? {
      candidateId: shared.proposal.candidateId,
      candidate: candidate(shared.proposal.candidateId),
      version: shared.proposal.version,
      agreeCount: shared.proposal.agreeCount,
      requiredCount: shared.proposal.requiredCount,
      mine: proposalOwn && own.agreement.isProposer,
      agreed: proposalOwn && own.agreement.agreed,
    } : null,
    decision: candidate(shared.decision?.candidateId),
  };
}

/** A proposal takes over the screen of everyone in the round until it's decided or set aside on this device. */
export function showsProposal(view: RoomView, dismissedVersion: number | null) {
  return view.phase === 'choosing' && Boolean(view.proposal) && view.me.inRound && dismissedVersion !== view.proposal!.version;
}

/** The status line under a room's name on the start page. */
export function statusLine(view: RoomView) {
  if (view.phase === 'decided') return view.decision ? `Tonight: ${view.decision.title}` : 'Tonight';
  if (view.phase === 'setup') return 'Setting up';
  if (view.proposal) return `Proposed: ${view.proposal.candidate?.title ?? 'a match'}`;
  return `Choosing · ${view.matches.length} ${view.matches.length === 1 ? 'match' : 'matches'}`;
}

/** Bringers of one service tile: everyone whose own services include it. */
export function bringers(view: RoomView, ids: readonly number[]) {
  return view.people.filter((p) => (p.serviceIds ?? []).some((id) => ids.includes(id)));
}

/** Text size from length: one line when it fits, else two lines, never below 17 px. */
export function fitSize(text: string, width: number, max: number) {
  const one = width / (Math.max(1, text.length) * 0.56);
  if (one >= 22) return Math.min(max, Math.floor(one));
  return Math.max(17, Math.min(26, Math.floor((width * 2) / (Math.max(1, text.length) * 0.56))));
}

type Send = (command: RoomCommand) => Promise<boolean>;

/**
 * Every command the redesigned screens send, built against the latest confirmed snapshot so
 * version guards are never stale.
 */
export function roomCommands(send: Send, latest: () => RoomSnapshot | undefined) {
  const at = <T,>(fn: (s: RoomSnapshot) => Promise<T>, fallback: T) => { const s = latest(); return s ? fn(s) : Promise.resolve(fallback); };
  return {
    addIdea: (text: string) => send({ type: 'add_idea', text: text.trim() }),
    editIdea: (ideaId: string, text: string) => send({ type: 'edit_idea', ideaId, text: text.trim() }),
    removeIdea: (ideaId: string) => send({ type: 'remove_idea', ideaId }),
    setIdea: (ideaId: string, on: boolean) => send({ type: 'set_idea', ideaId, on }),
    setServices: (serviceIds: number[]) => send({ type: 'set_services', serviceIds: [...new Set(serviceIds)].sort((a, b) => a - b) }),
    setServiceEnabled: (serviceIds: number[], enabled: boolean) => send({ type: 'set_service_enabled', serviceIds, enabled }),
    rename: (nickname: string) => send({ type: 'rename', nickname: nickname.trim() }),
    setShowSeen: (show: boolean) => send({ type: 'set_show_seen', show }),
    configure: (patch: { country?: string; constraints?: RoomConstraints }) =>
      at((s) => send({ type: 'configure', expectedContextVersion: s.shared.contextVersion, ...patch }), false),
    start: () => at((s) => send({ type: 'start', expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion, hostReady: true }), false),
    vote: (candidateId: string, yes: boolean, activeExposureMs: number | null) => at((s) => {
      const current = s.own.votes.find((v) => v.candidateId === candidateId);
      return send({ type: 'vote', generation: s.shared.generation, candidateId, expectedVoteRevision: current?.revision ?? 0, value: yes ? 'watch' : 'pass', activeExposureMs: yes ? activeExposureMs : null });
    }, false),
    undo: (target: { candidateId: string; revision: number }) =>
      at((s) => send({ type: 'vote', generation: s.shared.generation, candidateId: target.candidateId, expectedVoteRevision: target.revision, value: null }), false),
    propose: (candidateId: string) =>
      at((s) => send({ type: 'propose', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId }), false),
    agree: (agreed: boolean) => at((s) => s.shared.proposal
      ? send({ type: 'agree', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId: s.shared.proposal.candidateId, expectedOwnAgreementRevision: s.own.agreement.revision, agreed })
      : Promise.resolve(false), false),
    retryAgreement: () => at((s) => send({ type: 'retry_agreement', generation: s.shared.generation, expectedAgreementVersion: s.shared.agreement.version, expectedProposalVersion: s.shared.proposalVersion }), false),
    refill: () => at((s) => send({ type: 'refill', generation: s.shared.generation, expectedStreamVersion: s.shared.stream.version }), false),
    restart: () => at((s) => send({ type: 'restart', expectedRevision: s.shared.revision }), false),
    leave: () => send({ type: 'leave' }),
  };
}
export type RoomCommands = ReturnType<typeof roomCommands>;

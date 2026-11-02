/**
 * What the room looks like once this device's unconfirmed commands land. The confirmed snapshot stays
 * the authority (version guards, retries, reconciling): this overlay is rendered on top of it and
 * simply stops applying when a command settles, so a refused command reverts by itself. Every step is
 * safe to apply twice, because a friend's broadcast can bring our own change before our answer does.
 */
import type { CommandEnvelope, RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

/** Builds the command against the given snapshot, so version guards are never stale when it is sent. */
export type CommandBuild = (snapshot: RoomSnapshot) => RoomCommand | null;
export interface QueuedCommand { commandId: string; build: CommandBuild }

/** The server decides what these lead to, so the screen waits for its answer. */
const SERVER_DECIDES: ReadonlySet<RoomCommand['type']> = new Set<RoomCommand['type']>(['start', 'propose', 'restart', 'leave', 'retry_agreement']);
export const awaitsServer = (command: RoomCommand) => SERVER_DECIDES.has(command.type);

export function previewCommand<T extends RoomSnapshot>(s: T, commandId: string, c: RoomCommand): T {
  const me = s.own.participantId;
  const shared = (patch: Partial<T['shared']>): T => ({ ...s, shared: { ...s.shared, ...patch } });
  const own = (patch: Partial<T['own']>): T => ({ ...s, own: { ...s.own, ...patch } });
  const ideas = (fn: (i: T['shared']['ideas'][number]) => T['shared']['ideas'][number]) => shared({ ideas: s.shared.ideas.map(fn) } as Partial<T['shared']>);
  const participant = (patch: Partial<RoomSnapshot['shared']['participants'][number]>) =>
    shared({ participants: s.shared.participants.map((p) => (p.participantId === me ? { ...p, ...patch } : p)) } as Partial<T['shared']>);
  switch (c.type) {
    case 'add_idea':
      // The server names the idea after the command, so this row is already the real one.
      if (s.shared.ideas.some((i) => i.id === commandId)) return s;
      return shared({ ideas: [...s.shared.ideas, { id: commandId, text: c.text, authorId: me, on: s.own.canHost, attributes: [] }] } as Partial<T['shared']>);
    case 'edit_idea': return ideas((i) => (i.id === c.ideaId ? { ...i, text: c.text } : i));
    case 'set_idea': return ideas((i) => (i.id === c.ideaId ? { ...i, on: c.on } : i));
    case 'remove_idea': return shared({ ideas: s.shared.ideas.filter((i) => i.id !== c.ideaId) } as Partial<T['shared']>);
    case 'set_services': return participant({ serviceIds: c.serviceIds });
    case 'rename': return participant({ nickname: c.nickname });
    case 'set_service_enabled':
      return shared({ disabledServiceIds: c.enabled ? s.shared.disabledServiceIds.filter((id) => !c.serviceIds.includes(id)) : [...new Set([...s.shared.disabledServiceIds, ...c.serviceIds])] } as Partial<T['shared']>);
    case 'set_show_seen': return own({ showSeen: c.show } as Partial<T['own']>);
    case 'configure': {
      const [screen, ...rest] = s.shared.screens;
      const screens = c.country ? [{ ...(screen ?? { id: 'room', label: '', serviceIds: [], confirmed: true }), country: c.country }, ...rest] : s.shared.screens;
      return shared({ screens, constraints: c.constraints ?? s.shared.constraints } as Partial<T['shared']>);
    }
    case 'vote': {
      if (c.generation !== s.shared.generation) return s;
      const old = s.own.votes.find((v) => v.candidateId === c.candidateId);
      const votes = [...s.own.votes.filter((v) => v.candidateId !== c.candidateId), {
        candidateId: c.candidateId, value: c.value, revision: (old?.revision ?? 0) + 1,
        activeExposureMs: c.activeExposureMs ?? null, timingSource: c.activeExposureMs == null ? 'unavailable' as const : 'active_exposure' as const,
      }];
      return own({ votes, nextCandidateId: c.value === null ? c.candidateId : null } as Partial<T['own']>);
    }
    case 'agree': {
      const { proposal } = s.shared;
      if (!proposal || proposal.candidateId !== c.candidateId || s.own.agreement.agreed === c.agreed) return s;
      const agreeCount = Math.min(proposal.requiredCount, Math.max(0, proposal.agreeCount + (c.agreed ? 1 : -1)));
      return { ...s, shared: { ...s.shared, proposal: { ...proposal, agreeCount } }, own: { ...s.own, agreement: { ...s.own.agreement, agreed: c.agreed } } };
    }
    default: return s;
  }
}

/** The confirmed room plus the command awaiting confirmation and everything queued behind it. */
export function overlayRoom<T extends RoomSnapshot>(confirmed: T, pending: CommandEnvelope | null, queued: readonly QueuedCommand[]): T {
  const unconfirmed = pending ? previewCommand(confirmed, pending.commandId, pending.command) : confirmed;
  return queued.reduce((room, entry) => {
    const command = entry.build(room);
    return command ? previewCommand(room, entry.commandId, command) : room;
  }, unconfirmed);
}

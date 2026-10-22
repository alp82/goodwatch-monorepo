import type { EpisodeChoice, ProgressConflict } from '../../../packages/yepwatch-contracts/index.ts'
import type { Room } from './types.ts'
/** A proposal is an explicit shared host action. NEVER derive one from private history, even for a querying member. */
export function continuationProposal(room: Room, showId: number, episodes: EpisodeChoice[]) {
  const proposal = room.episodeProposals.find(p => p.showId === showId)
  const proposed = proposal ? episodes.find(e => e.tmdbId === proposal.episode.tmdbId && e.season === proposal.episode.season && e.number === proposal.episode.number) ?? null : null
  const members = room.round ? room.participants.filter(p => room.round!.memberIds.includes(p.id)) : room.participants
  const conflicts = new Map<string, ProgressConflict[]>()
  for (const p of members) {
    const own = p.progress.find(s => s.showId === showId)
    const ownNext = own?.input.state === 'continue' ? own.input.nextEpisodeId : null
    const reason: ProgressConflict['reason'] | null = !episodes.length ? 'episode_catalog_unavailable'
      : proposal && !proposed ? 'episode_unavailable'
      : !own || own.input.state === 'unknown' || !proposal ? 'missing_progress'
      : ownNext !== null && !episodes.some(e => e.tmdbId === ownNext) ? 'episode_unavailable'
      : own.approvedEpisodeId === proposed?.tmdbId ? null
      : ownNext !== proposed?.tmdbId ? 'different_next_episode' : 'rewind_or_spoiler_approval'
    // proposed is PUBLIC room input; no other person's selection/history contributes to this projection.
    conflicts.set(p.id, reason ? [{ showId, reason, ownNextEpisodeId: ownNext, proposedEpisode: proposal?.episode ?? null }] : [])
  }
  return { proposed, conflicts, agreed: !!proposed && [...conflicts.values()].every(c => c.length === 0) }
}

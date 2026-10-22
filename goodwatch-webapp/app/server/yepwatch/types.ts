import type { Candidate, CatalogMetadata, CommandEnvelope, EpisodeChoice, EpisodeIdentity, RoomConstraints, RoomPhase, ScreenContext, ShowProgress, ShowSearchResponse, VoteValue } from '../../../packages/yepwatch-contracts/index.ts'
export const LIMITS = { participants: 12, screens: 12, deck: 20, receipts: 64, tickets: 4, roomMs: 6 * 60 * 60 * 1000, aggregateBytes: 512_000 } as const
export interface Participant {
  id: string; nickname: string; tokenHash: string; admissionHash: string; admissionCommand: string
  screenId: string | null; ready: boolean; epoch: number; nextSequence: number
  votes: Record<string, { value: VoteValue | null; revision: number }>
  progress: ShowProgress[]; complete: boolean; preference: string | null
  consent: { proposalVersion: number; accepted: boolean } | null
  receipts: { commandId: string; sequence: number; digest: string; revision: number }[]
}
export interface Room {
  format: 1; id: string; revision: number; expiresAt: number; hostId: string; inviteHash: string
  phase: RoomPhase; rosterVersion: number; contextVersion: number; roundVersion: number
  screens: ScreenContext[]; constraints: RoomConstraints; participants: Participant[]
  episodeProposals: { showId: number; episode: EpisodeIdentity; version: number }[]
  round: { version: number; rosterVersion: number; contextVersion: number; memberIds: string[] } | null
  candidates: Candidate[]; shortlist: string[] | null; shortlistVersion: number; proposalVersion: number
  proposedId: string | null; decision: { candidateId: string; proposalVersion: number; decidedAt: number; availability: Candidate['availability'] } | null
  tickets: { hash: string; participantId: string; epoch: number; expiresAt: number }[]
}
export interface StoredRoom<T = Room> { room: T; seq: number; term: number; pendingRevision: number }
export interface RoomRepository<T = Room> {
  read(id: string): Promise<StoredRoom<T> | null>
  insert(room: T): Promise<boolean>
  compareAndSwap(previous: StoredRoom<T>, room: T, notify: boolean): Promise<boolean>
  pending(limit: number): Promise<string[]>
  acknowledge(id: string, revision: number): Promise<void>
}
export interface CatalogPort {
  metadata(country: string | null): Promise<CatalogMetadata>
  searchShows(query: string): Promise<ShowSearchResponse>
  episodes(showId: number): Promise<EpisodeChoice[]>
  /** Domain adapter must intersect every occupied screen and reconcile all included people's progress. */
  candidates(room: Room): Promise<Candidate[]>
  recheck(room: Room, candidate: Candidate): Promise<Candidate['availability']>
}
export type RevisionPublisher = (event: { roomId: string; revision: number }) => Promise<void>
export interface Applied { room: Room; envelope: CommandEnvelope }

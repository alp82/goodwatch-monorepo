/** Portable wire contract. No framework, transport, storage, or environment imports. */
export const API_PREFIX = "/api/yepwatch/v1" as const
export const CONTRACT_VERSION = 1 as const
export type RoomPhase = "setup" | "voting" | "shortlist" | "decided" | "expired"
export type CandidateKind = "movie" | "show_start" | "show_continue"
/** Continuation uses linked GoodWatch saved progress; never a guest/manual-history default. */
export const GUEST_CANDIDATE_KINDS = ["movie", "show_start"] as const
export type VoteValue = "watch" | "pass" | "veto"
export type Presence = "unknown" | "connected" | "reconnecting"
export interface EpisodeIdentity {
  tmdbId: number
  season: number
  number: number
  displaySeason?: number
  displayNumber?: number
  presentationVersion?: string
}
export type CandidateIdentity =
  | { kind: "movie"; tmdbId: number }
  | { kind: "show_start" | "show_continue"; tmdbId: number; episode: EpisodeIdentity }
export interface ProviderLink {
  serviceId: number
  name: string
  url: string | null
  kind: "provider" | "where_to_watch" | "search"
  offerType: "flatrate" | "free" | "ads"
}
export interface ScreenAvailability {
  screenId: string
  state: "watchable" | "no_match" | "unknown"
  /** Title evidence MUST NOT be presented as verified episode entitlement. */
  scope: "title" | "episode"
  checkedAt: number | null
  offers: ProviderLink[]
}
export interface Candidate {
  id: string
  identity: CandidateIdentity
  title: string
  year: number | null
  overview: string | null
  posterUrl: string | null
  runtimeMinutes: number | null
  availability: ScreenAvailability[]
}
export interface ScreenContext {
  id: string
  label: string
  country: string | null
  serviceIds: number[]
  confirmed: boolean
}
export interface RoomConstraints {
  kinds: CandidateKind[]
  maxMinutes: number | null
  moods: string[]
}
/** Deliberately contains no candidate ID, direction, vote value, or preference. */
export interface ParticipantActivity {
  participantId: string
  nickname: string
  screenId: string | null
  ready: boolean
  participation: "invited" | "included" | "waiting"
  completedCount: number
  /** Ephemeral presence is never readiness, consent, or a roster mutation. */
  presence: Presence
}
export interface RoundSummary {
  version: number
  rosterVersion: number
  contextVersion: number
  candidateCount: number
  completed: boolean
}
export interface Shortlist {
  version: number
  proposalVersion: number
  candidateIds: string[]
  proposedCandidateId: string | null
  /** Count only. No participant-to-choice or participant-to-consent mapping. */
  consentCount: number
}
export interface Decision {
  candidateId: string
  proposalVersion: number
  decidedAt: number
  availability: ScreenAvailability[]
}
/** Safe for ALL authorized room subscribers, including the host. */
export interface SharedRoomSnapshot {
  contractVersion: 1
  roomId: string
  revision: number
  phase: RoomPhase
  expiresAt: number
  rosterVersion: number
  contextVersion: number
  hostParticipantId: string
  participants: ParticipantActivity[]
  screens: ScreenContext[]
  constraints: RoomConstraints
  /** Explicit host proposal, never derived from private progress/history. */
  episodeProposals: { showId: number; episode: EpisodeIdentity; version: number }[]
  round: RoundSummary | null
  /** Common deck, never somebody's current card. */
  candidates: Candidate[]
  shortlist: Shortlist | null
  decision: Decision | null
}
export type ShowProgressInput =
  | { state: "unknown" }
  | { state: "not_started" }
  | { state: "continue"; nextEpisodeId: number }
export interface ShowProgress {
  showId: number
  input: ShowProgressInput
  /** Explicit agreement to this episode, including rewind/spoiler risk. No history write. */
  approvedEpisodeId: number | null
}
export interface EpisodeChoice extends EpisodeIdentity { name: string | null; airDate: string | null }
export interface ShowProgressResponse {
  showId: number
  own: ShowProgress
  episodes: EpisodeChoice[]
  conflicts: ProgressConflict[]
  catalogState: "ready" | "unavailable"
  source: "guest" | "member"
}
export type ProgressConflictReason =
  | "missing_progress" | "different_next_episode" | "rewind_or_spoiler_approval"
  | "episode_unavailable" | "episode_catalog_unavailable"
export interface ProgressConflict {
  showId: number
  reason: ProgressConflictReason
  /** Own state only; never expose another participant's progress/history. */
  ownNextEpisodeId: number | null
  proposedEpisode: EpisodeIdentity | null
}
export interface OwnPrivateSnapshot {
  participantId: string
  roundCompleted: boolean
  /** Start the next command at this value. One in-flight command per actor. */
  nextSequence: number
  canHost: boolean
  votes: { candidateId: string; value: VoteValue | null; revision: number }[]
  progress: ShowProgress[]
  progressConflicts: ProgressConflict[]
  shortlistPreference: string | null
  consent: { proposalVersion: number; accepted: boolean } | null
}
export interface RoomSnapshot { shared: SharedRoomSnapshot; own: OwnPrivateSnapshot }
export interface GuestCredential { roomId: string; participantId: string; token: string; expiresAt: number }
/** Retry admission with the SAME secret. Generate >=32 random bytes; do not log/share it. */
export interface ResolveInviteRequest { code: string }
export interface ResolveInviteResponse { roomId: string }
export interface GuestAdmissionRequest { commandId: string; admissionSecret: string; nickname: string }
export interface JoinRoomRequest extends GuestAdmissionRequest { inviteCode: string; screenId?: string }
export interface GuestAdmission {
  recovered?: boolean
  credential: GuestCredential
  invite: { code: string; path: string }
  snapshot: RoomSnapshot
}
export interface CommandEnvelope<T extends RoomCommand = RoomCommand> {
  commandId: string
  sequence: number
  command: T
}
export type RoomCommand =
  | { type: "setup"; expectedContextVersion: number; screens: ScreenContext[]; constraints: RoomConstraints; screenId: string | null }
  | { type: "assign_screen"; expectedContextVersion: number; screenId: string }
  | { type: "ready"; expectedContextVersion: number; ready: boolean }
  /** @deprecated Rejected: progress comes only from authenticated GoodWatch reads, never client-entered history. */
  | { type: "show_progress"; showId: number; input: ShowProgressInput; approvedEpisodeId: number | null }
  | { type: "propose_episode"; expectedContextVersion: number; showId: number; episodeId: number }
  | { type: "start_round"; expectedRosterVersion: number; expectedContextVersion: number; hostReady?: boolean }
  | { type: "vote"; roundVersion: number; candidateId: string; expectedVoteRevision: number; value: VoteValue | null }
  | { type: "complete_round"; roundVersion: number }
  | { type: "shortlist_preference"; shortlistVersion: number; candidateId: string }
  | { type: "propose"; shortlistVersion: number; candidateId: string }
  | { type: "consent"; proposalVersion: number; accepted: boolean }
  | { type: "decide"; proposalVersion: number }
  | { type: "new_round"; expectedRevision: number }
export interface CommandReceipt { commandId: string; sequence: number; appliedRevision: number; replayed: boolean }
export interface CommandResult { receipt: CommandReceipt; snapshot: RoomSnapshot }
export type ErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "not_found" | "expired"
  | "conflict" | "busy" | "outcome_unknown" | "limit_reached" | "needs_context"
  | "needs_progress" | "no_intersection" | "catalog_unavailable" | "not_implemented" | "member_required"
export type RecoveryAction = "retry" | "review_screen_services" | "review_constraints" | "use_guest_modes"
export type DeckFailureReason = "availability_unknown" | "episode_catalog_unavailable" | "catalog_metadata_missing" | "scan_limit" | "deadline" | "filtered_catalog_empty" | "verified_no_intersection"
export interface DeckFailureDetails {
  type: "deck"
  reason: DeckFailureReason
  reasons: DeckFailureReason[]
  actions: RecoveryAction[]
  scannedTitles: number
  poolSize: number
  scanComplete: boolean
  uncertainTitles: number
  noMatchTitles: number
  missingMetadataTitles: number
  missingEpisodeTitles: number
  screens: { screenId: string; country: string; serviceIds: number[]; watchable: number; noMatch: number; unknown: number }[]
}
export type FailureDetails = DeckFailureDetails | { type: "catalog"; reason: "catalog_loading"; actions: RecoveryAction[] } | {
  type: "access"
  reason: "member_auth_unavailable" | "manual_progress_not_supported"
  actions: RecoveryAction[]
}
export interface ApiError {
  error: { code: ErrorCode; message: string; retryable: boolean; commandId?: string; details?: FailureDetails }
  /** Supplied only to the authenticated caller, never to shared activity. */
  snapshot?: RoomSnapshot
}
export interface CatalogMetadata {
  countries: { code: string; name: string }[]
  services: { id: number; name: string; logoUrl: string | null }[]
  moods: { id: string; label: string }[]
}
export interface ShowSearchResponse { shows: { tmdbId: number; title: string; year: number | null }[] }
export interface MemberStartRequest { returnTo: string; roomId?: string }
export interface MemberStartResponse { authorizeUrl: string }
/** Member routes are reserved: guest foundation MUST NOT simulate a completed sign-in. */
export const REVISION_CHANNEL = "yepwatch:v1:revision" as const
export interface RealtimeAttachRequest { ticket: string; roomId: string }
export interface RealtimeAttachment {
  roomId: string; participantId: string; lease: string; leaseExpiresAt: number
  roomExpiresAt: number; capabilityEpoch: number; scope: "shared:read"
}
export interface RealtimeViewRequest { roomId: string; lease: string }
export interface RealtimeViewResponse extends RealtimeAttachment { snapshot: SharedRoomSnapshot }
export interface RealtimeTicket { ticket: string; expiresAt: number; websocketPath: string }
export type ClientRealtimeFrame =
  | { type: "authenticate"; ticket: string; roomId: string; lastRevision: number | null }
  | { type: "ping" }
export type ServerRealtimeFrame =
  | { type: "room.snapshot" | "room.updated"; snapshot: SharedRoomSnapshot }
  | { type: "presence"; roomId: string; participants: { participantId: string; presence: Presence }[] }
  | { type: "resync_required"; roomId: string }
  | { type: "restarting" | "degraded"; retryAfterMs: number }
  | { type: "error"; code: ErrorCode }
  | { type: "pong" }
/** API-side gateway hook. Revisions only; no actor, candidate, vote, or action name. */
export interface RoomInvalidation { roomId: string; revision: number }
const roomPath = (roomId: string) => `${API_PREFIX}/rooms/${encodeURIComponent(roomId)}`
export const paths = {
  rooms: `${API_PREFIX}/rooms`,
  metadata: `${API_PREFIX}/catalog/metadata`,
  showSearch: `${API_PREFIX}/catalog/shows`,
  resolveInvite: `${API_PREFIX}/guest/resolve-invite`,
  memberStart: `${API_PREFIX}/member/start`,
  memberCallback: `${API_PREFIX}/member/callback`,
  memberNativeCallback: `${API_PREFIX}/member/native-callback`,
  realtime: `${API_PREFIX}/realtime`,
  realtimeAttach: `${API_PREFIX}/realtime/internal/attach`,
  realtimeView: `${API_PREFIX}/realtime/internal/view`,
  snapshot: (roomId: string) => roomPath(roomId),
  join: (roomId: string) => `${roomPath(roomId)}/join`,
  commands: (roomId: string) => `${roomPath(roomId)}/commands`,
  realtimeTicket: (roomId: string) => `${roomPath(roomId)}/realtime-ticket`,
  showProgress: (roomId: string, showId: number) => `${roomPath(roomId)}/shows/${showId}/progress`,
} as const

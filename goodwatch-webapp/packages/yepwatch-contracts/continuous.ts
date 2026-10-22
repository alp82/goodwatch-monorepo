/** Continuous choosing protocol. Additive v2; legacy index.ts remains frozen for retained rooms. */
import type {
	Candidate as BaseCandidate,
	CatalogMetadata,
	CommandReceipt,
	EpisodeIdentity,
	ErrorCode,
	FailureDetails,
	GuestCredential,
	RoomConstraints,
	ScreenAvailability,
	ScreenContext,
} from "./index.ts"
export type {
	CatalogMetadata,
	CommandReceipt,
	EpisodeIdentity,
	ErrorCode,
	FailureDetails,
	GuestCredential,
	RoomConstraints,
	ScreenAvailability,
	ScreenContext,
}
export const CONTRACT_VERSION = 2 as const
export const API_PREFIX = "/api/yepwatch/v1/continuous" as const
export const REVISION_CHANNEL = "yepwatch:v2:revision" as const
export const ACTIVITY_CHANNEL = "yepwatch:v2:activity" as const
export type RoomPhase = "setup" | "choosing" | "decided" | "expired"
export type VoteValue = "watch" | "pass"
export interface Candidate extends BaseCandidate {
	/** Only real catalog values. Null/absent means unknown, never a seed or invented score. */
	backdropUrl?: string | null
	trailerUrl?: string | null
	goodwatchScore?: number | null
	genres?: string[]
}
export interface Match {
	candidateId: string
	pickCount: number
}
export interface Decision {
	candidateId: string
	agreementVersion: number
	decidedAt: number
	availability: ScreenAvailability[]
}
export interface StreamState {
	version: number
	state: "ready" | "exhausted" | "unavailable" | "capacity"
	/** No per-person cursor/completed/answer counts. Bounds are not a full-catalog guarantee. */
	reason:
		| "catalog_end"
		| "catalog_incomplete"
		| "room_capacity"
		| "awaiting_answers"
		| null
}
export interface SharedRoomSnapshot {
	contractVersion: 2
	roomId: string
	revision: number
	phase: RoomPhase
	expiresAt: number
	hostParticipantId: string
	rosterVersion: number
	contextVersion: number
	generation: number
	participants: {
		participantId: string
		nickname: string
		screenId: string | null
		ready: boolean
	}[]
	screens: ScreenContext[]
	constraints: RoomConstraints
	candidates: Candidate[]
	stream: StreamState
	/** Immediately recomputed against every admitted, non-revoked participant. No pick ownership. */
	matches: Match[]
	agreement: {
		version: number
		state: "none" | "checking" | "unavailable"
		error: { code: ErrorCode; details?: FailureDetails } | null
	}
	decision: Decision | null
}
export interface OwnPrivateSnapshot {
	participantId: string
	nextSequence: number
	canHost: boolean
	votes: { candidateId: string; value: VoteValue | null; revision: number }[]
	pick: { candidateId: string | null; revision: number }
	/** First unanswered retained candidate, not a public activity field. UI retains exact focus while inspecting matches. */
	nextCandidateId: string | null
	member: {
		state: "guest" | "linked" | "unavailable"
		prefill: MemberPrefill | null
	}
}
export interface RoomSnapshot {
	shared: SharedRoomSnapshot
	own: OwnPrivateSnapshot
}
export interface MemberPrefill {
	country: string | null
	serviceIds: number[]
	savedProgressAvailable: boolean
}
export interface GuestAdmissionRequest {
	contractVersion: 2
	commandId: string
	admissionSecret: string
	nickname: string
}
export interface JoinRoomRequest extends GuestAdmissionRequest {
	inviteCode: string
	screenId?: string
}
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
	| {
			type: "setup"
			expectedContextVersion: number
			screens: ScreenContext[]
			constraints: RoomConstraints
			screenId: string | null
	  }
	| { type: "assign_screen"; expectedContextVersion: number; screenId: string }
	| { type: "ready"; expectedContextVersion: number; ready: boolean }
	| {
			type: "start"
			expectedRosterVersion: number
			expectedContextVersion: number
			hostReady?: boolean
	  }
	| {
			type: "vote"
			generation: number
			candidateId: string
			expectedVoteRevision: number
			value: VoteValue | null
	  }
	| {
			type: "pick"
			generation: number
			expectedRosterVersion: number
			candidateId: string | null
			expectedPickRevision: number
	  }
	| { type: "refill"; generation: number; expectedStreamVersion: number }
	| {
			type: "retry_agreement"
			generation: number
			expectedAgreementVersion: number
	  }
	| { type: "restart"; expectedRevision: number }
export interface CommandResult {
	receipt: CommandReceipt
	snapshot: RoomSnapshot
}
export interface ApiError {
	error: {
		code: ErrorCode
		message: string
		retryable: boolean
		details?: FailureDetails
	}
	snapshot?: RoomSnapshot
}
export interface RealtimeTicket {
	ticket: string
	expiresAt: number
	websocketPath: string
}
export interface RealtimeAttachRequest {
	ticket: string
	roomId: string
}
export interface RealtimeAttachment {
	roomId: string
	participantId: string
	lease: string
	leaseExpiresAt: number
	roomExpiresAt: number
	capabilityEpoch: number
	scope: "shared:read"
}
export interface RealtimeViewRequest {
	roomId: string
	lease: string
}
export interface RealtimeViewResponse extends RealtimeAttachment {
	snapshot: SharedRoomSnapshot
}
export type ActivityView = "voting" | "matches" | "trailer" | "away"
export type ActivityGesture = "reach" | "handle" | "release"
export interface ClientActivity {
	type: "activity"
	sessionId: string
	sequence: number
	view: ActivityView
	gesture?: ActivityGesture
	beat?: "answer"
}
export interface ServerActivity extends ClientActivity {
	roomId: string
	participantId: string
	serverTime: number
	expiresAt: number
}
/** Ephemeral only: view expires at6s; gestures/beats at serverTime+1500ms. Reject unknown fields. */
export const ACTIVITY_LIMITS = {
	viewTtlMs: 6000,
	pulseTtlMs: 1500,
	renewalMs: 3000,
	framesPerSecond: 4,
	burst: 8,
} as const
export type ClientRealtimeFrame =
	| {
			type: "authenticate"
			ticket: string
			roomId: string
			lastRevision: number | null
	  }
	| { type: "ping" }
	| ClientActivity
export type ServerRealtimeFrame =
	| { type: "room.snapshot" | "room.updated"; snapshot: SharedRoomSnapshot }
	| {
			type: "activity.session"
			roomId: string
			sessionId: string
			serverTime: number
	  }
	| ServerActivity
	| { type: "resync_required"; roomId: string }
	| { type: "restarting" | "degraded"; retryAfterMs: number }
	| { type: "error"; code: ErrorCode }
	| { type: "pong" }
export interface RoomInvalidation {
	roomId: string
	revision: number
}
export interface MemberStartRequest {
	roomId: string
	returnTo: string
	client: "browser" | "native"
	codeChallenge?: string
}
export interface MemberStartResponse {
	authorizeUrl: string
	expiresAt: number
	state: string
}
export interface MemberExchangeRequest {
	roomId: string
	state: string
	code: string
	codeVerifier: string
}
export interface MemberProgressResponse {
	source: "goodwatch"
	shows: { showId: number; nextEpisode: EpisodeIdentity | null }[]
	limitReached: boolean
}
export interface MemberStatusResponse {
	state: "guest" | "linked" | "unavailable"
	prefill: MemberPrefill | null
}
const room = (id: string) => `${API_PREFIX}/rooms/${encodeURIComponent(id)}`
export const paths = {
	rooms: `${API_PREFIX}/rooms`,
	metadata: `${API_PREFIX}/catalog/metadata`,
	resolveInvite: `${API_PREFIX}/guest/resolve-invite`,
	memberStart: `${API_PREFIX}/member/start`,
	memberCallback: `${API_PREFIX}/member/callback`,
	memberExchange: `${API_PREFIX}/member/exchange`,
	realtime: `${API_PREFIX}/realtime`,
	realtimeAttach: `${API_PREFIX}/realtime/internal/attach`,
	realtimeView: `${API_PREFIX}/realtime/internal/view`,
	snapshot: (id: string) => room(id),
	join: (id: string) => `${room(id)}/join`,
	commands: (id: string) => `${room(id)}/commands`,
	realtimeTicket: (id: string) => `${room(id)}/realtime-ticket`,
	memberStatus: (id: string) => `${room(id)}/member`,
	memberProgress: (id: string) => `${room(id)}/member/progress`,
} as const

import type {
	Candidate,
	Decision,
	OwnPrivateSnapshot,
	RoomConstraints,
	ScreenContext,
	SharedRoomSnapshot,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import type {
	CatalogMetadata,
	EpisodeChoice,
	ShowSearchResponse,
} from "../../../packages/yepwatch-contracts/index.ts"
import type { MemberIntent } from "./continuous-members.server.ts"
import type { RoomRepository, StoredRoom } from "./types.ts"
export const CONTINUOUS_LIMITS = {
	participants: 12,
	screens: 12,
	active: 120,
	seen: 2000,
	page: 20,
	receipts: 64,
	tickets: 4,
	roomMs: 6 * 3600_000,
} as const
export interface ContinuousParticipant {
	id: string
	nickname: string
	tokenHash: string
	admissionHash: string
	epoch: number
	nextSequence: number
	screenId: string | null
	ready: boolean
	votes: Record<string, { value: "watch" | "pass" | null; revision: number }>
	pick: { candidateId: string | null; revision: number }
	member: OwnPrivateSnapshot["member"]
	/** Issuer subject is private; never projected/shared. No duplicated accounts. */
	lastVotedId?: string | null
	revoked?: boolean
	memberUserId: string | null
	memberGrant?: { accessToken: string; expiresAt: number }
	receipts: {
		commandId: string
		sequence: number
		digest: string
		revision: number
	}[]
}
export interface ContinuousRoom {
	format: 2
	id: string
	revision: number
	expiresAt: number
	hostId: string
	inviteHash: string
	phase: "setup" | "choosing" | "decided"
	rosterVersion: number
	contextVersion: number
	generation: number
	memberIntents?: MemberIntent[]
	participants: ContinuousParticipant[]
	screens: ScreenContext[]
	constraints: RoomConstraints
	candidates: Candidate[]
	seenKeys: string[]
	stream: SharedRoomSnapshot["stream"]
	agreement: SharedRoomSnapshot["agreement"]
	decision: Decision | null
	tickets: {
		hash: string
		participantId: string
		epoch: number
		expiresAt: number
	}[]
}
export interface CandidatePage {
	candidates: Candidate[]
	exhausted: boolean
}
export interface ContinuousCatalog {
	metadata(country: string | null): Promise<CatalogMetadata>
	page(room: ContinuousRoom): Promise<CandidatePage>
	refresh?(room: ContinuousRoom): Promise<Candidate[]>
	recheck(
		room: ContinuousRoom,
		candidate: Candidate,
	): Promise<Candidate["availability"]>
}
export type ContinuousRepository = RoomRepository<ContinuousRoom>
export type ContinuousStored = StoredRoom<ContinuousRoom>
export function titleIdentity(c: Candidate) {
	return `${c.identity.kind === "movie" ? "movie" : "show"}_${c.identity.tmdbId}`
}
export type LegacyCatalogMetadata = {
	metadata(country: string | null): Promise<CatalogMetadata>
	searchShows(query: string): Promise<ShowSearchResponse>
	episodes(id: number): Promise<EpisodeChoice[]>
}

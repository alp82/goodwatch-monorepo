import type {
	ContinuousRoom,
	ContinuousParticipant
} from "./continuous-types.ts"
import type {
	Candidate,
	RoomDescription
} from "../../../packages/yepwatch-contracts/proposal.ts"
import type { RoomRepository, StoredRoom } from "./types.ts"
import type { AccountDecision } from "../../../packages/yepwatch-contracts/proposal.ts"
export interface ParticipantSession {
	id: string
	tokenHash: string
	expiresAt: number
	nextSequence: number
	receipts: ContinuousParticipant["receipts"]
}
/** Identity supplied only by the server after opening a verified GoodWatch session. */
export interface RoomAccount {
	userId: string
	sessionId: string
	expiresAt: number
}
export interface HistoricalDecision extends AccountDecision {
	accountIds: string[]
	participantIds: string[]
}
export interface AccountRoomIndex {
	roomId: string
	expiresAt: number
}
export interface AccountRoomsStore {
	remember(userId: string, entry: AccountRoomIndex): Promise<void>
	revokeSession(id: string, expiresAt: number): Promise<void>
	sessionActive(id: string): Promise<boolean>
	rooms(userId: string): Promise<AccountRoomIndex[]>
	/** Called only with snapshots read from a committed room head. */
	publish(decisions: HistoricalDecision[]): Promise<void>
	history(userId: string): Promise<AccountDecision[]>
}
/** Storage envelope2 is reused for existing member-read compatibility; flowVersion/table/routes distinguish protocol3. */
export interface ProposalParticipant extends ContinuousParticipant {
	sessions?: ParticipantSession[]
	joinedAt?: number
	archivedAt?: number | null
	leftLabel?: string | null
	serviceIds?: number[] | null
	showSeen?: boolean
	leftAt?: number | null
	votes: Record<
		string,
		{
			value: "watch" | "pass" | null
			revision: number
			activeExposureMs?: number | null
			timingSource?: "active_exposure" | "implied" | "unavailable"
		}
	>
	approvedProposalVersion: number | null
	agreementRevision: number
}
export interface ProposalRoom extends ContinuousRoom {
	history?: HistoricalDecision[]
	intent?:
		| (RoomDescription & { rankedKeys: number[]; interpretedAt: number })
		| null
	ideas?: (import("../../../packages/yepwatch-contracts/proposal.ts").RoomIdea & {
		rankedKeys: number[]
		interpretedAt: number
	})[]
	disabledServiceIds?: number[]
	interpretationCount?: number
	flowVersion: 3
	participants: ProposalParticipant[]
	candidates: (Candidate & { ideaIds?: string[] })[]
	proposalVersion: number
	proposal: {
		candidateId: string
		version: number
		previousCandidateId: string | null
		proposerId: string
		baseParticipantIds: string[]
	} | null
}
export type ProposalRepository = RoomRepository<ProposalRoom> & {
	deletionStore?: import('./proposal-deletion.ts').DeletionStore
	accountStore?: AccountRoomsStore
	/** Optional for historical encrypted demo repositories; production uses typed PK lookup. */
	rememberInvite?(
		hash: string,
		roomId: string,
		expiresAt: number
	): Promise<number | null>
	findInvite?(hash: string): Promise<string | null>
	/**
	 * Ids of live rooms (expiring after `now`) whose current ideas include one still pending with a lease from
	 * before `leaseBefore`, at most `limit`, ordered by room id. A search, not a typed read: callers read each room.
	 */
	stalePendingIdeas?(leaseBefore: number, now: number, limit: number): Promise<string[]>
}
export type ProposalStored = StoredRoom<ProposalRoom>
export interface ExcludedKeysOptions {
	fresh?: boolean
}
export interface ProposalCatalog {
	metadata: import("./continuous-types.ts").ContinuousCatalog["metadata"]
	page(
		room: ProposalRoom
	): Promise<{ candidates: Candidate[]; exhausted: boolean }>
	/** Title keys the room's linked members have seen (and don't want shown). `fresh` reads past any session cache. */
	excludedKeys?(room: ProposalRoom, options?: ExcludedKeysOptions): Promise<string[]>
	refresh?(room: ProposalRoom): Promise<Candidate[]>
	recheck(
		room: ProposalRoom,
		candidate: Candidate
	): Promise<Candidate["availability"]>
}

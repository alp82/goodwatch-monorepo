import type {
	ContinuousRoom,
	ContinuousParticipant,
} from "./continuous-types.ts"
import type { Candidate } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { RoomRepository, StoredRoom } from "./types.ts"
/** Storage envelope2 is reused for existing member-read compatibility; flowVersion/table/routes distinguish protocol3. */
export interface ProposalParticipant extends ContinuousParticipant {
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
	flowVersion: 3
	participants: ProposalParticipant[]
	candidates: Candidate[]
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
	/** Optional for historical encrypted demo repositories; production uses typed PK lookup. */
	rememberInvite?(
		hash: string,
		roomId: string,
		expiresAt: number
	): Promise<number | null>
	findInvite?(hash: string): Promise<string | null>
}
export type ProposalStored = StoredRoom<ProposalRoom>
export interface ProposalCatalog {
	metadata: import("./continuous-types.ts").ContinuousCatalog["metadata"]
	page(
		room: ProposalRoom
	): Promise<{ candidates: Candidate[]; exhausted: boolean }>
	refresh?(room: ProposalRoom): Promise<Candidate[]>
	recheck(
		room: ProposalRoom,
		candidate: Candidate
	): Promise<Candidate["availability"]>
}

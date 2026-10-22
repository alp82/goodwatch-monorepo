import { createHash } from "node:crypto"
import type {
	MemberPrefill,
	MemberStartRequest,
	MemberExchangeRequest,
	MemberStatusResponse,
	MemberProgressResponse,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { random, hash, equal } from "./crypto.server.ts"
import { RoomError, requireRoom } from "./errors.ts"
import { actor, continuousLive } from "./continuous-machine.ts"
import type {
	ContinuousRepository,
	ContinuousRoom,
} from "./continuous-types.ts"
export interface MemberTokens {
	accessToken: string
	expiresAt: number
}
export interface MemberIssuer {
	authorize(input: {
		state: string
		challenge: string
		redirectUri: string
	}): string
	exchange(input: {
		code: string
		verifier: string
		redirectUri: string
	}): Promise<MemberTokens>
	verify(token: string): Promise<{ userId: string; expiresAt: number }>
}
export interface MemberReads {
	prefill(userId: string, accessToken?: string): Promise<MemberPrefill>
	progress?(userId: string, accessToken?: string): Promise<MemberProgressResponse>
}
export interface MemberFlowConfig {
	callbackUrl: string
	browserOrigins: string[]
	nativeReturnUri: string
	nativeReturnUris?: string[]
}
export interface MemberIntent {
	stateHash: string
	participantId: string
	epoch: number
	expiresAt: number
	client: "browser" | "native"
	returnTo: string
	challenge: string
	verifier: string | null
	status: "ready" | "exchanging" | "linked"
	codeHash: string | null
}
export const pkce = (verifier: string) =>
	createHash("sha256").update(verifier).digest("base64url")
export class ContinuousMembers {
	private repo: ContinuousRepository
	private issuer: MemberIssuer
	private reads: MemberReads
	private config: MemberFlowConfig
	private now: () => number
	constructor(
		repo: ContinuousRepository,
		issuer: MemberIssuer,
		reads: MemberReads,
		config: MemberFlowConfig,
		now: () => number = Date.now,
	) {
		this.repo = repo
		this.issuer = issuer
		this.reads = reads
		this.config = config
		this.now = now
	}
	private async get(id: string) {
		const old = await this.repo.read(id)
		requireRoom(
			old && old.room.format === 2,
			"not_found",
			"Room unavailable",
			404,
		)
		continuousLive(old.room, this.now())
		return old
	}
	private returnUri(value: string, client: "browser" | "native", id: string) {
		const u = new URL(value)
		requireRoom(
			!u.username && !u.password && !u.hash,
			"invalid_request",
			"Invalid return destination",
			400,
		)
		if (client === "browser")
			requireRoom(
				this.config.browserOrigins.includes(u.origin) &&
					u.pathname === `/room/${id}` &&
					!u.search,
				"invalid_request",
				"Return must be this room on an approved app",
				400,
			)
		else
			requireRoom(
				[this.config.nativeReturnUri, ...(this.config.nativeReturnUris ?? [])].includes(u.href),
				"invalid_request",
				"Native return destination not allowed",
				400,
			)
		return u.href
	}
	async start(id: string, participantId: string, input: MemberStartRequest) {
		const returnTo = this.returnUri(input.returnTo, input.client, id)
		const verifier = input.client === "browser" ? random() : null
		const challenge = verifier ? pkce(verifier) : input.codeChallenge
		requireRoom(
			challenge && /^[A-Za-z0-9_-]{43}$/.test(challenge),
			"invalid_request",
			"S256 challenge required",
			400,
		)
		const state = `${id}.${random()}`
		const expiresAt = this.now() + 10 * 60_000
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			const intents = (room.memberIntents ?? []).filter(
				(i) => i.expiresAt > this.now(),
			)
			requireRoom(
				intents.filter((i) => i.participantId === p.id).length < 4,
				"limit_reached",
				"Too many pending sign-ins",
			)
			intents.push({
				stateHash: hash(state),
				participantId: p.id,
				epoch: p.epoch,
				expiresAt,
				client: input.client,
				returnTo,
				challenge,
				verifier,
				status: "ready",
				codeHash: null,
			})
			room.memberIntents = intents
			if (await this.repo.compareAndSwap(old, room, false))
				return {
					authorizeUrl: this.issuer.authorize({
						state,
						challenge,
						redirectUri: this.config.callbackUrl,
					}),
					expiresAt,
					state,
				}
		}
		throw new RoomError("busy", "Room busy; try sign-in again", 503, true)
	}
	/** Native browser callback only returns code/state to the fixed app URI. The room credential+verifier must exchange it. */
	async callbackClient(state: string) {
		const [id] = state.split(".")
		const { room } = await this.get(id)
		const intent = room.memberIntents?.find((i) =>
			equal(i.stateHash, hash(state)),
		)
		requireRoom(
			intent && intent.expiresAt > this.now(),
			"unauthorized",
			"Sign-in state unavailable",
			401,
		)
		return intent.client
	}
	async nativeReturn(state: string, code: string) {
		const [id] = state.split(".")
		const { room } = await this.get(id)
		const intent = room.memberIntents?.find((i) =>
			equal(i.stateHash, hash(state)),
		)
		requireRoom(
			intent &&
				intent.client === "native" &&
				intent.expiresAt > this.now() &&
				actor(room, intent.participantId).epoch === intent.epoch,
			"unauthorized",
			"Sign-in state unavailable",
			401,
		)
		const u = new URL(intent.returnTo)
		u.searchParams.set("roomId", id)
		u.searchParams.set("state", state)
		u.searchParams.set("code", code)
		return u.href
	}
	async callback(state: string, code: string, participantId: string) {
		const [id] = state.split(".")
		return this.finish(id, participantId, state, code, null, "browser")
	}
	async exchange(
		id: string,
		participantId: string,
		input: MemberExchangeRequest,
	) {
		return this.finish(
			id,
			participantId,
			input.state,
			input.code,
			input.codeVerifier,
			"native",
		)
	}
	private async finish(
		id: string,
		participantId: string,
		state: string,
		code: string,
		verifier: string | null,
		client: "browser" | "native",
	) {
		requireRoom(
			state.startsWith(`${id}.`) && code.length > 0 && code.length <= 4096,
			"invalid_request",
			"Invalid callback",
			400,
		)
		let claimed: MemberIntent | undefined
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			const intent = room.memberIntents?.find((i) =>
				equal(i.stateHash, hash(state)),
			)
			requireRoom(
				intent &&
					intent.participantId === p.id &&
					intent.epoch === p.epoch &&
					intent.client === client &&
					intent.expiresAt > this.now(),
				"unauthorized",
				"Sign-in state unavailable",
				401,
			)
			if (intent.status === "linked") {
				requireRoom(
					intent.codeHash === hash(code),
					"unauthorized",
					"Callback changed",
					401,
				)
				return {
					returnTo: intent.returnTo,
					status: await this.status(id, p.id),
				}
			}
			requireRoom(
				intent.status === "ready",
				"busy",
				"Sign-in exchange already pending; restart sign-in if interrupted",
				503,
			)
			const proof = client === "browser" ? intent.verifier : verifier
			requireRoom(
				proof &&
					/^[A-Za-z0-9_-]{43,128}$/.test(proof) &&
					equal(pkce(proof), intent.challenge),
				"unauthorized",
				"PKCE verification failed",
				401,
			)
			intent.status = "exchanging"
			intent.codeHash = hash(code)
			if (await this.repo.compareAndSwap(old, room, false)) {
				claimed = { ...intent, verifier: proof }
				break
			}
		}
		requireRoom(claimed, "busy", "Room busy; retry sign-in", 503)
		// One upstream exchange owner. Crash/lost token response requires a fresh sign-in; never blindly reuse a consumed code.
		const tokens = await this.issuer.exchange({
			code,
			verifier: claimed.verifier!,
			redirectUri: this.config.callbackUrl,
		})
		const grant = await this.issuer.verify(tokens.accessToken)
		const prefill = await this.reads.prefill(grant.userId, tokens.accessToken)
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			const intent = room.memberIntents?.find((i) =>
				equal(i.stateHash, hash(state)),
			)
			requireRoom(
				intent &&
					intent.status === "exchanging" &&
					intent.codeHash === hash(code) &&
					p.epoch === claimed.epoch,
				"unauthorized",
				"Sign-in identity changed",
				401,
			)
			requireRoom(
				!p.memberUserId || p.memberUserId === grant.userId,
				"conflict",
				"This participant is linked to another account; do not replace its identity",
			)
			p.memberUserId = grant.userId
			p.member = { state: "linked", prefill }
			p.memberGrant = {
				accessToken: tokens.accessToken,
				expiresAt: Math.min(tokens.expiresAt, grant.expiresAt),
			}
			intent.status = "linked"
			intent.verifier = null
			room.revision++
			if (await this.repo.compareAndSwap(old, room, true))
				return {
					returnTo: intent.returnTo,
					status: { state: "linked" as const, prefill },
				}
		}
		throw new RoomError(
			"outcome_unknown",
			"Account link acknowledgment unavailable; refresh member status",
			503,
			true,
		)
	}
	async identity(room: ContinuousRoom, participantId: string) {
		const p = actor(room, participantId)
		requireRoom(
			p.memberGrant && p.memberGrant.expiresAt > this.now(),
			"member_required",
			"Sign in with GoodWatch again",
			403,
		)
		const grant = await this.issuer.verify(p.memberGrant.accessToken)
		requireRoom(
			grant.userId === p.memberUserId,
			"unauthorized",
			"Linked identity changed",
			401,
		)
		return grant.userId
	}
	async progress(
		room: ContinuousRoom,
		participantId: string,
	): Promise<MemberProgressResponse> {
		const userId = await this.identity(room, participantId)
		requireRoom(
			this.reads.progress,
			"not_implemented",
			"Saved progress reader unavailable",
			501,
		)
		return this.reads.progress(userId, actor(room, participantId).memberGrant!.accessToken)
	}
	async ownProgress(id: string, participantId: string) {
		return this.progress((await this.get(id)).room, participantId)
	}
	async status(
		id: string,
		participantId: string,
	): Promise<MemberStatusResponse> {
		const { room } = await this.get(id)
		const p = actor(room, participantId)
		if (!p.memberGrant) return { state: "guest", prefill: null }
		try {
			const userId = await this.identity(room, p.id)
			return { state: "linked", prefill: await this.reads.prefill(userId, p.memberGrant.accessToken) }
		} catch {
			return { state: "unavailable", prefill: null }
		}
	}
}

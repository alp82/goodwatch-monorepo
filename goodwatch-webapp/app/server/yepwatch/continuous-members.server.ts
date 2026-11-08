import { reconcile as reconcileProposal } from "./proposal-machine.ts"
import { refreshServices, retireIneligible } from "./proposal-redesign.ts"
import { createHash } from "node:crypto"
import type {
	MemberPrefill,
	MemberStartRequest,
	MemberExchangeRequest,
	MemberStatusResponse,
	MemberProgressResponse,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { random, hash, equal, codec } from "./crypto.server.ts"
import type {
	AccountExchangeRequest,
	AccountStartRequest,
	AccountStatus,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { RoomError, requireRoom } from "./errors.ts"
import { actor, continuousLive } from "./continuous-machine.ts"
import type {
	ContinuousRepository,
	ContinuousRoom,
} from "./continuous-types.ts"
export interface MemberTokens {
	accessToken: string
	expiresAt: number
	/** Present only when the issuer grants offline access to this client. */
	refreshToken?: string | null
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
	verify(token: string): Promise<{ userId: string; expiresAt: number; displayName?: string | null }>
	/** Renews a device session; issuers without offline access leave it out. */
	refresh?(input: { refreshToken: string }): Promise<MemberTokens>
}
export interface MemberReads {
 seen?(userId: string, accessToken?: string): Promise<string[]>
	prefill(userId: string, accessToken?: string): Promise<MemberPrefill>
	progress?(userId: string, accessToken?: string): Promise<MemberProgressResponse>
}
export interface MemberFlowConfig {
	callbackUrl: string
	browserOrigins: string[]
	nativeReturnUri: string
	nativeReturnUris?: string[]
	/** Seals device sessions and browser sign-in intents. Without it, account sign-in is unavailable. */
	sessionSecret?: string
}
/** One device's GoodWatch sign-in, sealed by the server: browsers keep it in an HttpOnly cookie, apps in secure storage. */
export interface MemberSession {
	v: 1
	userId: string
	displayName: string | null
	accessToken: string
	expiresAt: number
	refreshToken: string | null
}
interface AccountIntent {
	v: 1
	nonce: string
	verifier: string
	returnTo: string
	expiresAt: number
}
/** Account sign-in states never look like a room ID (32 characters). */
const BROWSER_STATE = "acct."
const NATIVE_STATE = "acctn."
const SESSION_AAD = "yepwatch-member-session"
const INTENT_AAD = "yepwatch-member-intent"
/** A renewable session lasts as long as the issuer's refresh grant; otherwise only as long as its access token. */
export const RENEWABLE_SESSION_MS = 90 * 86_400_000
export const isAccountState = (state: string) =>
	state.startsWith(BROWSER_STATE) || state.startsWith(NATIVE_STATE)
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
const cleanName = (name?: string | null) =>
	name?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) || null
/** Never replace a chosen nickname or fall back to an email address. */
function linkedNickname(current: string, name?: string | null) {
	const clean = cleanName(name)
	return (current === "Guest" || current === "") && clean ? clean : current
}
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
		const seen = await this.reads.seen?.(grant.userId, tokens.accessToken)
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
			this.applyLink(room, old.room, p, {
				userId: grant.userId,
				displayName: grant.displayName,
				prefill,
				seen,
				accessToken: tokens.accessToken,
				expiresAt: Math.min(tokens.expiresAt, grant.expiresAt),
			})
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
	/**
	 * Links one participant to a verified GoodWatch account. A first link applies the account's name
	 * (only over a placeholder) and saved services; a renewed link of the same account only replaces
	 * the grant, so services chosen in the room stay.
	 */
	private applyLink(
		room: ContinuousRoom,
		previous: ContinuousRoom,
		p: ReturnType<typeof actor>,
		link: {
			userId: string
			displayName?: string | null
			prefill: MemberPrefill
			seen?: string[]
			accessToken: string
			expiresAt: number
		},
	) {
		type Room = import("./proposal-types.ts").ProposalRoom
		type Person = import("./proposal-types.ts").ProposalParticipant
		const v3 = (room as Room).flowVersion === 3
		const renewal = p.memberUserId === link.userId && p.member.state === "linked"
		p.nickname = linkedNickname(p.nickname, link.displayName)
		p.memberUserId = link.userId
		p.member = { state: "linked", prefill: link.prefill }
		if (v3 && !renewal) {
			;(p as Person).serviceIds = [...link.prefill.serviceIds]
			refreshServices(room as Room)
			room.contextVersion++
			room.stream = { version: room.stream.version + 1, state: "ready", reason: null }
		}
		p.memberGrant = { accessToken: link.accessToken, expiresAt: link.expiresAt }
		if (v3 && this.reads.seen && link.seen)
			retireIneligible(room as Room, new Set(link.seen))
		if (v3) reconcileProposal(room as Room, previous as Room)
	}
	private sealer() {
		const secret = this.config.sessionSecret
		requireRoom(
			secret && secret.length >= 32,
			"not_implemented",
			"GoodWatch sign-in is not configured on this runtime",
			501,
		)
		return codec(`member-session\0${secret}`)
	}
	sealSession(session: MemberSession) {
		return this.sealer().encode(session, SESSION_AAD)
	}
	/** A session this server sealed, or null for anything else (tampered, foreign, malformed). */
	openSession(raw: string | null | undefined): MemberSession | null {
		if (!raw || raw.length > 12_000) return null
		try {
			const s = this.sealer().decode<MemberSession>(raw, SESSION_AAD)
			return s?.v === 1 &&
				typeof s.userId === "string" &&
				typeof s.accessToken === "string" &&
				Number.isFinite(s.expiresAt)
				? s
				: null
		} catch (e) {
			if (e instanceof RoomError) throw e
			return null
		}
	}
	/** Browser returns stay on an approved app origin; any page of it (the screen you signed in from). */
	private accountReturn(value: string) {
		const u = new URL(value)
		requireRoom(
			this.config.browserOrigins.includes(u.origin) &&
				!u.username &&
				!u.password &&
				!u.hash &&
				u.pathname.startsWith("/") &&
				!u.pathname.startsWith("//") &&
				!u.pathname.startsWith("/api/"),
			"invalid_request",
			"Return must be a page of an approved app",
			400,
		)
		return u.href
	}
	/** Starts GoodWatch sign-in for this device. Browsers keep the sealed intent in a cookie bound to this browser. */
	startAccount(input: AccountStartRequest) {
		const expiresAt = this.now() + 10 * 60_000
		const authorize = (state: string, challenge: string) =>
			this.issuer.authorize({ state, challenge, redirectUri: this.config.callbackUrl })
		if (input.client === "browser") {
			const returnTo = this.accountReturn(input.returnTo)
			const nonce = random()
			const verifier = random()
			const state = `${BROWSER_STATE}${nonce}`
			const intent: AccountIntent = { v: 1, nonce, verifier, returnTo, expiresAt }
			return {
				authorizeUrl: authorize(state, pkce(verifier)),
				expiresAt,
				state,
				intent: this.sealer().encode(intent, INTENT_AAD),
			}
		}
		const uris = [this.config.nativeReturnUri, ...(this.config.nativeReturnUris ?? [])]
		const index = uris.indexOf(input.returnTo)
		requireRoom(index >= 0, "invalid_request", "Native return destination not allowed", 400)
		requireRoom(
			input.codeChallenge && /^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge),
			"invalid_request",
			"S256 challenge required",
			400,
		)
		this.sealer()
		const state = `${NATIVE_STATE}${index}.${random()}`
		return { authorizeUrl: authorize(state, input.codeChallenge), expiresAt, state }
	}
	accountClient(state: string): "browser" | "native" {
		return state.startsWith(NATIVE_STATE) ? "native" : "browser"
	}
	/** Native: hand the one-use code back to the app's fixed link; the app's verifier redeems it. */
	accountNativeReturn(state: string, code: string) {
		const [index] = state.slice(NATIVE_STATE.length).split(".")
		const uris = [this.config.nativeReturnUri, ...(this.config.nativeReturnUris ?? [])]
		const uri = uris[Number(index)]
		requireRoom(/^\d+$/.test(index ?? "") && uri, "unauthorized", "Sign-in state unavailable", 401)
		const u = new URL(uri)
		u.searchParams.set("state", state)
		u.searchParams.set("code", code)
		return u.href
	}
	/** Browser callback: only the browser that started sign-in holds the matching sealed intent. */
	async accountCallback(state: string, code: string, intentRaw: string | null) {
		let intent: AccountIntent | null = null
		try {
			intent = intentRaw ? this.sealer().decode<AccountIntent>(intentRaw, INTENT_AAD) : null
		} catch (e) {
			if (e instanceof RoomError) throw e
		}
		requireRoom(
			intent &&
				intent.v === 1 &&
				state === `${BROWSER_STATE}${intent.nonce}` &&
				intent.expiresAt > this.now(),
			"unauthorized",
			"Sign-in did not complete in this browser; start again",
			401,
		)
		const tokens = await this.issuer.exchange({
			code,
			verifier: intent.verifier,
			redirectUri: this.config.callbackUrl,
		})
		return { session: await this.sessionFrom(tokens), returnTo: intent.returnTo }
	}
	/** Native: the issuer checks the app's PKCE verifier against the challenge it started with. */
	async accountExchange(input: AccountExchangeRequest) {
		requireRoom(input.state.startsWith(NATIVE_STATE), "invalid_request", "Invalid callback", 400)
		this.sealer()
		const tokens = await this.issuer.exchange({
			code: input.code,
			verifier: input.codeVerifier,
			redirectUri: this.config.callbackUrl,
		})
		return this.sessionFrom(tokens)
	}
	private async sessionFrom(tokens: MemberTokens, previous?: MemberSession): Promise<MemberSession> {
		const grant = await this.issuer.verify(tokens.accessToken)
		requireRoom(
			!previous || previous.userId === grant.userId,
			"unauthorized",
			"GoodWatch account changed",
			401,
		)
		return {
			v: 1,
			userId: grant.userId,
			displayName: cleanName(grant.displayName) ?? previous?.displayName ?? null,
			accessToken: tokens.accessToken,
			expiresAt: Math.min(tokens.expiresAt, grant.expiresAt),
			refreshToken: tokens.refreshToken ?? previous?.refreshToken ?? null,
		}
	}
	/** A usable session: the same one while its access token lasts, a renewed one when it can be renewed, else null. */
	async freshSession(session: MemberSession | null): Promise<{ session: MemberSession; renewed: boolean } | null> {
		if (!session) return null
		if (session.expiresAt > this.now() + 30_000) return { session, renewed: false }
		if (!session.refreshToken || !this.issuer.refresh) return null
		try {
			const tokens = await this.issuer.refresh({ refreshToken: session.refreshToken })
			return { session: await this.sessionFrom(tokens, session), renewed: true }
		} catch (e) {
			// Only a definitive refusal (revoked grant, another account) ends the session. Anything else
			// (throttled, down, unreachable, a garbled reply) keeps it for a later try.
			if (e instanceof RoomError && ["unauthorized", "member_required"].includes(e.code)) return null
			throw e instanceof RoomError && e.code === "busy" ? e : new RoomError("busy", "GoodWatch is temporarily unavailable; try again", 503, true)
		}
	}
	/** How long a browser keeps the session cookie. */
	sessionMaxAge(session: MemberSession) {
		const until = session.refreshToken ? this.now() + RENEWABLE_SESSION_MS : session.expiresAt
		return Math.max(0, Math.floor((until - this.now()) / 1000))
	}
	/** This device's sign-in, without calling GoodWatch while the session is current. */
	async account(raw: string | null | undefined): Promise<{ status: AccountStatus; session: MemberSession | null; changed: boolean }> {
		const opened = this.openSession(raw)
		let fresh
		try {
			fresh = await this.freshSession(opened)
		} catch (e) {
			// Still signed in; GoodWatch just couldn't renew it now. Keep the session untouched.
			if (opened && e instanceof RoomError && e.code === "busy")
				return { status: { state: "member", displayName: opened.displayName, unavailable: true }, session: opened, changed: false }
			throw e
		}
		if (!fresh) return { status: { state: "guest", displayName: null }, session: null, changed: Boolean(raw) }
		return {
			status: { state: "member", displayName: fresh.session.displayName },
			session: fresh.session,
			changed: fresh.renewed,
		}
	}
	/**
	 * Links your participant in a room to this device's sign-in: rooms you create, join or open while
	 * signed in. The live grant is checked with GoodWatch before it is copied into the room.
	 */
	async linkRoom(id: string, participantId: string, raw: string | null | undefined) {
		const fresh = await this.freshSession(this.openSession(raw))
		requireRoom(fresh, "member_required", "Sign in with GoodWatch again", 403)
		const session = fresh.session
		{
			const { room } = await this.get(id)
			const p = actor(room, participantId)
			requireRoom(
				!p.memberUserId || p.memberUserId === session.userId,
				"conflict",
				"You joined this room with another GoodWatch account",
			)
			if (
				p.memberUserId === session.userId &&
				p.member.state === "linked" &&
				p.memberGrant?.accessToken === session.accessToken &&
				p.memberGrant.expiresAt > this.now()
			)
				return { status: { state: "linked" as const, prefill: p.member.prefill }, session, renewed: fresh.renewed }
		}
		const grant = await this.issuer.verify(session.accessToken)
		requireRoom(grant.userId === session.userId, "unauthorized", "GoodWatch account changed", 401)
		const prefill = await this.reads.prefill(grant.userId, session.accessToken)
		const seen = await this.reads.seen?.(grant.userId, session.accessToken)
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			requireRoom(
				!p.memberUserId || p.memberUserId === grant.userId,
				"conflict",
				"You joined this room with another GoodWatch account",
			)
			this.applyLink(room, old.room, p, {
				userId: grant.userId,
				displayName: grant.displayName ?? session.displayName,
				prefill,
				seen,
				accessToken: session.accessToken,
				expiresAt: Math.min(session.expiresAt, grant.expiresAt),
			})
			room.revision++
			if (await this.repo.compareAndSwap(old, room, true))
				return { status: { state: "linked" as const, prefill }, session, renewed: fresh.renewed }
		}
		throw new RoomError("busy", "Room busy; try again", 503, true)
	}
	private async verifiedIdentity(room: ContinuousRoom, participantId: string) {
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
		return grant
	}
	async identity(room: ContinuousRoom, participantId: string) {
		return (await this.verifiedIdentity(room, participantId)).userId
	}
	/** Repair previously linked Guest names without changing their actor or choices. */
	private async restoreNickname(
		id: string, participantId: string, userId: string, token: string, name?: string | null,
	) {
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			requireRoom(
				p.memberUserId === userId && p.memberGrant?.accessToken === token,
				"conflict", "Account changed while restoring its name", 409,
			)
			const nickname = linkedNickname(p.nickname, name)
			if (nickname === p.nickname) return
			p.nickname = nickname
			room.revision++
			if (await this.repo.compareAndSwap(old, room, true)) return
		}
		throw new RoomError("busy", "Room busy; refresh your account", 503, true)
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
    private seenCache = new Map<string, {roster: number; keys: string[]}>()
    async seen(room: ContinuousRoom, participantId: string): Promise<string[]> {
      if (!this.reads.seen) return []
      const key = `${room.id}:${participantId}`
      const cached = this.seenCache.get(key)
      if (cached?.roster === room.rosterVersion) return cached.keys
      const userId = await this.identity(room, participantId)
      const keys = await this.reads.seen(userId, actor(room, participantId).memberGrant!.accessToken)
      this.seenCache.set(key, {roster:room.rosterVersion,keys})
      if (this.seenCache.size > 512) this.seenCache.delete(this.seenCache.keys().next().value!)
      return keys
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
			const grant = await this.verifiedIdentity(room, p.id)
			const prefill = await this.reads.prefill(grant.userId, p.memberGrant.accessToken)
			if (linkedNickname(p.nickname, grant.displayName) !== p.nickname)
				await this.restoreNickname(id, p.id, grant.userId, p.memberGrant.accessToken, grant.displayName)
			return { state: "linked", prefill }
		} catch {
			return { state: "unavailable", prefill: null }
		}
	}
}

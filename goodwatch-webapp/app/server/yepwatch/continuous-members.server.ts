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
/** Only a definitive refusal (revoked grant, another account) ends a device session. */
const refused = (e: unknown) => e instanceof RoomError && ["unauthorized", "member_required"].includes(e.code)
/** GoodWatch reads abort after 12 s (proposal-release-members.ts); an in-flight seen read is never shared longer. */
const SEEN_TRANSPORT_TIMEOUT_MS = 12_000
/**
 * Stored seen copies (ContinuousMembers.seenStored): Start uses one up to SEEN_COPY_MAX_AGE_MS old, and a room change
 * in setup reads again once the copy is SEEN_REFRESH_AFTER_MS old. At most SEEN_COPIES_MAX copies holding
 * SEEN_COPY_KEYS_MAX title keys are kept (least recently stored out): a missing copy only costs Start the bounded
 * read it made before copies existed.
 */
const SEEN_COPY_MAX_AGE_MS = 5 * 60_000
const SEEN_REFRESH_AFTER_MS = 10_000
const SEEN_COPIES_MAX = 2_000
const SEEN_COPY_KEYS_MAX = 1_000_000
const SEEN_REFUSALS_MAX = 50_000
/** Throttled, down, unreachable, a garbled reply: the session is kept for a later try. */
const unavailable = (e: unknown) =>
	e instanceof RoomError && e.code === "busy" ? e : new RoomError("busy", "GoodWatch is temporarily unavailable; try again", 503, true)
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
	/** Refuses (throws) when the token doesn't belong to `userId`: ContinuousMembers.seen checks the grant with this read alone. */
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
	/** How long a deck build or Start waits for one member's seen list before going on without it (default 300 ms). */
	seenReadTimeoutMs?: number
	/** The oldest stored seen copy Start uses instead of asking GoodWatch (default SEEN_COPY_MAX_AGE_MS). */
	seenCopyMaxAgeMs?: number
}
/** One device's GoodWatch sign-in, sealed by the server: browsers keep it in an HttpOnly cookie, apps in secure storage. */
export interface MemberSession {
	sessionId?: string
	v: 1
	userId: string
	displayName: string | null
	accessToken: string
	expiresAt: number
	refreshToken: string | null
	/**
	 * A refresh rotated these tokens but GoodWatch's identity check failed just then. The rotated
	 * credentials are kept (the old refresh token is spent); `userId` and `displayName` are still the
	 * previously verified identity, which is checked again before the session links a room.
	 */
	unverified?: true
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
const SESSION_AAD = "yepwatch-account-session-v3"
const INTENT_AAD = "yepwatch-member-intent"
type RenewalOutcome =
	| { state: "renewed"; session: MemberSession }
	| { state: "refused" }
	| { state: "unavailable"; error: RoomError }
/**
 * A rotated session is kept for its device until the device shows it has it (sends it, or one renewed from it),
 * then for LANDED_GRACE_MS more for requests still in flight with the replaced one. Undelivered, it is kept as long
 * as its refresh grant can last (RENEWABLE_SESSION_MS). A refusal is kept a day: forgetting one only means GoodWatch
 * refuses again. LANDED_MAX bounds memory; only undelivered rotations count against it in practice.
 */
const LANDED_GRACE_MS = 5 * 60_000
const REFUSAL_KEPT_MS = 24 * 3_600_000
const LANDED_MAX = 50_000
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
		const seenStarted = this.seenStart()
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
			if (await this.repo.compareAndSwap(old, room, true)) {
				if (seen) this.keepSeen(this.seenKey(id, p.id, grant.userId, tokens.accessToken), seenStarted, seen, p.memberGrant!.expiresAt)
				return {
					returnTo: intent.returnTo,
					status: { state: "linked" as const, prefill },
				}
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
			// Services are only valid within a country. A room without one takes the member's GoodWatch
			// country: the host's own country step can lose the race with this link, and friends would
			// then be refused every service they pick.
			const screen = (room as Room).screens[0]
			if (screen && !screen.country && link.prefill.country) screen.country = link.prefill.country
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
		return this.sealer().encode({ ...session, sessionId: session.sessionId ?? random() }, SESSION_AAD)
	}
	/** A session this server sealed, or null for anything else (tampered, foreign, malformed). */
	openSession(raw: string | null | undefined): MemberSession | null {
		if (!raw || raw.length > 12_000) return null
		try {
			const s = this.sealer().decode<MemberSession>(raw, SESSION_AAD)
			return s?.v === 1 &&
				typeof s.sessionId === "string" &&
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
			sessionId: previous?.sessionId ?? random(),
			userId: grant.userId,
			displayName: cleanName(grant.displayName) ?? previous?.displayName ?? null,
			accessToken: tokens.accessToken,
			expiresAt: Math.min(tokens.expiresAt, grant.expiresAt),
			refreshToken: tokens.refreshToken ?? previous?.refreshToken ?? null,
		}
	}
	/**
	 * Renewals of a lapsed device session with GoodWatch, one per credential (access + refresh token): concurrent
	 * requests carrying the same session share it. It is never tied to the request that started it, so a refresh
	 * token GoodWatch has already rotated is never lost when that request finishes first.
	 */
	private renewals = new Map<string, Promise<RenewalOutcome>>()
	/**
	 * What a finished renewal left for the session it replaced: the rotated session, or GoodWatch's refusal. Kept so a
	 * device still sending the replaced session gets the rotated one (it may not have received it yet), and is never
	 * sent to GoodWatch with its spent refresh token. A network failure keeps nothing: the stored session stays.
	 */
	private landed = new Map<string, { outcome: Exclude<RenewalOutcome, { state: "unavailable" }>; until: number }>()
	/** The renewal key of a rotated session -> the key of the session it replaced (see `delivered`). */
	private replaced = new Map<string, string>()
	private renewalKey(session: MemberSession) {
		return createHash("sha256").update(`${session.accessToken}\0${session.refreshToken ?? ""}`).digest("base64url")
	}
	private land(key: string, outcome: Exclude<RenewalOutcome, { state: "unavailable" }>) {
		const now = this.now()
		if (this.landed.size >= LANDED_MAX) {
			for (const [k, v] of this.landed) if (v.until <= now) this.forget(k)
			for (const [k] of this.landed) {
				if (this.landed.size < LANDED_MAX) break
				this.forget(k)
				console.warn(JSON.stringify({ event: "yepwatch_member_renewal_evicted" }))
			}
		}
		this.forget(key)
		this.landed.set(key, { outcome, until: now + (outcome.state === "renewed" ? RENEWABLE_SESSION_MS : REFUSAL_KEPT_MS) })
		// A verification keeps the tokens (the key maps onto itself): the session it replaced stays recorded.
		const next = outcome.state === "renewed" ? this.renewalKey(outcome.session) : null
		if (next && next !== key) this.replaced.set(next, key)
	}
	private forget(key: string) {
		const kept = this.landed.get(key)
		if (kept?.outcome.state === "renewed") {
			const next = this.renewalKey(kept.outcome.session)
			if (this.replaced.get(next) === key) this.replaced.delete(next)
		}
		this.landed.delete(key)
	}
	/** The device sent `session`: the rotations that led to it have reached it, and only in-flight requests need them. */
	private delivered(session: MemberSession) {
		const until = this.now() + LANDED_GRACE_MS
		let key = this.renewalKey(session)
		// A verified session also acknowledges the verification that kept its tokens.
		const verified = this.landed.get(key)
		if (verified?.outcome.state === "renewed" && !session.unverified && verified.until > until &&
			this.renewalKey(verified.outcome.session) === key) verified.until = until
		const seen = new Set<string>()
		while (!seen.has(key)) {
			seen.add(key)
			const previous = this.replaced.get(key)
			const kept = previous && this.landed.get(previous)
			if (!previous || !kept || kept.outcome.state !== "renewed" || this.renewalKey(kept.outcome.session) !== key) break
			if (kept.until > until) kept.until = until
			key = previous
		}
	}
	/**
	 * The newest session a finished renewal left for `session` (null: GoodWatch refused it). `moved`: it differs from
	 * the one given, so the device must be sent it.
	 */
	current(session: MemberSession): { session: MemberSession; moved: boolean } | null {
		let at = session
		let moved = false
		// To the end of the chain: every link replaced a different credential, or verified one (once).
		const seen = new Set<string>()
		for (;;) {
			const step = `${this.renewalKey(at)}\0${at.unverified ? 1 : 0}`
			if (seen.has(step)) break
			seen.add(step)
			const kept = this.landed.get(this.renewalKey(at))
			if (!kept || kept.until <= this.now()) break
			if (kept.outcome.state === "refused") return null
			const next = kept.outcome.session
			// A verified session keeps its tokens: it maps onto itself.
			if (next.accessToken === at.accessToken && next.refreshToken === at.refreshToken && !at.unverified) break
			at = next
			moved = true
		}
		return { session: at, moved }
	}
	/** Starts (or joins) the renewal of `session`; it never rejects. */
	private renewal(session: MemberSession): Promise<RenewalOutcome> {
		const key = this.renewalKey(session)
		const running = this.renewals.get(key)
		if (running) return running
		const started = this.now()
		const work = this.renew(session).then((outcome) => {
			if (outcome.state !== "unavailable") this.land(key, outcome)
			console.info(JSON.stringify({ event: "yepwatch_member_renewal", outcome: outcome.state, ms: this.now() - started }))
			return outcome
		}).finally(() => {
			if (this.renewals.get(key) === work) this.renewals.delete(key)
		})
		this.renewals.set(key, work)
		return work
	}
	/**
	 * One renewal: a refresh while the access token is spent, else a fresh identity check. A rotation whose identity
	 * check fails transiently still renews (the new tokens must be kept), marked unverified; a later renewal verifies
	 * its access token while it lasts, or refreshes with the rotated refresh token, never the spent one.
	 */
	private async renew(session: MemberSession): Promise<RenewalOutcome> {
		const live = session.expiresAt > this.now() + 30_000
		let tokens: MemberTokens
		try {
			tokens = live ? session : await this.issuer.refresh!({ refreshToken: session.refreshToken! })
		} catch (e) {
			return refused(e) ? { state: "refused" } : { state: "unavailable", error: unavailable(e) }
		}
		try {
			return { state: "renewed", session: await this.sessionFrom(tokens, session) }
		} catch (e) {
			if (refused(e)) return { state: "refused" }
			if (live) return { state: "unavailable", error: unavailable(e) }
			return {
				state: "renewed",
				session: {
					...session,
					accessToken: tokens.accessToken,
					expiresAt: tokens.expiresAt,
					refreshToken: tokens.refreshToken ?? session.refreshToken,
					unverified: true,
				},
			}
		}
	}
	/**
	 * A usable session: the same one while its access token lasts, a renewed one when it can be renewed, else null.
	 *
	 * `background` (room actions): never waits for GoodWatch. A session that needs renewing comes back as it is with
	 * `pending`, its renewal running on its own; a renewal that already finished is used.
	 */
	async freshSession(
		given: MemberSession | null,
		options: { background?: boolean } = {},
	): Promise<{ session: MemberSession; renewed: boolean; pending?: true } | null> {
		if (!given) return null
		const current = this.current(given)
		if (!current) return null
		const session = current.session
		const live = session.expiresAt > this.now() + 30_000
		if (live && !session.unverified) return { session, renewed: current.moved }
		if (!live && (!session.refreshToken || !this.issuer.refresh)) return null
		const renewal = this.renewal(session)
		if (options.background) return { session, renewed: current.moved, pending: true }
		const outcome = await renewal
		if (outcome.state === "refused") return null
		if (outcome.state === "unavailable") throw outcome.error
		return { session: outcome.session, renewed: true }
	}
	/** How long a browser keeps the session cookie. */
	sessionMaxAge(session: MemberSession) {
		const until = session.refreshToken ? this.now() + RENEWABLE_SESSION_MS : session.expiresAt
		return Math.max(0, Math.floor((until - this.now()) / 1000))
	}
	/**
	 * This device's sign-in, without calling GoodWatch while the session is current. `background`: see freshSession;
	 * `renewing` says a renewal is still running for the session returned.
	 */
	async account(
		raw: string | null | undefined,
		options: { background?: boolean } = {},
	): Promise<{ status: AccountStatus; session: MemberSession | null; changed: boolean; renewing?: true }> {
		const opened = this.openSession(raw)
		if (opened) this.delivered(opened)
		let fresh
		try {
			fresh = await this.freshSession(opened, options)
		} catch (e) {
			// Still signed in; GoodWatch just couldn't renew it now. Keep the session untouched.
			if (opened && e instanceof RoomError && e.code === "busy")
				return { status: { state: "member", displayName: opened.displayName, unavailable: true }, session: opened, changed: false }
			throw e
		}
		if (!fresh) return { status: { state: "guest", displayName: null }, session: null, changed: Boolean(raw) }
		return {
			status: {
				state: "member",
				displayName: fresh.session.displayName,
				...(fresh.session.unverified ? { unavailable: true } : {}),
			},
			session: fresh.session,
			changed: fresh.renewed,
			...(fresh.pending ? { renewing: true as const } : {}),
		}
	}
	/**
	 * Links your participant in a room to this device's sign-in: rooms you create, join or open while
	 * signed in. The live grant is checked with GoodWatch before it is copied into the room.
	 *
	 * `admit`: whether the place may still take this link, asked before GoodWatch is read and again on every write
	 * attempt (a link answered late must not land after Log out or Leave). Refused, nothing is written: null.
	 * A linked answer carries the room's context version as the link left it.
	 */
	async linkRoom(id: string, participantId: string, raw: string | null | undefined, admit?: (room: ContinuousRoom) => boolean | Promise<boolean>) {
		const fresh = await this.freshSession(this.openSession(raw))
		requireRoom(fresh, "member_required", "Sign in with GoodWatch again", 403)
		const session = fresh.session
		// Rotated tokens whose identity GoodWatch couldn't confirm yet: keep them, link nothing.
		if (session.unverified)
			return { status: { state: "unavailable" as const, prefill: null }, session, renewed: fresh.renewed }
		{
			const { room } = await this.get(id)
			if (admit && !(await admit(room))) return null
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
			) {
				// Already linked with this grant (an app reopening the room, perhaps on a restarted server): a missing or
				// ageing seen copy is read again in the background.
				this.refreshSeen(room, p.id)
				return { status: { state: "linked" as const, prefill: p.member.prefill }, session, renewed: fresh.renewed, contextVersion: room.contextVersion }
			}
		}
		const grant = await this.issuer.verify(session.accessToken)
		requireRoom(grant.userId === session.userId, "unauthorized", "GoodWatch account changed", 401)
		const prefill = await this.reads.prefill(grant.userId, session.accessToken)
		const seenStarted = this.seenStart()
		const seen = await this.reads.seen?.(grant.userId, session.accessToken)
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id)
			if (admit && !(await admit(old.room))) return null
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
			if (await this.repo.compareAndSwap(old, room, true)) {
				if (seen) this.keepSeen(this.seenKey(id, p.id, grant.userId, session.accessToken), seenStarted, seen, p.memberGrant!.expiresAt)
				return { status: { state: "linked" as const, prefill }, session, renewed: fresh.renewed, contextVersion: room.contextVersion }
			}
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
	/**
	 * Seen reads in flight per room seat, bound to the linked account and its grant: concurrent reads for the same
	 * link share one GoodWatch request. The entry goes once the read settles; what it read lives on as the link's copy.
	 */
	private seenReads = new Map<string, { fresh: boolean; read: Promise<string[]> }>()
	/**
	 * Stored seen copies: the newest successful GoodWatch read per room seat and link (account + grant), from sign-in
	 * (a room link), a deck build or a refresh. Only Start reads them (seenStored), and only as exclusions. A link is
	 * bound to its grant: a renewed grant, another account, a guest seat (Log out) or a seat that left has no copy.
	 */
	private seenCopies = new Map<string, { keys: string[]; started: { order: number; at: number }; expiresAt: number }>()
	private seenCopyKeys = 0
	/**
	 * Links whose grant GoodWatch refused (revoked, or answering for another account), until the grant expires: their
	 * copy is gone and no read, also one that started before the refusal and lands after it, stores one again.
	 */
	private seenRefused = new Map<string, number>()
	private seenOrder = 0
	private seenStart() {
		return { order: ++this.seenOrder, at: this.now() }
	}
	private seenKey(roomId: string, participantId: string, userId: string, accessToken: string) {
		return `${roomId}\0${participantId}\0${userId}\0${createHash("sha256").update(accessToken).digest("base64url")}`
	}
	/** The seat's current link; refuses a guest, an expired grant or an unlinked seat. */
	private seenLink(room: ContinuousRoom, participantId: string) {
		const p = actor(room, participantId)
		requireRoom(
			p.memberGrant && p.memberGrant.expiresAt > this.now() && p.memberUserId,
			"member_required",
			"Sign in with GoodWatch again",
			403,
		)
		return {
			userId: p.memberUserId,
			accessToken: p.memberGrant.accessToken,
			expiresAt: p.memberGrant.expiresAt,
			key: this.seenKey(room.id, p.id, p.memberUserId, p.memberGrant.accessToken),
		}
	}
	private refusedSeen(key: string) {
		const until = this.seenRefused.get(key)
		if (until === undefined) return false
		if (until > this.now()) return true
		this.seenRefused.delete(key)
		return false
	}
	/** Stores a successful read as the link's copy, unless a newer read is stored or GoodWatch refused the link. */
	private keepSeen(key: string, started: { order: number; at: number }, keys: string[], expiresAt: number) {
		if (this.refusedSeen(key)) return
		const old = this.seenCopies.get(key)
		if (old && old.started.order > started.order) return
		this.dropSeen(key)
		this.seenCopies.set(key, { keys, started, expiresAt })
		this.seenCopyKeys += keys.length
		const now = this.now()
		if (this.seenCopies.size > SEEN_COPIES_MAX || this.seenCopyKeys > SEEN_COPY_KEYS_MAX)
			for (const [k, v] of this.seenCopies) if (v.expiresAt <= now || now - v.started.at > this.copyMaxAge()) this.dropSeen(k)
		for (const [k] of this.seenCopies) {
			if (this.seenCopies.size <= SEEN_COPIES_MAX && this.seenCopyKeys <= SEEN_COPY_KEYS_MAX) break
			if (k !== key) this.dropSeen(k)
		}
	}
	private dropSeen(key: string) {
		const old = this.seenCopies.get(key)
		if (!old) return
		this.seenCopyKeys -= old.keys.length
		this.seenCopies.delete(key)
	}
	private refuseSeen(key: string, until: number) {
		this.dropSeen(key)
		this.seenRefused.delete(key)
		this.seenRefused.set(key, until)
		if (this.seenRefused.size <= SEEN_REFUSALS_MAX) return
		const now = this.now()
		for (const [k, v] of this.seenRefused) if (v <= now) this.seenRefused.delete(k)
		for (const [k] of this.seenRefused) {
			if (this.seenRefused.size <= SEEN_REFUSALS_MAX) break
			this.seenRefused.delete(k)
		}
	}
	private copyMaxAge() {
		return this.config.seenCopyMaxAgeMs ?? SEEN_COPY_MAX_AGE_MS
	}
	/** The link's copy while it is young enough for Start, else undefined. */
	private seenCopy(key: string) {
		if (this.refusedSeen(key)) return undefined
		const copy = this.seenCopies.get(key)
		if (!copy) return undefined
		if (copy.expiresAt > this.now() && this.now() - copy.started.at <= this.copyMaxAge()) return copy
		this.dropSeen(key)
		return undefined
	}
	/**
	 * A member's seen title keys, read from GoodWatch; a successful read becomes the link's copy, a refusal ends it.
	 * `fresh` never joins a read that started earlier, so a title marked Seen since then is in the list; other reads
	 * share any read in flight for the same link.
	 */
	async seen(room: ContinuousRoom, participantId: string, options: { fresh?: boolean } = {}): Promise<string[]> {
		if (!this.reads.seen) return []
		const link = this.seenLink(room, participantId)
		const key = link.key
		const pending = this.seenReads.get(key)
		if (pending && (pending.fresh || !options.fresh)) return pending.read
		const started = this.seenStart()
		// No separate identity check first: the read proves the grant itself (MemberReads.seen), and a second
		// round trip to GoodWatch sat on Start's path.
		const read = this.reads.seen(link.userId, link.accessToken)
		const entry = { fresh: Boolean(options.fresh), read }
		// Dropped when it settles, or after the transport's own timeout if a reader never settles.
		const forget = () => {
			clearTimeout(timer)
			if (this.seenReads.get(key) === entry) this.seenReads.delete(key)
		}
		const timer = setTimeout(forget, SEEN_TRANSPORT_TIMEOUT_MS)
		timer.unref?.()
		read.then(
			(keys) => {
				forget()
				this.keepSeen(key, started, keys, link.expiresAt)
			},
			(e) => {
				forget()
				if (refused(e)) this.refuseSeen(key, link.expiresAt)
			},
		)
		this.seenReads.set(key, entry)
		return read
	}
	/**
	 * Reads the seat's seen list again in the background when its copy is missing or SEEN_REFRESH_AFTER_MS old (a
	 * room change in setup, a room reopened): Start then finds a recent copy. Never throws.
	 */
	refreshSeen(room: ContinuousRoom, participantId: string) {
		if (!this.reads.seen) return
		try {
			const { key } = this.seenLink(room, participantId)
			if (this.refusedSeen(key) || this.seenReads.has(key)) return
			const copy = this.seenCopies.get(key)
			if (copy && this.now() - copy.started.at < SEEN_REFRESH_AFTER_MS) return
			this.seen(room, participantId).catch(() => {})
		} catch {
			// Not linked (any more): nothing to refresh.
		}
	}
	/**
	 * `seen` for building decks: never fails the room. A refused grant, a GoodWatch outage or a read slower than
	 * `seenReadTimeoutMs` leaves this member's seen titles out (logged); nothing is taken from an earlier read or
	 * another link.
	 */
	async seenOrNone(room: ContinuousRoom, participantId: string, options: { fresh?: boolean } = {}): Promise<string[]> {
		let timer: ReturnType<typeof setTimeout> | undefined
		const timedOut = new Error("seen read timed out")
		try {
			return await Promise.race([
				this.seen(room, participantId, options),
				new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timedOut), this.config.seenReadTimeoutMs ?? 300) }),
			])
		} catch (e) {
			const reason = e === timedOut ? "timeout" : refused(e) ? "refused" : "unavailable"
			console.warn(JSON.stringify({ event: "yepwatch_member_seen_skipped", reason, fresh: Boolean(options.fresh) }))
			return []
		} finally {
			clearTimeout(timer)
		}
	}
	/**
	 * Start's seen titles for one seat, without calling GoodWatch in the common case: the link's stored copy (read at
	 * sign-in and kept up by deck builds and room changes in setup) while it is at most `seenCopyMaxAgeMs` old. A title
	 * marked Seen after that read can still appear. Only the seat's current link counts: a guest seat (Log out), an
	 * expired or renewed grant, or a link GoodWatch refused has no copy, and a refused link is left out without
	 * asking again. No copy (a restarted server, another instance, a sign-in read that failed): a fresh read, as
	 * Start made before copies existed (seenOrNone: bounded, best effort).
	 */
	async seenStored(room: ContinuousRoom, participantId: string): Promise<string[]> {
		if (!this.reads.seen) return []
		let key: string
		try {
			key = this.seenLink(room, participantId).key
		} catch (e) {
			console.warn(JSON.stringify({ event: "yepwatch_member_seen_skipped", reason: refused(e) ? "refused" : "unavailable", stored: true }))
			return []
		}
		if (this.refusedSeen(key)) {
			console.warn(JSON.stringify({ event: "yepwatch_member_seen_skipped", reason: "refused", stored: true }))
			return []
		}
		const copy = this.seenCopy(key)
		console.info(JSON.stringify({ event: "yepwatch_member_seen_start", source: copy ? "copy" : "read", ...(copy ? { ageMs: this.now() - copy.started.at } : {}) }))
		return copy ? copy.keys : this.seenOrNone(room, participantId, { fresh: true })
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

import { MemoryAccountRooms } from "./proposal-account-store.ts"
import { MemoryDeletionStore, requireNotDeleting, type DeletionStore } from './proposal-deletion.ts'
import type { AccountRoomsStore, RoomAccount } from "./proposal-types.ts"
import type { AccountHome } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import {
	redesignCommands,
	retireIneligible,
	refreshServices,
	attributeCandidates,
	titleKey
} from "./proposal-redesign.ts"
import type { InterpretRoom } from "./proposal-intent.ts"
import { activeRoom, normalizeRoomContext } from "./proposal-context.ts"
import { PreparedDecks, type PreparedDecksOptions } from "./proposal-prepared-decks.ts"
import { CONTINUOUS_LIMITS as L } from "./continuous-types.ts"
import type {
	CommandEnvelope,
	CommandResult,
	GuestAdmission,
	CreateRoomRequest,
	GuestAdmissionRequest,
	JoinRoomRequest,
	RoomSetupRequest,
	RealtimeAttachment,
	RealtimeTicket,
	RealtimeViewResponse,
	RealtimeViewsResponse,
	RoomInvalidation,
	InvitePreview
} from "../../../packages/yepwatch-contracts/proposal.ts"
import {
	shortInvite,
	previousInvite,
	INVITE_ATTEMPTS,
	normalizeShortInvite
} from "./proposal-invites.ts"
import { hash, equal, keyed, random, sign, verify } from "./crypto.server.ts"
import { IndeterminateWrite, RoomError, requireRoom } from "./errors.ts"
import {
	actor,
	agreementCandidate,
	continuousLive,
	proposalSnapshot,
	proposalTransition,
	preflight,
	reconcile,
	retire,
	staleRefill
} from "./proposal-machine.ts"
import type {
	ProposalCatalog,
	ProposalParticipant,
	ProposalRepository,
	ProposalRoom,
	ProposalStored
} from "./proposal-types.ts"
import type { ActorCredential } from "./service.server.ts"
interface Lease {
	roomId: string
	participantId: string
	epoch: number
	expiresAt: number
	scope: "shared:read"
	format: 3
	sessionId?: string
}
/** Optional release-only guard; legacy runtimes retain existing behavior. */
export interface ProposalOperationGuard {
	/** Throws unless the room is live and holds its capacity. What it resolves to may be passed to `command`. */
	active(room: Pick<ProposalRoom, "id" | "expiresAt">): Promise<unknown>
	/** Reserves the room in its creator's allowance; there is no shared cap on active rooms. */
	create(roomId: string, admissionDigest: string, creatorDigest: string): Promise<number>
	join(roomId: string, actorId: string, admissionDigest: string): Promise<void>
	/** `checked`: what `active` just resolved to for this room, so the guard can start from what it read. */
	command(roomId: string, actorId: string, commandDigest: string, checked?: unknown): Promise<void>
}
export class ProposalService {
	readonly deletions: DeletionStore
	readonly accounts: AccountRoomsStore
	readonly repository: ProposalRepository
	readonly catalog: ProposalCatalog
	private secret: string
	private publish: (event: RoomInvalidation) => Promise<void>
	private guard?: ProposalOperationGuard
	private now: () => number
	private interpret?: InterpretRoom
	/** First decks built during setup, so Start doesn't wait for the catalog. */
	readonly decks: PreparedDecks
	private knownCountries = new Set<string>()
	private writes = new Map<string, { tail: Promise<void>; count: number }>()
	/** Rooms' expiries (fixed at creation) by id, most recently read last: lets a read check capacity alongside. */
	private expiries = new Map<string, number>()
	constructor(
		repository: ProposalRepository,
		catalog: ProposalCatalog,
		secret: string,
		publish: (event: RoomInvalidation) => Promise<void> = async () => {},
		now: () => number = Date.now,
		guard?: ProposalOperationGuard,
		interpret?: InterpretRoom,
		options: { decks?: PreparedDecksOptions } = {}
	) {
		if (secret.length < 32) throw new Error("Room secret too short")
		this.repository = repository
		this.accounts = repository.accountStore ?? new MemoryAccountRooms()
		this.deletions = repository.deletionStore ?? new MemoryDeletionStore()
		this.catalog = catalog
		this.secret = secret
		this.publish = publish
		this.now = now
		this.guard = guard
		this.interpret = interpret
		this.decks = new PreparedDecks(catalog, async (id) => {
			const stored = await repository.read(id)
			return stored && stored.room.format === 2 && stored.room.flowVersion === 3 ? stored.room : null
		}, { now, ...options.decks })
	}
	/** Avoid retry storms between this process's joins, votes and socket handshakes.
	 * Database CAS remains the authority across processes and background repair.
	 */
	private async write<T>(id: string, work: () => Promise<T>): Promise<T> {
		const lane = this.writes.get(id) ?? { tail: Promise.resolve(), count: 0 }
		if (lane.count >= 32)
			throw new RoomError("busy", "Room busy; retry shortly", 503, true)
		const queuedAt = Date.now()
		const previous = lane.tail
		let release!: () => void
		lane.tail = new Promise<void>((resolve) => {
			release = resolve
		})
		lane.count++
		this.writes.set(id, lane)
		try {
			await previous
			if (Date.now() - queuedAt >= 10000)
				throw new RoomError("busy", "Room busy; retry shortly", 503, true)
			return await work()
		} finally {
			lane.count--
			release()
			if (!lane.count) this.writes.delete(id)
		}
	}
	private async get(id: string): Promise<ProposalStored> {
		return (await this.readChecked(id)).stored
	}
	/** A stored room any answer may be built from: a v3 room, not expired, its capacity reservation still active. */
	private async live(stored: ProposalStored | null): Promise<ProposalStored> {
		return (await this.checked(stored)).stored
	}
	/**
	 * Reads the room and checks it like live(), also returning what the guard's capacity check read (for the
	 * command's permit). A room's expiry is fixed when it is created, so once this process has read the room the
	 * capacity check runs alongside the room read instead of after it: one store round trip on every read, vote
	 * and realtime refresh instead of two.
	 */
	private async readChecked(id: string): Promise<{ stored: ProposalStored; check: unknown }> {
		const expiresAt = this.expiries.get(id)
		if (!this.guard || expiresAt === undefined) return this.checked(await this.repository.read(id))
		const early = this.guard.active({ id, expiresAt }).then(
			(check) => ({ check }),
			(error: unknown) => ({ error })
		)
		const stored = await this.repository.read(id)
		return this.checked(stored, stored?.room.expiresAt === expiresAt ? early : undefined)
	}
	/** live(), also returning what the guard's capacity check read. `early`: that check, already started for this room's expiry. */
	private async checked(
		stored: ProposalStored | null,
		early?: Promise<{ check: unknown } | { error: unknown }>
	): Promise<{ stored: ProposalStored; check: unknown }> {
		requireRoom(
			stored && stored.room.format === 2 && stored.room.flowVersion === 3,
			"not_found",
			"Room unavailable",
			404
		)
		continuousLive(stored.room, this.now())
		this.expiries.delete(stored.room.id)
		this.expiries.set(stored.room.id, stored.room.expiresAt)
		if (this.expiries.size > 4096) this.expiries.delete(this.expiries.keys().next().value!)
		const result = early ? await early : { check: await this.guard?.active(stored.room) }
		if ("error" in result) throw result.error
		return { stored, check: result.check }
	}
	private auth(
		room: ProposalRoom,
		credential: ActorCredential,
		allowLeft = false
	) {
		const p = actor(room, credential.participantId)
		requireRoom(
			allowLeft || p.leftAt == null,
			"forbidden",
			"You have left this room",
			403
		)
		requireRoom(
			!p.revoked && (p.memberUserId
				? p.memberUserId === credential.accountId && Boolean((p.sessions ?? []).find(s => s.id === credential.sessionId && s.expiresAt > this.now() && equal(s.tokenHash, hash(credential.token))))
				: equal(p.tokenHash, hash(credential.token))),
			"unauthorized",
			"Invalid room credential",
			401
		)
		return p
	}
	/** Private draft interpretation; only the durable search budget changes, never ideas or command sequence. */
	async preview(
		id: string,
		credential: ActorCredential,
		input: { prompt: string; country: string; serviceIds: number[] }
	) {
		const { room } = await this.get(id)
		const p = this.auth(room, credential)
		requireRoom(
			room.hostId === p.id,
			"forbidden",
			"Only the host can edit the room description",
			403
		)
		requireRoom(
			room.phase === "setup",
			"conflict",
			"Return to setup to edit the room"
		)
		const metadata = await this.catalog.metadata(input.country)
		requireRoom(
			metadata.countries.some((c) => c.code === input.country) &&
				input.serviceIds.every((id) =>
					metadata.services.some((s) => s.id === id)
				),
			"invalid_request",
			"Choose a valid country and services",
			400
		)
		requireRoom(
			this.interpret,
			"busy",
			"Room prompts are temporarily unavailable",
			503
		)
		await this.guard?.command(id, p.id, hash(`preview:${random()}`))
		let reserved = false
		for (let attempt = 0; attempt < 6; attempt++) {
			const old = await this.get(id),
				person = this.auth(old.room, credential)
			requireRoom(
				old.room.hostId === person.id && old.room.phase === "setup",
				"conflict",
				"Room setup changed"
			)
			requireRoom(
				(old.room.interpretationCount ?? 0) < 24,
				"limit_reached",
				"Room interpretation budget reached"
			)
			const next = structuredClone(old.room)
			next.interpretationCount = (next.interpretationCount ?? 0) + 1
			next.revision++
			if (await this.repository.compareAndSwap(old, next, true)) {
				reserved = true
				break
			}
		}
		requireRoom(reserved, "busy", "Room busy; retry shortly", 503)
		const result = await this.interpret!(
			input.prompt,
			input.country,
			input.serviceIds,
			p.memberUserId ? "member" : "guest"
		)
		return { prompt: result.prompt, attributes: result.attributes }
	}
	private identity(id: string, request: GuestAdmissionRequest) {
		const key = JSON.stringify([id, request.commandId, request.admissionSecret])
		return {
			id: keyed(this.secret, "proposal-participant", key).slice(0, 32),
			token: keyed(this.secret, "proposal-token", key),
			digest: hash(JSON.stringify(request))
		}
	}
	private legacyInvite(id: string) {
		return `${id}.${keyed(this.secret, "proposal-invite", id)}`
	}
	private async reserveInvite(id: string, expiresAt: number) {
		if (!this.repository.rememberInvite || !this.repository.findInvite)
			return { code: this.legacyInvite(id), expiresAt }
		for (let attempt = 0; attempt < INVITE_ATTEMPTS; attempt++) {
			const code = shortInvite(this.secret, id, attempt)
			const reserved = await this.repository.rememberInvite(
				hash(code),
				id,
				expiresAt
			)
			if (reserved !== null) return { code, expiresAt: reserved }
		}
		throw new RoomError(
			"busy",
			"Room codes are busy. Retry the same request.",
			503,
			true
		)
	}
	private async roomInvite(room: ProposalRoom) {
		const codes = [
			this.legacyInvite(room.id),
			previousInvite(this.secret, room.id),
			...Array.from({ length: INVITE_ATTEMPTS }, (_, i) =>
				shortInvite(this.secret, room.id, i)
			)
		]
		const code = codes.find((code) => equal(hash(code), room.inviteHash))
		requireRoom(code, "not_found", "Invite unavailable", 404)
		if (normalizeShortInvite(code)) {
			const reserved = await this.repository.rememberInvite!(
				hash(code),
				room.id,
				room.expiresAt
			)
			if (reserved !== room.expiresAt)
				throw new RoomError("busy", "Invitation unavailable", 503, true)
		}
		return code
	}
	private async admission(
		room: ProposalRoom,
		request: GuestAdmissionRequest,
		account?: RoomAccount
	): Promise<GuestAdmission> {
		if (account) {
			const p = room.participants.find(p => p.memberUserId === account.userId)
			requireRoom(p, "unauthorized", "Room membership unavailable", 401)
			return this.recoverAdmission(room.id, this.accountCredential(room.id, p.id, account))
		}
		const p = this.identity(room.id, request)
		// Admission replay is capability recovery, not an authorization bypass.
		// The original bootstrap must still derive the active original credential;
		// revocation/epoch changes may never disclose a fresh private snapshot.
		const member = this.auth(room, { participantId: p.id, token: p.token })
		requireRoom(
			member.epoch === 1,
			"unauthorized",
			"Admission capability changed",
			401
		)
		requireRoom(
			equal(actor(room, p.id).admissionHash, p.digest),
			"conflict",
			"Admission retry changed"
		)
		const code = await this.roomInvite(room)
		return {
			credential: {
				sessionKey: hash(p.token),
				roomId: room.id,
				participantId: p.id,
				token: p.token,
				expiresAt: room.expiresAt
			},
			invite: {
				code,
				path: `/r/${code}`
			},
			snapshot: proposalSnapshot(room, p.id)
		}
	}
	private member(
		roomId: string,
		request: GuestAdmissionRequest
	): ProposalParticipant {
		const p = this.identity(roomId, request)
		return {
			id: p.id,
			tokenHash: hash(p.token),
			admissionHash: p.digest,
			nickname: request.nickname,
			serviceIds: null,
			showSeen: false,
			epoch: 1,
			nextSequence: 1,
			screenId: null,
			ready: false,
			votes: {},
			pick: { candidateId: null, revision: 0 },
			approvedProposalVersion: null,
			agreementRevision: 0,
			member: { state: "guest", prefill: null },
			memberUserId: null,
			receipts: []
		}
	}
	/**
	 * The first setup a create request carries (country, first idea), applied to the new room before it
	 * is first stored, as the host's configure and add_idea would. An unknown country is left out (the app's
	 * own commands set it afterwards); search unavailable only leaves the idea uninterpreted.
	 */
	private async withSetup(
		room: ProposalRoom,
		setup: RoomSetupRequest,
		interpretation: { value?: Promise<NonNullable<ProposalRoom["intent"]> | null> }
	): Promise<ProposalRoom> {
		const host = actor(room, room.hostId)
		const step = (from: ProposalRoom, command: RoomCommand, commandId: string) =>
			proposalTransition(from, host.id, { commandId, sequence: 0, command }, this.now(), undefined, true)
		let next = step(room, { type: "configure", expectedContextVersion: room.contextVersion, country: setup.country }, "setup-country")
		const search = () => {
			if (!setup.idea || !this.interpret) return
			const services = next.screens[0]?.serviceIds ?? []
			// Searched once per create request, also when a lost insert makes the loop go round again.
			interpretation.value ??= this.interpret(setup.idea, setup.country, services, host.memberUserId ? "member" : "guest").catch(() => null)
		}
		// A country this process has already confirmed is searched alongside the catalog check; any other only after
		// it, so an unknown country never spends a search.
		if (this.knownCountries.has(setup.country)) search()
		const metadata = await this.catalog.metadata(setup.country).catch(() => null)
		for (const c of metadata?.countries ?? []) this.knownCountries.add(c.code)
		if (!metadata?.countries.some((c) => c.code === setup.country)) return room
		search()
		if (setup.idea) {
			// The idea is kept also when search is unavailable (budget, outage, timeout, none configured): it opens
			// uninterpreted, the deck uses the normal ranking, and the app never has to send it again as a command.
			const interpreted = interpretation.value ? await interpretation.value : null
			const ideaId = keyed(this.secret, "proposal-setup-idea", room.id).slice(0, 32)
			next = step(next, { type: "add_idea", text: setup.idea }, ideaId)
			if (interpreted) {
				const idea = next.ideas!.find((i) => i.id === ideaId)!
				idea.attributes = structuredClone(interpreted.attributes)
				idea.rankedKeys = [...interpreted.rankedKeys]
				idea.interpretedAt = interpreted.interpretedAt
				// Only a search that answered spends the room's budget, as before.
				next.interpretationCount = (next.interpretationCount ?? 0) + 1
				attributeCandidates(next)
			}
		}
		if (this.catalog.refresh) next.candidates = await this.catalog.refresh(activeRoom(next))
		retireIneligible(next, new Set((await this.catalog.excludedKeys?.(next)) ?? []))
		reconcile(next, room)
		return next
	}
	async create(request: CreateRoomRequest, account?: RoomAccount, guestCreatorId?: string) {
		if (account) await this.requireAccountActive(account.userId);
		const interpretation: { value?: Promise<NonNullable<ProposalRoom["intent"]> | null> } = {}
		const id = keyed(
			this.secret,
			"proposal-room",
			JSON.stringify([request.commandId, request.admissionSecret])
		).slice(0, 32)
		for (let i = 0; i < 4; i++) {
			const existing = await this.repository.read(id)
			if (existing) {
				continuousLive(existing.room, this.now())
				await this.guard?.active(existing.room)
				return this.admission(existing.room, request, account)
			}
			// A caller without any creator identity (HTTP always sends one) gets an allowance of its own, like a
			// browser without the creator cookie.
			const creatorDigest = keyed(this.secret, 'room-creator', account
				? `account:${account.userId}`
				: guestCreatorId ? `guest:${guestCreatorId}` : `room:${id}`)
			const expiresAt =
				(await this.guard?.create(id, hash(JSON.stringify(request)), creatorDigest)) ??
				this.now() + L.roomMs
			const invitation = await this.reserveInvite(id, expiresAt)
			const p = this.member(id, request)
			p.joinedAt = this.now()
			if (account) this.connectAccount(id, p, account, invitation.expiresAt)
			const blank: ProposalRoom = {
				format: 2,
				flowVersion: 3,
				ideas: [],
				disabledServiceIds: [],
				interpretationCount: 0,
				proposalVersion: 0,
				proposal: null,
				id,
				hostId: p.id,
				revision: 1,
				expiresAt: invitation.expiresAt,
				inviteHash: hash(invitation.code),
				phase: "setup",
				rosterVersion: 1,
				contextVersion: 1,
				generation: 0,
				participants: [p],
				screens: [],
				constraints: {
					kinds: ["movie", "show_start"],
					maxMinutes: null,
					moods: []
				},
				candidates: [],
				seenKeys: [],
				stream: { version: 0, state: "ready", reason: null },
				agreement: { version: 0, state: "none", error: null },
				decision: null,
				tickets: []
			}
			const room = request.setup ? await this.withSetup(blank, request.setup, interpretation) : blank
			try {
				if (account) await this.accounts.remember(account.userId, { roomId: id, expiresAt: room.expiresAt })
				if (await this.repository.insert(room)) this.decks.schedule(id)
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
			}
		}
		throw new RoomError(
			"outcome_unknown",
			"Retain and retry same admission",
			503,
			true
		)
	}
	async resolveInvite(code: string) {
		const room = await this.invitedRoom(code)
		return { roomId: room.id }
	}
	async invitePreview(code: string): Promise<InvitePreview> {
		const room = activeRoom(await this.invitedRoom(code))
		return {
			roomId: room.id,
			hostName: room.participants.find((p) => p.id === room.hostId)?.nickname || null,
			ideas: (room.ideas ?? []).filter((idea) => idea.on).map(({ text }) => ({ text })),
			kinds: [...room.constraints.kinds],
			phase: room.phase,
			people: room.participants.length
		}
	}
	private async invitedRoom(code: string): Promise<ProposalRoom> {
		const short = normalizeShortInvite(code)
		const [legacyId, proof, extra] = code.split(".")
		const id = short
			? await this.repository.findInvite?.(hash(short))
			: legacyId
		if (short) code = short
		requireRoom(
			id && (short || (proof && !extra && /^[A-Za-z0-9_-]{32}$/.test(id))),
			"not_found",
			"Invite unavailable",
			404
		)
		const { room } = await this.get(id)
		requireRoom(
			equal(room.inviteHash, hash(code)),
			"not_found",
			"Invite unavailable",
			404
		)
		return room
	}
	async join(id: string, request: JoinRoomRequest, account?: RoomAccount) {
		return this.write(id, () => this.joinRoom(id, request, account))
	}
	private async joinRoom(id: string, request: JoinRoomRequest, account?: RoomAccount) {
		if (account) await this.requireAccountActive(account.userId);
		const resolved = await this.resolveInvite(request.inviteCode)
		requireRoom(resolved.roomId === id, "not_found", "Invite unavailable", 404)
		const { inviteCode: _invite, screenId, ...base } = request
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const existing = account && room.participants.find(p => p.memberUserId === account.userId)
			if (existing) return this.resumeAccount(id, account!, true)
			const p = this.member(id, base)
			p.joinedAt = this.now()
			if (account) {
				this.connectAccount(id, p, account, room.expiresAt)
				await this.accounts.remember(account.userId, { roomId: id, expiresAt: room.expiresAt })
			}
			if (room.participants.some((m) => m.id === p.id))
				return this.admission(room, base, account)
			requireRoom(
				room.phase !== "decided",
				"conflict",
				"This room has chosen; ask the host to restart"
			)
			requireRoom(
				room.participants.length < L.participants,
				"limit_reached",
				"Room is full"
			)
			if (screenId) {
				requireRoom(
					room.screens.length === 1,
					"invalid_request",
					"Unknown screen",
					400
				)
				p.screenId = screenId
			}
			await this.guard?.join(id, p.id, p.admissionHash)
			if (!activeRoom(room).participants.length) room.hostId = p.id
			room.participants.push(p)
			refreshServices(room)
			room.rosterVersion++
			room.revision++
			if (room.phase === "choosing" && this.catalog.refresh)
				room.candidates = await this.catalog.refresh(activeRoom(room))
			if (room.phase === "choosing") {
				retireIneligible(
					room,
					new Set((await this.catalog.excludedKeys?.(room)) ?? [])
				)
				room.stream = {
					version: room.stream.version + 1,
					state: "ready",
					reason: null
				}
			}
			reconcile(room, old.room)
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				continue
			}
			await this.notify(id)
			return this.admission((await this.get(id)).room, base, account)
		}
		throw new RoomError(
			"outcome_unknown",
			"Retain and retry same admission",
			503,
			true
		)
	}
	async resumeOrJoin(
		id: string,
		credential: ActorCredential,
		request: JoinRoomRequest
	) {
		const resolved = await this.resolveInvite(request.inviteCode)
		requireRoom(resolved.roomId === id, "not_found", "Invite unavailable", 404)
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const p = this.auth(old.room, credential, true)
			if (p.leftAt == null) return this.recoverAdmission(id, credential)
			const room = structuredClone(old.room)
			if (!activeRoom(room).participants.length) room.hostId = p.id
			const returning = actor(room, p.id)
			returning.leftAt = null
			returning.epoch++
			refreshServices(room)
			room.rosterVersion++
			room.revision++
			if (room.phase === "choosing" && this.catalog.refresh)
				room.candidates = await this.catalog.refresh(activeRoom(room))
			if (room.phase !== "decided") reconcile(room, old.room)
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				continue
			}
			await this.notify(id)
			return this.recoverAdmission(id, credential)
		}
		throw new RoomError(
			"outcome_unknown",
			"Retry returning to your saved place",
			503,
			true
		)
	}

	async recoverAdmission(
		id: string,
		credential: ActorCredential
	): Promise<GuestAdmission> {
		const { room } = await this.get(id)
		const p = this.auth(room, credential)
		const code = await this.roomInvite(room)
		return {
			recovered: true,
			credential: {
				sessionKey: hash(credential.token),
				roomId: id,
				participantId: p.id,
				token: credential.token,
				expiresAt: room.expiresAt
			},
			invite: { code, path: `/r/${code}` },
			snapshot: this.snapshot(room, credential)
		}
	}
	async read(id: string, credential: ActorCredential) {
		const { room } = await this.get(id)
		const p = this.auth(room, credential, true)
		requireRoom(p.memberUserId || p.leftAt == null, "forbidden", "You have left this room", 403)
		return this.snapshot(room, credential)
	}
	/**
	 * `allowed`: a check still running that this actor may act (a guest's deletion check), read alongside the room.
	 * Nothing is written or answered before it passes, and its refusal wins over the command's own.
	 */
	async command(
		id: string,
		credential: ActorCredential,
		envelope: CommandEnvelope,
		allowed: Promise<void> = Promise.resolve()
	): Promise<CommandResult> {
		const { receipt, room } = await this.write(id, () =>
			this.applyCommand(id, credential, envelope, allowed)
		).catch(async (e: unknown) => {
			await allowed
			throw e
		})
		await allowed
		// The command answers with the room it committed: its read was checked (v3, live, capacity reserved) just
		// before the compare-and-swap, and a newer revision reaches this phone over the socket like any other change.
		// Its expiry and capacity reservation are checked again after the commit, as any read would.
		// notify (publish + acknowledge) then runs on its own, unless the answer has to wait for it: a decision moved
		// into the history is stored on the accounts first, and an agreement check settles before it answers.
		// Fresh availability checks must not block joins or withdrawals that invalidate them.
		if (room && !(room.committed.phase === "choosing" && room.committed.agreement.state === "checking") && !room.historyChanged) {
			void this.notify(id, { yieldToQueued: true })
			continuousLive(room.committed, this.now())
			// The capacity read is in flight while the answer's snapshot is built.
			const capacity = this.guard?.active(room.committed)
			capacity?.catch(() => {}) // awaited below
			const snapshot = this.snapshot(room.committed, credential)
			await capacity
			return { receipt, snapshot }
		}
		let stored = await this.notify(id, { yieldToQueued: true })
		if (!stored || (stored.room.phase === "choosing" && stored.room.agreement.state === "checking")) {
			await this.settle(id)
			stored = await this.repository.read(id)
		}
		const committed = (await this.live(stored)).room
		return {
			receipt,
			snapshot: this.snapshot(committed, credential)
		}
	}
	private async applyCommand(
		id: string,
		credential: ActorCredential,
		envelope: CommandEnvelope,
		allowed: Promise<void>
	): Promise<{ receipt: CommandResult["receipt"]; room?: { committed: ProposalRoom; historyChanged: boolean } }> {
		const digest = hash(JSON.stringify(envelope))
		let uncertain = false
		let interpreted: ProposalRoom["intent"] | undefined
		const ideaCommand =
			envelope.command.type === "add_idea" ||
			envelope.command.type === "edit_idea"
		// Search unavailable never refuses an idea: it is stored uninterpreted (normal ranking, no ranked keys).
		let searchFailed = false
		let budgetRefused = false
		if (ideaCommand && this.interpret) {
			// Reserve the lifetime spend before search; failed searches also spend a slot, except a refusal for
			// GoodWatch's spend limit, which never ran a search (refunded when the idea is stored).
			// Search runs once here, outside the command-publication retry loop.
			for (let attempt = 0; attempt < 6; attempt++) {
				const old = await this.get(id),
					p = this.auth(old.room, credential)
				const slot = this.sequenceSlot(p, credential, envelope, digest)
				if ("replayed" in slot) return { receipt: slot }
				requireRoom(
					this.commandState(p, credential).nextSequence === slot.sequence,
					"conflict",
					"Commands must be sent in order"
				)
				proposalTransition(old.room, p.id, envelope, this.now())
				await allowed
				await this.guard?.command(id, p.id, digest)
				const reserved = structuredClone(old.room)
				reserved.interpretationCount = (reserved.interpretationCount ?? 0) + 1
				reserved.revision++
				// An ambiguous reservation never starts search: retry may spend another slot but cannot exceed 24.
				if (!(await this.repository.compareAndSwap(old, reserved, true)))
					continue
				const c = envelope.command as Extract<
					RoomCommand,
					{ type: "add_idea" | "edit_idea" }
				>
				try {
					interpreted = await this.interpret(
						c.text,
						old.room.screens[0]?.country ?? "US",
						old.room.screens[0]?.serviceIds ?? [],
						p.memberUserId ? "member" : "guest"
					)
				} catch (error) {
					searchFailed = true
					budgetRefused = error instanceof RoomError && error.code === "catalog_unavailable"
				}
				break
			}
			requireRoom(interpreted || searchFailed, "busy", "Room busy; retry this idea", 503)
		}
		for (let i = 0; i < 6; i++) {
			const { stored: old, check } = await this.readChecked(id)
			const p = this.auth(
				old.room,
				credential,
				envelope.command.type === "leave"
			)
			const slot = this.sequenceSlot(p, credential, envelope, digest)
			if ("replayed" in slot) return { receipt: slot }
			const sequence = slot.sequence
			requireRoom(
				sequence >= this.commandState(p, credential).nextSequence,
				"outcome_unknown",
				"Receipt no longer retained; reconcile current state",
				503
			)
			requireRoom(
				sequence === this.commandState(p, credential).nextSequence,
				"conflict",
				"Commands must be sent in order"
			)
			requireRoom(
				p.leftAt == null || envelope.command.type === "leave",
				"forbidden",
				"You have left this room",
				403
			)
			preflight(old.room, p.id, envelope, this.now())
			if (redesignCommands.has(envelope.command.type))
				proposalTransition(
					old.room,
					p.id,
					envelope,
					this.now(),
					undefined,
					ideaCommand
				)
			await allowed
			await this.guard?.command(id, p.id, digest, check)
			const command = envelope.command
			if (command.type === "configure" && command.country) {
				const metadata = await this.catalog.metadata(command.country)
				requireRoom(
					metadata.countries.some((v) => v.code === command.country),
					"invalid_request",
					"Choose a valid country",
					400
				)
			}
			if (
				command.type === "set_services" ||
				command.type === "set_service_enabled"
			) {
				const country = old.room.screens[0]?.country ?? null
				// The app sets the room country right after creation; services are only valid within a country.
				requireRoom(Boolean(country), "needs_context", "Choose a country first", 409)
				const metadata = await this.catalog.metadata(country)
				const countries = new Set<string>()
				if (command.type === "set_services") {
					const prefillCountry = p.member.state === "linked"
						? p.member.prefill?.country
						: null
					if (prefillCountry && prefillCountry !== country)
						countries.add(prefillCountry)
				}
				const catalogs = await Promise.all(
					[...countries].map((c) => this.catalog.metadata(c))
				)
				const validIds = new Set(
					[metadata, ...catalogs].flatMap((m) => m.services.map((s) => s.id))
				)
				requireRoom(
					command.serviceIds.every((id) => validIds.has(id)),
					"invalid_request",
					"Choose valid services",
					400
				)
			}
			let page: Awaited<ReturnType<ProposalCatalog["page"]>> | undefined
			if (
				envelope.command.type === "start" ||
				(envelope.command.type === "refill" && !staleRefill(old.room, envelope))
			) {
				const room = structuredClone(activeRoom(old.room))
				if (envelope.command.type === "refill") retire(room)
				// Usually prepared during setup; a Start retried after losing its compare-and-swap reuses the same build.
				if (room.candidates.length < L.active && room.seenKeys.length < L.seen)
					page = await this.decks.page(room)
				// Seen lists are read again at Start: a deck prepared earlier never shows what a member has since seen.
				if (page && envelope.command.type === "start" && this.catalog.excludedKeys) {
					// Fresh: a background build may have filled the seen cache before a title was marked Seen.
					const excluded = new Set(await this.catalog.excludedKeys(room, { fresh: true }))
					if (excluded.size) page = { ...page, candidates: page.candidates.filter((c) => !excluded.has(titleKey(c))) }
				}
			}
			if (envelope.command.type === "restart") await this.accounts.publish(old.room.history ?? [])
			const room = proposalTransition(
				old.room,
				p.id,
				envelope,
				this.now(),
				page,
				ideaCommand
			)
			if (command.type === "add_idea" || command.type === "edit_idea") {
				const idea = room.ideas!.find(
					(i) =>
						i.id ===
						(command.type === "add_idea" ? envelope.commandId : command.ideaId)
				)!
				if (interpreted) {
					idea.attributes = structuredClone(interpreted.attributes)
					idea.rankedKeys = [...interpreted.rankedKeys]
					idea.interpretedAt = interpreted.interpretedAt
					attributeCandidates(room)
				}
				// The transition left it uninterpreted (no attributes or ranked keys).
				if (budgetRefused)
					room.interpretationCount = Math.max(0, (room.interpretationCount ?? 0) - 1)
			}
			if (
				redesignCommands.has(command.type) ||
				(command.type === "leave" &&
					room.phase !== "decided" &&
					activeRoom(room).participants.length > 0)
			) {
				if (
					this.catalog.refresh &&
					(command.type === "set_services" ||
						command.type === "set_service_enabled" ||
						(command.type === "configure" &&
							command.country !== undefined &&
							command.country !== old.room.screens[0]?.country) ||
						command.type === "leave") &&
					watchScreensChanged(old.room, room)
				)
					room.candidates = await this.catalog.refresh(activeRoom(room))
				retireIneligible(
					room,
					new Set((await this.catalog.excludedKeys?.(room)) ?? [])
				)
				reconcile(room, old.room)
			}
			if (
				envelope.command.type === "assign_screen" &&
				room.phase === "choosing" &&
				this.catalog.refresh
			) {
				room.candidates = await this.catalog.refresh(activeRoom(room))
				reconcile(room, old.room)
			}
			const changed = actor(room, p.id)
			if (command.type === "leave") changed.leftLabel = this.label(old.room)
			const commandState = this.commandState(changed, credential)
			commandState.nextSequence++
			commandState.receipts.push({
				commandId: envelope.commandId,
				sequence,
				digest,
				revision: room.revision
			})
			commandState.receipts = commandState.receipts.slice(-L.receipts)
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				uncertain = true
				continue
			}
			return {
				receipt: { commandId: envelope.commandId, sequence, appliedRevision: room.revision, replayed: false },
				room: { committed: room, historyChanged: !this.hintCommitted(old.room, room) }
			}
		}
		throw new RoomError(
			uncertain ? "outcome_unknown" : "busy",
			"Retain and retry same command",
			503,
			true
		)
	}
	/**
	 * A command already applied replays its receipt. A sequence another command already took on this session
	 * (a second tab of the same browser shares it) doesn't refuse this one: a command id never seen before is
	 * a new command, so it takes the next sequence. A reused command id with other content stays a conflict.
	 */
	private sequenceSlot(
		p: ProposalParticipant,
		credential: ActorCredential,
		envelope: CommandEnvelope,
		digest: string
	): CommandResult["receipt"] | { sequence: number } {
		const state = this.commandState(p, credential)
		const own = state.receipts.find((r) => r.commandId === envelope.commandId)
		if (own) {
			requireRoom(own.digest === digest, "conflict", "Command ID/sequence reused")
			return { commandId: own.commandId, sequence: own.sequence, appliedRevision: own.revision, replayed: true }
		}
		const taken = state.receipts.some((r) => r.sequence === envelope.sequence)
		return { sequence: taken ? state.nextSequence : envelope.sequence }
	}
	private commandState(p: ProposalParticipant, credential: ActorCredential) {
		return (p.sessions ?? []).find((s) => s.id === credential.sessionId) ?? p;
	}
	private snapshot(room: ProposalRoom, credential: ActorCredential) {
		const snapshot = proposalSnapshot(room, credential.participantId);
		snapshot.own.nextSequence = this.commandState(
			actor(room, credential.participantId),
			credential,
		).nextSequence;
		return snapshot;
	}
	private label(room: ProposalRoom) {
		return (
			(room.ideas ?? [])
				.filter((i) => i.on)
				.map((i) => i.text)
				.join(" + ") || "Anything"
		);
	}
	private accountCredential(
		roomId: string,
		participantId: string,
		account: RoomAccount,
	): ActorCredential {
		return {
			participantId,
			accountId: account.userId,
			sessionId: account.sessionId,
			token: keyed(
				this.secret,
				"account-room-session",
				JSON.stringify([
					roomId,
					participantId,
					account.userId,
					account.sessionId,
				]),
			),
		};
	}
	private connectAccount(
		roomId: string,
		p: ProposalParticipant,
		account: RoomAccount,
		roomExpiresAt: number,
	) {
		const credential = this.accountCredential(roomId, p.id, account);
		p.memberUserId = account.userId;
		const sessions = (p.sessions ?? []).filter((s) => s.expiresAt > this.now());
		const existing = sessions.find((s) => s.id === account.sessionId);
		if (existing) existing.expiresAt = roomExpiresAt;
		else {
			requireRoom(
				sessions.length < 12,
				"limit_reached",
				"Too many devices for this room; sign out on another device",
				409,
			);
			sessions.push({
				id: account.sessionId,
				tokenHash: hash(credential.token),
				expiresAt: roomExpiresAt,
				nextSequence: 1,
				receipts: [],
			});
		}
		p.sessions = sessions;
		return credential;
	}
	/** Opening an existing membership never changes the roster. Return after Leave is explicit. */
	async resumeAccount(
		id: string,
		account: RoomAccount,
		returnAfterLeave = false,
	): Promise<GuestAdmission> {
		await this.requireAccountActive(account.userId);
		for (let attempt = 0; attempt < 8; attempt++) {
			const old = await this.get(id);
			const p = old.room.participants.find(
				(p) => p.memberUserId === account.userId,
			);
			requireRoom(
				p && !p.revoked,
				"not_found",
				"You have no place in this room",
				404,
			);
			requireRoom(
				p.leftAt == null || returnAfterLeave,
				"forbidden",
				"You have left this room",
				403,
			);
			const credential = this.accountCredential(id, p.id, account);
			if (
				p.leftAt == null &&
				p.sessions?.some(
					(s) =>
						s.id === account.sessionId && s.expiresAt > this.now() + 30_000,
				)
			)
				return this.recoverAdmission(id, credential);
			const room = structuredClone(old.room);
			const returning = actor(room, p.id);
			this.connectAccount(id, returning, account, room.expiresAt);
			if (p.leftAt != null) {
				if (!activeRoom(room).participants.length) room.hostId = p.id;
				returning.leftAt = null;
				returning.leftLabel = null;
				returning.epoch++;
				room.rosterVersion++;
				refreshServices(room);
				if (room.phase === "choosing" && this.catalog.refresh)
					room.candidates = await this.catalog.refresh(activeRoom(room));
				if (room.phase !== "decided") reconcile(room, old.room);
			}
			room.revision++;
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue;
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e;
				continue;
			}
			await this.notify(id);
			return this.recoverAdmission(id, credential);
		}
		throw new RoomError(
			"busy",
			"Your room could not be restored; retry shortly",
			503,
			true,
		);
	}
	/** A guest upgrades in place, or relinquishes the temporary place to their existing account place. */
	async linkAccount(
		id: string,
		credential: ActorCredential,
		account: RoomAccount,
	): Promise<GuestAdmission> {
		await this.requireAccountActive(account.userId);
		for (let attempt = 0; attempt < 8; attempt++) {
			const old = await this.get(id);
			let source: ProposalParticipant;
			try {
				source = this.auth(old.room, credential);
			} catch (e) {
				if (
					e instanceof RoomError &&
					["unauthorized", "forbidden"].includes(e.code) &&
					old.room.participants.some(
						(p) => p.memberUserId === account.userId && !p.revoked,
					)
				)
					return this.resumeAccount(id, account);
				throw e;
			}
			requireRoom(
				!source.memberUserId || source.memberUserId === account.userId,
				"conflict",
				"You joined this room with another GoodWatch account",
			);
			if (source.memberUserId === account.userId)
				return this.resumeAccount(id, account);
			await this.accounts.remember(account.userId, {
				roomId: id,
				expiresAt: old.room.expiresAt,
			});
			const room = structuredClone(old.room);
			const canonical = room.participants.find(
				(p) => p.memberUserId === account.userId,
			);
			const target = canonical ?? actor(room, source.id);
			requireRoom(
				target.leftAt == null,
				"conflict",
				"Return to your existing place from History before linking this guest",
			);
			if (canonical) {
				// The established account's answers win. Never combine two people's approval evidence.
				room.participants = room.participants.filter((p) => p.id !== source.id);
				for (const idea of room.ideas ?? [])
					if (idea.authorId === source.id) idea.authorId = target.id;
				if (room.hostId === source.id) room.hostId = target.id;
				if (room.phase !== "decided") {
					room.proposal = null;
					room.proposalVersion++;
					for (const p of room.participants) {
						p.approvedProposalVersion = null;
						p.agreementRevision++;
					}
				} else if (room.proposal) {
					if (room.proposal.proposerId === source.id)
						room.proposal.proposerId = target.id;
					room.proposal.baseParticipantIds = [
						...new Set(
							room.proposal.baseParticipantIds.map((id) =>
								id === source.id ? target.id : id,
							),
						),
					];
				}
				room.rosterVersion++;
			}
			if (!canonical) {
				target.epoch++;
				target.tokenHash = hash(random());
			}
			const next = this.connectAccount(id, target, account, room.expiresAt);
			room.tickets = room.tickets.filter((t) => t.participantId !== source.id);
			room.memberIntents = room.memberIntents?.filter(
				(t) => t.participantId !== source.id,
			);
			for (const d of room.history ?? [])
				if (
					d.participantIds.includes(source.id) &&
					!d.accountIds.includes(account.userId)
				)
					d.accountIds.push(account.userId);
			refreshServices(room);
			if (canonical && room.phase === "choosing") {
				room.contextVersion++;
				if (this.catalog.refresh)
					room.candidates = await this.catalog.refresh(activeRoom(room));
				retireIneligible(
					room,
					new Set((await this.catalog.excludedKeys?.(room)) ?? []),
				);
				room.stream = {
					version: room.stream.version + 1,
					state: "ready",
					reason: null,
				};
			}
			if (room.phase !== "decided") reconcile(room, old.room);
			room.revision++;
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue;
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e;
				continue;
			}
			await this.notify(id);
			return {
				...(await this.recoverAdmission(id, next)),
				...(canonical ? { replacedGuest: true } : {}),
			};
		}
		throw new RoomError(
			"busy",
			"Your account could not be linked; retry shortly",
			503,
			true,
		);
	}
	async accountHome(account: RoomAccount): Promise<AccountHome> {
		await this.requireAccountActive(account.userId);
		const rooms: AccountHome["rooms"] = [];
		for (const entry of await this.accounts.rooms(account.userId)) {
			if (entry.expiresAt <= this.now()) continue;
			const stored = await this.repository.read(entry.roomId);
			const p = stored?.room.participants.find(
				(p) => p.memberUserId === account.userId && !p.revoked,
			);
			if (!stored || stored.room.expiresAt <= this.now() || !p) continue;
			await this.accounts.publish(stored.room.history ?? []);
			rooms.push({
				snapshot: proposalSnapshot(stored.room, p.id),
				joinedAt: p.joinedAt ?? 0,
				archivedAt: p.archivedAt ?? null,
				leftLabel: p.leftLabel ?? null,
			});
		}
		rooms.sort(
			(a, b) =>
				b.joinedAt - a.joinedAt ||
				b.snapshot.shared.roomId.localeCompare(a.snapshot.shared.roomId),
		);
		return { rooms, decisions: await this.accounts.history(account.userId) };
	}
	async archiveAccountRoom(
		id: string,
		account: RoomAccount,
		archived: boolean,
	) {
		for (let attempt = 0; attempt < 8; attempt++) {
			const old = await this.get(id);
			const room = structuredClone(old.room);
			const p = room.participants.find(
				(p) => p.memberUserId === account.userId && !p.revoked,
			);
			requireRoom(p, "not_found", "You have no place in this room", 404);
			p.archivedAt = archived ? this.now() : null;
			room.revision++;
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue;
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e;
				continue;
			}
			await this.notify(id);
			return;
		}
		throw new RoomError(
			"busy",
			"Your room list could not be updated",
			503,
			true,
		);
	}
	/** Returns the rooms this device stays in as a guest. */
	async logoutAccount(account: RoomAccount) {
		const kept: { roomId: string; nickname: string; expiresAt: number }[] = [];
		for (const entry of await this.accounts.rooms(account.userId)) {
			if (entry.expiresAt <= this.now()) continue;
			for (let attempt = 0; attempt < 8; attempt++) {
				const old = await this.repository.read(entry.roomId);
				if (!old || old.room.expiresAt <= this.now()) break;
				const room = structuredClone(old.room);
				const p = room.participants.find(
					(p) => p.memberUserId === account.userId,
				);
				const session = p?.sessions?.find((s) => s.id === account.sessionId);
				if (!p || !session) break;
				p.sessions = p.sessions!.filter((s) => s.id !== account.sessionId);
				room.tickets = room.tickets.filter(
					(t) => t.sessionId !== account.sessionId,
				);
				const guest = p.leftAt == null && !p.sessions.some((s) => s.expiresAt > this.now());
				if (guest) this.keepDeviceAsGuest(p, session);
				room.revision++;
				try {
					if (!(await this.repository.compareAndSwap(old, room, true)))
						continue;
				} catch (e) {
					if (!(e instanceof IndeterminateWrite)) throw e;
					continue;
				}
				if (guest) kept.push({ roomId: room.id, nickname: p.nickname, expiresAt: room.expiresAt });
				await this.notify(entry.roomId);
				break;
			}
		}
		// Revoked after the rooms are guest places: a room read racing Log out reads the guest place, never a
		// refusal. Once revoked, replaying the old sealed sign-in cannot resume or link anything.
		await this.accounts.revokeSession(account.sessionId, account.expiresAt);
		return kept;
	}
	/**
	 * Log out on the account's last device in a room: that device keeps its seat (name, votes, host role)
	 * as a guest. Only the GoodWatch link goes: the grant, prefill and seen titles. The device's room
	 * credential becomes the guest credential, so it never acts as the signed-out account again.
	 */
	private keepDeviceAsGuest(
		p: ProposalParticipant,
		session: NonNullable<ProposalParticipant["sessions"]>[number],
	) {
		p.memberUserId = null;
		delete p.memberGrant;
		p.member = { state: "guest", prefill: null };
		p.showSeen = false;
		p.sessions = [];
		p.tokenHash = session.tokenHash;
		p.nextSequence = session.nextSequence;
		p.receipts = session.receipts;
	}
	async requireAccountActive(userId: string) {
		await requireNotDeleting(this.deletions, { kind: 'account', userId });
	}
	accountDeletionTag(userId: string) { return keyed(this.secret, 'deletion-account-tag', userId); }
	/** The durable deletion marker fences new admissions before the recoverable room departures begin. */
	async deleteAccount(account: RoomAccount) {
		const state = await this.deletions.schedule({ kind: 'account', userId: account.userId }, this.now());
		for (const entry of await this.accounts.rooms(account.userId)) {
			await this.departForDeletion(entry.roomId, p => p.memberUserId === account.userId);
		}
		// End this device's sealed YepWatch session. Restoring requires a fresh GoodWatch authentication.
		await this.accounts.revokeSession(account.sessionId, account.expiresAt);
		return state;
	}
	async deleteGuest(id: string, credential: ActorCredential) {
		const stored = await this.get(id);
		const p = this.auth(stored.room, credential, true);
		requireRoom(!p.memberUserId, 'forbidden', 'Use account deletion for a signed-in participant', 403);
		const state = await this.deletions.schedule({ kind: 'guest', roomId: id, participantId: p.id }, this.now());
		await this.departForDeletion(id, person => person.id === p.id);
		return state;
	}
	async restoreGuest(id: string, credential: ActorCredential) {
		const stored = await this.get(id);
		const p = this.auth(stored.room, credential, true);
		requireRoom(!p.memberUserId, 'forbidden', 'Use account restoration for a signed-in participant', 403);
		await this.deletions.restore({ kind: 'guest', roomId: id, participantId: p.id }, this.now());
		for (let i = 0; i < 8; i++) {
			const old = await this.get(id);
			const room = structuredClone(old.room);
			const person = this.auth(room, credential, true);
			person.leftAt = null; person.epoch++; room.rosterVersion++; room.revision++;
			refreshServices(room);
			if (room.phase !== 'decided') reconcile(room, old.room);
			if (!(await this.repository.compareAndSwap(old, room, true))) continue;
			await this.notify(id);
			return { restored: true };
		}
		throw new RoomError('busy', 'Restoration will need another attempt.', 503, true);
	}
	private async departForDeletion(id: string, matches: (p: ProposalParticipant) => boolean) {
		for (let i = 0; i < 12; i++) {
			const stored = await this.repository.read(id);
			if (!stored || stored.room.expiresAt <= this.now()) return;
			const room = structuredClone(stored.room);
			const departing = room.participants.filter(matches);
			if (!departing.length) return;
			for (const p of departing) {
				p.leftAt ??= this.now(); p.epoch++; p.sessions = []; delete p.memberGrant;
				room.tickets = room.tickets.filter(t => t.participantId !== p.id);
				room.memberIntents = room.memberIntents?.filter(t => t.participantId !== p.id);
			}
			const remaining = activeRoom(room).participants;
			if (departing.some(p => p.id === room.hostId) && remaining.length) room.hostId = remaining[0].id;
			refreshServices(room);
			room.rosterVersion++; room.revision++;
			if (room.phase !== 'decided') reconcile(room, stored.room);
			try { if (!(await this.repository.compareAndSwap(stored, room, true))) continue; }
			catch (e) { if (!(e instanceof IndeterminateWrite)) throw e; continue; }
			await this.notify(id);
			return;
		}
		throw new RoomError('busy', 'Deletion is scheduled; retry to finish leaving rooms.', 503, true);
	}
	private recordDecision(room: ProposalRoom) {
		const d = room.decision!;
		const candidate = room.candidates.find((c) => c.id === d.candidateId)!;
		const participants = activeRoom(room).participants;
		const record = {
			id: `${room.id}:${room.generation}:${d.decidedAt}`,
			roomId: room.id,
			roomLabel: this.label(room),
			title: candidate.title,
			year: candidate.year,
			posterUrl: candidate.posterUrl,
			decidedAt: d.decidedAt,
			people: participants.map((p) => p.nickname),
			participantIds: participants.map((p) => p.id),
			accountIds: participants.flatMap((p) =>
				p.memberUserId ? [p.memberUserId] : [],
			),
		};
		room.history = [
			...(room.history ?? []).filter((h) => h.id !== record.id),
			record,
		].slice(-128);
	}

	/** Bounded automatic repair, including after process restart; public errors contain no catalog/actor/private inputs. */
	async settle(id: string) {
		for (let i = 0; i < 3; i++) {
			const old = await this.get(id)
			if (
				old.room.phase !== "choosing" ||
				old.room.agreement.state !== "checking"
			)
				return
			const candidate = agreementCandidate(old.room)
			if (!candidate) return
			const room = structuredClone(old.room)
			try {
				const evidence = await this.catalog.recheck(
					activeRoom(old.room),
					candidate
				)
				requireRoom(
					evidence.length > 0 && evidence.every((e) => e.state === "watchable"),
					"no_intersection",
					"Current offers do not cover every screen"
				)
				const screens = new Set(
					activeRoom(room).participants.map((p) => p.screenId)
				)
				requireRoom(
					!screens.has(null) &&
						evidence.length === screens.size &&
						[...screens].every((id) => evidence.some((e) => e.screenId === id)),
					"needs_context",
					"Evidence must cover every occupied screen"
				)
				continuousLive(room, this.now())
				room.decision = {
					candidateId: candidate.id,
					agreementVersion: room.agreement.version,
					decidedAt: this.now(),
					availability: evidence
				}
				room.phase = "decided"
				this.recordDecision(room)
				room.agreement.state = "none"
			} catch (e) {
				if (!(e instanceof RoomError)) return // Unknown failure leaves durable checking for background repair.
				if (e.code === "expired") return
				room.agreement = {
					version: room.agreement.version,
					state: "unavailable",
					error: { code: e.code, ...(e.details ? { details: e.details } : {}) }
				}
			}
			room.revision++
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				continue
			}
			await this.notify(id)
			return
		}
	}
	async ticket(
		id: string,
		credential: ActorCredential
	): Promise<RealtimeTicket> {
		return this.write(id, () => this.issueTicket(id, credential))
	}
	private async issueTicket(
		id: string,
		credential: ActorCredential
	): Promise<RealtimeTicket> {
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const p = this.auth(old.room, credential)
			const room = structuredClone(old.room)
			room.tickets = room.tickets.filter((t) => t.expiresAt > this.now())
			requireRoom(
				room.tickets.filter((t) => t.participantId === p.id).length < L.tickets,
				"limit_reached",
				"Too many connection tickets"
			)
			const ticket = random()
			const expiresAt = Math.min(this.now() + 30_000, room.expiresAt)
			room.tickets.push({
				...(credential.sessionId ? { sessionId: credential.sessionId } : {}),
				hash: hash(ticket),
				participantId: p.id,
				epoch: p.epoch,
				expiresAt
			})
			try {
				if (await this.repository.compareAndSwap(old, room, false))
					return {
						ticket,
						expiresAt,
						websocketPath: "/api/yepwatch/v1/proposal/realtime"
					}
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				throw new RoomError(
					"outcome_unknown",
					"Ticket issue uncertain; backoff and request fresh ticket",
					503,
					true
				)
			}
		}
		throw new RoomError("busy", "Room busy; retry ticket issue", 503, true)
	}
	private attachment(room: ProposalRoom, id: string, sessionId?: string): RealtimeAttachment {
		const p = actor(room, id)
		requireRoom(p.leftAt == null, "forbidden", "You have left this room", 403)
		if (p.memberUserId) requireRoom((p.sessions ?? []).some(s => s.id === sessionId && s.expiresAt > this.now()), "forbidden", "Session ended", 403)
		const expiresAt = Math.min(this.now() + 60_000, room.expiresAt)
		const lease: Lease = {
			format: 3,
			...(sessionId ? { sessionId } : {}),
			roomId: room.id,
			participantId: id,
			epoch: p.epoch,
			expiresAt,
			scope: "shared:read"
		}
		return {
			roomId: room.id,
			participantId: id,
			lease: sign(this.secret, lease),
			leaseExpiresAt: expiresAt,
			roomExpiresAt: room.expiresAt,
			capabilityEpoch: p.epoch,
			scope: "shared:read"
		}
	}
	async attach(id: string, ticket: string) {
		return this.write(id, () => this.consumeTicket(id, ticket))
	}
	private async consumeTicket(id: string, ticket: string) {
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const t = room.tickets.find((t) => equal(t.hash, hash(ticket)))
			requireRoom(
				t && t.expiresAt > this.now(),
				"unauthorized",
				"Ticket expired or consumed",
				401
			)
			requireRoom(
				actor(room, t.participantId).epoch === t.epoch,
				"forbidden",
				"Access revoked",
				403
			)
			room.tickets = room.tickets.filter((x) => x !== t)
			try {
				if (!(await this.repository.compareAndSwap(old, room, false))) continue
				const committed = (await this.get(id)).room
				requireRoom(
					actor(committed, t.participantId).epoch === t.epoch,
					"forbidden",
					"Access revoked",
					403
				)
				if (t.sessionId) requireRoom(await this.accounts.sessionActive(t.sessionId), "forbidden", "Session ended", 403)
				return this.attachment(committed, t.participantId, t.sessionId)
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				throw new RoomError(
					"outcome_unknown",
					"Ticket consumption uncertain; request fresh ticket",
					503,
					true
				)
			}
		}
		throw new RoomError("busy", "Room busy; reconnect", 503, true)
	}
	async view(id: string, token: string): Promise<RealtimeViewResponse> {
		const lease = this.lease(id, token)
		requireRoom(lease, "unauthorized", "Invalid lease", 401)
		const session = lease.sessionId ? this.accounts.sessionActive(lease.sessionId) : undefined
		session?.catch(() => {}) // Its failure is reported below, after the room's own checks.
		const { room } = await this.get(id)
		const result = await this.leaseView(room, lease, session)
		if (result instanceof RoomError) throw result
		return { ...result, snapshot: proposalSnapshot(room, lease.participantId).shared }
	}
	/**
	 * The gateway's refresh of every phone on a room after a change: one read of the room (and its capacity) for all
	 * of them instead of one each, and one snapshot, which is the same for every viewer. Each lease gets what `view`
	 * would answer for it; a room that can't be read refuses every lease the same way.
	 */
	async views(id: string, tokens: string[]): Promise<RealtimeViewsResponse> {
		const leases = tokens.map((token) => this.lease(id, token))
		const sessions = new Map<string, Promise<boolean>>()
		for (const lease of leases)
			if (lease?.sessionId && !sessions.has(lease.sessionId)) {
				const active = this.accounts.sessionActive(lease.sessionId)
				active.catch(() => {})
				sessions.set(lease.sessionId, active)
			}
		const refusal = (e: unknown) => {
			const error = e instanceof RoomError ? e : new RoomError("busy", "Service unavailable", 503, true)
			return { error: { code: error.code, status: error.status } }
		}
		const invalid = refusal(new RoomError("unauthorized", "Invalid lease", 401))
		if (!leases.some(Boolean)) return { snapshot: null, views: leases.map(() => invalid) }
		let room: ProposalRoom
		try {
			room = (await this.get(id)).room
		} catch (e) {
			return { snapshot: null, views: leases.map((lease) => (lease ? refusal(e) : invalid)) }
		}
		const views = await Promise.all(
			leases.map(async (lease) => {
				const result = lease
					? await this.leaseView(room, lease, lease.sessionId ? sessions.get(lease.sessionId) : undefined).catch(
							() => new RoomError("busy", "Service unavailable", 503, true)
						)
					: null
				return result === null ? invalid : result instanceof RoomError ? refusal(result) : result
			})
		)
		const viewer = leases.find((lease, i) => lease && !("error" in views[i]))
		return { snapshot: viewer ? proposalSnapshot(room, viewer.participantId).shared : null, views }
	}
	/** A realtime lease this service signed for the room, unexpired; null otherwise. */
	private lease(id: string, token: string): Lease | null {
		const lease = verify<Lease>(this.secret, token)
		return lease &&
			lease.format === 3 &&
			lease.roomId === id &&
			lease.scope === "shared:read" &&
			Number.isFinite(lease.expiresAt) &&
			lease.expiresAt > this.now()
			? lease
			: null
	}
	/**
	 * A lease's renewed attachment on the room as read, or why it is refused. `session`: whether its sign-in is still
	 * active, checked alongside the room read. That early answer only holds while the room as read still lists the
	 * session on its account participant (attachment requires it): Log out takes the session off every room before
	 * it revokes it. A participant that is a guest now may have become one by that very Log out, after the early
	 * check, so its session is checked again after the read.
	 */
	private async leaseView(room: ProposalRoom, lease: Lease, session?: Promise<boolean>): Promise<RealtimeAttachment | RoomError> {
		try {
			if (lease.sessionId && !room.participants.find((p) => p.id === lease.participantId)?.memberUserId)
				session = this.accounts.sessionActive(lease.sessionId)
			if (session) requireRoom(await session, "forbidden", "Session ended", 403)
			requireRoom(
				actor(room, lease.participantId).epoch === lease.epoch,
				"forbidden",
				"Access revoked",
				403
			)
			return this.attachment(room, lease.participantId, lease.sessionId)
		} catch (e) {
			if (e instanceof RoomError) return e
			throw e
		}
	}
	/**
	 * Tells the gateway about a revision as soon as its compare-and-swap succeeds, without waiting for notify's read
	 * of the room (the other phones see a vote that much sooner). notify still publishes it, a no-op for the gateway,
	 * and acknowledges it. Not when the history changed: notify stores it on the accounts before anyone hears of it.
	 * Returns false then (the command's answer waits for notify too).
	 */
	private hintCommitted(old: ProposalRoom, room: ProposalRoom): boolean {
		if (JSON.stringify(room.history ?? []) !== JSON.stringify(old.history ?? [])) return false
		if (room.expiresAt <= this.now()) return true
		this.publish({ roomId: room.id, revision: room.revision }).catch(() => {
			/* notify publishes it again; repair retries */
		})
		return true
	}
	/**
	 * Publishes a committed revision once. Returns the room it read, or null when the read failed.
	 *
	 * `yieldToQueued` (a command's notify, which runs after it left the room's lane): when another write already waits
	 * in the lane, the revision is published but not acknowledged. Clearing pending_revision is a write too, and moves
	 * the row's sequence number: landing between the queued write's read and its compare-and-swap, it made that write
	 * (a Start right behind a friend's service pick, the next vote) fail and start over. The queued write keeps the
	 * revision pending in its own commit and its own notify acknowledges both; if it commits nothing, repair publishes
	 * the revision once more, which the gateway ignores.
	 */
	async notify(id: string, options: { yieldToQueued?: boolean } = {}): Promise<ProposalStored | null> {
		let stored: ProposalStored | null = null
		try {
			stored = await this.repository.read(id)
			if (stored?.room.phase === "setup") this.decks.schedule(id)
			if (
				!stored ||
				!stored.pendingRevision
			)
				return stored
			await this.accounts.publish(stored.room.history ?? [])
			if (stored.room.expiresAt > this.now()) await this.publish({ roomId: id, revision: stored.room.revision })
			if (options.yieldToQueued && this.writes.has(id)) return stored
			await this.repository.acknowledge(id, stored.room.revision)
		} catch {
			/* commit remains durable; repair retries */
		}
		return stored
	}
	/** Server/operator-only revocation, never a gateway/public command. Required roster is retained. */
	async revokeParticipant(id: string, participantId: string) {
		return this.write(id, () => this.revoke(id, participantId))
	}
	private async revoke(id: string, participantId: string) {
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = actor(room, participantId)
			p.epoch++
			p.revoked = true
			p.tokenHash = hash(random())
			p.pick = { candidateId: null, revision: p.pick.revision + 1 }
			p.approvedProposalVersion = null
			p.agreementRevision++
			room.tickets = room.tickets.filter((t) => t.participantId !== p.id)
			reconcile(room, old.room)
			room.revision++
			if (await this.repository.compareAndSwap(old, room, true)) {
				await this.notify(id)
				return
			}
		}
		throw new RoomError("busy", "Revocation not committed; retry", 503, true)
	}
	async repair() {
		for (const id of await this.repository.pending(100)) {
			await this.settle(id).catch(() => {})
			await this.notify(id)
		}
	}
}

/**
 * Whether the screens the room watches on (country, services, who is on which) differ: a refresh reads nothing else.
 * A friend picking services the room already has leaves them as they were, and checking every card's offers again
 * (~1 s in production) would only hold up the command and the Start queued behind it.
 */
function watchScreensChanged(old: ProposalRoom, next: ProposalRoom) {
	const screens = (room: ProposalRoom) => {
		const active = activeRoom(room)
		return JSON.stringify([active.screens, [...new Set(active.participants.map((p) => p.screenId))].sort()])
	}
	return screens(old) !== screens(next)
}

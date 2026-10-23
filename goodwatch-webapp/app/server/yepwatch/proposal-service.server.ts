import { CONTINUOUS_LIMITS as L } from "./continuous-types.ts"
import type {
	CommandEnvelope,
	CommandResult,
	GuestAdmission,
	GuestAdmissionRequest,
	JoinRoomRequest,
	RealtimeAttachment,
	RealtimeTicket,
	RealtimeViewResponse,
	RoomInvalidation,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { shortInvite, normalizeShortInvite } from "./proposal-invites.ts"
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
} from "./proposal-machine.ts"
import {
	type ProposalCatalog,
	type ProposalParticipant,
	type ProposalRepository,
	type ProposalRoom,
	type ProposalStored,
} from "./proposal-types.ts"
import type { ActorCredential } from "./service.server.ts"
interface Lease {
	roomId: string
	participantId: string
	epoch: number
	expiresAt: number
	scope: "shared:read"
	format: 3
}
/** Optional release-only guard; legacy runtimes retain existing behavior. */
export interface ProposalOperationGuard {
	active(room: Pick<ProposalRoom, "id" | "expiresAt">): Promise<void>
	create(roomId: string, admissionDigest: string): Promise<number>
	join(roomId: string, actorId: string, admissionDigest: string): Promise<void>
	command(roomId: string, actorId: string, commandDigest: string): Promise<void>
}
export class ProposalService {
	readonly repository: ProposalRepository
	readonly catalog: ProposalCatalog
	private secret: string
	private publish: (event: RoomInvalidation) => Promise<void>
	private guard?: ProposalOperationGuard
	private now: () => number
	constructor(
		repository: ProposalRepository,
		catalog: ProposalCatalog,
		secret: string,
		publish: (event: RoomInvalidation) => Promise<void> = async () => {},
		now: () => number = Date.now,
		guard?: ProposalOperationGuard
	) {
		if (secret.length < 32) throw new Error("Room secret too short")
		this.repository = repository
		this.catalog = catalog
		this.secret = secret
		this.publish = publish
		this.now = now
		this.guard = guard
	}
	private async get(id: string): Promise<ProposalStored> {
		const stored = await this.repository.read(id)
		requireRoom(
			stored && stored.room.format === 2 && stored.room.flowVersion === 3,
			"not_found",
			"Room unavailable",
			404
		)
		continuousLive(stored.room, this.now())
		await this.guard?.active(stored.room)
		return stored
	}
	private auth(room: ProposalRoom, credential: ActorCredential) {
		const p = actor(room, credential.participantId)
		requireRoom(
			!p.revoked && equal(p.tokenHash, hash(credential.token)),
			"unauthorized",
			"Invalid room credential",
			401
		)
		return p
	}
	private identity(id: string, request: GuestAdmissionRequest) {
		const key = JSON.stringify([id, request.commandId, request.admissionSecret])
		return {
			id: keyed(this.secret, "proposal-participant", key).slice(0, 32),
			token: keyed(this.secret, "proposal-token", key),
			digest: hash(JSON.stringify(request)),
		}
	}
	private invite(id: string) {
		return this.repository.rememberInvite && this.repository.findInvite
			? shortInvite(this.secret, id)
			: this.legacyInvite(id)
	}
	private legacyInvite(id: string) {
		return `${id}.${keyed(this.secret, "proposal-invite", id)}`
	}
	private async roomInvite(room: ProposalRoom) {
		const code = this.invite(room.id)
		if (equal(hash(code), room.inviteHash)) {
			if (normalizeShortInvite(code))
				await this.repository.rememberInvite!(
					hash(code),
					room.id,
					room.expiresAt
				)
			return code
		}
		const legacy = this.legacyInvite(room.id)
		requireRoom(
			equal(hash(legacy), room.inviteHash),
			"not_found",
			"Invite unavailable",
			404
		)
		return legacy
	}
	private async admission(
		room: ProposalRoom,
		request: GuestAdmissionRequest
	): Promise<GuestAdmission> {
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
				roomId: room.id,
				participantId: p.id,
				token: p.token,
				expiresAt: room.expiresAt,
			},
			invite: {
				code,
				path: `/r/${code}`,
			},
			snapshot: proposalSnapshot(room, p.id),
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
			receipts: [],
		}
	}
	async create(request: GuestAdmissionRequest) {
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
				return this.admission(existing.room, request)
			}
			const expiresAt =
				(await this.guard?.create(id, hash(JSON.stringify(request)))) ??
				this.now() + L.roomMs
			const p = this.member(id, request)
			const room: ProposalRoom = {
				format: 2,
				flowVersion: 3,
				proposalVersion: 0,
				proposal: null,
				id,
				hostId: p.id,
				revision: 1,
				expiresAt,
				inviteHash: hash(this.invite(id)),
				phase: "setup",
				rosterVersion: 1,
				contextVersion: 1,
				generation: 0,
				participants: [p],
				screens: [],
				constraints: {
					kinds: ["movie", "show_start"],
					maxMinutes: null,
					moods: [],
				},
				candidates: [],
				seenKeys: [],
				stream: { version: 0, state: "ready", reason: null },
				agreement: { version: 0, state: "none", error: null },
				decision: null,
				tickets: [],
			}
			try {
				await this.repository.insert(room)
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
		return { roomId: id }
	}
	async join(id: string, request: JoinRoomRequest) {
		const resolved = await this.resolveInvite(request.inviteCode)
		requireRoom(resolved.roomId === id, "not_found", "Invite unavailable", 404)
		const { inviteCode: _invite, screenId, ...base } = request
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const room = structuredClone(old.room)
			const p = this.member(id, base)
			if (room.participants.some((m) => m.id === p.id))
				return this.admission(room, base)
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
					room.screens.some((s) => s.id === screenId),
					"invalid_request",
					"Unknown screen",
					400
				)
				p.screenId = screenId
			}
			await this.guard?.join(id, p.id, p.admissionHash)
			room.participants.push(p)
			room.rosterVersion++
			room.revision++
			if (room.phase === "setup")
				for (const m of room.participants) m.ready = false
			if (room.phase === "choosing" && this.catalog.refresh)
				room.candidates = await this.catalog.refresh(room)
			reconcile(room, old.room)
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				continue
			}
			await this.notify(id)
			return this.admission((await this.get(id)).room, base)
		}
		throw new RoomError(
			"outcome_unknown",
			"Retain and retry same admission",
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
				roomId: id,
				participantId: p.id,
				token: credential.token,
				expiresAt: room.expiresAt,
			},
			invite: { code, path: `/r/${code}` },
			snapshot: proposalSnapshot(room, p.id),
		}
	}
	async read(id: string, credential: ActorCredential) {
		const { room } = await this.get(id)
		this.auth(room, credential)
		return proposalSnapshot(room, credential.participantId)
	}
	async command(
		id: string,
		credential: ActorCredential,
		envelope: CommandEnvelope
	): Promise<CommandResult> {
		const digest = hash(JSON.stringify(envelope))
		let uncertain = false
		for (let i = 0; i < 6; i++) {
			const old = await this.get(id)
			const p = this.auth(old.room, credential)
			const receipt = p.receipts.find(
				(r) =>
					r.commandId === envelope.commandId || r.sequence === envelope.sequence
			)
			if (receipt) {
				requireRoom(
					receipt.digest === digest,
					"conflict",
					"Command ID/sequence reused"
				)
				await this.settle(id)
				const committed = await this.get(id)
				await this.notify(id)
				return {
					receipt: {
						commandId: receipt.commandId,
						sequence: receipt.sequence,
						appliedRevision: receipt.revision,
						replayed: true,
					},
					snapshot: proposalSnapshot(committed.room, p.id),
				}
			}
			requireRoom(
				envelope.sequence >= p.nextSequence,
				"outcome_unknown",
				"Receipt no longer retained; reconcile current state",
				503
			)
			requireRoom(
				envelope.sequence === p.nextSequence,
				"conflict",
				"Commands must be sent in order"
			)
			preflight(old.room, p.id, envelope, this.now())
			await this.guard?.command(id, p.id, digest)
			let page
			if (
				envelope.command.type === "start" ||
				envelope.command.type === "refill"
			) {
				const room = structuredClone(old.room)
				if (envelope.command.type === "refill") retire(room)
				if (room.candidates.length < L.active && room.seenKeys.length < L.seen)
					page = await this.catalog.page(room)
			}
			const room = proposalTransition(
				old.room,
				p.id,
				envelope,
				this.now(),
				page
			)
			if (
				envelope.command.type === "assign_screen" &&
				room.phase === "choosing" &&
				this.catalog.refresh
			) {
				room.candidates = await this.catalog.refresh(room)
				reconcile(room, old.room)
			}
			const changed = actor(room, p.id)
			changed.nextSequence++
			changed.receipts.push({
				commandId: envelope.commandId,
				sequence: envelope.sequence,
				digest,
				revision: room.revision,
			})
			changed.receipts = changed.receipts.slice(-L.receipts)
			try {
				if (!(await this.repository.compareAndSwap(old, room, true))) continue
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
				uncertain = true
				continue
			}
			// Durable checking state is committed before network evidence. Crashes repair from persisted state.
			await this.notify(id)
			await this.settle(id)
			const committed = await this.get(id)
			const committedReceipt = actor(committed.room, p.id).receipts.find(
				(r) => r.digest === digest
			)
			if (!committedReceipt) {
				uncertain = true
				continue
			}
			return {
				receipt: {
					commandId: committedReceipt.commandId,
					sequence: committedReceipt.sequence,
					appliedRevision: committedReceipt.revision,
					replayed: false,
				},
				snapshot: proposalSnapshot(committed.room, p.id),
			}
		}
		throw new RoomError(
			uncertain ? "outcome_unknown" : "busy",
			"Retain and retry same command",
			503,
			true
		)
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
				const evidence = await this.catalog.recheck(old.room, candidate)
				requireRoom(
					evidence.length > 0 && evidence.every((e) => e.state === "watchable"),
					"no_intersection",
					"Current offers do not cover every screen"
				)
				const screens = new Set(room.participants.map((p) => p.screenId))
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
					availability: evidence,
				}
				room.phase = "decided"
				room.agreement.state = "none"
			} catch (e) {
				if (!(e instanceof RoomError)) return // Unknown failure leaves durable checking for background repair.
				if (e.code === "expired") return
				room.agreement = {
					version: room.agreement.version,
					state: "unavailable",
					error: { code: e.code, ...(e.details ? { details: e.details } : {}) },
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
				hash: hash(ticket),
				participantId: p.id,
				epoch: p.epoch,
				expiresAt,
			})
			try {
				if (await this.repository.compareAndSwap(old, room, false))
					return {
						ticket,
						expiresAt,
						websocketPath: "/api/yepwatch/v1/proposal/realtime",
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
	private attachment(room: ProposalRoom, id: string): RealtimeAttachment {
		const p = actor(room, id)
		const expiresAt = Math.min(this.now() + 60_000, room.expiresAt)
		const lease: Lease = {
			format: 3,
			roomId: room.id,
			participantId: id,
			epoch: p.epoch,
			expiresAt,
			scope: "shared:read",
		}
		return {
			roomId: room.id,
			participantId: id,
			lease: sign(this.secret, lease),
			leaseExpiresAt: expiresAt,
			roomExpiresAt: room.expiresAt,
			capabilityEpoch: p.epoch,
			scope: "shared:read",
		}
	}
	async attach(id: string, ticket: string) {
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
				return this.attachment(committed, t.participantId)
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
		const lease = verify<Lease>(this.secret, token)
		requireRoom(
			lease &&
				lease.format === 3 &&
				lease.roomId === id &&
				lease.scope === "shared:read" &&
				Number.isFinite(lease.expiresAt) &&
				lease.expiresAt > this.now(),
			"unauthorized",
			"Invalid lease",
			401
		)
		const { room } = await this.get(id)
		requireRoom(
			actor(room, lease.participantId).epoch === lease.epoch,
			"forbidden",
			"Access revoked",
			403
		)
		return {
			...this.attachment(room, lease.participantId),
			snapshot: proposalSnapshot(room, lease.participantId).shared,
		}
	}
	async notify(id: string) {
		try {
			const stored = await this.repository.read(id)
			if (
				!stored ||
				stored.room.expiresAt <= this.now() ||
				!stored.pendingRevision
			)
				return
			await this.publish({ roomId: id, revision: stored.room.revision })
			await this.repository.acknowledge(id, stored.room.revision)
		} catch {
			/* commit remains durable; repair retries */
		}
	}
	/** Server/operator-only revocation, never a gateway/public command. Required roster is retained. */
	async revokeParticipant(id: string, participantId: string) {
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

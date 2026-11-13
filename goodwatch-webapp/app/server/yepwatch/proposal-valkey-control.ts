import { createHash, randomUUID } from "node:crypto"
import { RoomError } from "./errors.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import { BudgetError, type ControlPolicy } from "./proposal-release-control.ts"
import { allowanceFull, type SqlCreationQuotas } from "./proposal-creation-quota.ts"
import type { CommandBudget } from "./proposal-command-budget.ts"
import type { ProposalOperationGuard } from "./proposal-service.server.ts"
import type { ProposalRoom } from "./proposal-types.ts"
import { K, readCall, script, writeCall, type RoomsValkey } from "./proposal-rooms-valkey.ts"

const WINDOW_MS = 60_000
const digest = (s: string) => createHash("sha256").update(s).digest("hex")
const busy = () => new RoomError("busy", "Room allowance could not be confirmed. Retry the same request.", 503, true)
const expired = () => new RoomError("expired", "Room expired", 410)
/** What `active` proved for a room, handed to `command` for the same room so its permit doesn't read it again. */
const checks = new WeakSet<object>()

/**
 * Capacity and admissions in the rooms Valkey (docs/yepwatch-valkey-rooms.md), the release guard: each person's
 * allowance of live rooms (roomsPerPerson), the shared admission budget per minute (create, join) and, through
 * `commands`, the command budget. A room's capacity proof is written with its reservation and read on every command:
 * one Valkey read instead of the control row and two quota rows in Crate. The history copy writes each new room's
 * reservation to Crate before its head (proposal-history-sync.ts).
 */
export class ValkeyReleaseControl implements ProposalOperationGuard {
	readonly policy: ControlPolicy
	readonly limit: number
	private redis: RoomsValkey
	private commands: CommandBudget
	private quotas: SqlCreationQuotas
	private now: () => number
	constructor(redis: RoomsValkey, policy: ControlPolicy, commands: CommandBudget, quotas: SqlCreationQuotas, now: () => number = Date.now) {
		this.redis = redis
		this.policy = policy
		this.limit = policy.roomsPerPerson ?? 10
		this.commands = commands
		this.quotas = quotas
		this.now = now
	}
	async check() {
		await Promise.all([readCall(this.redis.ping()), this.commands.check?.()])
		await writeCall(this.redis.set(`{yw}:readiness:${randomUUID()}`, "1", "PX", 1000))
	}
	private async proven(room: Pick<ProposalRoom, "id" | "expiresAt">) {
		const [expiry] = await readCall(script<string[]>(this.redis, "ywProof", K.quotaRoom(room.id), K.mirror))
		// Reservations not imported yet (a fresh or lost store): Crate proves it, as before.
		if (expiry === "unready") return this.quotas.active(room.id, room.expiresAt)
		if (!expiry) throw busy()
		if (Number(expiry) <= this.now()) throw expired()
		if (Number(expiry) !== room.expiresAt) throw busy()
	}
	async active(room: Pick<ProposalRoom, "id" | "expiresAt">) {
		if (this.now() >= room.expiresAt) throw expired()
		await this.proven(room)
		const check = { roomId: room.id }
		checks.add(check)
		return check
	}
	private async admit(mode: "create" | "join", roomId: string, inputDigest: string, creatorOrActor: string) {
		const now = this.now()
		const window = Math.floor(now / WINDOW_MS)
		const op = digest(JSON.stringify([mode, roomId, creatorOrActor, inputDigest]))
		const [status, expiry] = await writeCall(
			script<[string, string | number | undefined]>(
				this.redis,
				"ywAdmit",
				K.quotaRoom(roomId),
				K.quotaCreator(mode === "create" ? creatorOrActor : "-"),
				K.admissions(window),
				K.mirror,
				mode,
				now,
				roomId,
				inputDigest,
				creatorOrActor,
				this.limit,
				op,
				this.policy.admissions,
				CONTINUOUS_LIMITS.roomMs,
				(window + 1) * WINDOW_MS
			)
		)
		switch (status) {
			case "ok":
				return Number(expiry)
			case "expired":
				throw expired()
			case "conflict":
				throw new RoomError("conflict", "Admission retry changed", 409)
			case "full":
				throw allowanceFull(this.limit)
			case "budget":
				throw new BudgetError("Admission budget reached; retain admission and retry", ((window + 1) * WINDOW_MS - now) / 1000)
			default:
				// 'missing' (a join to a room without its proof) or 'unready' (reservations not imported yet).
				throw busy()
		}
	}
	async create(roomId: string, admissionDigest: string, creatorDigest: string, proceed?: Promise<boolean>) {
		if (proceed && !(await proceed)) return null
		return this.admit("create", roomId, admissionDigest, creatorDigest)
	}
	async join(roomId: string, actorId: string, admissionDigest: string) {
		await this.admit("join", roomId, admissionDigest, actorId)
	}
	async command(roomId: string, actorId: string, commandDigest: string, checked?: unknown) {
		const reused = typeof checked === "object" && checked !== null && checks.has(checked) && (checked as { roomId: string }).roomId === roomId
		if (reused) checks.delete(checked)
		else {
			const [expiry] = await readCall(script<string[]>(this.redis, "ywProof", K.quotaRoom(roomId), K.mirror))
			if (expiry === "unready") await this.quotas.active(roomId)
			else if (!expiry) throw busy()
			else if (Number(expiry) <= this.now()) throw expired()
		}
		await this.commands.charge(
			digest(JSON.stringify(["command", roomId, actorId, commandDigest])),
			digest(`${roomId}:${actorId}`).slice(0, 32),
			this.policy
		)
	}
}

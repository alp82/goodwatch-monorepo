import {
	controlTable,
	columns,
	parseRow,
	tableDdl,
} from "./proposal-storage-schema.ts"
import { createHash } from "node:crypto"
import { RoomError, IndeterminateWrite } from "./errors.ts"
import type { Sql } from "./repository.server.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import type { ProposalRoom } from "./proposal-types.ts"
export const CONTROL_TABLE = "doc.yepwatch_control"
const ID = "proposal3",
	WINDOW_MS = 60_000
export interface ControlPolicy {
	rooms: number
	admissions: number
	commands: number
	actorCommands: number
}
export const DEFAULT_CONTROL: ControlPolicy = {
	rooms: 20,
	admissions: 20,
	commands: 600,
	actorCommands: 60,
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex")
export function controlFingerprint(p: ControlPolicy) {
	return digest(
		JSON.stringify([
			1,
			WINDOW_MS,
			CONTINUOUS_LIMITS.roomMs,
			p.rooms,
			p.admissions,
			p.commands,
			p.actorCommands,
		])
	)
}
export interface Control {
	format: 1
	fingerprint: string
	window: number
	/** Room ID, complete original admission digest, fixed expiry. No choices/credentials. */
	rooms: [string, string, number][]
	admissions: string[]
	/** Logical command digest, hashed authenticated actor identity. */
	commands: [string, string][]
}
export const CONTROL_COLUMNS = columns(controlTable)
export function controlRow(s: Control) {
	return parseRow(controlTable, {
		id: ID,
		format: s.format,
		fingerprint: s.fingerprint,
		window_number: s.window,
		room_reservations: s.rooms.map(
			([room_id, admission_digest, expires_at]) => ({
				room_id,
				admission_digest,
				expires_at,
			})
		),
		admission_digests: s.admissions,
		command_grants: s.commands.map(([command_digest, actor_digest]) => ({
			command_digest,
			actor_digest,
		})),
	})
}
export function controlState(raw: Record<string, unknown>): Control {
	const s = parseRow(controlTable, raw)
	if (s.id !== ID)
		throw new RoomError("busy", "Invalid control identity", 503, true)
	return {
		format: s.format,
		fingerprint: s.fingerprint,
		window: s.window_number,
		rooms: s.room_reservations.map((r: any) => [
			r.room_id,
			r.admission_digest,
			r.expires_at,
		]),
		admissions: s.admission_digests,
		commands: s.command_grants.map((r: any) => [
			r.command_digest,
			r.actor_digest,
		]),
	}
}
interface Read {
	state: Control
	seq: number
	term: number
	now: number
}
export class BudgetError extends RoomError {
	readonly retryAfterSeconds: number
	constructor(message: string, seconds: number, status = 429) {
		super(status === 429 ? "limit_reached" : "busy", message, status, true)
		this.retryAfterSeconds = Math.min(21600, Math.max(1, Math.ceil(seconds)))
	}
}
function initial(policy: ControlPolicy): Control {
	return {
		format: 1,
		fingerprint: controlFingerprint(policy),
		window: -1,
		rooms: [],
		admissions: [],
		commands: [],
	}
}
/** Operator only. Missing controls over existing history cannot be safely bootstrapped by a running API. */
export async function provisionControl(
	sql: Sql,
	policy: ControlPolicy,
	replicas: 0 | 2
) {
	await sql(tableDdl(controlTable, replicas))
	const existing = (
		await sql(`SELECT id FROM ${CONTROL_TABLE} WHERE id=?`, [ID])
	).rows[0]
	if (!existing) {
		await sql("REFRESH TABLE doc.yepwatch_room")
		const count = (await sql("SELECT count(*) FROM doc.yepwatch_room")).rows[0]
		if (Number(count?.[0]) !== 0)
			throw new Error(
				"Control initialization requires an empty room store and quiesced writers; never reset live capacity"
			)
		const row = controlRow(initial(policy))
		await sql(
			`INSERT INTO ${CONTROL_TABLE} (${CONTROL_COLUMNS.join(
				","
			)}) VALUES (${CONTROL_COLUMNS.map(() => "?").join(",")})`,
			CONTROL_COLUMNS.map((k) => row[k])
		)
	}
	await new ReleaseControl(sql, policy).check()
}
export class ReleaseControl {
	private sql: Sql
	readonly policy: ControlPolicy
	constructor(sql: Sql, policy: ControlPolicy) {
		this.sql = sql
		this.policy = policy
	}
	private async read(): Promise<Read> {
		const row = (
			await this.sql(
				`SELECT ${CONTROL_COLUMNS.join(
					","
				)},_seq_no,_primary_term,CURRENT_TIMESTAMP FROM ${CONTROL_TABLE} WHERE id=?`,
				[ID]
			)
		).rows[0]
		if (!row)
			throw new RoomError(
				"busy",
				"Capacity controls are not provisioned",
				503,
				true
			)
		const state = controlState(
			Object.fromEntries(CONTROL_COLUMNS.map((k, i) => [k, row[i]]))
		)
		if (
			state.format !== 1 ||
			state.fingerprint !== controlFingerprint(this.policy)
		)
			throw new RoomError(
				"busy",
				"Capacity configuration mismatch; operator reconciliation required",
				503,
				true
			)
		if (
			!Array.isArray(state.rooms) ||
			state.rooms.length > this.policy.rooms ||
			!Array.isArray(state.commands) ||
			state.commands.length > this.policy.commands ||
			!Array.isArray(state.admissions) ||
			state.admissions.length > this.policy.admissions
		)
			throw new RoomError("busy", "Capacity state unavailable", 503, true)
		const now = Number(row[CONTROL_COLUMNS.length + 2])
		if (!Number.isFinite(now) || !Number.isInteger(now))
			throw new RoomError("busy", "Store clock unavailable", 503, true)
		return {
			state,
			seq: Number(row[CONTROL_COLUMNS.length]),
			term: Number(row[CONTROL_COLUMNS.length + 1]),
			now,
		}
	}
	async check() {
		await this.read()
	}
	async summary() {
		const r = await this.read()
		return {
			activeReservations: r.state.rooms.filter((x) => x[2] > r.now).length,
			maximumRooms: this.policy.rooms,
			window: r.state.window,
			admissionGrants: r.state.admissions.length,
			commandGrants: r.state.commands.length,
			databaseTime: r.now,
		}
	}
	async active(room: Pick<ProposalRoom, "id" | "expiresAt">) {
		const r = await this.read()
		if (r.now >= room.expiresAt)
			throw new RoomError("expired", "Room expired", 410)
		if (!r.state.rooms.some((x) => x[0] === room.id && x[2] === room.expiresAt))
			throw new RoomError(
				"busy",
				"Room capacity reservation unavailable",
				503,
				true
			)
	}
	private clean(r: Read) {
		const s = structuredClone(r.state)
		s.rooms = s.rooms.filter((x) => x[2] > r.now)
		const window = Math.floor(r.now / WINDOW_MS)
		if (window < s.window)
			throw new BudgetError(
				"Store clock window has not advanced; retry later",
				(s.window * WINDOW_MS - r.now) / 1000,
				503
			)
		if (window !== s.window) {
			s.window = window
			s.admissions = []
			s.commands = []
		}
		return s
	}
	private async update(r: Read, state: Control) {
		const row = controlRow(state)
		const changed = CONTROL_COLUMNS.filter((k) => k !== "id")
		const end = (state.window + 1) * WINDOW_MS
		try {
			return (
				(
					await this.sql(
						`UPDATE ${CONTROL_TABLE} SET ${changed
							.map(
								(k) =>
									`${k}=CASE WHEN CURRENT_TIMESTAMP < ? THEN ? ELSE ${k} END`
							)
							.join(",")} WHERE id=? AND _seq_no=? AND _primary_term=?`,
						[...changed.flatMap((k) => [end, row[k]]), ID, r.seq, r.term]
					)
				).rowcount === 1
			)
		} catch (e) {
			if (e instanceof IndeterminateWrite) return true
			throw e
		}
	}
	async create(roomId: string, admissionDigest: string) {
		const op = digest(`create:${roomId}:${admissionDigest}`)
		for (let i = 0; i < 8; i++) {
			const r = await this.read(),
				state = this.clean(r),
				prior = state.rooms.find((x) => x[0] === roomId)
			if (prior) {
				if (prior[1] !== admissionDigest)
					throw new RoomError("conflict", "Admission retry changed")
				return prior[2]
			}
			if (state.rooms.length >= this.policy.rooms)
				throw new BudgetError(
					"Active room capacity reached; retry after an existing room expires",
					(Math.min(...state.rooms.map((x) => x[2])) - r.now) / 1000,
					503
				)
			this.admissionBudget(state, r.now)
			const expiry = r.now + CONTINUOUS_LIMITS.roomMs
			state.rooms.push([roomId, admissionDigest, expiry])
			state.admissions.push(op)
			if (!(await this.update(r, state))) continue
			const proof = await this.read()
			if (
				proof.now < expiry &&
				proof.state.rooms.some(
					(x) => x[0] === roomId && x[1] === admissionDigest && x[2] === expiry
				)
			)
				return expiry
		}
		throw new BudgetError(
			"Capacity outcome uncertain; retain the exact admission for retry",
			1,
			503
		)
	}
	private admissionBudget(state: Control, now: number) {
		if (state.admissions.length >= this.policy.admissions)
			throw new BudgetError(
				"Admission budget reached; retain admission and retry",
				((state.window + 1) * WINDOW_MS - now) / 1000
			)
	}
	async join(roomId: string, actorId: string, admissionDigest: string) {
		await this.permit("join", roomId, actorId, admissionDigest)
	}
	async command(roomId: string, actorId: string, commandDigest: string) {
		await this.permit("command", roomId, actorId, commandDigest)
	}
	private async permit(
		kind: "join" | "command",
		roomId: string,
		actorId: string,
		inputDigest: string
	) {
		const op = digest(JSON.stringify([kind, roomId, actorId, inputDigest])),
			actor = digest(`${roomId}:${actorId}`).slice(0, 32)
		for (let i = 0; i < 8; i++) {
			const r = await this.read(),
				state = this.clean(r)
			if (!state.rooms.some((x) => x[0] === roomId))
				throw new RoomError("expired", "Room capacity reservation expired", 410)
			const admitted =
				kind === "join"
					? state.admissions.includes(op)
					: state.commands.some((x) => x[0] === op && x[1] === actor)
			if (admitted) return
			if (kind === "join") {
				this.admissionBudget(state, r.now)
				state.admissions.push(op)
			} else {
				if (
					state.commands.length >= this.policy.commands ||
					state.commands.filter((x) => x[1] === actor).length >=
						this.policy.actorCommands
				)
					throw new BudgetError(
						"Command budget reached; retain pending command and retry",
						((state.window + 1) * WINDOW_MS - r.now) / 1000
					)
				state.commands.push([op, actor])
			}
			if (!(await this.update(r, state))) continue
			const proof = await this.read()
			// Never confirm an old window using a later window. New authorization remains subject to domain receipts/sequence/CAS.
			if (
				proof.state.window !== state.window ||
				Math.floor(proof.now / WINDOW_MS) !== state.window
			)
				continue
			if (
				kind === "join"
					? proof.state.admissions.includes(op)
					: proof.state.commands.some((x) => x[0] === op && x[1] === actor)
			)
				return
		}
		throw new BudgetError(
			"Operation budget outcome uncertain; retain pending request for retry",
			1,
			503
		)
	}
}

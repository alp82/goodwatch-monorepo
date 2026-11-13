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
import { SqlCreationQuotas, type CreationQuotaStore } from './proposal-creation-quota.ts'
export const CONTROL_TABLE = "doc.yepwatch_control"
const ID = "proposal3",
	WINDOW_MS = 60_000
export interface ControlPolicy {
	roomsPerPerson?: number
	admissions: number
	commands: number
	actorCommands: number
}
export const DEFAULT_CONTROL: ControlPolicy = {
	admissions: 20,
	commands: 600,
	actorCommands: 60,
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex")
/**
 * The removed shared active-room cap (owner 2026-11-12) is still part of the stored fingerprint: rows provisioned
 * with it keep validating without an operator reconciliation. New rows record 20, its old default.
 */
const LEGACY_ROOM_CAP = 20
function fingerprint(p: ControlPolicy, legacyRoomCap: number) {
	return digest(
		JSON.stringify([
			1,
			WINDOW_MS,
			CONTINUOUS_LIMITS.roomMs,
			legacyRoomCap,
			p.admissions,
			p.commands,
			p.actorCommands,
		])
	)
}
export function controlFingerprint(p: ControlPolicy) {
	return fingerprint(p, LEGACY_ROOM_CAP)
}
/** Every fingerprint a row may carry for this policy: the old cap was configurable from 1 to 100. */
const LEGACY_ROOM_CAP_MAX = 100
function acceptedFingerprints(p: ControlPolicy) {
	return new Set(Array.from({ length: LEGACY_ROOM_CAP_MAX }, (_, i) => fingerprint(p, i + 1)))
}
export interface Control {
	format: 1
	fingerprint: string
	window: number
	/**
	 * Reservations of the removed shared room cap: room ID, admission digest, fixed expiry. Nothing adds any now; a
	 * live one still proves its room (reads, joins, commands, exact creation retries) until it expires.
	 */
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
/** What `active` saw for a room, handed back to `command` for the same room so its permit doesn't read it again. */
const checks = new WeakSet<object>()
interface Check extends Read {
	roomId: string
}
/** An UPDATE whose acknowledgement was lost: the outcome is only known from a fresh read. */
const UNCERTAIN = Symbol("uncertain")
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
	await new ReleaseControl(sql, policy, new SqlCreationQuotas(sql, policy.roomsPerPerson)).check()
}
export class ReleaseControl {
	private sql: Sql
	private readonly quotas: CreationQuotaStore
	private readonly fingerprints: Set<string>
	readonly policy: ControlPolicy
	constructor(sql: Sql, policy: ControlPolicy, quotas: CreationQuotaStore) {
		this.sql = sql
		this.policy = policy
		this.quotas = quotas
		this.fingerprints = acceptedFingerprints(policy)
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
		return this.parse(row)
	}
	/** A control row as `${CONTROL_COLUMNS},_seq_no,_primary_term,CURRENT_TIMESTAMP`, validated. */
	private parse(row: unknown[] | undefined): Read {
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
			!this.fingerprints.has(state.fingerprint)
		)
			throw new RoomError(
				"busy",
				"Capacity configuration mismatch; operator reconciliation required",
				503,
				true
			)
		if (
			!Array.isArray(state.rooms) ||
			state.rooms.length > LEGACY_ROOM_CAP_MAX ||
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
			activeReservations: await this.quotas.count(),
			roomsPerPerson: this.quotas.limit,
			window: r.state.window,
			admissionGrants: r.state.admissions.length,
			commandGrants: r.state.commands.length,
			databaseTime: r.now,
		}
	}
	/**
	 * A room's creation-quota proof, read alongside the control row: it doesn't depend on it, and every command and
	 * realtime read checks both, so reading them one after the other cost a round trip each time. The outcome is
	 * held, not thrown, until the control row has been read.
	 */
	private quotaProof(roomId: string, expiresAt?: number) {
		return this.quotas.active(roomId, expiresAt).then(
			() => null,
			(error: unknown) => ({ error })
		)
	}
	/** A live reservation of the removed shared cap for this room (read only: none is ever added). */
	private legacy(r: Read, roomId: string, expiresAt?: number) {
		return r.state.rooms.find(
			(x) => x[0] === roomId && x[2] > r.now && (expiresAt === undefined || x[2] === expiresAt)
		)
	}
	/**
	 * Whether the room is live and holds its capacity: its creator's allowance reservation, or a legacy reservation
	 * in the control row from before allowances. Returns what it read: a command for this room passes it to
	 * `command`, whose permit then starts from it.
	 */
	async active(room: Pick<ProposalRoom, "id" | "expiresAt">): Promise<unknown> {
		const quota = this.quotaProof(room.id, room.expiresAt)
		const r = await this.read()
		if (r.now >= room.expiresAt)
			throw new RoomError("expired", "Room expired", 410)
		if (!this.legacy(r, room.id, room.expiresAt)) {
			const failed = await quota
			if (failed) throw failed.error
		}
		const check: Check = { ...r, roomId: room.id }
		checks.add(check)
		return check
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
	/**
	 * Writes `state` over the row `r` read (compare-and-swap), unless the window has ended by the database clock.
	 * Returns the row as written (RETURNING: whether the grant landed is known without reading it back), null when
	 * another write came first, or UNCERTAIN when the acknowledgement was lost.
	 */
	private async update(r: Read, state: Control): Promise<Read | null | typeof UNCERTAIN> {
		const row = controlRow(state)
		const changed = CONTROL_COLUMNS.filter((k) => k !== "id")
		const end = (state.window + 1) * WINDOW_MS
		try {
			const result = await this.sql(
				`UPDATE ${CONTROL_TABLE} SET ${changed
					.map(
						(k) =>
							`${k}=CASE WHEN CURRENT_TIMESTAMP < ? THEN ? ELSE ${k} END`
					)
					.join(",")} WHERE id=? AND _seq_no=? AND _primary_term=? RETURNING ${CONTROL_COLUMNS.join(
					","
				)},_seq_no,_primary_term,CURRENT_TIMESTAMP`,
				[...changed.flatMap((k) => [end, row[k]]), ID, r.seq, r.term]
			)
			if (result.rowcount !== 1) return null
			// A store that acknowledged the write without the row: read it back like a lost acknowledgement.
			return result.rows[0]?.length ? this.parse(result.rows[0]) : UNCERTAIN
		} catch (e) {
			if (e instanceof IndeterminateWrite) return UNCERTAIN
			throw e
		}
	}
	/**
	 * Checks (read only) that the creator's allowance has room, charges the shared admission budget, then reserves
	 * the room in the allowance (compare-and-swap, authoritative). A creator who is already full is refused before
	 * any grant is charged, so they can't use up everyone's admissions; a rate-denied admission writes no allowance
	 * rows. Only a creator racing themselves for their last slot can spend a grant on a refused reservation. An exact
	 * retry finds its grant and its reservation again; an exact retry of a room created under the removed shared cap
	 * gets that room's original expiry and creates nothing.
	 *
	 * `proceed`: whether the room still needs creating (the caller's existence read, running alongside). The reads
	 * here run alongside it; nothing is written, and null is returned, unless it resolves true. `deferProof`: see
	 * CreationQuotaStore.reserve (the room's proof row is handed over, not awaited).
	 */
	create(roomId: string, admissionDigest: string, creatorDigest: string): Promise<number>
	create(roomId: string, admissionDigest: string, creatorDigest: string, proceed?: Promise<boolean>, deferProof?: (proof: Promise<void>) => void): Promise<number | null>
	async create(roomId: string, admissionDigest: string, creatorDigest: string, proceed?: Promise<boolean>, deferProof?: (proof: Promise<void>) => void): Promise<number | null> {
		const eligibility = this.quotas.eligible(roomId, admissionDigest, creatorDigest).then(
			(seen) => ({ seen }),
			(error: unknown) => ({ error })
		)
		const read = this.read().then(
			(r) => ({ r }),
			(error: unknown) => ({ error })
		)
		if (proceed && !(await proceed)) return null
		const control = await read
		if ("error" in control) throw control.error
		const r = control.r
		const legacyExpiry = this.legacyCreation(r, roomId, admissionDigest)
		if (legacyExpiry !== undefined) return legacyExpiry
		const eligible = await eligibility
		if ("error" in eligible) throw eligible.error
		const check: Check = { ...r, roomId }
		checks.add(check)
		const raced = await this.permit("create", roomId, creatorDigest, admissionDigest, check)
		if (raced !== undefined) return raced
		return this.quotas.reserve(roomId, admissionDigest, creatorDigest, eligible.seen, r.now, deferProof)
	}
	/**
	 * A creation permit checks for a legacy reservation on every read it builds a compare-and-swap on, not only on
	 * the first: an instance still running the shared-cap code could have written one after `create` read the row
	 * (its CAS then fails ours). An exact retry gets the legacy expiry, a changed one conflicts.
	 *
	 * What stays open is an old writer adding its reservation after our CAS landed; closing that would need fencing
	 * old writers. It doesn't arise for HTTP: the old code (0a7028684^) wrote a control-row reservation only when
	 * `create` got no creator digest or no allowance store (proposal-release-control.ts:308-332). Its release
	 * runtime always passed the store (proposal-release-runtime.ts:45-46), and its only HTTP create
	 * (proposal-http.server.ts:464) passed an account or guestCreator(), which returns an identifier or throws
	 * (proposal-http.server.ts:101-110); the service turned either into a creator digest
	 * (proposal-service.server.ts:427-431). So old HTTP writers reserved allowances and never wrote legacy rows.
	 */
	private legacyCreation(r: Read, roomId: string, admissionDigest: string) {
		const legacy = this.legacy(r, roomId)
		if (legacy && legacy[1] !== admissionDigest) throw new RoomError("conflict", "Admission retry changed")
		return legacy?.[2]
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
	/** `checked`: what `active` returned for this room just before, so the permit starts from that read. */
	async command(roomId: string, actorId: string, commandDigest: string, checked?: unknown) {
		await this.permit("command", roomId, actorId, commandDigest, checked)
	}
	private async permit(
		kind: "create" | "join" | "command",
		roomId: string,
		actorId: string,
		inputDigest: string,
		checked?: unknown
	): Promise<number | undefined> {
		const op = digest(JSON.stringify([kind, roomId, actorId, inputDigest])),
			actor = digest(`${roomId}:${actorId}`).slice(0, 32)
		// The room's capacity was just proven by `active` from this very read: the first try starts from it (a
		// compare-and-swap lost to a newer row reads again below, with the room checked again).
		let reuse =
			typeof checked === "object" && checked !== null && checks.has(checked) && (checked as Check).roomId === roomId
				? (checked as Check)
				: null
		if (reuse) checks.delete(reuse)
		for (let i = 0; i < 8; i++) {
			const fresh = reuse
			reuse = null
			// A room being created has no reservation yet; every other permit proves the room's, unless the control
			// row still holds a live legacy reservation for it.
			const quota = fresh || kind === "create" ? undefined : this.quotaProof(roomId)
			const r = fresh ?? (await this.read()),
				state = this.clean(r)
			if (kind === "create") {
				const legacyExpiry = this.legacyCreation(r, roomId, inputDigest)
				if (legacyExpiry !== undefined) return legacyExpiry
			}
			if (quota && !state.rooms.some((x) => x[0] === roomId)) {
				const failed = await quota
				if (failed) throw failed.error
			}
			const admitted =
				kind !== "command"
					? state.admissions.includes(op)
					: state.commands.some((x) => x[0] === op && x[1] === actor)
			if (admitted) return undefined
			if (kind !== "command") {
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
			const updateStarted = Date.now()
			const written = await this.update(r, state)
			if (!written) continue
			// RETURNING carries the statement's start time: an UPDATE acknowledged after the window rolled over
			// could confirm against the old window, so read back whenever the statement may have crossed it.
			const elapsed = Date.now() - updateStarted
			const proof =
				written === UNCERTAIN || Math.floor((written.now + elapsed) / WINDOW_MS) !== state.window
					? await this.read()
					: written
			// Never confirm an old window using a later window. New authorization remains subject to domain receipts/sequence/CAS.
			if (
				proof.state.window !== state.window ||
				Math.floor(proof.now / WINDOW_MS) !== state.window
			)
				continue
			if (
				kind !== "command"
					? proof.state.admissions.includes(op)
					: proof.state.commands.some((x) => x[0] === op && x[1] === actor)
			)
				return undefined
		}
		throw new BudgetError(
			"Operation budget outcome uncertain; retain pending request for retry",
			1,
			503
		)
	}
}

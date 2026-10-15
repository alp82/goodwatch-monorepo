import { createHash } from "node:crypto"
import {
	type AuthSql,
	CrateAuthRequestError,
	IndeterminateAuthWriteError,
	type SqlResult,
} from "./crate-adapter.server.ts"
import { AuthPayloadAuthenticationError } from "./payload-codec.server.ts"
import type { authPayloadCodec } from "./payload-codec.server.ts"

type Codec = ReturnType<typeof authPayloadCodec>
export type AuthPopulationBounds = { buckets: number; limitPerBucket: number }
export type AuthAdmission = { bucket: string; generation: number }
export type CapacityLedger = {
	id: string
	emptySince?: string
	nextGeneration: number
	bounds: AuthPopulationBounds
	slots: Record<string, { generation: number; createdAt: string }>
}
export const launchPopulationBounds: AuthPopulationBounds = {
	buckets: 1,
	limitPerBucket: 128,
}

/** No ledger is shared between unrelated members or anonymous registrations. */
export function authPopulationActor(
	model: string,
	row: Record<string, unknown>,
): string | undefined {
	if (["user", "account", "jwks", "oauthResource", "rateLimit"].includes(model))
		return undefined
	if (model === "verification")
		return typeof row.identifier === "string" ? row.identifier : undefined
	if (model === "oauthClient")
		return typeof row.userId === "string" ? row.userId : undefined
	if (["oauthClientResource", "oauthClientAssertion"].includes(model))
		return typeof row.clientId === "string" ? row.clientId : undefined
	return typeof row.userId === "string" ? row.userId : undefined
}
export function authActorBounds(model: string): AuthPopulationBounds {
	return {
		buckets: 1,
		limitPerBucket:
			model === "session"
				? 20
				: ["oauthAccessToken", "oauthRefreshToken"].includes(model)
					? 1024
					: 128,
	}
}
export function authCapacityBucket(
	model: string,
	id: string,
	bounds: AuthPopulationBounds,
	actor: string,
) {
	const digest = (value: string) =>
		createHash("sha256").update(value).digest("hex")
	return `${model}:actor:${digest(actor)}:${Number.parseInt(digest(id).slice(0, 8), 16) % bounds.buckets}`
}

export function validatePopulationBounds(
	bounds: AuthPopulationBounds,
	maxEnumeration: number,
) {
	if (
		!Number.isSafeInteger(bounds.buckets) ||
		bounds.buckets < 1 ||
		bounds.buckets > 64 ||
		!Number.isSafeInteger(bounds.limitPerBucket) ||
		bounds.limitPerBucket < 1 ||
		bounds.limitPerBucket * bounds.buckets > maxEnumeration
	)
		throw new Error("Invalid auth population bounds")
}

export async function readCapacity(sql: AuthSql, codec: Codec, bucket: string) {
	const result = (
		await sql(
			"SELECT payload,_seq_no,_primary_term FROM doc.auth_capacity WHERE id=?",
			[bucket],
		)
	).rows[0]
	if (!result) return null
	const envelope = codec.decode(
		result[0],
		`doc.auth_capacity:${bucket}:payload`,
	)
	const ledger = envelope.row as CapacityLedger
	if (
		envelope.deleted !== false ||
		ledger.id !== bucket ||
		!Number.isSafeInteger(ledger.nextGeneration) ||
		!ledger.slots ||
		Array.isArray(ledger.slots)
	)
		throw new AuthPayloadAuthenticationError(
			`doc.auth_capacity:${bucket}:payload`,
		)
	return { ledger, seq: result[1], term: result[2] }
}

/** Caller must fence or archive the row before returning its matching generation. */
export async function releaseAuthAdmission(
	sql: AuthSql,
	codec: Codec,
	id: string,
	admission?: AuthAdmission,
	now = new Date(),
) {
	if (!admission) return
	for (let attempt = 0; attempt < 64; attempt++) {
		const current = await readCapacity(sql, codec, admission.bucket)
		if (
			!current ||
			current.ledger.slots[id]?.generation !== admission.generation
		)
			return
		const slots = { ...current.ledger.slots }
		delete slots[id]
		const result = await sql(
			"UPDATE doc.auth_capacity SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?",
			[
				codec.encode(
					{
						row: {
							...current.ledger,
							slots,
							emptySince: Object.keys(slots).length
								? undefined
								: now.toISOString(),
						},
						deleted: false,
					},
					`doc.auth_capacity:${admission.bucket}:payload`,
				),
				admission.bucket,
				current.seq,
				current.term,
			],
		)
		if (result.rowcount === 1) return
	}
	throw new Error("Auth population release contention")
}

/** Reserve before insertion. Slots include pending writes and are reclaimed only after row fencing. */
export async function admitAuthRow(
	sql: AuthSql,
	codec: Codec,
	model: string,
	id: string,
	bounds: AuthPopulationBounds,
	actor: string,
	evict?: (id: string, admission: AuthAdmission) => Promise<boolean>,
): Promise<AuthAdmission> {
	const bucket = authCapacityBucket(model, id, bounds, actor)
	const aad = `doc.auth_capacity:${bucket}`
	for (let attempt = 0; attempt < 64; attempt++) {
		const current = await readCapacity(sql, codec, bucket)
		if (
			current &&
			(current.ledger.bounds.buckets !== bounds.buckets ||
				current.ledger.bounds.limitPerBucket !== bounds.limitPerBucket)
		)
			throw new Error(
				"Auth population capacity configuration changed; offline rebuild required",
			)
		const existing = current?.ledger.slots[id]
		if (existing !== undefined)
			return { bucket, generation: existing.generation }
		if (
			current &&
			Object.keys(current.ledger.slots).length >= bounds.limitPerBucket
		) {
			const oldest = Object.entries(current.ledger.slots).sort(
				(a, b) =>
					a[1].createdAt.localeCompare(b[1].createdAt) ||
					a[1].generation - b[1].generation,
			)[0]
			if (
				evict &&
				oldest &&
				(await evict(oldest[0], { bucket, generation: oldest[1].generation }))
			)
				continue
			throw new Error("Auth population capacity exhausted")
		}
		const generation = (current?.ledger.nextGeneration ?? 0) + 1
		if (!Number.isSafeInteger(generation))
			throw new Error("Auth population capacity generation exhausted")
		const ledger: CapacityLedger = {
			id: bucket,
			nextGeneration: generation,
			bounds,
			slots: {
				...current?.ledger.slots,
				[id]: { generation, createdAt: new Date().toISOString() },
			},
		}
		let result: SqlResult
		try {
			result = current
				? await sql(
						"UPDATE doc.auth_capacity SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?",
						[
							codec.encode({ row: ledger, deleted: false }, `${aad}:payload`),
							bucket,
							current.seq,
							current.term,
						],
					)
				: await sql(
						"INSERT INTO doc.auth_capacity (id,payload,receipts) VALUES (?,?,?)",
						[
							bucket,
							codec.encode({ row: ledger, deleted: false }, `${aad}:payload`),
							codec.encode([], `${aad}:receipts`),
						],
					)
		} catch (error) {
			if (error instanceof CrateAuthRequestError && error.code === 4091)
				continue
			if (error instanceof CrateAuthRequestError && error.definitelyNotApplied)
				throw error
			const recovered = await readCapacity(sql, codec, bucket)
			if (recovered?.ledger.slots[id]?.generation === generation)
				return { bucket, generation }
			throw new IndeterminateAuthWriteError()
		}
		if (result.rowcount === 1) return { bucket, generation }
		const recovered = await readCapacity(sql, codec, bucket)
		if (recovered?.ledger.slots[id] !== undefined)
			return { bucket, generation: recovered.ledger.slots[id].generation }
		// Reserving an identity is idempotent; a proven conflict can start over.
		if (!current || !recovered || recovered.seq === current.seq)
			throw new IndeterminateAuthWriteError()
	}
	throw new Error("Auth population capacity contention")
}

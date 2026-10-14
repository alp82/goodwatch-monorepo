import { createHash } from "node:crypto"
import {
	type AuthSql,
	CrateAuthRequestError,
	IndeterminateAuthWriteError,
	type SqlResult,
} from "./crate-adapter.server.ts"
import type { authPayloadCodec } from "./payload-codec.server.ts"

type Codec = ReturnType<typeof authPayloadCodec>
export type AuthPopulationBounds = { buckets: number; limitPerBucket: number }
export type AuthAdmission = { bucket: string; generation: number }
export type CapacityLedger = {
	id: string
	nextGeneration: number
	bounds: AuthPopulationBounds
	slots: Record<string, { generation: number; createdAt: string }>
}
export const launchPopulationBounds: AuthPopulationBounds = {
	buckets: 64,
	limitPerBucket: 128,
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
		throw new Error("Invalid authenticated auth capacity ledger")
	return { ledger, seq: result[1], term: result[2] }
}

/** Reserve before insertion. Slots include pending writes and are reclaimed only after row fencing. */
export async function admitAuthRow(
	sql: AuthSql,
	codec: Codec,
	model: string,
	id: string,
	bounds: AuthPopulationBounds,
): Promise<AuthAdmission> {
	const bucket = `${model}:${Number.parseInt(createHash("sha256").update(id).digest("hex").slice(0, 8), 16) % bounds.buckets}`
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
		)
			throw new Error("Auth population capacity exhausted")
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

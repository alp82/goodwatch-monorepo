import { captureMessage } from "@sentry/remix"
import { counter } from "../metrics/registry.server.ts"
import { isDeepStrictEqual } from "node:util"
import { createHash, createHmac, randomUUID } from "node:crypto"
import {
	type AuthSql,
	CrateAuthRequestError,
	IndeterminateAuthWriteError,
	authModelTable,
	authLookupHints,
	authModels,
} from "./crate-adapter.server.ts"
import {
	type AuthEncryptionKeys,
	AuthPayloadAuthenticationError,
	authCredentialVersion,
	authPayloadCodec,
} from "./payload-codec.server.ts"
import {
	type AuthAdmission,
	releaseAuthAdmission,
	authPopulationActor,
	authActorBounds,
	authCapacityBucket,
	readCapacity,
} from "./population.server.ts"

export type AuthMaintenanceOptions = {
	sql: AuthSql
	encryptionSecret: string
	encryptionKeys?: AuthEncryptionKeys
	cursor?: string
	batchSize?: number
	now?: Date
	onRowError?: (row: {table: string; id: string}) => void
}
type Options = AuthMaintenanceOptions
type Envelope = {
	row: Record<string, unknown>
	deleted: boolean
	archived?: boolean
	authorizedAt?: string
	emailClaim?: string
	deletedAt?: string
	admission?: AuthAdmission
	admissionFence?: number
}
type Receipt = { operation: string; baseSeq: number; at?: string }

const quarantined = counter("goodwatch_auth_maintenance_quarantined_total", "Unreadable auth rows skipped by maintenance.", ["table"], 16)
function skipRow(error: unknown, options: Options) {
 if (!(error instanceof AuthPayloadAuthenticationError)) throw error
 const row = {table:error.table,id:error.id}
 quarantined.inc([row.table])
 if(options.onRowError) options.onRowError(row)
 else {
  console.error("Auth maintenance skipped unreadable row", row)
  captureMessage("Auth maintenance skipped unreadable row", {level:"error", extra:row})
 }
}

function batchSize(value = 1000) {
	if (!Number.isSafeInteger(value) || value < 1 || value > 10000)
		throw new Error("Invalid maintenance batch size")
	return value
}

/** Fence the owner row before releasing a reservation. Time alone never proves orphanhood. */
export async function recoverEmailClaims(options: Options) {
	const { sql, encryptionSecret, cursor } = options
	const size = batchSize(options.batchSize)
	const now = options.now ?? new Date()
	if (!Number.isFinite(now.getTime()))
		throw new Error("Invalid maintenance time")
	const codec = authPayloadCodec(encryptionSecret, options.encryptionKeys)
	await sql("REFRESH TABLE doc.auth_user_email")
	const page = await sql(
		`SELECT email_norm FROM doc.auth_user_email ${cursor === undefined ? "" : "WHERE email_norm > ?"} ORDER BY email_norm LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		released: 0,
		retained: 0,
		conflicted: 0,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const email = String(value)
		report.cursor = email
		report.scanned++
		const claim = (
			await sql(
				"SELECT user_id,operation_id,_seq_no,_primary_term,created_at FROM doc.auth_user_email WHERE email_norm=?",
				[email],
			)
		).rows[0]
		if (!claim) continue
		if (now.getTime() - new Date(claim[4] as string).getTime() < 15 * 60000) {
			report.retained++
			continue
		}
		const id = String(claim[0])
		const aad = `doc.auth_user:${id}`
		const current = (
			await sql(
				"SELECT payload,receipts,_seq_no,_primary_term FROM doc.auth_user WHERE id=?",
				[id],
			)
		).rows[0]
		if (current) {
			const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
			if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
				throw new AuthPayloadAuthenticationError(`${aad}:payload`)
			const key = createHmac("sha256", encryptionSecret)
				.update(
					JSON.stringify([
						"email-claim",
						String(envelope.row.email).trim().toLowerCase(),
					]),
				)
				.digest("hex")
			if (!envelope.deleted && key === email) {
				report.retained++
				continue
			}
			// Advancing the user version makes any delayed adoption CAS lose. Keep
			// operation receipts so its recovery cannot mistake uncertainty for success.
			const receipts: Receipt[] = codec.decode(current[1], `${aad}:receipts`)
			const fenced = await sql(
				"UPDATE doc.auth_user SET receipts=? WHERE id=? AND _seq_no=? AND _primary_term=?",
				[
					codec.encode(
						[
							...receipts,
							{
								operation: randomUUID(),
								baseSeq: Number(current[2]),
								at: new Date().toISOString(),
							},
						].slice(-256),
						`${aad}:receipts`,
					),
					id,
					current[2],
					current[3],
				],
			)
			if (fenced.rowcount !== 1) {
				report.conflicted++
				continue
			}
		} else {
			// Fence the abandoned operation. A fresh reservation may adopt this
			// missing-user barrier by CAS, including a forced Supabase id.
			try {
				const fenced = await sql(
					"INSERT INTO doc.auth_user (id,payload,deleted,receipts) VALUES (?,?,true,?)",
					[
						id,
						codec.encode(
							{
								row: { id },
								deleted: true,
								deletedAt: new Date().toISOString(),
								abandonedClaim: String(claim[1]),
							},
							`${aad}:payload`,
						),
						codec.encode([], `${aad}:receipts`),
					],
				)
				if (fenced.rowcount !== 1) throw new IndeterminateAuthWriteError()
			} catch (error) {
				if (error instanceof CrateAuthRequestError && error.code === 4091) {
					report.conflicted++
					continue
				}
				throw error
			}
		}
		const released = await sql(
			"DELETE FROM doc.auth_user_email WHERE email_norm=? AND _seq_no=? AND _primary_term=?",
			[email, claim[2], claim[3]],
		)
		if (released.rowcount === 1) report.released++
		else report.conflicted++
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	return report
}

const retentionMs = 24 * 3600000
const expiringModels = new Set([
	"session",
	"verification",
	"oauthAccessToken",
	"oauthRefreshToken",
	"oauthClientAssertion",
])


/** Each page is bounded independently of table size; all decisions use authenticated PK reads. */
export async function collectAuthGarbage(
	options: Options & { model: string; now?: Date },
) {
	const { sql, model, cursor } = options
	if (!authModels.includes(model))
		throw new Error("Unsupported maintenance model")
	const size = batchSize(options.batchSize)
	const now = options.now ?? new Date()
	if (!Number.isFinite(now.getTime()))
		throw new Error("Invalid maintenance time")
	const codec = authPayloadCodec(
		options.encryptionSecret,
		options.encryptionKeys,
	)
	const name = authModelTable(model)
	await sql(`REFRESH TABLE ${name}`)
	const page = await sql(
		`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		expired: 0,
		archived: 0,
		compacted: 0,
		repaired: 0,
		purged: 0,
		conflicted: 0,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const id = String(value)
		report.cursor = id
		report.scanned++
		const current = (
			await sql(
				`SELECT payload,receipts,_seq_no,_primary_term,lookup,deleted FROM ${name} WHERE id=?`,
				[id],
			)
		).rows[0]
		if (!current) continue
		const envelope: Envelope = codec.decode(current[0], `${name}:${id}:payload`)
		if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
			throw new AuthPayloadAuthenticationError(`${name}:${id}:payload`)
		const receipts: Receipt[] = codec.decode(
			current[1],
			`${name}:${id}:receipts`,
		)
		const archiveRefresh =
			!envelope.deleted &&
			model === "oauthRefreshToken" &&
			Boolean(envelope.row.revoked) &&
			typeof envelope.row.rotatedAt === "string" &&
			typeof envelope.row.rotationReplayExpiresAt === "string" &&
			new Date(envelope.row.rotationReplayExpiresAt).getTime() <=
				now.getTime() &&
			(!envelope.archived || envelope.row.rotationReplayResponse != null)
		const expired =
			!envelope.deleted &&
			(expiringModels.has(model) || model === "jwks") &&
			typeof envelope.row.expiresAt === "string" &&
			new Date(envelope.row.expiresAt).getTime() +
				(model === "jwks" ? 86400000 : 0) <=
				now.getTime()
		if (
			envelope.deleted &&
			envelope.deletedAt &&
			now.getTime() - new Date(envelope.deletedAt).getTime() >= 30 * 86400000
		) {
            // Thirty days exceeds the database-enforced fifteen-minute insert lease.
            // CAS deletion cannot remove a concurrently recreated logical record.
            await releaseAuthAdmission(sql,codec,id,envelope.admission)
			const result = await sql(
				`DELETE FROM ${name} WHERE id=? AND _seq_no=? AND _primary_term=?`,
				[id, current[2], current[3]],
			)
			if (result.rowcount === 1) report.purged++
			else report.conflicted++
			continue
		}
		const kept = receipts
			.filter(
				(receipt) =>
					!receipt.at ||
					now.getTime() - new Date(receipt.at).getTime() < retentionMs,
			)
			.map((receipt) =>
				receipt.at ? receipt : { ...receipt, at: now.toISOString() },
			)
		let next: Envelope = expired
			? {
					...envelope,
					row: { id },
					emailClaim: undefined,
					deleted: true,
					archived: false,
					deletedAt: now.toISOString(),
				}
			: archiveRefresh
				? {
						...envelope,
						archived: true,
						row: { ...envelope.row, rotationReplayResponse: null },
					}
				: envelope.deleted && !envelope.deletedAt
					? { ...envelope, deletedAt: now.toISOString() }
					: envelope
        if ((next.deleted || next.archived) && next.admission && (next.admissionFence ?? 0) < next.admission.generation)
            next = {...next, admissionFence:next.admission.generation}
		const hints = next.deleted || next.archived ? {} : authLookupHints(model, next.row, options.encryptionSecret)
		const repaired =
			Boolean(envelope.deleted || envelope.archived) !== current[5] || !isDeepStrictEqual(hints, current[4])
		if (
			!expired &&
			next === envelope &&
			JSON.stringify(kept) === JSON.stringify(receipts) &&
			!repaired
		) {
            if(next.deleted || next.archived) await releaseAuthAdmission(sql,codec,id,next.admission)
            continue
        }
		const compacted = kept.length < receipts.length
		const result = await sql(
			`UPDATE ${name} SET payload=?,receipts=?,deleted=?,lookup=?,created_at=?,expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
			[
				codec.encode(next, `${name}:${id}:payload`),
				codec.encode(kept, `${name}:${id}:receipts`),
				Boolean(next.deleted || next.archived),
				hints,
				next.deleted ? null : (envelope.row.createdAt ?? null),
				next.deleted ? null : (envelope.row.expiresAt ?? null),
				id,
				current[2],
				current[3],
			],
		)
		if (result.rowcount === 1) {
            if(next.deleted || next.archived) await releaseAuthAdmission(sql,codec,id,next.admission)
			if (expired) report.expired++
			if (archiveRefresh && !expired) report.archived++
			if (compacted) report.compacted++
			if (repaired) report.repaired++
		} else report.conflicted++
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	return report
}

/** Reclaim admission slots only after a permanent generation fence prevents late insertion. */
export async function reconcileAuthCapacity(options: Options) {
	const { sql, cursor } = options
	const codec = authPayloadCodec(
		options.encryptionSecret,
		options.encryptionKeys,
	)
	const size = batchSize(options.batchSize)
	const now = options.now ?? new Date()
	if (!Number.isFinite(now.getTime()))
		throw new Error("Invalid maintenance time")
	await sql("REFRESH TABLE doc.auth_capacity")
	const page = await sql(
		`SELECT id FROM doc.auth_capacity ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		released: 0,
		retained: 0,
		conflicted: 0,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const bucket = String(value)
		report.cursor = bucket
		const model = bucket.split(":")[0]
		if (!authModels.includes(model) || model === "user")
			throw new Error("Invalid auth capacity bucket")
		const name = authModelTable(model)
		const capacity = await readCapacity(sql, codec, bucket)
		if (!capacity) continue
		for (const [id, slot] of Object.entries(capacity.ledger.slots)) {
            try {
			report.scanned++
			const aad = `${name}:${id}`
			const current = (
				await sql(
					`SELECT payload,_seq_no,_primary_term FROM ${name} WHERE id=?`,
					[id],
				)
			).rows[0]
			if (current) {
				const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
				if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
					throw new AuthPayloadAuthenticationError(`${name}:${id}:payload`)
				if (!envelope.deleted && !envelope.archived) {
					report.retained++
					continue
				}
				const fenced = await sql(
					`UPDATE ${name} SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
					[
						codec.encode(
							{
								...envelope,
								admissionFence: Math.max(
									envelope.admissionFence ?? 0,
									slot.generation,
								),
							},
							`${aad}:payload`,
						),
						id,
						current[1],
						current[2],
					],
				)
				if (fenced.rowcount !== 1) {
					report.conflicted++
					continue
				}
			} else {
				if (now.getTime() - new Date(slot.createdAt).getTime() < 15 * 60000) {
					report.retained++
					continue
				}
				try {
					const fenced = await sql(
						`INSERT INTO ${name} (id,payload,deleted,receipts) VALUES (?,?,true,?)`,
						[
							id,
							codec.encode(
								{
									row: { id },
									deleted: true,
									deletedAt: now.toISOString(),
									admissionFence: slot.generation,
								},
								`${aad}:payload`,
							),
							codec.encode([], `${aad}:receipts`),
						],
					)
					if (fenced.rowcount !== 1) throw new IndeterminateAuthWriteError()
				} catch (error) {
					if (error instanceof CrateAuthRequestError && error.code === 4091) {
						report.conflicted++
						continue
					}
					throw error
				}
			}
			let released = false
			for (let attempt = 0; attempt < 64; attempt++) {
				const latest = await readCapacity(sql, codec, bucket)
				if (
					!latest ||
					latest.ledger.slots[id]?.generation !== slot.generation
				) {
					released = true
					break
				}
				const slots = { ...latest.ledger.slots }
				delete slots[id]
				const result = await sql(
					"UPDATE doc.auth_capacity SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?",
					[
						codec.encode(
							{ row: { ...latest.ledger, slots }, deleted: false },
							`doc.auth_capacity:${bucket}:payload`,
						),
						bucket,
						latest.seq,
						latest.term,
					],
				)
				if (result.rowcount === 1) {
					released = true
					break
				}
			}
			if (released) report.released++
			else report.conflicted++
            } catch(error) {
                skipRow(error, options)
                report.skipped++
            }
		}
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	return report
}

/** Launch requires every page to be safe. Existing prerelease/import rows must be admitted offline. */
export async function auditAuthPopulation(
	options: Options & { model: string },
) {
	const { sql, model, cursor } = options
	if (!authModels.includes(model))
		throw new Error("Unsupported maintenance model")
	const codec = authPayloadCodec(
		options.encryptionSecret,
		options.encryptionKeys,
	)
	const size = batchSize(options.batchSize)
	const name = authModelTable(model)
	await sql(`REFRESH TABLE ${name}`)
	const page = await sql(
		`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		live: 0,
		unadmitted: 0,
		inconsistent: 0,
		safe: true,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const id = String(value)
		report.scanned++
		report.cursor = id
		const current = (
			await sql(`SELECT payload,deleted,receipts FROM ${name} WHERE id=?`, [id])
		).rows[0]
		if (!current) continue
		const envelope: Envelope = codec.decode(current[0], `${name}:${id}:payload`)
		if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
			throw new AuthPayloadAuthenticationError(`${name}:${id}:payload`)
		codec.decode(current[2], `${name}:${id}:receipts`)
		if (Boolean(envelope.deleted || envelope.archived) !== current[1])
			report.inconsistent++
		if (envelope.deleted || envelope.archived) continue
		report.live++
		const actor = authPopulationActor(model, envelope.row)
		if (actor === undefined) continue // No site-wide member or anonymous-registration ceiling.
		if (!envelope.admission) {
			report.unadmitted++
			continue
		}
		const capacity = await readCapacity(sql, codec, envelope.admission.bucket)
		if (
			capacity?.ledger.slots[id]?.generation !==
				envelope.admission.generation ||
			capacity.ledger.bounds.buckets !== authActorBounds(model).buckets ||
			capacity.ledger.bounds.limitPerBucket !==
				authActorBounds(model).limitPerBucket ||
			envelope.admission.bucket !== authCapacityBucket(model, id, capacity.ledger.bounds, actor) ||
			Object.keys(capacity.ledger.slots).length > capacity.ledger.bounds.limitPerBucket
		)
			report.inconsistent++
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	report.safe = report.skipped === 0 && report.unadmitted === 0 && report.inconsistent === 0
	return report
}

/** Rewrite encrypted envelopes by CAS; do not change logical records, indexes or receipt ownership. */
export async function rotateAuthEncryption(
	options: Options & { model: string },
) {
	const { sql, model, cursor } = options
	if (![...authModels, "capacity"].includes(model))
		throw new Error("Unsupported maintenance model")
	if (!options.encryptionKeys)
		throw new Error(
			"A versioned auth encryption key ring is required for rotation",
		)
	const codec = authPayloadCodec(
		options.encryptionSecret,
		options.encryptionKeys,
	)
	const size = batchSize(options.batchSize)
	const name = authModelTable(model)
	await sql(`REFRESH TABLE ${name}`)
	const page = await sql(
		`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		rotated: 0,
		conflicted: 0,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const id = String(value)
		report.scanned++
		report.cursor = id
		const current = (
			await sql(
				`SELECT payload,receipts,_seq_no,_primary_term FROM ${name} WHERE id=?`,
				[id],
			)
		).rows[0]
		if (!current) continue
		const aad = `${name}:${id}`
		// Authenticate both even when already at the active key. An audit must not
		// certify a forged key id or leave an undecryptable receipt behind.
		const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
		if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
			throw new AuthPayloadAuthenticationError(`${name}:${id}:payload`)
		const receipts = codec.decode(current[1], `${aad}:receipts`)
		if (codec.usesActiveKey(current[0]) && codec.usesActiveKey(current[1]))
			continue
		const result = await sql(
			`UPDATE ${name} SET payload=?,receipts=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
			[
				codec.encode(envelope, `${aad}:payload`),
				codec.encode(receipts, `${aad}:receipts`),
				id,
				current[2],
				current[3],
			],
		)
		if (result.rowcount === 1) report.rotated++
		else report.conflicted++
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	return report
}

export const reconcilableAuthModels = [
	"user",
	"account",
	"session",
	"oauthClient",
	"oauthConsent",
	"oauthClientResource",
	"oauthRefreshToken",
	"oauthAccessToken",
]

/** Remove leftovers of multi-row auth operations. Authorization remains authoritative between sweeps. */
export async function reconcileAuthRows(
	options: Options & {
		model: string
		storage?: { delete(key: string): Promise<unknown> }
	},
) {
	const { sql, model, cursor } = options
	if (!reconcilableAuthModels.includes(model))
		throw new Error("Unsupported reconciliation model")
	const codec = authPayloadCodec(
		options.encryptionSecret,
		options.encryptionKeys,
	)
	const size = batchSize(options.batchSize)
	const now = options.now ?? new Date()
	if (!Number.isFinite(now.getTime()))
		throw new Error("Invalid maintenance time")
	const read = async (parentModel: string, id: string) => {
		const name = authModelTable(parentModel)
		const stored = (
			await sql(
				`SELECT payload,receipts,_seq_no,_primary_term FROM ${name} WHERE id=?`,
				[id],
			)
		).rows[0]
		if (!stored) return null
		const envelope: Envelope = codec.decode(stored[0], `${name}:${id}:payload`)
		if (envelope.row.id !== id || typeof envelope.deleted !== "boolean")
			throw new AuthPayloadAuthenticationError(`${name}:${id}:payload`)
		return {
			envelope,
			receipts: codec.decode(stored[1], `${name}:${id}:receipts`) as Receipt[],
			seq: stored[2],
			term: stored[3],
		}
	}
	const remove = async (
		targetModel: string,
		id: string,
		stored: NonNullable<Awaited<ReturnType<typeof read>>>,
	) => {
		const name = authModelTable(targetModel)
		const envelope: Envelope = {
			...stored.envelope,
			row: { id },
			deleted: true,
            admissionFence: Math.max(stored.envelope.admissionFence ?? 0, stored.envelope.admission?.generation ?? 0),
			deletedAt: now.toISOString(),
			emailClaim: undefined,
		}
		const receipts = [
			...stored.receipts,
			{
				operation: randomUUID(),
				baseSeq: Number(stored.seq),
				at: now.toISOString(),
			},
		].slice(-256)
		const removed = (
			(
				await sql(
					`UPDATE ${name} SET payload=?,receipts=?,deleted=true,lookup=?,created_at=NULL,expires_at=NULL WHERE id=? AND _seq_no=? AND _primary_term=?`,
					[
						codec.encode(envelope, `${name}:${id}:payload`),
						codec.encode(receipts, `${name}:${id}:receipts`),
						{},
						id,
						stored.seq,
						stored.term,
					],
				)
			).rowcount === 1
		)
        if(removed && targetModel === "user" && typeof stored.envelope.row.email === "string" && stored.envelope.emailClaim) {
            const email = createHmac("sha256",options.encryptionSecret).update(JSON.stringify(["email-claim",stored.envelope.row.email.trim().toLowerCase()])).digest("hex")
            const claim = (await sql("SELECT user_id,operation_id,_seq_no,_primary_term FROM doc.auth_user_email WHERE email_norm=?",[email])).rows[0]
            if(claim?.[0] === id && claim[1] === stored.envelope.emailClaim)
                await sql("DELETE FROM doc.auth_user_email WHERE email_norm=? AND _seq_no=? AND _primary_term=?",[email,claim[2],claim[3]])
        }
        if(removed) await releaseAuthAdmission(sql,codec,id,envelope.admission)
        return removed
	}
	const name = authModelTable(model)
	await sql(`REFRESH TABLE ${name}`)
	const page = await sql(
		`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`,
		cursor === undefined ? [] : [cursor],
	)
	const report = {
		skipped: 0,
		scanned: 0,
		removed: 0,
		conflicted: 0,
		cursor: null as string | null,
		complete: page.rows.length <= size,
	}
	for (const [value] of page.rows.slice(0, size)) {
        try {
		const id = String(value)
		report.scanned++
		report.cursor = id
		const current = await read(model, id)
		if (!current || current.envelope.deleted) continue
		const row = current.envelope.row
		const user =
			typeof row.userId === "string" ? await read("user", row.userId) : null
		let orphan =
			(model === "account" || model === "session") &&
			(!user ||
				user.envelope.deleted ||
				(model === "session" && !user.envelope.row.emailVerified))
		if (
			model === "session" &&
			typeof row.credentialVersion === "string" &&
			!orphan
		) {
			const credentialId = createHash("sha256")
				.update(JSON.stringify(["credential", row.userId]))
				.digest("hex")
			const credential = await read("account", credentialId)
			const password =
				credential &&
				!credential.envelope.deleted &&
				typeof credential.envelope.row.password === "string"
					? credential.envelope.row.password
					: null
			orphan ||=
				row.credentialVersion !==
				authCredentialVersion(options.encryptionSecret, password)
		}
        if(model === "user") orphan = row.emailVerified === false && typeof row.createdAt === "string" && now.getTime()-new Date(row.createdAt).getTime() >= 48*3600000
		if (model === "oauthClient" && typeof row.userId === "string")
			orphan = !user || user.envelope.deleted
        if(model === "oauthClient" && !current.envelope.authorizedAt && typeof row.createdAt === "string" && now.getTime()-new Date(row.createdAt).getTime() >= 24*3600000)
            orphan = true
		if (
			[
				"oauthConsent",
				"oauthRefreshToken",
				"oauthAccessToken",
				"oauthClientResource",
			].includes(model)
		) {
			const client =
				typeof row.clientId === "string"
					? await read("oauthClient", row.clientId)
					: null
			orphan =
				!client ||
				client.envelope.deleted ||
				client.envelope.row.disabled === true
			if (model !== "oauthClientResource")
				orphan ||=
					!user || user.envelope.deleted || !user.envelope.row.emailVerified
			else {
				const resource =
					typeof row.resourceId === "string"
						? await read("oauthResource", row.resourceId)
						: null
				orphan ||= !resource || resource.envelope.deleted
			}
		}
		if (["oauthRefreshToken", "oauthAccessToken"].includes(model) && !orphan) {
			const grantId = createHash("sha256")
				.update(
					JSON.stringify([row.clientId, row.userId, row.referenceId ?? null]),
				)
				.digest("hex")
			const consent = await read("oauthConsent", grantId)
			orphan = !consent || consent.envelope.deleted
			if (consent && !orphan) {
				const grant = consent.envelope.row
				if (model === "oauthRefreshToken") {
					if (row.grantVersion)
						orphan ||= row.grantVersion !== grant.grantVersion
					else if (typeof row.createdAt === "string")
						orphan ||=
							now.getTime() - new Date(row.createdAt).getTime() >= 15 * 60000
					// Reconcile pre-fence/failed revocations too. Do not confuse ordinary
					// rotation with terminal revocation; replay parents stay until expiry.
					if (
						row.revoked &&
						!row.rotatedAt &&
						row.grantVersion === grant.grantVersion
					) {
						if (!(await remove("oauthConsent", grantId, consent))) {
							report.conflicted++
							continue
						}
						orphan = true
					}
				}
				if (Array.isArray(row.scopes))
					orphan ||= !row.scopes.every(
						(scope) =>
							Array.isArray(grant.scopes) && grant.scopes.includes(scope),
					)
				if (Array.isArray(row.resources))
					orphan ||= !row.resources.every(
						(resource) =>
							Array.isArray(grant.resources) &&
							grant.resources.includes(resource),
					)
			}
			if (
				typeof row.sessionId === "string" &&
				!(Array.isArray(row.scopes) && row.scopes.includes("offline_access"))
			) {
				const session = await read("session", row.sessionId)
				orphan ||=
					!session ||
					session.envelope.deleted ||
					typeof session.envelope.row.expiresAt !== "string" ||
					new Date(session.envelope.row.expiresAt).getTime() <= now.getTime()
			}
		}
		if (!orphan) continue
		if (await remove(model, id, current)) {
			report.removed++
			if (model === "session" && typeof row.token === "string")
				await options.storage?.delete(row.token)
		} else report.conflicted++
        } catch(error) {
            skipRow(error, options)
            report.skipped++
        }
	}
	return report
}

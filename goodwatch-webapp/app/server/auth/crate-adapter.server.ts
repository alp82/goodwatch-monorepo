import { createHash, createHmac, randomUUID } from "node:crypto"
import { createAdapterFactory } from "better-auth/adapters"
import type { CleanedWhere, CustomAdapter } from "better-auth/adapters"
import { assertAuthShape, assertAuthMutation } from "./call-shapes.server.ts"
import { authPayloadCodec } from "./payload-codec.server.ts"

export type SqlResult = { rows: unknown[][]; rowcount: number; cols: string[] }
export type AuthSql = (statement: string, args?: unknown[]) => Promise<SqlResult>
const localTransports = new WeakSet<AuthSql>()

// This transport never logs credential-bearing SQL or parameters.
export class CrateAuthRequestError extends Error {
	readonly code?: number
	readonly status?: number
	readonly definitelyNotApplied: boolean
	constructor(message: string, code?: number, status?: number, definitelyNotApplied = false) {
		super(message); this.name = "CrateAuthRequestError"
		this.code = code; this.status = status; this.definitelyNotApplied = definitelyNotApplied
	}
}
export function crateAuthTransport(urls: string[], timeoutMs = 15_000, credentials?: { username: string; password: string }): AuthSql {
	if (!urls.length || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Invalid auth CrateDB transport configuration")
	for (const address of urls) {
		const url = new URL(address)
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Auth CrateDB endpoint must be an HTTP origin")
	}
	const headers: Record<string, string> = { "content-type": "application/json" }
	if (credentials) headers.authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`
	let next = 0
	return async (stmt, args = []) => {
		const read = /^(SELECT|REFRESH TABLE)\b/.test(stmt)
		let error: unknown
		for (let attempt = 0; attempt < urls.length; attempt++) {
			try {
				const response = await fetch(`${urls[next++ % urls.length].replace(/\/$/, "")}/_sql`, {
					method: "POST", headers, body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(timeoutMs),
				})
				const result = await response.json()
				if (!response.ok || result.error) throw new CrateAuthRequestError(result.error?.message ?? "CrateDB auth statement refused", result.error?.code, response.status, response.status >= 400 && response.status < 500)
				return result
			} catch (failure) {
				const code = (failure as { cause?: { code?: string } }).cause?.code
				const notSent = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code ?? "")
				error = notSent ? new CrateAuthRequestError("Could not connect to CrateDB auth coordinator", undefined, undefined, true) : failure
				// Retry writes only when connection establishment failed before sending.
				if (!read && !notSent) throw error
			}
		}
		throw error
	}
}

export function localCrateTransport(urls: string[], timeoutMs = 15_000): AuthSql {
	for (const url of urls) if (!/^http:\/\/127\.0\.0\.1:15(5|7)(48|49|50)$/.test(url)) throw new Error("Local auth test endpoint required")
	const sql = crateAuthTransport(urls, timeoutMs)
	localTransports.add(sql)
	return sql
}

const table = (model: string) => {
	if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(model)) throw new Error("Invalid auth model name")
	return `doc.auth_${model.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`
}
const digest = (...parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex")
const normalizeEmail = (value: unknown) => String(value).trim().toLowerCase()
type Row = Record<string, any>
const models = ["user", "account", "session", "verification", "jwks", "oauthClient", "oauthResource", "oauthClientResource", "oauthConsent", "oauthAccessToken", "oauthRefreshToken", "oauthClientAssertion", "rateLimit"]
const indexedFields = ["userId", "clientId", "sessionId", "referenceId", "resourceId", "identifier", "refreshId", "authorizationCodeId", "lastRequest", "count"]
const lookup = (row: Row) => Object.fromEntries(indexedFields.map(field => [field, row[field] ?? null]))
type Receipt = { operation: string; baseSeq: number }
type Stored = { row: Row; seq: number; term: number; deleted: boolean; receipts: Receipt[]; emailClaim?: string }
export class IndeterminateAuthWriteError extends Error {
	constructor() { super("Auth write outcome is indeterminate; do not retry the logical operation"); this.name = "IndeterminateAuthWriteError" }
}
export class AuthMutationConflictError extends Error {
	constructor() { super("Auth mutation conflicted; the requested update or revocation did not complete"); this.name = "AuthMutationConflictError" }
}
const decode = (text: unknown): Row => JSON.parse(String(text), (key, value) =>
	typeof value === "string" && /At$/.test(key) && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value) : value)

export async function migrateAuthTables(sql: AuthSql, additionalModels: string[] = []) {
	if (additionalModels.length && !localTransports.has(sql)) throw new Error("Additional tables require the disposable local transport")
	for (const model of new Set([...models, ...additionalModels])) await sql(`CREATE TABLE IF NOT EXISTS ${table(model)} (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF NOT NULL,
		lookup OBJECT(STRICT) AS (${indexedFields.map(field => `"${field}" ${["lastRequest", "count"].includes(field) ? "DOUBLE PRECISION" : "TEXT"}`).join(",")}),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
	await sql(`CREATE TABLE IF NOT EXISTS doc.auth_user_email (
		email_norm TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_id TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL, user_seq LONG NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
}

export function crateAuthAdapter({ sql, testOnlyConformance = false, maxEnumeration = 10000, encryptionSecret }: { sql: AuthSql; testOnlyConformance?: boolean; maxEnumeration?: number; encryptionSecret?: string }) {
	if (testOnlyConformance && !localTransports.has(sql)) throw new Error("Conformance mode requires the disposable local transport")
	if (!Number.isSafeInteger(maxEnumeration) || maxEnumeration < 1 || maxEnumeration > 10000) throw new Error("Invalid auth enumeration bound")
	if (!encryptionSecret && !localTransports.has(sql)) throw new Error("Auth payload encryption secret is required")
	const payloadSecret = encryptionSecret ?? "disposable-local-auth-integration-key-548"
	const codec = authPayloadCodec(payloadSecret)
	const privateKey = (purpose: string, value: unknown) => createHmac("sha256", payloadSecret).update(JSON.stringify([purpose, value])).digest("hex")
	const emailKey = (email: unknown) => privateKey("email-claim", normalizeEmail(email))
	return createAdapterFactory({
		config: { adapterId: "goodwatch-cratedb", adapterName: "Strict CrateDB", supportsDates: true,
			supportsBooleans: true, supportsJSON: true, supportsArrays: true, transaction: false },
		adapter: context => {
			const defaultLimit = context.options.advanced?.database?.defaultFindManyLimit ?? 100
			const modes = { verification: !context.options.secondaryStorage || context.options.verification?.storeInDatabase === true,
				rateLimit: context.options.rateLimit?.storage === "database", preserveSessions: context.options.session?.preserveSessionInDatabase === true }
			if (context.options.secondaryStorage && context.options.session?.storeSessionInDatabase !== true) throw new Error("CrateDB session mirror is required")
			const decodeRow = (model: string, payload: unknown): Row => {
				const { __emailClaim, ...row } = codec.decode(payload)
				for (const [field, attributes] of Object.entries(context.schema[model]?.fields ?? {})) if (attributes.type === "date" && row[field] != null) row[field] = new Date(row[field])
				return row
			}
			const releaseEmail = async (email: unknown, userId: string, operation?: string) => {
				if (!operation) return
				for (let attempt = 0; attempt < 64; attempt++) {
					const claim = (await sql("SELECT user_id,operation_id,_seq_no,_primary_term FROM doc.auth_user_email WHERE email_norm=?", [emailKey(email)])).rows[0]
					if (!claim || claim[0] !== userId || claim[1] !== operation) return
					const result = await sql("DELETE FROM doc.auth_user_email WHERE email_norm=? AND _seq_no=? AND _primary_term=?", [emailKey(email), claim[2], claim[3]])
					if (result.rowcount === 1) return
				}
				throw new AuthMutationConflictError()
			}
			const reserveEmail = async (email: string, userId: string, operation: string, generation: number, creating = false): Promise<string> => {
				try {
					const inserted = await sql("INSERT INTO doc.auth_user_email (email_norm,user_id,operation_id,created_at,user_seq) VALUES (?,?,?,?,?)", [emailKey(email), userId, operation, new Date(), generation])
					if (inserted.rowcount !== 1) throw new IndeterminateAuthWriteError()
					return operation
				} catch (error) {
					if (error instanceof CrateAuthRequestError && error.definitelyNotApplied && error.code !== 4091) throw error
					const claim = (await sql("SELECT user_id,operation_id,user_seq,_seq_no,_primary_term FROM doc.auth_user_email WHERE email_norm=?", [emailKey(email)])).rows[0]
					if (claim?.[1] === operation) return operation
					if ((error as { code?: number }).code === 4091 && !creating && claim?.[0] === userId) {
						// Monotonic user versions fence delayed address release and ABA changes.
						if (Number(claim[2]) > generation) throw new AuthMutationConflictError()
						const changed = await sql("UPDATE doc.auth_user_email SET operation_id=?,user_seq=? WHERE email_norm=? AND _seq_no=? AND _primary_term=?", [operation, generation, emailKey(email), claim[3], claim[4]])
						if (changed.rowcount === 1) return operation
						throw new AuthMutationConflictError()
					}
					if ((error as { code?: number }).code === 4091) throw Object.assign(new Error("duplicate key: email"), { code: "23505" })
					throw new IndeterminateAuthWriteError()
				}
			}
			const stored = async (model: string, id: string): Promise<Stored | null> => {
				if (!models.includes(model) && !(testOnlyConformance && context.schema[model])) throw new Error("Unsupported auth model")
				const result = await sql(`SELECT payload,_seq_no,_primary_term,deleted,receipts FROM ${table(model)} WHERE id = ?`, [id])
				if (!result.rows.length) return null
				const [payload, seq, term, deleted, receipts] = result.rows[0]
				return { row: decodeRow(model, payload), seq: Number(seq), term: Number(term), deleted: Boolean(deleted), receipts: codec.decode(receipts), emailClaim: codec.decode(payload).__emailClaim }
			}
			const key = (model: string, row: Row): string => {
				switch (model) {
					case "account": return digest(row.providerId, row.accountId)
					case "session": case "oauthAccessToken": case "oauthRefreshToken": return digest(row.token)
					case "oauthClient": return String(row.clientId)
					case "oauthResource": return String(row.identifier)
					case "oauthClientResource": return digest(row.clientId, row.resourceId)
					case "oauthConsent": return digest(row.clientId, row.userId, row.referenceId ?? null)
					case "rateLimit": return String(row.key)
					default: return String(row.id)
				}
			}
			const candidates = async (model: string, where: CleanedWhere[]): Promise<Stored[]> => {
				const eq = Object.fromEntries(where.filter(p => p.operator === "eq").map(p => [p.field, p.value]))
				let ids: string[] | undefined
				if (testOnlyConformance && where.some(p => p.connector === "OR" || p.mode === "insensitive")) { /* Use refreshed enumeration in the generic test suite. */ }
				else if (eq.id !== undefined) ids = [String(eq.id)]
				else if (model === "user" && eq.email !== undefined) {
					const claim = await sql("SELECT user_id FROM doc.auth_user_email WHERE email_norm = ?", [emailKey(eq.email)])
					ids = claim.rows.map(r => String(r[0]))
					if (!testOnlyConformance) where = where.map(p => p.field === "email" ? { ...p, value: normalizeEmail(p.value) } : p)
				} else if (["session", "oauthAccessToken", "oauthRefreshToken"].includes(model) && eq.token !== undefined) ids = [digest(eq.token)]
				else if (model === "account" && eq.providerId !== undefined && eq.accountId !== undefined) ids = [digest(eq.providerId, eq.accountId)]
				else if (model === "oauthClient" && eq.clientId !== undefined) ids = [String(eq.clientId)]
				else if (model === "oauthResource" && eq.identifier !== undefined) ids = [String(eq.identifier)]
				else if (model === "oauthClientResource" && eq.clientId !== undefined && eq.resourceId !== undefined) ids = [digest(eq.clientId, eq.resourceId)]
				else if (model === "oauthConsent" && eq.clientId !== undefined && eq.userId !== undefined && eq.referenceId !== undefined) ids = [digest(eq.clientId, eq.userId, eq.referenceId)]
				else if (model === "rateLimit" && eq.key !== undefined) ids = [String(eq.key)]
				const batch = where.find(p => p.operator === "in" && ["id", "token", "clientId", "identifier"].includes(p.field))
				if (!ids && batch && !testOnlyConformance) ids = (batch.value as string[]).map(value => batch.field === "token" ? digest(value) : String(value))
				if (!ids) {
					await sql(`REFRESH TABLE ${table(model)}`)
					const filters: string[] = [], args: unknown[] = []
					if (!where.some(p => p.connector === "OR" || p.mode === "insensitive")) for (const p of where) {
						const column = p.field === "expiresAt" ? "expires_at" : indexedFields.includes(p.field) ? `lookup['${p.field}']` : undefined
						if (!column) continue
						if (p.value === null && p.operator === "eq") { filters.push(`${column} IS NULL`); continue }
						if (p.operator === "in") {
							const values = p.value as unknown[]
							filters.push(values.length ? `${column} IN (${values.map(() => "?").join(",")})` : "false")
							args.push(...values)
						} else {
							const operator = { eq: "=", lt: "<", lte: "<=", gt: ">", gte: ">=" }[p.operator as "eq"]
							if (operator) { filters.push(`${column} ${operator} ?`); args.push(p.value) }
						}
					}
					ids = []
					let after: string | undefined
					for (;;) {
						const pageSize = Math.min(100, maxEnumeration + 1 - ids.length)
						const page = await sql(`SELECT id FROM ${table(model)} WHERE deleted = false ${filters.length ? `AND ${filters.join(" AND ")}` : ""} ${after === undefined ? "" : "AND id > ?"} ORDER BY id LIMIT ${pageSize}`, after === undefined ? args : [...args, after])
						ids.push(...page.rows.map(r => String(r[0])))
						if (ids.length > maxEnumeration) throw new Error("Auth enumeration exceeds safe bound")
						if (page.rows.length < pageSize) break
						after = ids.at(-1)
					}
				}
				const result: Stored[] = []
				for (const id of new Set(ids)) {
					const value = await stored(model, id)
					if (value && !value.deleted && matches(value.row, where)) result.push(value)
				}
				return result
			}
			const mutate = async (model: string, original: Stored, update: Row, deleting = false, replacing = false): Promise<Row | null> => {
				let emailClaim = original.emailClaim
				if (model === "user" && update.email !== undefined && update.email !== original.row.email) {
					update = { ...update, email: testOnlyConformance ? update.email : normalizeEmail(update.email) }
					try { emailClaim = await reserveEmail(update.email, original.row.id, digest(original.row.id, update.email, original.seq, original.term), original.seq) }
					catch (error) { if (error instanceof AuthMutationConflictError) return null; throw error }
				}
				const operation = randomUUID()
				const result = deleting ? original.row : replacing ? { ...update, id: original.row.id } : { ...original.row, ...update }
				if (key(model, result) !== key(model, original.row)) throw new Error("Auth lookup keys are immutable")
				// Receipts prove ownership; this invocation already knows its result.
				// Never retain historical credentials or an unbounded operation log.
				const receipts = [...original.receipts, { operation, baseSeq: original.seq }].slice(-256)
				const id = key(model, original.row)
				let response: SqlResult | undefined
				try {
					response = await sql(`UPDATE ${table(model)} SET payload=?, deleted=?, receipts=?, lookup=?, created_at=?, expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
						[codec.encode({ ...result, __emailClaim: emailClaim }), deleting, codec.encode(receipts), lookup(result), result.createdAt ?? null, result.expiresAt ?? null, id, original.seq, original.term])
				} catch (error) { if (error instanceof CrateAuthRequestError && error.definitelyNotApplied) throw error }
				if (response?.rowcount === 1) {
					if (model === "user" && (deleting || result.email !== original.row.email)) await releaseEmail(original.row.email, original.row.id, original.emailClaim)
					return result
				}
				let current: Stored | null
				try { current = await stored(model, id) } catch { throw new IndeterminateAuthWriteError() }
				const receipt = current?.receipts.find(r => r.operation === operation)
				if (receipt) {
					if (model === "user" && (deleting || result.email !== original.row.email)) await releaseEmail(original.row.email, original.row.id, original.emailClaim)
					return result
				}
				if (response?.rowcount === 0 && current && current.seq !== original.seq && original.seq >= (current.receipts[0]?.baseSeq ?? Infinity)) return null
				throw new IndeterminateAuthWriteError()
			}
			const assign = async (model: string, row: Stored, where: CleanedWhere[], update: Row, deleting = false): Promise<Row | null> => {
				for (let attempt = 0; attempt < 64; attempt++) {
					const result = await mutate(model, row, update, deleting)
					if (result) return result
					// Only a proven competing version reaches here. Re-evaluate every
					// predicate; never resurrect a deleted row or replay a logical delta.
					const current = await stored(model, key(model, row.row))
					if (!current || current.deleted || !matches(current.row, where)) return null
					row = current
				}
				throw new AuthMutationConflictError()
			}
			const requireCompleted = async (model: string, row: Stored, where: CleanedWhere[], update: Row, deleting = false) => Boolean(await assign(model, row, where, update, deleting))
			const adapter: CustomAdapter = {
				async create({ model, data }) {
					const row: Row = { ...data, id: data.id ?? randomUUID() }
					let emailClaim: string | undefined
					if (model === "user") {
						if (!testOnlyConformance) row.email = normalizeEmail(row.email)
						emailClaim = await reserveEmail(row.email, row.id, randomUUID(), -1, true)
					}
					row.id = key(model, row)
					const operation = randomUUID()
					try {
						const inserted = await sql(`INSERT INTO ${table(model)} (id,payload,created_at,expires_at,receipts,lookup) VALUES (?,?,?,?,?,?)`,
							[row.id, codec.encode({ ...row, __emailClaim: emailClaim }), row.createdAt ?? null, row.expiresAt ?? null, codec.encode([{ operation, baseSeq: -1 }]), lookup(row)])
						if (inserted.rowcount !== 1) throw new IndeterminateAuthWriteError()
					}
					catch (error) {
						if (error instanceof CrateAuthRequestError && error.definitelyNotApplied && error.code !== 4091) {
							if (model === "user") await releaseEmail(row.email, row.id, emailClaim)
							throw error
						}
						const existing = await stored(model, row.id)
						const receipt = existing?.receipts.find(r => r.operation === operation)
						if (receipt) return row as typeof data
						if ((error as { code?: number }).code === 4091 && existing?.deleted && ["account", "oauthConsent", "oauthClientResource", "oauthResource"].includes(model)) {
							const recreated = await mutate(model, existing, row, false, true)
							if (recreated) return recreated as typeof data
							throw Object.assign(new Error("duplicate key: auth association"), { code: "23505" })
						}
						if (model === "oauthConsent" && (error as { code?: number }).code === 4091 && existing && !existing.deleted) {
							const updated = await mutate(model, existing, { ...row, id: existing.row.id })
							if (updated) return updated as typeof data
							throw new IndeterminateAuthWriteError()
						}
						if ((error as { code?: number }).code === 4091) throw Object.assign(new Error("duplicate key: auth identity"), { code: "23505" })
						throw new IndeterminateAuthWriteError()
					}
					return row as typeof data
				},
				async findOne({ model, where }) {
					const rows = await candidates(model, where)
					if (!testOnlyConformance && rows.length > 1) throw new Error("Ambiguous auth lookup; supply the complete logical key")
					return rows[0]?.row as any ?? null
				},
				async findMany({ model, where = [], limit, offset = 0, sortBy }) {
					const rows = (await candidates(model, where)).map(v => v.row)
					if (sortBy) rows.sort((a,b) => (a[sortBy.field] > b[sortBy.field] ? 1 : a[sortBy.field] < b[sortBy.field] ? -1 : 0) * (sortBy.direction === "desc" ? -1 : 1))
					// Upstream hook pre-reads swallow errors and deleteMany ignores limits.
					// Return the complete bounded population for the factory default.
					if (!testOnlyConformance && limit === defaultLimit) return rows.slice(offset) as any
					return rows.slice(offset, offset + limit) as any
				},
				async consumeOne({ model, where }) {
					const row = (await candidates(model, where))[0]
					return row ? await mutate(model, row, {}, true) as any : null
				},
				async incrementOne({ model, where, increment, set = {} }) {
					const row = (await candidates(model, where))[0]
					if (!row) return null
					const update: Row = { ...set }
					for (const [field, delta] of Object.entries(increment)) {
						if (!Number.isFinite(delta) || typeof row.row[field] !== "number" || !Number.isFinite(row.row[field])) throw new Error("Invalid auth increment")
						update[field] = row.row[field] + delta
					}
					return await mutate(model, row, update) as any
				},
				async update({ model, where, update }) {
					if (!where.length) return null
					const row = (await candidates(model, where))[0]
					return row ? await assign(model, row, where, update as Row) as any : null
				},
				async updateMany({ model, where, update }) {
					let count = 0
					for (const row of await candidates(model, where)) if (await requireCompleted(model, row, where, update)) count++
					return count
				},
				async delete({ model, where }) {
					const row = (await candidates(model, where))[0]
					if (row) await requireCompleted(model, row, where, {}, true)
				},
				async deleteMany({ model, where }) {
					let count = 0
					for (const row of await candidates(model, where)) if (await requireCompleted(model, row, where, {}, true)) count++
					return count
				},
				async count({ model, where = [] }) { return (await candidates(model, where)).length },
			}
			return Object.fromEntries(Object.entries(adapter).map(([action, fn]) => [action, async (input: any) => {
				const model = context.getDefaultModelName(input.model)
				const canonical = (data: Row) => Object.fromEntries(Object.entries(data).map(([field, value]) =>
					[context.getDefaultFieldName({ model, field }), value]))
				const where = (input.where ?? []).map((p: CleanedWhere) => ({ ...p, field: context.getDefaultFieldName({ model, field: p.field }) }))
				if (!testOnlyConformance) assertAuthShape(model, action, where, modes)
				const normalized = { ...input, model, where }
				for (const field of ["data", "update", "set", "increment"]) if (input[field]) normalized[field] = canonical(input[field])
				if (input.sortBy) normalized.sortBy = { ...input.sortBy, field: context.getDefaultFieldName({ model, field: input.sortBy.field }) }
				if (!testOnlyConformance) assertAuthMutation(model, action, normalized)
				const output = await fn(normalized)
				const selected = input.select?.map((field: string) => context.getDefaultFieldName({ model, field }))
				const mapped = (row: Row) => Object.fromEntries(Object.entries(row).filter(([field]) => !selected || selected.includes(field)).map(([field, value]) =>
					[context.getFieldName({ model, field }), value != null && context.schema[model]?.fields[field]?.type === "date" ? new Date(value) : value]))
				return Array.isArray(output) ? output.map(mapped) : output && typeof output === "object" ? mapped(output) : output
			}])) as unknown as CustomAdapter
		},
	})
}

function matches(row: Row, where: CleanedWhere[]) {
	const test = (p: CleanedWhere) => {
		let a = row[p.field] ?? null
		let b: any = p.value
		if (p.mode === "insensitive" && typeof a === "string") { a = a.toLowerCase(); b = Array.isArray(b) ? b.map(v => typeof v === "string" ? v.toLowerCase() : v) : typeof b === "string" ? b.toLowerCase() : b }
		switch (p.operator) {
			case "eq": return a instanceof Date ? a.getTime() === new Date(b as string).getTime() : a === b
			case "ne": return a !== b
			case "in": return Array.isArray(b) && b.includes(a)
			case "not_in": return Array.isArray(b) && !b.includes(a)
			case "contains": return typeof a === "string" && a.includes(String(b))
			case "starts_with": return typeof a === "string" && a.startsWith(String(b))
			case "ends_with": return typeof a === "string" && a.endsWith(String(b))
			case "lt": return a < b!
			case "lte": return a <= b!
			case "gt": return a > b!
			case "gte": return a >= b!
			default: throw new Error("Unsupported auth operator")
		}
	}
	const and = where.filter(p => p.connector !== "OR"), or = where.filter(p => p.connector === "OR")
	return and.every(test) && (!or.length || or.some(test))
}

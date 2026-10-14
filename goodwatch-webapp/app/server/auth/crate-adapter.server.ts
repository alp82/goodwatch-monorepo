import { createHash, randomUUID } from "node:crypto"
import { createAdapterFactory } from "better-auth/adapters"
import type { CleanedWhere, CustomAdapter } from "better-auth/adapters"
import { assertAuthShape } from "./call-shapes.server.ts"

export type SqlResult = { rows: unknown[][]; rowcount: number; cols: string[] }
export type AuthSql = (statement: string, args?: unknown[]) => Promise<SqlResult>
const localTransports = new WeakSet<AuthSql>()

// This isolated transport is for the disposable integration cluster only. The
// application supplies an AuthSql wrapper around its CrateClient.execute.
export function localCrateTransport(urls: string[], timeoutMs = 15_000): AuthSql {
	for (const url of urls) {
		if (!/^http:\/\/127\.0\.0\.1:155(48|49|50)$/.test(url)) throw new Error("Local auth test endpoint required")
	}
	let next = 0
	const sql: AuthSql = async (stmt, args = []) => {
		const response = await fetch(`${urls[next++ % urls.length]}/_sql`, {
			method: "POST", headers: { "content-type": "application/json" },
			body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(timeoutMs),
		})
		const result = await response.json()
		if (result.error) throw Object.assign(new Error("CrateDB auth statement refused"), { code: result.error.code })
		return result
	}
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
type Receipt = { operation: string; result: Row }
type Stored = { row: Row; seq: number; term: number; deleted: boolean; receipts: Receipt[] }
export class IndeterminateAuthWriteError extends Error {
	constructor() { super("Auth write outcome is indeterminate; do not retry the logical operation"); this.name = "IndeterminateAuthWriteError" }
}
const decode = (text: unknown): Row => JSON.parse(String(text), (key, value) =>
	typeof value === "string" && /At$/.test(key) && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value) : value)

export async function migrateAuthTables(sql: AuthSql, additionalModels: string[] = []) {
	if (additionalModels.length && !localTransports.has(sql)) throw new Error("Additional tables require the disposable local transport")
	for (const model of new Set([...models, ...additionalModels])) await sql(`CREATE TABLE IF NOT EXISTS ${table(model)} (
		id TEXT PRIMARY KEY, payload TEXT NOT NULL,
		lookup OBJECT(STRICT) AS (${indexedFields.map(field => `"${field}" ${["lastRequest", "count"].includes(field) ? "DOUBLE PRECISION" : "TEXT"}`).join(",")}),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT NOT NULL DEFAULT '[]'
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
	await sql(`CREATE TABLE IF NOT EXISTS doc.auth_user_email (
		email_norm TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_id TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
}

export function crateAuthAdapter({ sql, testOnlyConformance = false, maxEnumeration = 10000 }: { sql: AuthSql; testOnlyConformance?: boolean; maxEnumeration?: number }) {
	if (testOnlyConformance && !localTransports.has(sql)) throw new Error("Conformance mode requires the disposable local transport")
	if (!Number.isSafeInteger(maxEnumeration) || maxEnumeration < 1 || maxEnumeration > 10000) throw new Error("Invalid auth enumeration bound")
	return createAdapterFactory({
		config: { adapterId: "goodwatch-cratedb", adapterName: "Strict CrateDB", supportsDates: true,
			supportsBooleans: true, supportsJSON: true, supportsArrays: true, transaction: false },
		adapter: context => {
			const modes = { verification: !context.options.secondaryStorage || context.options.verification?.storeInDatabase === true,
				rateLimit: context.options.rateLimit?.storage === "database", preserveSessions: context.options.session?.preserveSessionInDatabase === true }
			if (context.options.secondaryStorage && context.options.session?.storeSessionInDatabase !== true) throw new Error("CrateDB session mirror is required")
			const decodeRow = (payload: unknown) => decode(payload)
			const reserveEmail = async (email: string, userId: string, creating = false) => {
				const operation = randomUUID()
				try {
					await sql("INSERT INTO doc.auth_user_email (email_norm,user_id,operation_id,created_at) VALUES (?,?,?,?)", [normalizeEmail(email), userId, operation, new Date()])
				} catch (error) {
					const claim = await sql("SELECT user_id,operation_id FROM doc.auth_user_email WHERE email_norm=?", [normalizeEmail(email)])
					if (claim.rows[0]?.[1] === operation || !creating && claim.rows[0]?.[0] === userId) return
					if ((error as { code?: number }).code === 4091) throw Object.assign(new Error("duplicate key: email"), { code: "23505" })
					throw new IndeterminateAuthWriteError()
				}
			}
			const stored = async (model: string, id: string): Promise<Stored | null> => {
				if (!models.includes(model) && !(testOnlyConformance && context.schema[model])) throw new Error("Unsupported auth model")
				const result = await sql(`SELECT payload,_seq_no,_primary_term,deleted,receipts FROM ${table(model)} WHERE id = ?`, [id])
				if (!result.rows.length) return null
				const [payload, seq, term, deleted, receipts] = result.rows[0]
				const row = decodeRow(payload)
				for (const [field, attributes] of Object.entries(context.schema[model]?.fields ?? {})) if (attributes.type === "date" && row[field] != null) row[field] = new Date(row[field])
				return { row, seq: Number(seq), term: Number(term), deleted: Boolean(deleted), receipts: JSON.parse(String(receipts)) }
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
					const claim = await sql("SELECT user_id FROM doc.auth_user_email WHERE email_norm = ?", [normalizeEmail(eq.email)])
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
					const result = await sql(`SELECT id,payload FROM ${table(model)} WHERE deleted = false ${filters.length ? `AND ${filters.join(" AND ")}` : ""} ORDER BY id LIMIT ${maxEnumeration + 1}`, args)
					if (result.rows.length > maxEnumeration) throw new Error("Auth enumeration exceeds safe bound")
					ids = result.rows.filter(r => matches(decode(r[1]), where)).map(r => String(r[0]))
				}
				const result: Stored[] = []
				for (const id of new Set(ids)) {
					const value = await stored(model, id)
					if (value && !value.deleted && matches(value.row, where)) result.push(value)
				}
				return result
			}
			const mutate = async (model: string, original: Stored, update: Row, deleting = false): Promise<Row | null> => {
				if (model === "user" && update.email !== undefined && update.email !== original.row.email) {
					update = { ...update, email: testOnlyConformance ? update.email : normalizeEmail(update.email) }
					await reserveEmail(update.email, original.row.id)
				}
				const operation = randomUUID()
				const result = deleting ? original.row : { ...original.row, ...update }
				if (key(model, result) !== key(model, original.row)) throw new Error("Auth lookup keys are immutable")
				if (original.receipts.length >= 4096) throw new Error("Auth receipt capacity reached")
				const receipts = [...original.receipts, { operation, result }]
				const id = key(model, original.row)
				let response: SqlResult | undefined
				try {
					response = await sql(`UPDATE ${table(model)} SET payload=?, deleted=?, receipts=?, lookup=?, created_at=?, expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
						[JSON.stringify(result), deleting, JSON.stringify(receipts), lookup(result), result.createdAt ?? null, result.expiresAt ?? null, id, original.seq, original.term])
				} catch { /* Only an atomic receipt can resolve an unknown write outcome. */ }
				if (response?.rowcount === 1) return result
				let current: Stored | null
				try { current = await stored(model, id) } catch { throw new IndeterminateAuthWriteError() }
				const receipt = current?.receipts.find(r => r.operation === operation)
				if (receipt) return decode(JSON.stringify(receipt.result))
				if (response?.rowcount === 0 && current && current.seq !== original.seq) return null
				throw new IndeterminateAuthWriteError()
			}
			const adapter: CustomAdapter = {
				async create({ model, data }) {
					const row: Row = { ...data, id: data.id ?? randomUUID() }
					if (model === "user") {
						if (!testOnlyConformance) row.email = normalizeEmail(row.email)
						await reserveEmail(row.email, row.id, true)
					}
					row.id = key(model, row)
					const operation = randomUUID()
					try { await sql(`INSERT INTO ${table(model)} (id,payload,created_at,expires_at,receipts,lookup) VALUES (?,?,?,?,?,?)`,
						[row.id, JSON.stringify(row), row.createdAt ?? null, row.expiresAt ?? null, JSON.stringify([{ operation, result: row }]), lookup(row)]) }
					catch (error) {
						const existing = await stored(model, row.id)
						const receipt = existing?.receipts.find(r => r.operation === operation)
						if (receipt) return decode(JSON.stringify(receipt.result)) as typeof data
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
				async findOne({ model, where }) { return (await candidates(model, where))[0]?.row as any ?? null },
				async findMany({ model, where = [], limit, offset = 0, sortBy }) {
					const rows = (await candidates(model, where)).map(v => v.row)
					if (sortBy) rows.sort((a,b) => (a[sortBy.field] > b[sortBy.field] ? 1 : a[sortBy.field] < b[sortBy.field] ? -1 : 0) * (sortBy.direction === "desc" ? -1 : 1))
					if (limit === 100 && rows.length > offset + limit) throw new Error("Auth enumeration truncated by Better Auth's default limit 100")
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
					return row ? await mutate(model, row, update as Row) as any : null
				},
				async updateMany({ model, where, update }) {
					let count = 0
					for (const row of await candidates(model, where)) if (await mutate(model, row, update)) count++
					return count
				},
				async delete({ model, where }) {
					const row = (await candidates(model, where))[0]
					if (row) await mutate(model, row, {}, true)
				},
				async deleteMany({ model, where }) {
					let count = 0
					for (const row of await candidates(model, where)) if (await mutate(model, row, {}, true)) count++
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

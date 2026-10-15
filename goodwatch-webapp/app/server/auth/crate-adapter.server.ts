import { createHash, createHmac, randomUUID } from "node:crypto"
import { createAdapterFactory, tryGetCurrentAuthEndpointContext } from "@goodwatch/auth-stack/adapters"
import type { CleanedWhere, CustomAdapter } from "@goodwatch/auth-stack/adapters"
import { assertAuthShape, assertAuthMutation } from "./call-shapes.server.ts"
import { releaseAuthAdmission, authPopulationActor, authActorBounds, admitAuthRow, validatePopulationBounds, launchPopulationBounds, type AuthPopulationBounds, type AuthAdmission } from "./population.server.ts"
import { authPayloadCodec, authCredentialVersion, type AuthEncryptionKeys } from "./payload-codec.server.ts"
// Not the global fetch: remix-serve replaces it with @remix-run/web-fetch (no v3_singleFetch), which fails every
// second request to CrateDB's HTTP endpoint with ECONNRESET (seen with CrateDB 5.10.12 on Node 24.22 and 26.8).
import { fetch } from "undici"

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
		const read = /^(SELECT|SHOW CREATE TABLE|REFRESH TABLE)\b/.test(stmt)
		let error: unknown
		for (let attempt = 0; attempt < urls.length; attempt++) {
			try {
				const response = await fetch(`${urls[next++ % urls.length].replace(/\/$/, "")}/_sql`, {
					method: "POST", headers, body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(timeoutMs),
				})
				const result: any = await response.json()
				if (!response.ok || result.error) {
					// Cancellation and unknown server codes are not proof of non-application.
					const refused = response.status === 401 || response.status === 403 || response.status >= 400 && response.status < 500 && [4000, 4041, 4043, 4091].includes(result.error?.code)
					throw new CrateAuthRequestError(result.error?.message ?? "CrateDB auth statement refused", result.error?.code, response.status, refused)
				}
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
	for (const url of urls) if (!/^http:\/\/127\.0\.0\.1:15(5|6|7|8)(48|49|50)$/.test(url)) throw new Error("Local auth test endpoint required")
	const sql = crateAuthTransport(urls, timeoutMs)
	localTransports.add(sql)
	return sql
}

export const authModelTable = (model: string) => {
	if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(model)) throw new Error("Invalid auth model name")
	return `doc.auth_${model.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`
}
const digest = (...parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex")
const normalizeEmail = (value: unknown) => String(value).trim().toLowerCase()
type Row = Record<string, any>
export const authModels = ["user", "account", "session", "verification", "jwks", "oauthClient", "oauthResource", "oauthClientResource", "oauthConsent", "oauthAccessToken", "oauthRefreshToken", "oauthClientAssertion", "rateLimit"]
const indexedFields = ["userId", "clientId", "sessionId", "referenceId", "resourceId", "identifier", "refreshId", "authorizationCodeId", "lastRequest", "count"]
export function authLookupHints(model: string, row: Record<string, unknown>, secret: string) {
	return Object.fromEntries(indexedFields.map(field => [field,
		model === "verification" && field === "identifier" && row[field] != null
			? createHmac("sha256", secret).update(JSON.stringify(["verification-identifier", row[field]])).digest("hex")
			: row[field] ?? null,
	]))
}
type Receipt = { operation: string; baseSeq: number; at?: string }
type Stored = { envelope: Record<string, any>; row: Row; seq: number; term: number; deleted: boolean; receipts: Receipt[]; emailClaim?: string }
export class IndeterminateAuthWriteError extends Error {
	constructor() { super("Auth write outcome is indeterminate; do not retry the logical operation"); this.name = "IndeterminateAuthWriteError" }
}
export class AuthMutationConflictError extends Error {
	constructor() { super("Auth mutation conflicted; the requested update or revocation did not complete"); this.name = "AuthMutationConflictError" }
}

export async function migrateAuthTables(sql: AuthSql, additionalModels: string[] = []) {
	if (additionalModels.length && !localTransports.has(sql)) throw new Error("Additional tables require the disposable local transport")
	for (const model of new Set([...authModels, "capacity", ...additionalModels])) {
		await sql(`CREATE TABLE IF NOT EXISTS ${authModelTable(model)} (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS (${indexedFields.map(field => `"${field}" ${["lastRequest", "count"].includes(field) ? "DOUBLE PRECISION" : "TEXT"}`).join(",")}),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
		const ddl = String((await sql(`SHOW CREATE TABLE ${authModelTable(model)}`)).rows[0]?.[0])
		for (const field of ["payload", "receipts"]) if (!new RegExp(`"${field}" TEXT NOT NULL INDEX OFF STORAGE WITH \\(\\s*columnstore = false`).test(ddl)) throw new Error("Incompatible prerelease auth schema: rebuild disposable tables or perform an offline migration before use")
	}
	await sql(`CREATE TABLE IF NOT EXISTS doc.auth_user_email (
		email_norm TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_id TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL, user_seq LONG NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
	if (!String((await sql("SHOW CREATE TABLE doc.auth_user_email")).rows[0]?.[0]).includes('"user_seq" BIGINT NOT NULL')) throw new Error("Incompatible prerelease email claim schema: offline migration required")
}

export const localAuthEncryptionSecret = "disposable-local-auth-integration-key-548"

export function crateAuthAdapter({ sql, testOnlyConformance = false, maxEnumeration = 10000, encryptionSecret, encryptionKeys, populationBounds, enforceGrantRevocation = false, validateSessionCredentials = false, onSessionRevoked }: { sql: AuthSql; testOnlyConformance?: boolean; maxEnumeration?: number; encryptionSecret?: string; encryptionKeys?: AuthEncryptionKeys; populationBounds?: true | AuthPopulationBounds; enforceGrantRevocation?: boolean; validateSessionCredentials?: boolean; onSessionRevoked?: (token: string) => Promise<unknown> }) {
	if (testOnlyConformance && !localTransports.has(sql)) throw new Error("Conformance mode requires the disposable local transport")
	if (!Number.isSafeInteger(maxEnumeration) || maxEnumeration < 1 || maxEnumeration > 10000) throw new Error("Invalid auth enumeration bound")
	if (!encryptionSecret && !localTransports.has(sql)) throw new Error("Auth payload encryption secret is required")
	// Private insertion provenance: direct adapter writes (including imports) never
	// qualify for abandoned-signup collection, regardless of their logical dates.
	const pendingSignupAt = (model: string) => model === "user" && tryGetCurrentAuthEndpointContext()?.path === "/sign-up/email" ? new Date().toISOString() : undefined
	const payloadSecret = encryptionSecret ?? localAuthEncryptionSecret
	const codec = authPayloadCodec(payloadSecret, encryptionKeys)
	const bounds = populationBounds === true ? launchPopulationBounds : populationBounds
	if (bounds) validatePopulationBounds(bounds, maxEnumeration)
	const privateKey = (purpose: string, value: unknown) => createHmac("sha256", payloadSecret).update(JSON.stringify([purpose, value])).digest("hex")
	const emailKey = (email: unknown) => privateKey("email-claim", normalizeEmail(email))
	const indexValue = (model: string, field: string, value: unknown) => model === "verification" && field === "identifier" && value != null ? privateKey("verification-identifier", value) : value
	const lookup = (model: string, row: Row) => authLookupHints(model, row, payloadSecret)
	return createAdapterFactory({
		config: { adapterId: "goodwatch-cratedb", adapterName: "Strict CrateDB", supportsDates: true,
			supportsBooleans: true, supportsJSON: true, supportsArrays: true, transaction: false },
		adapter: context => {
			const defaultLimit = context.options.advanced?.database?.defaultFindManyLimit ?? 100
			const modes = { verification: !context.options.secondaryStorage || context.options.verification?.storeInDatabase === true,
				rateLimit: context.options.rateLimit?.storage === "database", preserveSessions: context.options.session?.preserveSessionInDatabase === true }
			if (context.options.secondaryStorage && context.options.session?.storeSessionInDatabase !== true) throw new Error("CrateDB session mirror is required")
			const decodeRow = (model: string, payload: unknown): Row => {
				const row = payload as Row
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
				if (!authModels.includes(model) && !(testOnlyConformance && context.schema[model])) throw new Error("Unsupported auth model")
				const result = await sql(`SELECT payload,_seq_no,_primary_term,deleted,receipts FROM ${authModelTable(model)} WHERE id = ?`, [id])
				if (!result.rows.length) return null
				const [payload, seq, term, , receipts] = result.rows[0]
				const envelope = codec.decode(payload, `${authModelTable(model)}:${id}:payload`)
				if (typeof envelope.deleted !== "boolean" || envelope.row?.id !== id) throw new Error("Invalid authenticated auth row")
				if (bounds && authPopulationActor(model, envelope.row, payloadSecret) !== undefined && !envelope.deleted && !envelope.admission) throw new Error("Unadmitted prerelease auth row; offline rebuild/import required")
				return { envelope, row: decodeRow(model, envelope.row), seq: Number(seq), term: Number(term), deleted: envelope.deleted, receipts: codec.decode(receipts, `${authModelTable(model)}:${id}:receipts`), emailClaim: envelope.emailClaim }
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
				let enumerating = false
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
				const batch = where.find(p => p.operator === "in" && (p.field === "id" || p.field === "token" && ["session", "oauthAccessToken", "oauthRefreshToken"].includes(model) || p.field === "clientId" && model === "oauthClient" || p.field === "identifier" && model === "oauthResource"))
				if (!ids && batch && !testOnlyConformance) ids = (batch.value as string[]).map(value => batch.field === "token" ? digest(value) : String(value))
				if (!ids) {
					enumerating = true
					await sql(`REFRESH TABLE ${authModelTable(model)}`)
					const filters: string[] = [], args: unknown[] = []
					if (!where.some(p => p.connector === "OR" || p.mode === "insensitive")) for (const p of where) {
						const column = p.field === "expiresAt" ? "expires_at" : indexedFields.includes(p.field) ? `lookup['${p.field}']` : undefined
						if (!column) continue
						if (p.value === null && p.operator === "eq") { filters.push(`${column} IS NULL`); continue }
						if (p.operator === "in") {
							const values = p.value as unknown[]
							filters.push(values.length ? `${column} IN (${values.map(() => "?").join(",")})` : "false")
							args.push(...values.map(value => indexValue(model, p.field, value)))
						} else {
							const operator = { eq: "=", lt: "<", lte: "<=", gt: ">", gte: ">=" }[p.operator as "eq"]
							if (operator) { filters.push(`${column} ${operator} ?`); args.push(indexValue(model, p.field, p.value)) }
						}
					}
					ids = []
					let after: string | undefined
					for (;;) {
						const pageSize = Math.min(100, maxEnumeration + 1 - ids.length)
						const page = await sql(`SELECT id FROM ${authModelTable(model)} WHERE deleted = false ${filters.length ? `AND ${filters.join(" AND ")}` : ""} ${after === undefined ? "" : "AND id > ?"} ORDER BY id LIMIT ${pageSize}`, after === undefined ? args : [...args, after])
						ids.push(...page.rows.map(r => String(r[0])))
						if (ids.length > maxEnumeration) throw new Error("Auth enumeration exceeds safe bound")
						if (page.rows.length < pageSize) break
						after = ids.at(-1)
					}
				}
				const result: Stored[] = []
				for (const id of new Set(ids)) {
					const value = await stored(model, id)
					if (value && !value.deleted && (!enumerating || !value.envelope.archived) && matches(value.row, where)) result.push(value)
				}
				return result
			}
			const mutate = async (model: string, original: Stored, update: Row, deleting = false, replacing = false, admission?: AuthAdmission): Promise<Row | null> => {
				let emailClaim = original.emailClaim
				// A refresh-family sweep is not atomic with child issuance. Close the
				// authoritative grant first; a late child then fails both refresh and
				// JWT checks. Normal rotation carries rotatedAt and keeps its grant.
				if (enforceGrantRevocation && model === "oauthRefreshToken" && (deleting || update.revoked instanceof Date && !("rotatedAt" in update)) && original.row.grantVersion) {
					const grantId = digest(original.row.clientId, original.row.userId, original.row.referenceId ?? null)
					const grant = await stored("oauthConsent", grantId)
					if (grant && !grant.deleted && grant.row.grantVersion === original.row.grantVersion) await assign("oauthConsent", grant, [{ field: "id", operator: "eq", value: grantId, connector: "AND", mode: "sensitive" }, { field: "grantVersion", operator: "eq", value: original.row.grantVersion, connector: "AND", mode: "sensitive" }], {}, true)
				}
				if (model === "user" && update.email !== undefined && update.email !== original.row.email) {
					update = { ...update, email: testOnlyConformance ? update.email : normalizeEmail(update.email) }
					try { emailClaim = await reserveEmail(update.email, original.row.id, digest(original.row.id, update.email, original.seq, original.term), original.seq) }
					catch (error) { if (error instanceof AuthMutationConflictError) return null; throw error }
				}
				const operation = randomUUID()
				const result = deleting ? original.row : replacing ? { ...update, id: original.row.id } : { ...original.row, ...update }
				// Retire signup GC provenance in the confirming CAS. Also protect
				// already-confirmed rows first mutated after this policy is deployed.
				const signupConfirmed = model === "user" && (original.row.emailVerified === true || result.emailVerified === true)
				if (!deleting && key(model, result) !== original.row.id) throw new Error("Auth lookup keys are immutable")
				// Receipts prove ownership; this invocation already knows its result.
				// Never retain historical credentials or an unbounded operation log.
				const receipts = [...(replacing ? [] : original.receipts), { operation, baseSeq: original.seq, at: new Date().toISOString() }].slice(-256)
				const id = String(original.row.id)
				let response: SqlResult | undefined
				try {
					response = await sql(`UPDATE ${authModelTable(model)} SET payload=?, deleted=?, receipts=?, lookup=?, created_at=?, expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
						[codec.encode({ ...original.envelope, admission: replacing ? admission : original.envelope.admission, row: deleting ? { id } : result, abandonedClaim: replacing ? undefined : original.envelope.abandonedClaim, unusedClient: replacing ? undefined : original.envelope.unusedClient, authorizedAt: replacing ? undefined : original.envelope.authorizedAt, pendingSignupAt: signupConfirmed ? undefined : replacing ? pendingSignupAt(model) : original.envelope.pendingSignupAt, confirmationIssuedAt: signupConfirmed || replacing ? undefined : original.envelope.pendingSignupAt && typeof update.confirmationDigest === "string" ? new Date().toISOString() : original.envelope.confirmationIssuedAt, admissionFence: deleting ? Math.max(original.envelope.admissionFence ?? 0, original.envelope.admission?.generation ?? 0) : original.envelope.admissionFence, deleted: deleting, deletedAt: deleting ? new Date().toISOString() : undefined, emailClaim: deleting ? undefined : emailClaim }, `${authModelTable(model)}:${id}:payload`), deleting || !replacing && original.envelope.archived === true, codec.encode(receipts, `${authModelTable(model)}:${id}:receipts`), lookup(model, deleting ? {} : result), deleting ? null : result.createdAt ?? null, deleting ? null : result.expiresAt ?? null, id, original.seq, original.term])
				} catch (error) { if (error instanceof CrateAuthRequestError && error.definitelyNotApplied) throw error }
				if (response?.rowcount === 1) {
					if (model === "user" && (deleting || result.email !== original.row.email)) await releaseEmail(original.row.email, original.row.id, original.emailClaim)
					if (deleting) {
						await releaseAuthAdmission(sql,codec,id,original.envelope.admission)
						if (model === "session" && typeof original.row.token === "string") await onSessionRevoked?.(original.row.token)
					}
					return result
				}
				let current: Stored | null
				try { current = await stored(model, id) } catch { throw new IndeterminateAuthWriteError() }
				// A primary-key read may be served by a replica that has acknowledged our
				// rejected CAS but not yet applied the version that rejected it. Such a
				// read-back (no newer version, no receipt) proves nothing either way: read
				// again, bounded. The decision below still needs our receipt or a newer version.
				for (let attempt = 0; response?.rowcount === 0 && attempt < 10 && current && current.seq <= original.seq && !current.receipts.some(r => r.operation === operation); attempt++) {
					await new Promise(resolve => setTimeout(resolve, Math.min(5 * 2 ** attempt, 200)))
					try { current = await stored(model, id) } catch { throw new IndeterminateAuthWriteError() }
				}
				const receipt = current?.receipts.find(r => r.operation === operation)
				if (receipt) {
					if (deleting) {
						await releaseAuthAdmission(sql,codec,id,original.envelope.admission)
						if (model === "session" && typeof original.row.token === "string") await onSessionRevoked?.(original.row.token)
					}
					if (model === "user" && (deleting || result.email !== original.row.email)) await releaseEmail(original.row.email, original.row.id, original.emailClaim)
					return result
				}
				// Only a newer version proves a competitor: a lagging copy can be older than our base.
				if (response?.rowcount === 0 && current && current.seq > original.seq && original.seq >= (current.receipts[0]?.baseSeq ?? Infinity)) {
					if (model === "user" && emailClaim !== original.emailClaim && current.emailClaim !== emailClaim) await releaseEmail(update.email, original.row.id, emailClaim)
					return null
				}
				throw new IndeterminateAuthWriteError()
			}
			const assign = async (model: string, row: Stored, where: CleanedWhere[], update: Row, deleting = false): Promise<Row | null> => {
				for (let attempt = 0; attempt < 64; attempt++) {
					const result = await mutate(model, row, update, deleting)
					if (result) return result
					// Only a proven competing version reaches here. Re-evaluate every
					// predicate; never resurrect a deleted row or replay a logical delta.
					const current = await stored(model, String(row.row.id))
					if (!current || current.deleted || !matches(current.row, where)) return null
					row = current
				}
				throw new AuthMutationConflictError()
			}
			const requireCompleted = async (model: string, row: Stored, where: CleanedWhere[], update: Row, deleting = false) => Boolean(await assign(model, row, where, update, deleting))
			const adapter: CustomAdapter = {
				async create({ model, data }) {
					const writeDeadline = Date.now() + 15 * 60000
					const row: Row = { ...data, id: data.id ?? randomUUID() }
					let emailClaim: string | undefined
					if (model === "user") {
						if (!testOnlyConformance) row.email = normalizeEmail(row.email)
						emailClaim = await reserveEmail(row.email, row.id, randomUUID(), -1, true)
					}
					row.id = key(model, row)
					// Uncapped accounts still need a pre-insert version fence: a paused
					// create may only replace the exact tombstone it already observed.
					const accountBase = model === "account" ? await stored(model, row.id) : undefined
					const actor = authPopulationActor(model, row, payloadSecret)
					const admission = bounds && actor !== undefined && !testOnlyConformance ? await admitAuthRow(sql, codec, model, row.id, populationBounds === true ? authActorBounds(model) : bounds, actor,
							model === "session" && populationBounds === true ? async (id, admission) => {
								const oldest = await stored("session", id)
								if (!oldest || oldest.envelope.admission?.generation !== admission.generation || (!oldest.deleted && oldest.row.userId !== row.userId)) return false
								if (!oldest.deleted && !(await mutate("session", oldest, {}, true))) return false
								await releaseAuthAdmission(sql,codec,id,admission)
								return true
							} : undefined) : undefined
					const operation = randomUUID()
					try {
						const inserted = await sql(`INSERT INTO ${authModelTable(model)} (id,payload,created_at,expires_at,receipts,lookup) VALUES (?,CASE WHEN CURRENT_TIMESTAMP < ? THEN ? ELSE NULL END,?,?,?,?)`,
							[row.id, writeDeadline, codec.encode({ row, deleted: false, emailClaim, admission, pendingSignupAt: pendingSignupAt(model) }, `${authModelTable(model)}:${row.id}:payload`), row.createdAt ?? null, row.expiresAt ?? null, codec.encode([{ operation, baseSeq: -1, at: new Date().toISOString() }], `${authModelTable(model)}:${row.id}:receipts`), lookup(model, row)])
						if (inserted.rowcount !== 1) throw new IndeterminateAuthWriteError()
					}
					catch (error) {
						if (error instanceof CrateAuthRequestError && error.definitelyNotApplied && error.code !== 4091) {
							if (model === "user") await releaseEmail(row.email, row.id, emailClaim)
							throw error
						}
						let existing: Stored | null
						try { existing = await stored(model, row.id) } catch { throw new IndeterminateAuthWriteError() }
						const receipt = existing?.receipts.find(r => r.operation === operation)
						if (receipt) return row as typeof data
						if (Date.now() >= writeDeadline) throw new IndeterminateAuthWriteError()
						if (admission && existing && Number(existing.envelope.admissionFence ?? 0) >= admission.generation) throw new Error("Auth population capacity reservation was fenced; retry with a new operation")
						if ((error as {code?: number}).code === 4091 && model === "user" && existing?.deleted && existing.envelope.abandonedClaim && existing.envelope.abandonedClaim !== emailClaim) {
							const claim = (await sql("SELECT user_id,operation_id FROM doc.auth_user_email WHERE email_norm=?", [emailKey(row.email)])).rows[0]
							if (claim?.[0] === row.id && claim[1] === emailClaim) {
								const adopted = await mutate(model, existing, row, false, true)
								if (adopted) return adopted as typeof data
								throw new AuthMutationConflictError()
							}
						}
						if ((error as { code?: number }).code === 4091 && existing?.deleted && (["account", "oauthConsent", "oauthClientResource", "oauthResource"].includes(model) || model === "oauthClient" && existing.envelope.unusedClient === true)) {
							if (model === "account" && (!accountBase?.deleted || accountBase.seq !== existing.seq || accountBase.term !== existing.term))
								throw new Error("Auth account creation was fenced by unlink; retry a fresh operation")
							const recreated = await mutate(model, existing, row, false, true, admission)
							if (recreated) return recreated as typeof data
							throw Object.assign(new Error("duplicate key: auth association"), { code: "23505" })
						}
						if (model === "oauthConsent" && (error as { code?: number }).code === 4091 && existing && !existing.deleted) {
							const updated = await mutate(model, existing, { ...row, id: existing.row.id })
							if (updated) return updated as typeof data
							throw new IndeterminateAuthWriteError()
						}
						if ((error as { code?: number }).code === 4091) {
							// A supplied id may already belong to another insert. Only release
							// our rejected reservation; never an adopted or uncertain claim.
							if (model === "user" && existing && existing.emailClaim !== emailClaim) await releaseEmail(row.email, row.id, emailClaim)
							throw Object.assign(new Error("duplicate key: auth identity"), { code: "23505" })
						}
						throw new IndeterminateAuthWriteError()
					}
					return row as typeof data
				},
				async findOne({ model, where }) {
					const rows = await candidates(model, where)
					if (!testOnlyConformance && rows.length > 1) throw new Error("Ambiguous auth lookup; supply the complete logical key")
					const row = rows[0]?.row
					if (row && model === "session" && validateSessionCredentials) {
						const credential = await stored("account", digest("credential", row.userId))
						const password = credential && !credential.deleted && typeof credential.row.password === "string" ? credential.row.password : null
						if (row.credentialVersion !== authCredentialVersion(payloadSecret, password)) return null
					}
					return row as any ?? null
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
					// Provider reuse invalidation deletes by client/member, even when
					// its earlier captured token set was empty. Fence the grants first.
					if (enforceGrantRevocation && model === "oauthRefreshToken" && where.length === 2 && where.every(p => p.operator === "eq" && ["clientId", "userId"].includes(p.field))) {
						for (const grant of await candidates("oauthConsent", where)) if (grant.row.grantVersion) await assign("oauthConsent", grant, [{ field: "id", operator: "eq", value: grant.row.id, connector: "AND", mode: "sensitive" }, { field: "grantVersion", operator: "eq", value: grant.row.grantVersion, connector: "AND", mode: "sensitive" }], {}, true)
					}
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
				// Persist authorization history in the authenticated client envelope.
				// A collector races this CAS: either the marker wins, or issuance fails closed.
				if (model === "oauthConsent" && action === "create" && output) {
					let marked = false
					for (let attempt = 0; attempt < 64; attempt++) {
						const clientId = String(normalized.data.clientId)
						const client = await stored("oauthClient",clientId)
						if (!client) { if(enforceGrantRevocation) throw new Error("OAuth client no longer exists"); marked=true; break }
						if (client.deleted || client.row.disabled) throw new Error("OAuth client no longer exists")
						if (client.envelope.authorizedAt) { marked=true; break }
						const aad = `${authModelTable("oauthClient")}:${clientId}:payload`
						const result = await sql("UPDATE doc.auth_oauth_client SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?",[codec.encode({...client.envelope,authorizedAt:new Date().toISOString()},aad),clientId,client.seq,client.term])
						if (result.rowcount === 1) {marked=true;break}
					}
					if (!marked) throw new AuthMutationConflictError()
				}
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

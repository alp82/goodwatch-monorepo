import { createHmac } from "node:crypto"
import type { Client } from "pg"
import { type AuthSql, crateAuthAdapter } from "./crate-adapter.server.ts"
import {
	type AuthEncryptionKeys,
	authPayloadCodec,
} from "./payload-codec.server.ts"

type Document = Record<string, unknown>
type ImportRow = { model: "user" | "account"; data: Document }
export type ImportIssue = { code: string; userId?: string; identityId?: string }
export type TargetCounts = {
	users: number
	accounts: number
	credential: number
	google: number
	emailClaims: number
}
export type ImportReport = {
	sourceFingerprint?: string
	status: "planned" | "complete" | "rejected" | "failed"
	source: {
		users: number
		identities: number
		credential: number
		google: number
		verified: number
		unverified: number
	}
	before: TargetCounts
	after: TargetCounts
	created: { users: number; accounts: number }
	unchanged: { users: number; accounts: number }
	issues: ImportIssue[]
	elapsedMs: number
}
export class SupabaseImportError extends Error {
	readonly report: ImportReport
	constructor(report: ImportReport) {
		super(`Supabase import ${report.status}; see sanitized report`)
		this.name = "SupabaseImportError"
		this.report = report
	}
}

// No credential-bearing statements or raw database errors escape this boundary.
// The CLI uses explicitly supplied loopback endpoints, never app configuration.
export async function importSupabaseAuth({
	source,
	sql,
	encryptionSecret,
	encryptionKeys,
	expectedSourceFingerprint,
	expectedTargetCounts,
	requireExactRerun = false,
	apply = false,
}: {
	source: Client
	sql: AuthSql
	encryptionSecret: string
	encryptionKeys?: AuthEncryptionKeys
	expectedSourceFingerprint?: string
	expectedTargetCounts?: TargetCounts
	requireExactRerun?: boolean
	apply?: boolean
}): Promise<ImportReport> {
	const started = Date.now()
	const empty = (): TargetCounts => ({
		users: 0,
		accounts: 0,
		credential: 0,
		google: 0,
		emailClaims: 0,
	})
	const report: ImportReport = {
		status: "planned",
		source: {
			users: 0,
			identities: 0,
			credential: 0,
			google: 0,
			verified: 0,
			unverified: 0,
		},
		before: empty(),
		after: empty(),
		created: { users: 0, accounts: 0 },
		unchanged: { users: 0, accounts: 0 },
		issues: [],
		elapsedMs: 0,
	}
	const codec = authPayloadCodec(encryptionSecret, encryptionKeys)
	const adapter = crateAuthAdapter({ sql, encryptionSecret, encryptionKeys })({
		verification: { storeIdentifier: "hashed" },
		advanced: { database: { defaultFindManyLimit: 10000 } },
	})
	const counts = async (): Promise<TargetCounts> => {
		await sql(
			"REFRESH TABLE doc.auth_user, doc.auth_account, doc.auth_user_email",
		)
		const result = empty()
		result.emailClaims = Number(
			(await sql("SELECT count(*) FROM doc.auth_user_email")).rows[0][0],
		)
		for (const model of ["user", "account"]) {
			let cursor = ""
			while (true) {
				const rows = (
					await sql(
						`SELECT id,payload FROM doc.auth_${model} WHERE id>? ORDER BY id LIMIT 500`,
						[cursor],
					)
				).rows
				if (!rows.length) break
				for (const [id, payload] of rows) {
					const envelope = codec.decode(
						payload,
						`doc.auth_${model}:${id}:payload`,
					)
					if (
						typeof envelope?.deleted !== "boolean" ||
						envelope.row?.id !== String(id)
					)
						throw new Error("Invalid authenticated auth audit row")
					cursor = String(id)
					if (envelope.deleted) continue
					if (model === "user") result.users++
					else {
						result.accounts++
						if (envelope.row.providerId === "credential") result.credential++
						if (envelope.row.providerId === "google") result.google++
					}
				}
			}
		}
		return result
	}
	const issue = (code: string, userId?: string, identityId?: string) =>
		report.issues.push({
			code,
			...(userId ? { userId } : {}),
			...(identityId ? { identityId } : {}),
		})
	let sourceLocked = false
	try {
		report.before = await counts()
		report.after = { ...report.before }
		if (
			expectedTargetCounts &&
			Object.entries(expectedTargetCounts).some(
				([key, value]) => report.before[key as keyof TargetCounts] !== value,
			)
		)
			issue("target_changed_since_receipt")
		sourceLocked =
			(await source.query("SELECT pg_try_advisory_lock(551,551) AS locked"))
				.rows[0].locked === true
		if (!sourceLocked) {
			issue("source_copy_in_use")
			report.status = "rejected"
			throw new SupabaseImportError(report)
		}
		let users: Document[]
		let identities: Document[]
		await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
		try {
			const totals = (
				await source.query(
					"SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM auth.identities) AS identities",
				)
			).rows[0]
			report.source.users = Number(totals.users)
			report.source.identities = Number(totals.identities)
			// Bounded full preflight avoids writing earlier batches before finding a late collision.
			if (report.source.users > 100_000 || report.source.identities > 300_000) {
				issue("source_exceeds_preflight_bound")
				users = []
				identities = []
			} else {
				users = (
					await source.query(
						"SELECT to_jsonb(u) AS row FROM auth.users u ORDER BY u.id",
					)
				).rows.map((r) => r.row)
				identities = (
					await source.query(
						"SELECT to_jsonb(i) AS row FROM auth.identities i ORDER BY i.id",
					)
				).rows.map((r) => r.row)
			}
			await source.query("COMMIT")
		} catch {
			await source.query("ROLLBACK")
			throw new Error("Source snapshot failed")
		}
		report.sourceFingerprint = createHmac("sha256", encryptionSecret)
			.update(JSON.stringify(["import-source-552", users, identities]))
			.digest("hex")
		if (
			expectedSourceFingerprint &&
			expectedSourceFingerprint !== report.sourceFingerprint
		)
			issue("source_changed_since_receipt")
		const uuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		const byUser = new Map<string, Document[]>()
		const sourceIds = new Set(users.map((u) => String(u.id)))
		const accountKeys = new Set<string>()
		for (const identity of identities) {
			const userId = String(identity.user_id)
			const identityId = String(identity.id)
			if (!sourceIds.has(userId)) issue("orphan_identity", userId, identityId)
			if (!["email", "google"].includes(String(identity.provider)))
				issue("unsupported_provider", userId, identityId)
			const list = byUser.get(userId) ?? []
			list.push(identity)
			byUser.set(userId, list)
		}
		const plan: ImportRow[] = []
		const emails = new Map<string, string>()
		const date = (value: unknown, userId: string): Date => {
			const result = new Date(typeof value === "string" ? value : Number.NaN)
			if (!Number.isFinite(result.getTime())) issue("invalid_timestamp", userId)
			return result
		}
		for (const user of users) {
			const id = String(user.id)
			const email =
				typeof user.email === "string" ? user.email.trim().toLowerCase() : ""
			if (!uuid.test(id)) issue("invalid_user_uuid", id)
			if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
				issue("missing_or_invalid_email", id)
			if (emails.has(email) && emails.get(email) !== id)
				issue("source_email_collision", id)
			emails.set(email, id)
			if (
				user.deleted_at ||
				user.is_anonymous ||
				user.is_sso_user ||
				user.is_super_admin ||
				user.banned_until
			)
				issue("unsupported_user_lifecycle", id)
			if (
				user.encrypted_password &&
				(typeof user.encrypted_password !== "string" ||
					!/^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(
						user.encrypted_password,
					))
			)
				issue("unsupported_password_hash", id)
			const createdAt = date(user.created_at, id)
			const updatedAt = date(user.updated_at ?? user.created_at, id)
			const verified = user.email_confirmed_at != null
			if (verified) {
				date(user.email_confirmed_at, id)
				report.source.verified++
			} else report.source.unverified++
			const metadata = (user.raw_user_meta_data ?? {}) as Document
			const name =
				[metadata.name, metadata.full_name, metadata.username].find(
					(v) => typeof v === "string" && v.length,
				) ?? email.split("@")[0]
			const image =
				[metadata.avatar_url, metadata.picture].find(
					(v) => typeof v === "string" && v.length,
				) ?? null
			plan.push({
				model: "user",
				data: {
					id,
					email,
					name,
					image,
					emailVerified: verified,
					createdAt,
					updatedAt,
				},
			})
			const linked = byUser.get(id) ?? []
			if (!linked.length) issue("missing_identity", id)
			if (
				user.encrypted_password &&
				!linked.some((i) => i.provider === "email")
			)
				issue("password_without_email_identity", id)
			for (const identity of linked) {
				if (!["email", "google"].includes(String(identity.provider))) continue
				const providerId =
					identity.provider === "email" ? "credential" : "google"
				const sub = (identity.identity_data as Document | null)?.sub
				if (
					providerId === "google" &&
					(typeof sub !== "string" || !sub.trim())
				) {
					issue("missing_google_sub", id, String(identity.id))
					continue
				}
				const accountId = providerId === "credential" ? id : String(sub)
				const key = JSON.stringify([providerId, accountId])
				if (accountKeys.has(key))
					issue("source_account_collision", id, String(identity.id))
				accountKeys.add(key)
				report.source[providerId === "credential" ? "credential" : "google"]++
				plan.push({
					model: "account",
					data: {
						userId: id,
						providerId,
						accountId,
						password:
							providerId === "credential"
								? user.encrypted_password || null
								: null,
						createdAt: date(identity.created_at ?? user.created_at, id),
						updatedAt: date(
							identity.updated_at ?? user.updated_at ?? user.created_at,
							id,
						),
					},
				})
			}
		}
		const pending: ImportRow[] = []
		let newEmailClaims = 0
		for (const row of plan) {
			const { model, data } = row
			const existing =
				model === "user"
					? await adapter.findOne<Document>({
							model,
							where: [{ field: "id", value: String(data.id) }],
						})
					: (
							await adapter.findMany<Document>({
								model,
								where: [
									{ field: "providerId", value: String(data.providerId) },
									{ field: "accountId", value: String(data.accountId) },
								],
								limit: 2,
							})
						)[0]
			if (model === "user") {
				// Storage audit only: use the adapter's HMAC claim key. All changes
				// to claims remain exclusively inside the adapter lifecycle.
				const emailKey = createHmac("sha256", encryptionSecret)
					.update(JSON.stringify(["email-claim", data.email]))
					.digest("hex")
				const claimed = (
					await sql(
						"SELECT user_id FROM doc.auth_user_email WHERE email_norm=?",
						[emailKey],
					)
				).rows[0]
				if (claimed && claimed[0] !== data.id)
					issue("target_email_collision", String(data.id))
				if (existing && !claimed)
					issue("target_email_claim_missing", String(data.id))
				if (!existing && claimed?.[0] === data.id)
					issue("target_orphan_email_claim", String(data.id))
				if (!existing && !claimed) newEmailClaims++
			}
			if (existing) {
				if (
					Object.entries(data).some(
						([field, value]) =>
							JSON.stringify(existing[field]) !== JSON.stringify(value),
					)
				)
					issue("target_row_mismatch", String(data.id ?? data.userId))
				report.unchanged[model === "user" ? "users" : "accounts"]++
			} else pending.push(row)
		}
		if (requireExactRerun && pending.length) issue("rerun_would_create_rows")
		if (report.issues.length) {
			report.status = "rejected"
			throw new SupabaseImportError(report)
		}
		if (apply) {
			for (const { model, data } of pending) {
				await adapter.create({ model, data, forceAllowId: true })
				report.created[model === "user" ? "users" : "accounts"]++
			}
			report.after = await counts()
			if (
				report.after.users !== report.before.users + report.created.users ||
				report.after.accounts !==
					report.before.accounts + report.created.accounts ||
				report.after.credential !==
					report.before.credential +
						pending.filter((r) => r.data.providerId === "credential").length ||
				report.after.google !==
					report.before.google +
						pending.filter((r) => r.data.providerId === "google").length ||
				report.after.emailClaims !== report.before.emailClaims + newEmailClaims
			)
				throw new Error("Target count mismatch")
			report.status = "complete"
		}
		report.elapsedMs = Date.now() - started
		return report
	} catch (error) {
		if (!(error instanceof SupabaseImportError)) {
			report.status = "failed"
			issue("database_or_write_failure")
		}
		try {
			report.after = await counts()
		} catch {
			issue("after_counts_unavailable")
		}
		report.elapsedMs = Date.now() - started
		throw new SupabaseImportError(report)
	} finally {
		if (sourceLocked)
			await source.query("SELECT pg_advisory_unlock(551,551)").catch(() => {})
	}
}

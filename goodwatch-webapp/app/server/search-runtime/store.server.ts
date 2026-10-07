import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	randomUUID,
} from "node:crypto"
import { searchStatement } from "../combined-search/catalog.server"
import { readingsConfigured } from "./limits.server"
import { SearchCoordination } from "./coordination.server"

export const DAILY_NANO = 1_000_000_000
export const MONTHLY_NANO = 5_000_000_000
export type BasicReason =
	| "budget"
	| "rate"
	| "busy"
	| "unknown"
	| "storage"
	| "configuration"
	| "input"
	| "deadline"
	| "cancelled"
	| "provider"
	| "contract"
export type Claim =
	| { kind: "claimed"; id: string }
	| { kind: "cached"; ciphertext: string }
	| { kind: "basic"; reason: BasicReason }
type Interpretation = {
	cache_key: string
	attempt_id: string
	status: string
	ciphertext: string
	created_at: number
}
type Reservation = { cache_key: string; budget_at: number; amount_nano: number }

export function productionStore() {
	const key = process.env.SEARCH_STORAGE_KEY
	if (!readingsConfigured())
		throw new Error("Search storage key is not configured")
	return new SearchStore(
		searchStatement,
		new SearchCoordination(),
		Buffer.from(key!, "hex"),
	)
}

// Crate holds permanent data. Redis is only a cache and short-lived coordinator.
// Budget reads and appends are intentionally separate: concurrent/just-indexed work
// can slightly exceed the cutoff. No transaction or exact hard-cap claim is made.
export class SearchStore {
	constructor(
		private readonly execute: typeof searchStatement,
		private readonly coordination: SearchCoordination,
		private readonly key: Buffer,
	) {
		if (key.length !== 32) throw new Error("Invalid search storage key")
	}
	private async query<T>(stmt: string, args: unknown[] = []): Promise<T[]> {
		const data = await this.execute(stmt, args)
		return data.rows.map(
			(row) =>
				Object.fromEntries(data.cols.map((name, i) => [name, row[i]])) as T,
		)
	}
	digest(value: string) {
		return createHmac("sha256", this.key).update(value).digest("hex")
	}
	seal(value: unknown) {
		const iv = randomBytes(12)
		const cipher = createCipheriv("aes-256-gcm", this.key, iv)
		const encrypted = Buffer.concat([
			cipher.update(JSON.stringify(value), "utf8"),
			cipher.final(),
		])
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
			"base64",
		)
	}
	unseal<T>(value: string): T {
		const bytes = Buffer.from(value, "base64")
		const cipher = createDecipheriv(
			"aes-256-gcm",
			this.key,
			bytes.subarray(0, 12),
		)
		cipher.setAuthTag(bytes.subarray(12, 28))
		return JSON.parse(
			Buffer.concat([
				cipher.update(bytes.subarray(28)),
				cipher.final(),
			]).toString("utf8"),
		) as T
	}
	async lookup(cacheKey: string): Promise<Claim | undefined> {
		const fast = await this.coordination.cached(cacheKey)
		if (fast) return { kind: "cached", ciphertext: fast }
		const [row] = await this.query<Interpretation>(
			"SELECT * FROM doc.search_interpretations WHERE cache_key = ?",
			[cacheKey],
		)
		if (row?.status !== "ready") return undefined
		await this.coordination.cache(cacheKey, row.ciphertext)
		return { kind: "cached", ciphertext: row.ciphertext }
	}
	// Callers look the cache key up first (lookup), so claim doesn't. A reading that lands in between is caught by the
	// Redis lock and the primary-key insert below.
	// The scopes may still be resolving: they are awaited only before admission, after the spending checks.
	async claim(input: {
		cacheKey: string
		contract: string
		scopes: string[] | Promise<string[]>
		reserveNano: number
		priceVersion: string
		admissionAttemptId?: string
	}): Promise<Claim> {
		if (!Number.isSafeInteger(input.reserveNano) || input.reserveNano <= 0)
			return { kind: "basic", reason: "configuration" }
		// Handled at the await below; this only keeps an early rejection from counting as unhandled.
		const scopesReady = Promise.resolve(input.scopes)
		scopesReady.catch(() => {})
		// The control row and the spending, in parallel. The spending query reads Crate's clock once, and sums today's
		// and this month's (UTC) spending by it.
		const [[control], [spend]] = await Promise.all([
			this.query<{ halted: boolean }>(
				"SELECT halted FROM doc.search_control WHERE id = 'paid'",
			),
			this.query<{ now: number; day: number; month: number }>(
				"SELECT CURRENT_TIMESTAMP AS now, coalesce(sum(CASE WHEN budget_at >= date_trunc('day', CURRENT_TIMESTAMP) THEN amount_nano ELSE 0 END), 0) AS day, coalesce(sum(amount_nano), 0) AS month FROM doc.search_spending WHERE budget_at >= date_trunc('month', CURRENT_TIMESTAMP)",
			),
		])
		if (!control || control.halted) return { kind: "basic", reason: "budget" }
		const now = Number(spend.now)
		if (
			Number(spend.day) + input.reserveNano > DAILY_NANO ||
			Number(spend.month) + input.reserveNano > MONTHLY_NANO
		)
			return { kind: "basic", reason: "budget" }
		const scopes = await scopesReady
		if (!scopes.length) return { kind: "basic", reason: "configuration" }
		const id = randomUUID()
		const admitted = await this.coordination.claim(
			id,
			input.cacheKey,
			scopes,
			input.admissionAttemptId,
		)
		if (admitted !== "ok") return { kind: "basic", reason: admitted }
		let claimed = false
		try {
			// Both inserts run in parallel.
			// - A primary-key insert of the attempt also protects duplicates if a Redis lease is lost. Abandoned/unknown
			//   attempts stay blocked until explicitly reconciled.
			// - Immutable estimate, followed by a separate immutable adjustment on success. If the response is lost,
			//   retain the estimate; never infer a refund.
			const [inserted, estimate] = await Promise.allSettled([
				this.execute(
					"INSERT INTO doc.search_interpretations (cache_key, attempt_id, status, contract, created_at) VALUES (?, ?, 'pending', ?, ?) ON CONFLICT DO NOTHING",
					[input.cacheKey, id, input.contract, now],
				),
				this.execute(
					"INSERT INTO doc.search_spending (id, attempt_id, cache_key, event, budget_at, created_at, amount_nano, price_version) VALUES (?, ?, ?, 'estimate', ?, ?, ?, ?)",
					[
						`${id}:estimate`,
						id,
						input.cacheKey,
						now,
						now,
						input.reserveNano,
						input.priceVersion,
					],
				),
			])
			if (inserted.status === "rejected" || inserted.value.rowcount !== 1) {
				// No paid call happens for this attempt: settle its estimate at zero, as finish(id, 0) does for a search
				// cancelled before dispatch. If that fails, the estimate stays counted, which only errs on the safe side.
				if (estimate.status === "fulfilled")
					await this.execute(
						"INSERT INTO doc.search_spending (id, attempt_id, cache_key, event, budget_at, created_at, amount_nano) VALUES (?, ?, ?, 'settlement', ?, CURRENT_TIMESTAMP, ?) ON CONFLICT DO NOTHING",
						[`${id}:settled`, id, input.cacheKey, now, -input.reserveNano],
					).catch(() => {})
				if (inserted.status === "rejected") throw inserted.reason
				const cached = await this.lookup(input.cacheKey)
				if (cached) return cached
				const [prior] = await this.query<Interpretation>(
					"SELECT * FROM doc.search_interpretations WHERE cache_key = ?",
					[input.cacheKey],
				)
				return {
					kind: "basic",
					reason:
						prior?.status === "unknown" || now - prior?.created_at > 30000
							? "unknown"
							: "busy",
				}
			}
			if (estimate.status === "rejected") throw estimate.reason
			claimed = true
			return { kind: "claimed", id }
		} finally {
			if (!claimed) await this.coordination.release(id, input.cacheKey)
		}
	}
	private async reservation(id: string) {
		const [row] = await this.query<Reservation>(
			"SELECT cache_key, budget_at, amount_nano FROM doc.search_spending WHERE id = ?",
			[`${id}:estimate`],
		)
		if (!row) throw new Error("Search attempt unavailable")
		return row
	}
	async dispatch(id: string) {
		const row = await this.reservation(id)
		await this.coordination.dispatch(id, row.cache_key)
	}
	async haltPaidAdmissions() {
		await this.execute(
			"UPDATE doc.search_control SET halted = true WHERE id = 'paid'",
		)
	}
	async finish(id: string, costNano: number | null, value?: unknown) {
		if (costNano !== null && (!Number.isSafeInteger(costNano) || costNano < 0))
			throw new Error("Invalid search cost")
		// Primary-key reads see writes immediately, independently of search refresh. Both reads run in parallel.
		const settled = this.query<{ id: string }>(
			"SELECT id FROM doc.search_spending WHERE id = ?",
			[`${id}:settled`],
		)
		// Handled below; this only keeps an early rejection from counting as unhandled.
		settled.catch(() => {})
		const row = await this.reservation(id)
		try {
			const [previous] = await settled
			if (previous) return
			if (costNano === null) {
				await this.execute(
					"UPDATE doc.search_interpretations SET status = 'unknown' WHERE cache_key = ?",
					[row.cache_key],
				)
				return
			}
			if (costNano > Number(row.amount_nano)) await this.haltPaidAdmissions()
			const ciphertext =
				value !== undefined && costNano <= Number(row.amount_nano)
					? this.seal(value)
					: null
			if (ciphertext !== null) {
				await this.execute(
					"UPDATE doc.search_interpretations SET status = 'ready', ciphertext = ? WHERE cache_key = ?",
					[ciphertext, row.cache_key],
				)
			} else {
				await this.execute(
					"UPDATE doc.search_interpretations SET status = 'unknown' WHERE cache_key = ?",
					[row.cache_key],
				)
			}
			await this.execute(
				"INSERT INTO doc.search_spending (id, attempt_id, cache_key, event, budget_at, created_at, amount_nano) VALUES (?, ?, ?, 'settlement', ?, CURRENT_TIMESTAMP, ?) ON CONFLICT DO NOTHING",
				[
					`${id}:settled`,
					id,
					row.cache_key,
					row.budget_at,
					costNano - Number(row.amount_nano),
				],
			)
			if (ciphertext !== null)
				await this.coordination.cache(row.cache_key, ciphertext)
			else if (costNano <= Number(row.amount_nano)) {
				// Billing is known: a later explicit search can retry. Never retry here.
				await this.execute("DELETE FROM doc.search_interpretations WHERE cache_key = ?", [row.cache_key])
			}
		} finally {
			await this.coordination.release(id, row.cache_key)
		}
	}
	async reconcileUnknown(id: string, actualNano: number, evidence: string) {
		if (!evidence.trim() || !Number.isSafeInteger(actualNano) || actualNano < 0)
			throw new Error("Reconciliation requires verified cost and evidence")
		const row = await this.reservation(id)
		const [settled] = await this.query<{ id: string }>(
			"SELECT id FROM doc.search_spending WHERE id = ?",
			[`${id}:settled`],
		)
		if (settled) return false
		if (actualNano > Number(row.amount_nano)) await this.haltPaidAdmissions()
		const result = await this.execute(
			"INSERT INTO doc.search_spending (id, attempt_id, cache_key, event, budget_at, created_at, amount_nano, evidence) VALUES (?, ?, ?, 'reconciliation', ?, CURRENT_TIMESTAMP, ?, ?) ON CONFLICT DO NOTHING",
			[
				`${id}:settled`,
				id,
				row.cache_key,
				row.budget_at,
				actualNano - Number(row.amount_nano),
				this.seal({ evidence }),
			],
		)
		// No automatic paid retry. Maintenance may explicitly release an abandoned cache key.
		return result.rowcount === 1
	}
	async history(input: {
		text: string
		accountId: string | null
		elapsedMs: number
		chargedNano: number
		outcome: "ready" | "cached" | "basic"
		reason?: BasicReason
		// The ranking that produced the served list, so results can be compared by version.
		rankerVersion: string
		// Why the basic search served a search that has a reading, instead of the ranking.
		rankerFallback?: string
		// Milliseconds per stage (reading, ranking, display, ...), rounded to 0.1 ms.
		stageMs?: Record<string, number>
	}): Promise<string> {
		const id = randomUUID()
		await this.execute(
			"INSERT INTO doc.search_history (id, created_at, account_id, ciphertext, elapsed_ms, charged_nano, outcome, reason, ranker_version, ranker_fallback, stage_ms) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			[
				id,
				input.accountId,
				this.seal({ text: input.text }),
				Math.max(0, Math.round(input.elapsedMs)),
				input.chargedNano,
				input.outcome,
				input.reason ?? null,
				input.rankerVersion,
				input.rankerFallback ?? null,
				input.stageMs ?? null,
			],
		)
		return id
	}
}

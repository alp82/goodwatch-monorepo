import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	randomUUID,
} from "node:crypto"
import { searchStatement } from "../combined-search/catalog.server"
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
	if (!key || !/^[a-fA-F0-9]{64}$/.test(key))
		throw new Error("Search storage key is not configured")
	return new SearchStore(
		searchStatement,
		new SearchCoordination(),
		Buffer.from(key, "hex"),
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
	async claim(input: {
		cacheKey: string
		contract: string
		scopes: string[]
		reserveNano: number
		priceVersion: string
		admissionAttemptId?: string
	}): Promise<Claim> {
		if (
			!input.scopes.length ||
			!Number.isSafeInteger(input.reserveNano) ||
			input.reserveNano <= 0
		)
			return { kind: "basic", reason: "configuration" }
		const hit = await this.lookup(input.cacheKey)
		if (hit) return hit
		const [control] = await this.query<{ halted: boolean }>(
			"SELECT halted FROM doc.search_control WHERE id = 'paid'",
		)
		if (!control || control.halted) return { kind: "basic", reason: "budget" }
		const [{ now }] = await this.query<{ now: number }>(
			"SELECT CURRENT_TIMESTAMP AS now",
		)
		const date = new Date(now)
		const day = Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
		)
		const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
		const [spend] = await this.query<{ day: number; month: number }>(
			"SELECT coalesce(sum(CASE WHEN budget_at >= ? THEN amount_nano ELSE 0 END), 0) AS day, coalesce(sum(amount_nano), 0) AS month FROM doc.search_spending WHERE budget_at >= ?",
			[day, month],
		)
		if (
			Number(spend.day) + input.reserveNano > DAILY_NANO ||
			Number(spend.month) + input.reserveNano > MONTHLY_NANO
		)
			return { kind: "basic", reason: "budget" }
		const id = randomUUID()
		const admitted = await this.coordination.claim(
			id,
			input.cacheKey,
			input.scopes,
			input.admissionAttemptId,
		)
		if (admitted !== "ok") return { kind: "basic", reason: admitted }
		let claimed = false
		try {
			// A primary-key insert also protects duplicates if a Redis lease is lost.
			// Abandoned/unknown attempts stay blocked until explicitly reconciled.
			const inserted = await this.execute(
				"INSERT INTO doc.search_interpretations (cache_key, attempt_id, status, contract, created_at) VALUES (?, ?, 'pending', ?, ?) ON CONFLICT DO NOTHING",
				[input.cacheKey, id, input.contract, now],
			)
			if (inserted.rowcount !== 1) {
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
			// Immutable estimate, followed by a separate immutable adjustment on success.
			// If the response is lost, retain the estimate; never infer a refund.
			await this.execute(
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
			)
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
		const row = await this.reservation(id)
		try {
			// Primary-key reads see writes immediately, independently of search refresh.
			const [previous] = await this.query<{ id: string }>(
				"SELECT id FROM doc.search_spending WHERE id = ?",
				[`${id}:settled`],
			)
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
	}) {
		await this.execute(
			"INSERT INTO doc.search_history (id, created_at, account_id, ciphertext, elapsed_ms, charged_nano, outcome, reason) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)",
			[
				randomUUID(),
				input.accountId,
				this.seal({ text: input.text }),
				Math.max(0, Math.round(input.elapsedMs)),
				input.chargedNano,
				input.outcome,
				input.reason ?? null,
			],
		)
	}
}

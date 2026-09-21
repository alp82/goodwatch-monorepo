import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	randomUUID,
} from "node:crypto";
import { Pool, type PoolClient } from "pg";

export const DAILY_NANO = 1_000_000_000;
export const MONTHLY_NANO = 5_000_000_000;
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
	| "contract";
export type Claim =
	| { kind: "claimed"; id: string }
	| { kind: "cached"; ciphertext: string }
	| { kind: "basic"; reason: BasicReason };

// PostgreSQL only: Crate and evictable Redis cannot supply this transaction contract.
// Dedicated pool bypasses application SQL logging. Do not add parameter/error logging here.
export function productionStore() {
	const url = process.env.SEARCH_DATABASE_URL;
	const key = process.env.SEARCH_STORAGE_KEY;
	if (!url || !key || !/^[a-fA-F0-9]{64}$/.test(key))
		throw new Error("Search storage is not configured");
	return new SearchStore(
		new Pool({
			connectionString: url,
			max: 8,
			connectionTimeoutMillis: 500,
			statement_timeout: 1000,
			query_timeout: 1200,
			application_name: "search-runtime",
			options: "-c lock_timeout=500ms",
		}),
		Buffer.from(key, "hex"),
	);
}

export class SearchStore {
	constructor(
		readonly pool: Pool,
		private readonly key: Buffer,
	) {
		if (key.length !== 32) throw new Error("Invalid search storage key");
		// Never print the original error: database/provider messages can contain input.
		pool.on("error", () => {});
	}
	digest(value: string) {
		return createHmac("sha256", this.key).update(value).digest("hex");
	}
	seal(value: unknown) {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		const encrypted = Buffer.concat([
			cipher.update(JSON.stringify(value), "utf8"),
			cipher.final(),
		]);
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
			"base64",
		);
	}
	unseal<T>(value: string): T {
		const bytes = Buffer.from(value, "base64");
		const cipher = createDecipheriv(
			"aes-256-gcm",
			this.key,
			bytes.subarray(0, 12),
		);
		cipher.setAuthTag(bytes.subarray(12, 28));
		return JSON.parse(
			Buffer.concat([
				cipher.update(bytes.subarray(28)),
				cipher.final(),
			]).toString("utf8"),
		) as T;
	}
	async transaction<T>(work: (db: PoolClient) => Promise<T>) {
		const db = await this.pool.connect();
		try {
			await db.query("BEGIN");
			const result = await work(db);
			await db.query("COMMIT");
			return result;
		} catch {
			await db.query("ROLLBACK").catch(() => {});
			throw new Error("Search storage unavailable");
		} finally {
			db.release();
		}
	}
	async lookup(cacheKey: string): Promise<Claim | undefined> {
		const { rows } = await this.pool.query(
			"SELECT status, ciphertext FROM search_runtime.interpretation WHERE cache_key=$1",
			[cacheKey],
		);
		const row = rows[0];
		return row?.status === "ready"
			? { kind: "cached", ciphertext: row.ciphertext }
			: undefined;
	}
	async claim(input: {
		cacheKey: string;
		contract: string;
		scopes: string[];
		reserveNano: number;
		priceVersion: string;
		// Server-only prior stage, never accepted from the browser.
		admissionAttemptId?: string;
	}): Promise<Claim> {
		if (
			!input.scopes.length ||
			!Number.isSafeInteger(input.reserveNano) ||
			input.reserveNano <= 0
		)
			return { kind: "basic", reason: "configuration" };
		return this.transaction(async (db) => {
			// One short global lock serializes BOTH windows, visitor admission, and cache claims.
			// Database time is authoritative; app-server clocks do not select budget windows.
			const { rows: controls } = await db.query(
				"SELECT halted FROM search_runtime.control WHERE id=true FOR UPDATE",
			);
			const { rows: orphans } = await db.query(
				"UPDATE search_runtime.attempt SET status='unknown' WHERE status IN ('reserved','dispatched') AND created_at < clock_timestamp()-interval '30 seconds' RETURNING id",
			);
			if (orphans.length)
				await db.query(
					"UPDATE search_runtime.interpretation SET status='unknown' WHERE attempt_id=ANY($1::uuid[])",
					[orphans.map((row) => row.id)],
				);
			const { rows: cached } = await db.query(
				"SELECT status, ciphertext FROM search_runtime.interpretation WHERE cache_key=$1",
				[input.cacheKey],
			);
			if (cached[0]?.status === "ready")
				return { kind: "cached", ciphertext: cached[0].ciphertext };
			if (cached[0])
				return {
					kind: "basic",
					reason: cached[0].status === "unknown" ? "unknown" : "busy",
				};
			if (!controls[0] || controls[0].halted)
				return { kind: "basic", reason: "budget" };
			await db.query(
				"DELETE FROM search_runtime.admission WHERE admitted_at < clock_timestamp() - interval '2 minutes'",
			);
			// Reuse the visitor allowance only when this prior paid stage actually admitted
            // the same scope recently. Each stage still counts toward global provider load.
            const { rows: prior } = input.admissionAttemptId ? await db.query(
                "SELECT scope FROM search_runtime.admission WHERE attempt_id=$1 AND scope=ANY($2::text[]) AND admitted_at > clock_timestamp()-interval '1 minute'",
                [input.admissionAttemptId, input.scopes],
            ) : { rows: [] };
            const priorScopes = new Set(prior.map(row => row.scope));
            const scopes = input.scopes.filter(scope => scope === "global" || !priorScopes.has(scope));
			const { rows: rates } = await db.query(
				"SELECT scope,count(*)::integer AS n FROM search_runtime.admission WHERE scope=ANY($1::text[]) AND admitted_at > clock_timestamp()-interval '1 minute' GROUP BY scope",
				[scopes],
			);
			if (rates.some((row) => row.n >= (row.scope === "global" ? 240 : 20)))
				return { kind: "basic", reason: "rate" };
			const { rows: active } = await db.query(
				"SELECT count(*)::integer AS n FROM search_runtime.attempt WHERE status IN ('reserved','dispatched')",
			);
			if (active[0].n >= 16) return { kind: "basic", reason: "busy" };
			const { rows: windows } = await db.query(
				"SELECT (statement_timestamp() AT TIME ZONE 'UTC')::date::text AS day, date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC')::date::text AS month",
			);
			const { day, month } = windows[0];
			await db.query(
				"INSERT INTO search_runtime.budget(kind, starts) VALUES ('day',$1),('month',$2) ON CONFLICT DO NOTHING",
				[day, month],
			);
			const { rows: budgets } = await db.query(
				"SELECT kind,charged_nano FROM search_runtime.budget WHERE (kind='day' AND starts=$1) OR (kind='month' AND starts=$2)",
				[day, month],
			);
			if (
				budgets.some(
					(row) =>
						Number(row.charged_nano) + input.reserveNano >
						(row.kind === "day" ? DAILY_NANO : MONTHLY_NANO),
				)
			)
				return { kind: "basic", reason: "budget" };
			const id = randomUUID();
			await db.query(
				"UPDATE search_runtime.budget SET charged_nano=charged_nano+$3 WHERE (kind='day' AND starts=$1) OR (kind='month' AND starts=$2)",
				[day, month, input.reserveNano],
			);
			await db.query(
				"INSERT INTO search_runtime.attempt(id,cache_key,day_start,month_start,status,reserved_nano,charged_nano,price_version) VALUES ($1,$2,$3,$4,'reserved',$5,$5,$6)",
				[id, input.cacheKey, day, month, input.reserveNano, input.priceVersion],
			);
			await db.query(
				"INSERT INTO search_runtime.interpretation(cache_key,attempt_id,status,contract) VALUES ($1,$2,'pending',$3)",
				[input.cacheKey, id, input.contract],
			);
			await db.query(
				"INSERT INTO search_runtime.admission(scope, attempt_id) SELECT unnest($1::text[]), $2::uuid",
				[Array.from(new Set(scopes)), id],
			);
			return { kind: "claimed", id };
		});
	}
	async haltPaidAdmissions() {
		await this.pool.query(
			"UPDATE search_runtime.control SET halted=true WHERE id=true",
		);
	}
	async dispatch(id: string) {
		const { rowCount } = await this.pool.query(
			"UPDATE search_runtime.attempt SET status='dispatched' WHERE id=$1 AND status='reserved'",
			[id],
		);
		if (rowCount !== 1) throw new Error("Search dispatch unavailable");
	}
	async finish(id: string, costNano: number | null, value?: unknown) {
		if (costNano !== null && (!Number.isSafeInteger(costNano) || costNano < 0))
			throw new Error("Invalid search cost");
		return this.transaction(async (db) => {
			await db.query(
				"SELECT id FROM search_runtime.control WHERE id=true FOR UPDATE",
			);
			const { rows } = await db.query(
				"SELECT * FROM search_runtime.attempt WHERE id=$1 FOR UPDATE",
				[id],
			);
			const row = rows[0];
			if (!row || row.status === "settled") return;
			if (costNano === null) {
				await db.query(
					"UPDATE search_runtime.attempt SET status='unknown' WHERE id=$1",
					[id],
				);
				await db.query(
					"UPDATE search_runtime.interpretation SET status='unknown' WHERE attempt_id=$1",
					[id],
				);
				return;
			}
			const delta = costNano - Number(row.charged_nano);
			await db.query(
				"UPDATE search_runtime.budget SET charged_nano=charged_nano+$3 WHERE (kind='day' AND starts=$1) OR (kind='month' AND starts=$2)",
				[row.day_start, row.month_start, delta],
			);
			await db.query(
				"UPDATE search_runtime.attempt SET status='settled',charged_nano=$2 WHERE id=$1",
				[id, costNano],
			);
			if (costNano > Number(row.reserved_nano)) {
				await db.query(
					"UPDATE search_runtime.control SET halted=true WHERE id=true",
				);
				await db.query(
					"UPDATE search_runtime.interpretation SET status='unknown' WHERE attempt_id=$1",
					[id],
				);
			} else if (value !== undefined) {
				await db.query(
					"UPDATE search_runtime.interpretation SET status='ready',ciphertext=$2,created_at=clock_timestamp() WHERE attempt_id=$1",
					[id, this.seal(value)],
				);
			} else {
				await db.query(
					"DELETE FROM search_runtime.interpretation WHERE attempt_id=$1",
					[id],
				);
			}
		});
	}
	// Maintenance marks orphaned attempts unknown. Never refunds or automatically retries them.
	async recoverOrphans() {
		return this.transaction(async (db) => {
			await db.query(
				"SELECT id FROM search_runtime.control WHERE id=true FOR UPDATE",
			);
			const { rows } = await db.query(
				"UPDATE search_runtime.attempt SET status='unknown' WHERE status IN ('reserved','dispatched') AND created_at < clock_timestamp()-interval '30 seconds' RETURNING id",
			);
			await db.query(
				"UPDATE search_runtime.interpretation SET status='unknown' WHERE attempt_id=ANY($1::uuid[])",
				[rows.map((row) => row.id)],
			);
			return rows.length;
		});
	}
	// Operator-only reconciliation: evidence must establish the TOTAL cost of BOTH calls.
	// Not exposed as an HTTP route. Unknown attempts are never refunded merely for age.
	async reconcileUnknown(id: string, actualNano: number, evidence: string) {
		if (!Number.isSafeInteger(actualNano) || actualNano < 0 || !evidence.trim())
			throw new Error("Reconciliation requires verified cost and evidence");
		return this.transaction(async (db) => {
			await db.query(
				"SELECT id FROM search_runtime.control WHERE id=true FOR UPDATE",
			);
			const { rows } = await db.query(
				"SELECT * FROM search_runtime.attempt WHERE id=$1 AND status='unknown' FOR UPDATE",
				[id],
			);
			const row = rows[0];
			if (!row) return false;
			await db.query(
				"UPDATE search_runtime.budget SET charged_nano=charged_nano+$3 WHERE (kind='day' AND starts=$1) OR (kind='month' AND starts=$2)",
				[row.day_start, row.month_start, actualNano - Number(row.charged_nano)],
			);
			await db.query(
				"UPDATE search_runtime.attempt SET status='settled',charged_nano=$2,reconciliation_evidence=$3 WHERE id=$1",
				[id, actualNano, this.seal({ evidence })],
			);
			await db.query(
				"DELETE FROM search_runtime.interpretation WHERE attempt_id=$1",
				[id],
			);
			if (actualNano > Number(row.reserved_nano))
				await db.query(
					"UPDATE search_runtime.control SET halted=true WHERE id=true",
				);
			return true;
		});
	}
	async history(input: {
		text: string;
		accountId: string | null;
		elapsedMs: number;
		chargedNano: number;
		outcome: "ready" | "cached" | "basic";
		reason?: BasicReason;
	}) {
		await this.pool.query(
			"INSERT INTO search_runtime.history(id,account_id,ciphertext,elapsed_ms,charged_nano,outcome,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)",
			[
				randomUUID(),
				input.accountId,
				this.seal({ text: input.text }),
				Math.max(0, Math.round(input.elapsedMs)),
				input.chargedNano,
				input.outcome,
				input.reason ?? null,
			],
		);
	}
}

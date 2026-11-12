// Explicit isolated Crate test: no application configuration or production credentials are loaded.
import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { build } from "esbuild"
import { randomBytes } from "node:crypto"
const endpoint = new URL(
	process.env.SEARCH_OVERFLOW_TEST_CRATE_URL || "http://127.0.0.1:45212/_sql",
)
if (!["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))
	throw Error("Integration test requires a loopback Crate endpoint")
const schema = "overflow_test_" + randomBytes(6).toString("hex")
async function sql(stmt, args = []) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt: stmt.replaceAll("doc.", schema + "."), args }),
	})
	const result = await response.json()
	if (!response.ok || result.error)
		throw Error(result.error?.message || response.statusText)
	return result
}
const output = await build({
	entryPoints: [
		new URL("../../app/server/search-runtime/store.server.ts", import.meta.url)
			.pathname,
	],
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
	packages: "external",
	logLevel: "silent",
	plugins: [
		{
			name: "no-live-backends",
			setup(b) {
				b.onResolve(
					{ filter: /combined-search\/catalog\.server|^~\/utils\/cache$/ },
					(a) => ({ path: a.path, namespace: "blocked" }),
				)
				b.onLoad({ filter: /.*/, namespace: "blocked" }, (a) => ({
					contents: a.path.includes("catalog")
						? 'export function searchStatement(){throw Error("Live Crate forbidden")}'
						: 'export function getRedisCluster(){throw Error("Live Redis forbidden")}',
				}))
			},
		},
	],
})
const { SearchStore, JEV_BUDGET } = await import(
	"data:text/javascript;base64," +
		Buffer.from(output.outputFiles[0].text).toString("base64")
)
const coordination = {
	claim: async () => "ok",
	release: async () => {},
	cache: async () => {},
}
const key = Buffer.alloc(32, 1)
const overflowBudget = {
	pool: "openrouter-overflow",
	monthlyNano: 1e9,
	dailyNano: 1e9,
	resetDay: 1,
}
const input = {
	cacheKey: "key",
	contract: "test",
	scopes: ["global"],
	reserveNano: 10000000,
	priceVersion: "test",
	attribution: {
		version: 1,
		consumer: "web",
		surface: "start",
		trigger: "enter",
		actor_kind: "guest",
		reported_by: "client",
	},
}

test("real Crate migration, cycle boundaries, independent pools, settlement and history", async (t) => {
	t.after(async () => {
		for (const table of [
			"search_spending",
			"search_history",
			"search_interpretations",
			"search_control",
		])
			await sql("DROP TABLE IF EXISTS doc." + table)
	})
	for (const ddl of [
		"CREATE TABLE doc.search_spending (id TEXT PRIMARY KEY,attempt_id TEXT,cache_key TEXT,event TEXT,budget_at TIMESTAMP WITH TIME ZONE,created_at TIMESTAMP WITH TIME ZONE,amount_nano BIGINT,price_version TEXT,evidence TEXT,attribution OBJECT(IGNORED)) WITH (number_of_replicas=0)",
		"CREATE TABLE doc.search_history (id TEXT PRIMARY KEY,created_at TIMESTAMP WITH TIME ZONE,account_id TEXT,ciphertext TEXT,elapsed_ms INTEGER,charged_nano BIGINT,outcome TEXT,reason TEXT,ranker_version TEXT,ranker_fallback TEXT,stage_ms OBJECT(DYNAMIC),attribution OBJECT(IGNORED)) WITH (number_of_replicas=0)",
		"CREATE TABLE doc.search_interpretations (cache_key TEXT PRIMARY KEY,attempt_id TEXT,status TEXT,contract TEXT,created_at TIMESTAMP WITH TIME ZONE,ciphertext TEXT) WITH (number_of_replicas=0)",
		"CREATE TABLE doc.search_control (id TEXT PRIMARY KEY,halted BOOLEAN) WITH (number_of_replicas=0)",
	])
		await sql(ddl)
	for (const stmt of readFileSync(
		new URL(
			"../migrations/2026-11-12-search-overflow-budget.sql",
			import.meta.url,
		),
		"utf8",
	)
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean))
		await sql(stmt)
	await sql("INSERT INTO doc.search_control (id,halted) VALUES ('paid',false)")
	const primary = new SearchStore(sql, coordination, key, JEV_BUDGET),
		overflow = new SearchStore(sql, coordination, key, overflowBudget)
	// Test the actual primary cycle expression against fixed timestamps on both sides of renewal, including January.
	let spendingQuery
	await new SearchStore(
		async (stmt, args) => {
			if (stmt.startsWith("SELECT CURRENT_TIMESTAMP")) spendingQuery = stmt
			return sql(stmt, args)
		},
		coordination,
		key,
		JEV_BUDGET,
	).claimChecks()
	const expression = spendingQuery.match(
		/WHERE budget_at >= (.*?) AND coalesce/,
	)[1]
	for (const [now, start] of [
		["2026-11-16T23:59:59Z", "2026-10-17T00:00:00Z"],
		["2026-11-17T00:00:00Z", "2026-11-17T00:00:00Z"],
		["2027-01-01T00:00:00Z", "2026-12-17T00:00:00Z"],
		["2027-01-17T00:00:00Z", "2027-01-17T00:00:00Z"],
	]) {
		const result = await sql(
			"SELECT " +
				expression.replaceAll(
					"CURRENT_TIMESTAMP",
					"?::timestamp with time zone",
				),
			[now],
		)
		assert.equal(result.rows[0][0], Date.parse(start))
	}
	await sql(
		"INSERT INTO doc.search_spending (id,budget_at,amount_nano,budget_pool) VALUES ('legacy',CURRENT_TIMESTAMP,5000000000,NULL),('other',CURRENT_TIMESTAMP,300000000,'openrouter-overflow')",
	)
	await sql("REFRESH TABLE doc.search_spending,doc.search_control")
	assert.deepEqual(await primary.claim(input), {
		kind: "basic",
		reason: "budget",
		overflowEligible: true,
	})
	const admitted = await overflow.claim(input)
	assert.equal(admitted.kind, "claimed")
	await overflow.finish(admitted.id, 163000, [
		{ model: "liquid" },
		{ model: "liquid" },
	])
	await sql("REFRESH TABLE doc.search_spending")
	const total = await sql(
		"SELECT coalesce(budget_pool,'jev'),sum(amount_nano) FROM doc.search_spending GROUP BY 1 ORDER BY 1",
	)
	assert.deepEqual(total.rows, [
		["jev", 5000000000],
		["openrouter-overflow", 300163000],
	])
	await overflow.history({
		text: "private",
		accountId: null,
		elapsedMs: 10,
		chargedNano: 163000,
		outcome: "ready",
		rankerVersion: "test",
		interpretationProvider: "openrouter",
		interpretationModel: "liquid/d1.1-20261027",
		overflowReason: "cycle-budget",
	})
	await sql("REFRESH TABLE doc.search_history")
	assert.deepEqual(
		(
			await sql(
				"SELECT interpretation_provider,interpretation_model,overflow_reason FROM doc.search_history",
			)
		).rows,
		[["openrouter", "liquid/d1.1-20261027", "cycle-budget"]],
	)
	// Unknown billing holds the full overflow estimate and stays blocked, then verified reconciliation uses that pool.
	const unknown = await overflow.claim({ ...input, cacheKey: "lost" })
	await overflow.finish(unknown.id, null)
	await overflow.reconcileUnknown(
		unknown.id,
		200000,
		"verified provider billing",
	)
	await sql("REFRESH TABLE doc.search_spending")
	assert.equal(
		(
			await sql(
				"SELECT sum(amount_nano) FROM doc.search_spending WHERE budget_pool='openrouter-overflow'",
			)
		).rows[0][0],
		300363000,
	)
})

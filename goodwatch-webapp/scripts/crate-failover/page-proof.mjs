import assert from "node:assert/strict"
import { createServer } from "node:http"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"
import { createStaticHandler } from "@remix-run/router"
import { withCrateHttpRequest } from "../../app/utils/crate-diagnostics.ts"

// External services are replaced by build-page-proof.mjs. Every Crate query, loader and write recovery is real.
export async function preparePageProof(sql) {
	const loaders = await import("./page-loaders.generated.mjs")
	const schemaPath = fileURLToPath(
		new URL(
			"../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py",
			import.meta.url,
		),
	)
	const windmill = fileURLToPath(
		new URL("../../../goodwatch-flows/windmill", import.meta.url),
	)
	const { stdout } = await promisify(execFile)(
		"python3",
		[
			"-c",
			`import json,runpy,sys;sys.path.insert(0,sys.argv[2]);print(json.dumps(runpy.run_path(sys.argv[1])['SCHEMAS']))`,
			schemaPath,
			windmill,
		],
		{ maxBuffer: 2_000_000 },
	)
	const schemas = JSON.parse(stdout)
	for (const [table, schema] of Object.entries(schemas)) {
		const columns = { ...schema.columns }
		// Exercise the additive rollout against the previous physical schema, not just CREATE with the new field.
		if (table === "user_watch_state") delete columns.insert_token
		if (schema.timestamps !== false)
			for (const col of ["created_at", "updated_at"])
				columns[col] ??= "TIMESTAMP"
		const definitions = Object.entries(columns).map(
			([col, type]) => `"${col}" ${type}`,
		)
		definitions.push(
			`PRIMARY KEY (${schema.primary_key.map((col) => `"${col}"`).join(",")})`,
		)
		await sql(
			`CREATE TABLE "${table}" (${definitions.join(",")}) CLUSTERED ${schema.clustered_by ? `BY ("${schema.clustered_by}") ` : ""}INTO 1 SHARDS WITH (number_of_replicas = '1', "translog.durability" = 'REQUEST')`,
		)
	}
	const legacyState = ["proof-legacy-member", 42, "show", "watching", Date.UTC(2020, 0, 1), 1, Date.UTC(2020, 0, 1), Date.UTC(2020, 0, 1)]
	await sql("INSERT INTO user_watch_state (user_id,tmdb_id,media_type,state,state_changed_at,pass,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)", legacyState)
	const legacyKey = legacyState.slice(0, 3)
	const legacyBefore = (await sql("SELECT state,pass,_seq_no FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?", legacyKey)).rows
	await sql("ALTER TABLE user_watch_state ADD COLUMN insert_token TEXT")
	const legacyAfter = (await sql("SELECT state,pass,_seq_no,insert_token FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?", legacyKey)).rows
	assert.deepEqual(legacyAfter, legacyBefore.map((row) => [...row, null]), "Additive migration preserves old rows and versions without backfill")
	const migration = { legacyRowsPreserved: true, insertTokenNullable: true, backfillNeeded: false }
	if (!schemas.user_not_interested)
		await sql(
			`CREATE TABLE user_not_interested (user_id TEXT,tmdb_id INTEGER,media_type TEXT,created_at TIMESTAMP,updated_at TIMESTAMP,PRIMARY KEY(user_id,tmdb_id,media_type)) CLUSTERED INTO 1 SHARDS WITH(number_of_replicas='1')`,
		)
	const insert = async (table, data) => {
		const columns = Object.keys(data)
		await sql(
			`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
			Object.values(data),
		)
	}
	for (const type of ["movie", "show"]) {
		for (let id = 1; id <= 12; id++) {
			await insert(type, {
				tmdb_id: id,
				title: `Proof ${type} ${id}`,
				original_title: `Proof ${type} ${id}`,
				release_year: 2022,
				poster_path: "/proof.jpg",
				backdrop_path: "/proof.jpg",
				genres: ["comedy"],
				adult: false,
				popularity: 20,
				goodwatch_overall_score_normalized_percent: 80,
				goodwatch_overall_score_voting_count: 20000,
				fingerprint_scores: Object.fromEntries(
					loaders.VALID_FINGERPRINT_KEYS.map((k) => [k, 5]),
				),
				tropes: [],
			})
			await insert("user_wishlist", {
				user_id: "proof-member",
				tmdb_id: id,
				media_type: type,
				created_at: Date.now(),
				updated_at: Date.now(),
			})
		}
	}
	const people = Array.from({ length: 1000 }, (_, i) => [
		i + 1,
		`Proof Person ${i + 1}`,
		"Acting",
	])
	await sql(
		`INSERT INTO person (tmdb_id,name,known_for_department) VALUES ${people.map(() => "(?,?,?)").join(",")}`,
		people.flat(),
	)
	const credits = people.map(([id]) => [
		`proof-credit-${id}`,
		id,
		"movie",
		1,
		"Lead",
		0,
	])
	await sql(
		`INSERT INTO person_appeared_in (credit_id,person_tmdb_id,media_type,media_tmdb_id,character,order_default) VALUES ${credits.map(() => "(?,?,?,?,?,?)").join(",")}`,
		credits.flat(),
	)
	await sql(
		`REFRESH TABLE ${Object.keys(schemas)
			.map((t) => `"${t}"`)
			.join(",")}`,
	)
	// CREATE acknowledgement is not a readiness gate for every coordinator. Start the fault from a healthy cluster.
	for (const endpoint of [
		`http://127.0.0.1:${process.env.CRATE_PROOF_PORT ?? "17430"}`,
		`http://127.0.0.2:${process.env.CRATE_PROOF_PORT ?? "17430"}`,
		`http://127.0.0.3:${process.env.CRATE_PROOF_PORT ?? "17430"}`,
	]) {
		const until = Date.now() + 90_000
		let ready = false
		while (Date.now() < until) {
			const tableCount = await sql(
				`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'doc' AND table_name IN (${Object.keys(
					schemas,
				)
					.map(() => "?")
					.join(",")})`,
				Object.keys(schemas),
				endpoint,
			)
			if (tableCount.rows[0][0] === Object.keys(schemas).length) {
				ready = true
				break
			}
			await delay(250)
		}
		assert.ok(ready, `Fixture metadata must be ready through ${endpoint}`)
	}
	loaders.makeSnapshot()
	const definitions = [
		{ id: "movie", path: "/movie/:movieKey", loader: loaders.movie },
		{ id: "show", path: "/show/:showKey", loader: loaders.show },
		{ id: "person", path: "/person/:personKey", loader: loaders.person },
		{ id: "library", path: "/api/my-library", loader: loaders.library },
		{ id: "explore", path: "/api/explorer/world", loader: loaders.explore },
		{ id: "watch", path: "/api/watch-log", action: loaders.watch },
		{ id: "score", path: "/api/update-scores", action: loaders.score },
		{ id: "tracking", path: "/api/tracking/show", action: loaders.tracking },
		{
			id: "catalog",
			path: "/api/proof-catalog",
			loader: () =>
				loaders.catalog(
					"SELECT tmdb_id,title FROM movie WHERE tmdb_id = ?",
					[1],
				),
		},
	]
	const handler = createStaticHandler(definitions)
	const routeFor = (path) =>
		definitions.find((d) =>
			new RegExp("^" + d.path.replace(/:[^/]+/g, "[^/]+") + "$").test(path),
		)?.path ?? "unmatched"
	const server = createServer((req, res) =>
		withCrateHttpRequest(req, res, routeFor, async () => {
			try {
				const chunks = []
				for await (const chunk of req) chunks.push(chunk)
				const init = { method: req.method, headers: req.headers }
				if (chunks.length) init.body = Buffer.concat(chunks)
				const answer = await handler.query(
					new Request(`http://127.0.0.1${req.url}`, init),
				)
				if (answer instanceof Response) {
					res.statusCode = answer.status
					res.end(await answer.text())
					return
				}
				res.statusCode = answer.statusCode
				const data = answer.actionData ?? answer.loaderData
				res.end(
					JSON.stringify({
						data,
						errors: answer.errors
							? Object.fromEntries(
									Object.entries(answer.errors).map(([k, e]) => [
										k,
										{
											name: e?.name,
											message: e?.message ?? e?.data,
											stack: e?.stack,
										},
									]),
								)
							: null,
					}),
				)
			} catch (error) {
				res.statusCode = 500
				res.end(JSON.stringify({ error: error.message }))
			}
		}),
	)
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
	const url = `http://127.0.0.1:${server.address().port}`
	const stats = {}
	let number = 0
	let personNumber = 0
	const acknowledgedWatches = []
	const cases = [
		["movie", "/movie/1-proof-movie-1"],
		["show", "/show/1-proof-show-1"],
		[
			"person",
			() => {
				const id = ++personNumber
				assert.ok(id <= 1000)
				return `/person/${id}-proof-person-${id}`
			},
		],
		["library", "/api/my-library"],
		["explore", "/api/explorer/world?services=all&unseen=0"],
		[
			"watch",
			"/api/watch-log",
			() => ({
				tmdb_id: 1,
				action: {
					type: "watch",
					watchId: `proof-watch-${++number}`,
					when: { precision: "unknown" },
				},
			}),
		],
		[
			"score",
			"/api/update-scores",
			() => ({ tmdb_id: 2, media_type: "show", score: 8 }),
		],
		["catalog", "/api/proof-catalog"],
	]
	const request = async ([kind, path, body], expectedStatus = 200) => {
		const start = performance.now()
		stats[kind] ??= { succeeded: 0, failed: 0, maxMs: 0, examples: [] }
		const row = stats[kind]
		let text = "",
			status
		try {
			const payload = body?.()
			const result = await fetch(
				url + (typeof path === "function" ? path() : path),
				payload
					? {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(payload),
						}
					: undefined,
			)
			status = result.status
			text = await result.text()
			assert.equal(
				status,
				expectedStatus,
				`${kind}: HTTP ${status} ${text.slice(0, 1000)}`,
			)
			const data = JSON.parse(text).data?.[kind]
			if (kind === "movie" || kind === "show")
				assert.equal(data.media.details.tmdb_id, 1)
			if (kind === "person") assert.ok(data.profile.tmdb_id > 0 && data.total > 0)
			if (kind === "library")
				assert.ok(
					data.items.length > 0,
					"Fixture library must exercise catalog reads",
				)
			if (kind === "explore")
				assert.ok(
					data.maps.length > 0,
					"Fixture Explorer must have an in-memory pool",
				)
			if (kind === "catalog") assert.equal(data[0].tmdb_id, 1)
			if (kind === "score") assert.equal(data.status, "success")
			if (kind === "watch") {
				assert.equal(data.status, "applied")
				assert.equal(data.refused, null)
				acknowledgedWatches.push(payload.action.watchId)
			}
			if (kind === "tracking" && expectedStatus === 200) assert.equal(data.status, "applied")
			row.succeeded++
			return data
		} catch (error) {
			row.failed++
			if (row.examples.length < 8)
				row.examples.push({
					status,
					text: text.slice(0, 1600),
					error: error.message.slice(0, 1800),
				})
			throw error
		} finally {
			row.maxMs = Math.max(row.maxMs, performance.now() - start)
		}
	}
	return {
		tables: Object.keys(schemas),
		migration,
		stats,
		acknowledgedWatches,
		movieAction: (id, action) => request(["watch", "/api/watch-log", () => ({ tmdb_id: id, action })]),
		trackingFailure: (id, event, status) => request(["tracking", "/api/tracking/show", () => ({ id, event })], status),
		trackingAction: (id, event, actionId) => request(["tracking", "/api/tracking/show", () => ({ id, event, actionId })]),
		requestRoute: (kind) => request(cases.find(([name]) => name === kind)),
		warm: async () => {
			const errors = []
			for (const c of cases) {
				try {
					await request(c)
				} catch (e) {
					errors.push(e.message)
				}
			}
			if (errors.length) throw new Error(errors.join("\n"))
		},
		load: async (durationMs) => {
			const until = Date.now() + durationMs
			await Promise.all(
				cases.map((c) =>
					(async () => {
						while (Date.now() < until) {
							try {
								await request(c)
							} catch {}
							await delay(35)
						}
					})(),
				),
			)
			return stats
		},
		close: async () => {
			server.closeAllConnections()
			await new Promise((resolve) => server.close(resolve))
		},
	}
}

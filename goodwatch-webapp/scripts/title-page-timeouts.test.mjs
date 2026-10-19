// Run after npm run build: real production loaders and SSR, with only a loopback SQL fixture. No external stores.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { existsSync } from "node:fs"
import { createServer } from "node:http"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"

const agents = [
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	"Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36",
]
const grid = {
	cols: [
		"imdb_episode_id",
		"season_number",
		"episode_number",
		"name",
		"score",
		"votes",
	],
	rows: [["tt999999900", 1, 1, "Pilot", 8, 200]],
}
function answer(response, data = { cols: [], rows: [] }) {
	response.setHeader("Content-Type", "application/json")
	response.end(
		JSON.stringify({ ...data, rowcount: data.rows.length, duration: 1 }),
	)
}
async function listen(server) {
	server.listen(0, "127.0.0.1")
	await once(server, "listening")
	return server.address().port
}

test(
	"production title loaders bound stalled dependencies and recover without caching omissions",
	{ timeout: 30000 },
	async (t) => {
		assert.ok(existsSync("build/server/index.js"), "Run npm run build first")
		let mode = "grid"
		const held = new Set()
		const sql = createServer(async (request, response) => {
			let body = ""
			for await (const chunk of request) body += chunk
			const { stmt } = JSON.parse(body)
			const isGrid = stmt.includes("FROM imdb_episode")
			if (
				(mode === "grid" && isGrid) ||
				(mode === "details" && stmt.includes("params_media_tmdb_id"))
			) {
				held.add(response)
				response.once("close", () => held.delete(response))
				return
			}
			if (stmt.includes("params_media_tmdb_id")) {
				const id = Number(stmt.match(/SELECT (\d+) AS val/)[1])
				return answer(response, {
					cols: ["media"],
					rows: [
						[
							{
								details: {
									tmdb_id: id,
									title: "Fixture",
									release_year: 2020,
									genres: [],
									tropes: [],
									keywords: [],
									synopsis: "A test title.",
									original_language_code: "en",
								},
								seasons: [],
								cast_rows: [],
							},
						],
					],
				})
			}
			answer(response, isGrid ? grid : undefined)
		})
		t.after(() => {
			sql.closeAllConnections()
			sql.close()
		})
		const sqlPort = await listen(sql)
		const reservation = createServer()
		const port = await listen(reservation)
		await new Promise((resolve) => reservation.close(resolve))
		const app = spawn(
			process.execPath,
			["node_modules/@remix-run/serve/dist/cli.js", "build/server/index.js"],
			{
				env: {
					PATH: process.env.PATH,
					NODE_ENV: "production",
					HOST: "127.0.0.1",
					PORT: String(port),
					WEBAPP_ROLE: "page",
					PAGE_CACHE: "on",
					CRATE_HOSTS: "127.0.0.1",
					CRATE_PORT: String(sqlPort),
					CRATE_USER: "crate",
					CRATE_PASS: "",
					CRATE_TIMEOUT_MS: "10000",
					REDIS_HOST: "",
					SUPABASE_URL: "http://127.0.0.1:1",
					SUPABASE_ANON_KEY: "fixture",
					QDRANT_URL: "http://127.0.0.1:1",
					QDRANT_TIMEOUT_MS: "50",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		)
		let log = ""
		for (const stream of [app.stdout, app.stderr])
			stream.on("data", (chunk) => {
				log = (log + chunk).slice(-16000)
			})
		t.after(async () => {
			if (app.exitCode === null) {
				app.kill("SIGKILL")
				await once(app, "exit")
			}
		})
		const base = `http://127.0.0.1:${port}`
		let ready = false
		for (let n = 0; n < 150 && !ready; n++) {
			try {
				ready = (await fetch(`${base}/health/live`)).ok
			} catch {}
			if (!ready) await delay(50)
		}
		assert.ok(ready, `Production server failed to start: ${log}`)
		const request = (path, agent) =>
			fetch(base + path, {
				headers: { "User-Agent": agent, Accept: "text/html" },
				signal: AbortSignal.timeout(6000),
			})

		await t.test(
			"a stalled episode read returns a complete response within two seconds for both clients",
			async () => {
				for (const agent of agents) {
					const start = performance.now()
					const response = await request("/show/999999900-fixture", agent)
					const html = await response.text()
					assert.equal(response.status, 200)
					assert.match(html, /"episodeGrid":null/)
					assert.match(response.headers.get("Cache-Control"), /no-store/)
					assert.notEqual(response.headers.get("GW-Page-Cache"), "hit")
					assert.ok(
						performance.now() - start < 2000,
						"Optional SQL held the document past its budget",
					)
				}
			},
		)
		await t.test(
			"concurrent cold titles retain their individual fallback deadline",
			async () => {
				const start = performance.now()
				const results = await Promise.all(
					Array.from({ length: 8 }, async (_, n) => {
						const response = await request(
							`/show/${999999910 + n}-fixture`,
							agents[n % agents.length],
						)
						await response.text()
						return response.status
					}),
				)
				assert.deepEqual(results, Array(8).fill(200))
				assert.ok(
					performance.now() - start < 3000,
					"Concurrent renders exceeded the fallback deadline",
				)
			},
		)
		await t.test(
			"releasing the original query restores the grid on a retry",
			async () => {
				mode = "healthy"
				for (const response of held) answer(response, grid)
				await delay(50)
				const response = await request("/show/999999900-fixture", agents[0])
				assert.equal(response.status, 200)
				assert.doesNotMatch(await response.text(), /"episodeGrid":null/)
			},
		)
		await t.test(
			"essential timeouts return 503 with Retry-After for movies and shows",
			async () => {
				mode = "details"
				for (const [type, agent] of [
					["movie", agents[0]],
					["show", agents[1]],
				]) {
					const start = performance.now()
					const response = await request(`/${type}/999999901-fixture`, agent)
					await response.text()
					assert.equal(response.status, 503)
					assert.match(response.headers.get("Cache-Control"), /no-store/)
					assert.equal(response.headers.get("Retry-After"), "5")
					assert.ok(
						performance.now() - start < 4500,
						"Essential SQL held the document past its budget",
					)
				}
			},
		)
	},
)

// Compare already-built local servers with the synthetic fixture and its own snapshot.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { createRequire } from "node:module"
import {
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import { normalize, headers } from "../html-equivalence/core.mjs"
import { validate } from "../html-equivalence/run.mjs"
const root = resolve(".")
const base = resolve(process.argv[2])
const out = resolve(process.env.HOME, ".cache/gw-perf/scratch-stats/pages")
mkdirSync(out, { recursive: true })
const require = createRequire(resolve(root, "goodwatch-webapp/package.json"))
const Redis = require("ioredis")
const redis = new Redis(6473, "127.0.0.1")
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = {}
const documents = {}
const sizes = {}
try {
	for (const [name, tree, port] of [
		["base", base, 3307],
		["candidate", root, 3308],
	]) {
		const app = resolve(tree, "goodwatch-webapp")
		for (const dir of [tree, app])
			for (const file of readdirSync(dir))
				if (/^\.env($|\.)/.test(file) && file !== ".env.example")
					throw Error("Refusing dotenv file")
		const env = {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			TMPDIR: out,
			NODE_ENV: "production",
			NODE_OPTIONS:
				"--import=/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/bench2/block-egress.mjs",
			PORT: String(port),
			HOST: "127.0.0.1",
			WEBAPP_ROLE: "page",
			STATIC_ASSETS: "origin",
			PAGE_CACHE: "off",
			POSTHOG_DISABLED: "1",
			SENTRY_DISABLE_AUTO_UPLOAD: "true",
			CRATE_HOSTS: "127.0.0.1",
			CRATE_PORT: "15873",
			CRATE_USER: "crate",
			CRATE_PASS: "",
			REDIS_HOST: "127.0.0.1",
			REDIS_PORT: "6473",
			REDIS_PASS: "",
			REDIS_HOST2: "",
			REDIS_HOST3: "",
			TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:6476",
		}
		for (const key of "TASTE_REDIS_URL TITLE_CARDS_REDIS_URL TITLE_FILTER_REDIS_URL QDRANT_URL SUPABASE_URL POSTHOG_HOST APP_ORIGIN STATIC_ASSETS_HOST MCP_RESOURCE_URL TMDB_API_KEY TMDB_CONNECT_KEY TMDB_CONNECT_PREVIOUS_KEY OPENROUTER_API_KEY TYPESAFE_API_KEY POSTHOG_API_KEY QDRANT_API_KEY SEARCH_STORAGE_KEY SUPABASE_ANON_KEY HOMEPAGE_WARMUP_SECRET SOURCE_COMMIT SENTRY_AUTH_TOKEN".split(
			" ",
		))
			env[key] = ""
		validate(env)
		await redis.flushall()
		const log = openSync(resolve(out, `${name}-server.log`), "w")
		const child = spawn(
			"env",
			[
				"-i",
				...Object.entries(env).map(([k, v]) => `${k}=${v}`),
				"node",
				resolve(app, "node_modules/.bin/remix-serve"),
				resolve(app, "build/server/index.js"),
			],
			{ cwd: app, stdio: ["ignore", log, log] },
		)
		try {
			let ready = false
			for (let i = 0; i < 100; i++) {
				if (child.exitCode !== null) throw Error(`${name} exited`)
				try {
					const r = await fetch(`http://127.0.0.1:${port}/health/ready`)
					ready = r.ok
					await r.text()
					if (ready) break
				} catch {}
				await sleep(200)
			}
			assert.ok(ready, "server readiness")
			results[name] = []
			for (let i = 0; i < 6; i++) {
				const r = await fetch(
					`http://127.0.0.1:${port}/u/stats_synthetic/stats`,
					{ headers: headers("browser") },
				)
				const html = await r.text()
				assert.equal(r.status, 200)
				assert.match(
					html,
					/1,000 scores/,
					"portrait must describe all fixture scores",
				)
				results[name].push({
					kind: i ? "warm" : "cold",
					timing: r.headers.get("server-timing"),
				})
				if (i === 5) documents[name] = normalize(html)
			}
			if (name === "candidate") {
				await redis.set(
					"taste:touched:stats-synthetic",
					String(Date.now()),
					"EX",
					3600,
				)
				const r = await fetch(
					`http://127.0.0.1:${port}/u/stats_synthetic/stats`,
					{ headers: headers("browser") },
				)
				await r.text()
				results[name].push({
					kind: "after-touch",
					timing: r.headers.get("server-timing"),
				})
			}
			const keys = await redis.keys(
				name === "base" ? "taste-portrait:*" : "profile-summary:*",
			)
			sizes[name] = Object.fromEntries(
				await Promise.all(
					keys.map(async (key) => [key, await redis.strlen(key)]),
				),
			)
		} finally {
			const exited = once(child, "exit")
			child.kill("SIGTERM")
			await Promise.race([exited, sleep(12000)])
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL")
				await exited
			}
		}
	}
	writeFileSync(
		resolve(out, "cache-bytes.json"),
		JSON.stringify(sizes, null, 2),
	)
	writeFileSync(resolve(out, "timings.json"), JSON.stringify(results, null, 2))
	for (const [name, html] of Object.entries(documents))
		writeFileSync(resolve(out, `${name}.html`), html)
	// Unordered SQL results can change object property insertion order. Compare loader values,
	// then require every byte of normalized rendered markup outside that JSON to match.
	const assignment = /window\.__remixContext\s*=\s*(.*?);<\/script>/
	const contexts = Object.fromEntries(
		Object.entries(documents).map(([name, html]) => [
			name,
			JSON.parse(html.match(assignment)[1]),
		]),
	)
	assert.deepEqual(contexts.candidate, contexts.base, "Stats loader values")
	assert.equal(
		documents.candidate.replace(assignment, "[loader]</script>"),
		documents.base.replace(assignment, "[loader]</script>"),
		"Stats rendered markup",
	)

	console.log(JSON.stringify(results, null, 2))
	console.log("Stats HTML matches with 1,000 analyzed scores")
} finally {
	redis.disconnect()
}

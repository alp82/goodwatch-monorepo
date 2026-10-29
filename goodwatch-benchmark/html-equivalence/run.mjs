import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
	classAllowlist,
	clients,
	emptyLoaderLists,
	failures,
	filterClasses,
	headers,
	manifestDiff,
	manifestPaths,
	manifestRoutes,
	normalize,
	structure,
} from "./core.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const cache = process.env.GW_HTML_CHECK_CACHE || path.join(os.homedir(), ".cache/gw753-html-check")
const sharedModules = path.join(root, "goodwatch-webapp/node_modules")
const preload =
	"/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/bench2/block-egress.mjs"
const empty =
	"TMDB_API_KEY TMDB_CONNECT_KEY TMDB_CONNECT_PREVIOUS_KEY OPENROUTER_API_KEY TYPESAFE_API_KEY POSTHOG_API_KEY QDRANT_API_KEY SEARCH_STORAGE_KEY SUPABASE_ANON_KEY HOMEPAGE_WARMUP_SECRET SOURCE_COMMIT SENTRY_AUTH_TOKEN".split(
		" ",
	)
const endpoints =
	"CRATE_HOSTS REDIS_HOST REDIS_HOST2 REDIS_HOST3 QDRANT_URL SUPABASE_URL POSTHOG_HOST TASTE_REDIS_URL TITLE_CARDS_REDIS_URL TITLE_FILTER_REDIS_URL TITLE_SNAPSHOT_REDIS_URL APP_ORIGIN STATIC_ASSETS_HOST MCP_RESOURCE_URL".split(
		" ",
	)
const resources = []
const worktrees = []
let cleaning
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function command(args, options = {}) {
	const result = spawnSync(args[0], args.slice(1), {
		cwd: root,
		encoding: "utf8",
		...options,
	})
	if (result.status !== 0)
		throw new Error(
			`${args.join(" ")} failed: ${result.stderr || result.error || result.status}`,
		)
	return result.stdout?.trim()
}

export function validate(env) {
	for (const key of endpoints) {
		if (
			env[key] &&
			!/^((redis|https?):\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(
				env[key],
			)
		)
			throw new Error(`${key} is not loopback`)
	}
	for (const key of empty)
		if (env[key] !== "") throw new Error(`${key} must be pinned empty`)
	for (const key of ["CRATE_HOSTS", "TITLE_SNAPSHOT_REDIS_URL", "REDIS_HOST"])
		if (!env[key]) throw new Error(`${key} must be set`)
}

function environment(app, valkey) {
	const env = {
		PATH: process.env.PATH,
		HOME: os.homedir(),
		TMPDIR: cache,
		NODE_ENV: "production",
		NODE_OPTIONS: `--import=${preload}`,
		PORT: String(app),
		HOST: "127.0.0.1",
		WEBAPP_ROLE: "page",
		STATIC_ASSETS: "origin",
		PAGE_CACHE: "off",
		POSTHOG_DISABLED: "1",
		SENTRY_DISABLE_AUTO_UPLOAD: "true",
		CRATE_HOSTS: "127.0.0.1",
		CRATE_PORT: "15870",
		CRATE_USER: "crate",
		CRATE_PASS: "",
		REDIS_HOST: "127.0.0.1",
		REDIS_PORT: String(valkey),
		REDIS_PASS: "",
		REDIS_HOST2: "",
		REDIS_HOST3: "",
		TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:15871",
		TASTE_REDIS_URL: "",
		TITLE_CARDS_REDIS_URL: "",
		TITLE_FILTER_REDIS_URL: "",
		QDRANT_URL: "",
		SUPABASE_URL: "",
		POSTHOG_HOST: "",
		APP_ORIGIN: "",
		STATIC_ASSETS_HOST: "",
		MCP_RESOURCE_URL: "",
	}
	for (const key of empty) env[key] = ""
	validate(env)
	return env
}

async function freePort(cluster = false) {
	const occupied = command(["ss", "-ltn"])
	for (let port = 19000; port < 29000; port++) {
		if (
			occupied.includes(`:${port} `) ||
			(cluster && occupied.includes(`:${port + 10000} `))
		)
			continue
		const servers = []
		try {
			for (const p of cluster ? [port, port + 10000] : [port]) {
				const server = net.createServer()
				servers.push(server)
				server.listen(p, "127.0.0.1")
				await once(server, "listening")
			}
			return port
		} catch {
		} finally {
			for (const server of servers) server.close()
		}
	}
	throw new Error("No free ports")
}

function tree(ref, label, runDir) {
	if (existsSync(path.resolve(ref, "goodwatch-webapp/package.json")))
		return realpathSync(ref)
	const directory = path.join(runDir, label)
	const commit = command(["git", "rev-parse", "--verify", `${ref}^{commit}`])
	command(["git", "worktree", "add", "--detach", directory, commit])
	worktrees.push(directory)
	const modules = path.join(directory, "goodwatch-webapp/node_modules")
	mkdirSync(modules)
	for (const entry of readdirSync(sharedModules))
		symlinkSync(path.join(sharedModules, entry), path.join(modules, entry))
	return directory
}

async function start(treePath, label, runDir) {
	const appDir = path.join(treePath, "goodwatch-webapp")
	// Vite and remix-serve can load dotenv files even with an empty inherited environment.
	for (const directory of [treePath, appDir])
		for (const file of readdirSync(directory)) {
			if (/^\.env($|\.)/.test(file) && file !== ".env.example")
				throw new Error(
					`Refusing dotenv file ${directory}/${file}; use a clean git ref or clean worktree`,
				)
		}
	const valkey = await freePort(true)
	const env = environment(0, valkey)
	writeFileSync(
		path.join(runDir, `${label}-source.json`),
		JSON.stringify(
			{
				treePath,
				commit: command(["git", "-C", treePath, "rev-parse", "HEAD"]),
				status: command(["git", "-C", treePath, "status", "--porcelain"]),
				diff: command(["git", "-C", treePath, "diff", "HEAD"]),
			},
			null,
			2,
		),
	)
	console.log(`Building ${label}: ${treePath}`)
	const buildLog = createWriteStream(path.join(runDir, `${label}-build.log`))
	await once(buildLog, "open")
	const build = spawn(
		"env",
		[
			"-i",
			...Object.entries(env).map(([k, v]) => `${k}=${v}`),
			"npm",
			"--prefix",
			appDir,
			"run",
			"build",
		],
		{
			cwd: appDir,
			stdio: ["ignore", buildLog.fd, buildLog.fd],
			detached: true,
		},
	)
	resources.push({ process: build, treePath })
	const [code] = await once(build, "exit")
	buildLog.end()
	if (code !== 0)
		throw new Error(`${label} build failed; see ${runDir}/${label}-build.log`)
	const name = `gw-html-${process.pid}-${label}`
	resources.push({ container: name })
	command([
		"docker",
		"run",
		"-d",
		"--rm",
		"--name",
		name,
		"--network",
		"host",
		"valkey/valkey:8",
		"valkey-server",
		"--port",
		String(valkey),
		"--bind",
		"127.0.0.1",
		"--cluster-enabled",
		"yes",
		"--cluster-announce-ip",
		"127.0.0.1",
		"--save",
		"",
		"--appendonly",
		"no",
	])
	for (let n = 0; ; n++) {
		try {
			command([
				"docker",
				"exec",
				name,
				"valkey-cli",
				"-p",
				String(valkey),
				"ping",
			])
			break
		} catch (error) {
			if (n >= 30) throw error
			await sleep(300)
		}
	}
	command([
		"docker",
		"exec",
		name,
		"valkey-cli",
		"-p",
		String(valkey),
		"cluster",
		"addslotsrange",
		"0",
		"16383",
	])
	for (let n = 0; ; n++) {
		if (
			command([
				"docker",
				"exec",
				name,
				"valkey-cli",
				"-p",
				String(valkey),
				"cluster",
				"info",
			]).includes("cluster_state:ok")
		)
			break
		if (n >= 30) throw new Error("Valkey cluster did not become ready")
		await sleep(300)
	}
	const port = await freePort()
	const runtime = environment(port, valkey)
	writeFileSync(
		path.join(runDir, `${label}-environment.json`),
		JSON.stringify(runtime, null, 2),
	)
	const log = createWriteStream(path.join(runDir, `${label}-server.log`))
	await once(log, "open")
	const server = spawn(
		"env",
		[
			"-i",
			...Object.entries(runtime).map(([k, v]) => `${k}=${v}`),
			"node",
			path.join(appDir, "node_modules/.bin/remix-serve"),
			path.join(appDir, "build/server/index.js"),
		],
		{ cwd: appDir, stdio: ["ignore", log.fd, log.fd], detached: true },
	)
	resources.push({ process: server, treePath, log })
	const origin = `http://127.0.0.1:${port}`
	for (let n = 0; ; n++) {
		try {
			const response = await fetch(`${origin}/about`, {
				signal: AbortSignal.timeout(2000),
			})
			await response.text()
			break
		} catch (error) {
			if (n >= 90 || server.exitCode !== null) throw error
			await sleep(500)
		}
	}
	return origin
}

async function cleanup() {
	if (cleaning) return cleaning
	cleaning = (async () => {
		const errors = []
		for (const resource of resources.reverse()) {
			try {
				const child = resource.process
				if (child && child.exitCode === null && child.signalCode === null) {
					const pid = child.pid
					if (existsSync(`/proc/${pid}/cwd`)) {
						const cwd = realpathSync(`/proc/${pid}/cwd`)
						const cmd = command(["ps", "-o", "cmd=", "-p", String(pid)])
						if (
							!cwd.startsWith(`${resource.treePath}/`) ||
							!/node|npm|env/.test(cmd)
						)
							throw new Error(
								`Refusing to stop unrecognized process ${pid}: ${cmd}`,
							)
						console.log(`Stopping ${pid}: ${cmd}`)
						process.kill(-pid, "SIGTERM")
						await Promise.race([once(child, "exit"), sleep(4000)])
						if (child.exitCode === null && child.signalCode === null) {
							process.kill(-pid, "SIGKILL")
							await once(child, "exit")
						}
					}
				}
			} catch (error) {
				errors.push(error)
			}
			resource.log?.end()
			if (resource.container) {
				try {
					command(["docker", "rm", "-f", resource.container])
				} catch (error) {
					errors.push(error)
				}
			}
		}
		// A failed stop keeps its worktree available for manual inspection.
		if (!errors.length)
			for (const directory of worktrees.reverse()) {
				try {
					command(["git", "worktree", "remove", "--force", directory])
				} catch (error) {
					errors.push(error)
				}
			}
		if (errors.length)
			throw new AggregateError(
				errors,
				"Cleanup failed; inspect the recorded processes and containers",
			)
	})()
	return cleaning
}

async function sql(stmt) {
	if (!/^select\b/i.test(stmt))
		throw new Error("Bench queries must be read only")
	const response = await fetch("http://127.0.0.1:15870/_sql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt }),
		signal: AbortSignal.timeout(30000),
	})
	const result = await response.json()
	if (!response.ok || result.error) throw new Error(JSON.stringify(result))
	return result.rows
}

const staticPaths = [
	"/",
	"/movies",
	"/shows",
	"/movies/moods",
	"/shows/moods",
	"/movies/best",
	"/shows/best",
	"/movies/moods/feel-good",
	"/shows/moods/scary",
	"/discover",
	"/discover?q=Star%20Wars",
	"/people",
	"/about",
	"/__html-equivalence-not-found__",
]
async function localPaths(origin) {
	const movies = await sql(
		"select tmdb_id from movie order by tmdb_id limit 30",
	)
	if (movies.length < 30)
		throw new Error(`Need at least 30 movies; found ${movies.length}`)
	const paths = [...staticPaths, ...movies.map(([id]) => `/movie/${id}`)]
	for (const [table, route] of [
		["show", "show"],
		["person", "person"],
	]) {
		const rows = await sql(
			`select tmdb_id from "${table}" order by tmdb_id limit 1000`,
		)
		if (rows.length === 1000)
			throw new Error(`Too many ${table} rows; review coverage limit`)
		let rendered = 0
		for (const [id] of rows) {
			const url = `/${route}/${id}`
			const result = await capture(origin, url, "googlebot")
			if (result.status === 404) continue
			if (result.status !== 200)
				throw new Error(`${url} failed coverage probe: ${result.status}`)
			paths.push(url)
			rendered++
		}
		console.log(
			`Coverage: ${table}: ${rows.length} rows, ${rendered} rendered pages`,
		)
	}
	return paths
}

let nextProdRequest = 0
async function limitedFetch(url, options) {
	if (new URL(url).origin !== "https://goodwatch.app")
		throw new Error(`Unexpected production origin: ${url}`)
	await sleep(Math.max(0, nextProdRequest - Date.now()))
	nextProdRequest = Date.now() + 550
	return fetch(url, {
		...options,
		redirect: "manual",
		signal: AbortSignal.timeout(60000),
	})
}
async function capture(origin, pathname, client, prod = false) {
	let url = new URL(pathname, origin)
	const redirects = []
	for (let n = 0; n < 10; n++) {
		const options = {
			headers: {
				...headers(client),
				...(!prod ? { Host: "goodwatch.app" } : {}),
			},
			redirect: "manual",
			signal: AbortSignal.timeout(60000),
		}
		const response = await (prod
			? limitedFetch(url, options)
			: fetch(url, options))
		const raw = await response.text()
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const target = new URL(response.headers.get("location"), url)
			if (
				![origin, "https://goodwatch.app", "http://goodwatch.app"].includes(
					target.origin,
				)
			)
				throw new Error(`Unexpected redirect: ${target}`)
			redirects.push({
				status: response.status,
				location: target.pathname + target.search,
			})
			url = new URL(target.pathname + target.search, origin)
			continue
		}
		return {
			path: pathname,
			client,
			status: response.status,
			cacheControl: response.headers.get("cache-control"),
			redirects,
			raw,
			body: normalize(raw),
		}
	}
	throw new Error(`Too many redirects: ${pathname}`)
}

async function snapshot(origin, paths, directory, names, prod = false) {
	mkdirSync(directory, { recursive: true })
	const entries = []
	const manifest = {
		capturedAt: new Date().toISOString(),
		origin,
		paths,
		clients: names,
		complete: false,
		entries,
	}
	const saveManifest = () =>
		writeFileSync(
			path.join(directory, "snapshot.json"),
			JSON.stringify(manifest, null, 2),
		)
	saveManifest()
	for (const pathname of paths)
		for (const client of names) {
			const value = await capture(origin, pathname, client, prod)
			const id = String(entries.length).padStart(3, "0")
			writeFileSync(path.join(directory, `${id}.raw.html`), value.raw)
			writeFileSync(path.join(directory, `${id}.html`), value.body)
			const { raw, body, ...metadata } = value
			entries.push({ ...metadata, file: `${id}.html` })
			saveManifest()
			if (value.status >= 500 || !body.includes("</html>"))
				throw new Error(
					`${pathname} (${client}) failed to render: ${value.status}; ${directory}`,
				)
			if (
				value.status !==
				(pathname === "/__html-equivalence-not-found__" ? 404 : 200)
			)
				throw new Error(
					`${pathname} (${client}) expected ${pathname === "/__html-equivalence-not-found__" ? 404 : 200}, got ${value.status}`,
				)
		}
	manifest.complete = true
	saveManifest()
	console.log(`Saved ${entries.length} documents: ${directory}`)
}

function readSnapshot(directory) {
	const manifest = JSON.parse(
		readFileSync(path.join(directory, "snapshot.json"), "utf8"),
	)
	if (manifest.complete === false)
		throw new Error("Snapshot capture is incomplete")
	if (!manifest.entries?.length) throw new Error("Snapshot has no documents")
	return manifest.entries.map((entry) => ({
		...entry,
		body: normalize(
			readFileSync(
				path.join(directory, entry.file.replace(/\.html$/, ".raw.html")),
				"utf8",
			),
		),
	}))
}
function diff(a, b, output) {
	// Keep each tag and script payload on its own line so a missing section is easy to locate.
	const files = ["base", "candidate"].map((name, i) => {
		const file = path.join(output, `${name}.diff.html`)
		writeFileSync(file, [a, b][i].replace(/></g, ">\n<"))
		return file
	})
	const result = spawnSync(
		"diff",
		["-u", "--label", "base", "--label", "candidate", ...files],
		{ encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
	)
	if (result.status !== 1 && result.status !== 0)
		throw new Error(`diff failed: ${result.stderr}`)
	writeFileSync(path.join(output, "difference.diff"), result.stdout)
	console.log(
		result.stdout
			.split("\n")
			.slice(0, 60)
			.map((line) => (line.length > 700 ? `${line.slice(0, 700)}…` : line))
			.join("\n"),
	)
}
function compare(aDir, bDir, prod = false, allow = [], reportDir = bDir) {
	const a = readSnapshot(aDir)
	const b = readSnapshot(bDir)
	if (
		JSON.stringify(a.map((e) => [e.path, e.client])) !==
		JSON.stringify(b.map((e) => [e.path, e.client]))
	)
		throw new Error("Snapshot URL/client sets differ")
	const patterns = classAllowlist(allow)
	const review = {
		allowClass: allow,
		removed: { base: 0, candidate: 0 },
		documents: [],
		emptyOnBothSides: [],
	}
	for (let i = 0; i < a.length; i++) {
		const counts = {}
		for (const [side, entry] of [
			["base", a[i]],
			["candidate", b[i]],
		]) {
			const filtered = filterClasses(entry.body, patterns)
			entry.body = filtered.html
			counts[side] = filtered.removed
			review.removed[side] += filtered.removed
		}
		review.documents.push({
			path: a[i].path,
			client: a[i].client,
			removed: counts,
		})
		const right = emptyLoaderLists(b[i].body)
		const lists = emptyLoaderLists(a[i].body).filter((key) =>
			right.includes(key),
		)
		if (lists.length)
			review.emptyOnBothSides.push({
				path: a[i].path,
				client: a[i].client,
				lists,
			})
	}
	writeFileSync(
		path.join(reportDir, "comparison-review.json"),
		JSON.stringify(review, null, 2),
	)
	console.log(
		`Class allowlist: ${JSON.stringify(allow)}; removed tokens: base ${review.removed.base}, candidate ${review.removed.candidate}`,
	)
	console.log(
		`Empty on both sides: ${review.emptyOnBothSides.length} documents (informational)`,
	)
	for (const entry of review.emptyOnBothSides)
		console.log(
			`  ${entry.client} ${entry.path}: empty on both sides: ${entry.lists.join(", ")}`,
		)
	let changed = 0
	for (let i = 0; i < a.length; i++) {
		const issues = failures(a[i], b[i])
		if (!issues.length) continue
		changed++
		console.log(`${a[i].client} ${a[i].path}: ${issues.join("; ")}`)
		const output = path.join(bDir, `diff-${i}`)
		mkdirSync(output, { recursive: true })
		if (prod) {
			const left = structure(a[i].body)
			const right = structure(b[i].body)
			const structural = ["landmarks", "loaderDataKeys", "jsonLd"].filter(
				(key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]),
			)
			console.log(
				`  STRUCTURE: ${structural.join(", ") || "unchanged"}; TEXT: ${left.text === right.text ? "unchanged" : "changed"}`,
			)
			writeFileSync(
				path.join(output, "structure.json"),
				JSON.stringify({ base: left, candidate: right }, null, 2),
			)
		}
		diff(a[i].body, b[i].body, output)
	}
	console.log(
		`${prod ? "Production report" : "Gate"}: ${a.length} documents, ${changed} differences`,
	)
	return changed
}

async function reportManifests(baseOrigin, candidateOrigin, runDir) {
	const report = {
		informational: true,
		base: [],
		candidate: [],
		differences: [],
		errors: [],
	}
	for (const [side, origin] of [
		["base", baseOrigin],
		["candidate", candidateOrigin],
	]) {
		const directory = path.join(runDir, `${side}-2`)
		const snapshot = JSON.parse(
			readFileSync(path.join(directory, "snapshot.json"), "utf8"),
		)
		const paths = new Set()
		for (const entry of snapshot.entries) {
			const raw = readFileSync(
				path.join(directory, entry.file.replace(/\.html$/, ".raw.html")),
				"utf8",
			)
			for (const asset of manifestPaths(raw)) paths.add(asset)
		}
		if (!paths.size) report.errors.push(`${side}: no referenced manifest found`)
		for (const asset of [...paths].sort()) {
			try {
				const response = await fetch(new URL(asset, origin), {
					headers: { Host: "goodwatch.app" },
					redirect: "manual",
					signal: AbortSignal.timeout(30000),
				})
				if (response.status !== 200) throw new Error(`HTTP ${response.status}`)
				const source = await response.text()
				writeFileSync(
					path.join(runDir, `${side}-${path.basename(asset)}`),
					source,
				)
				report[side].push({ asset, routes: manifestRoutes(source) })
			} catch (error) {
				report.errors.push(`${side} ${asset}: ${error.message}`)
			}
		}
	}
	for (const base of report.base)
		for (const candidate of report.candidate)
			report.differences.push({
				base: base.asset,
				candidate: candidate.asset,
				routes: manifestDiff(base.routes, candidate.routes),
			})
	writeFileSync(
		path.join(runDir, "manifest-diff.json"),
		JSON.stringify(report, null, 2),
	)
	console.log(
		`Manifest report (informational): ${report.differences.reduce((sum, diff) => sum + diff.routes.length, 0)} route differences; ${report.errors.length} report errors`,
	)
	for (const diff of report.differences)
		console.log(JSON.stringify(diff, null, 2))
	for (const error of report.errors) console.log(`  ${error}`)
}

function locations(xml) {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
		match[1].replaceAll("&amp;", "&"),
	)
}
async function prodPaths() {
	const fixed = path.join(cache, "prod-urls.json")
	if (existsSync(fixed)) return JSON.parse(readFileSync(fixed, "utf8"))
	async function xml(url) {
		const response = await limitedFetch(url)
		if (response.status !== 200)
			throw new Error(`Sitemap failed ${url}: ${response.status}`)
		return response.text()
	}
	const index = locations(
		await xml("https://goodwatch.app/sitemaps/sitemap.xml"),
	)
	const selected = [...staticPaths.filter((p) => !p.includes("not-found"))]
	for (const [pattern, prefix, count] of [
		[/movie_detail/, "/movie/", 25],
		[/show_detail/, "/show/", 12],
		[/people/, "/person/", 8],
		[/categories/, "/movies/", 4],
	]) {
		const sitemap = index.find((url) => pattern.test(url))
		if (!sitemap) throw new Error(`Sitemap missing: ${pattern}`)
		const urls = locations(await xml(sitemap))
			.map((url) => {
				if (new URL(url).origin !== "https://goodwatch.app")
					throw new Error("Unexpected sitemap origin")
				return new URL(url).pathname
			})
			.filter((url) => url.startsWith(prefix))
		if (urls.length < count)
			throw new Error(`Not enough sitemap URLs: ${pattern}`)
		for (let i = 0; i < count; i++)
			selected.push(urls[Math.floor((i * urls.length) / count)])
	}
	const paths = [...new Set(selected)]
	writeFileSync(fixed, JSON.stringify(paths, null, 2))
	return paths
}

async function main() {
	mkdirSync(cache, { recursive: true })
	const args = []
	const allow = []
	for (let i = 2; i < process.argv.length; i++) {
		if (process.argv[i] === "--allow-class") {
			if (process.argv[++i] === undefined)
				throw new Error("--allow-class needs a regex")
			allow.push(process.argv[i])
		} else if (process.argv[i].startsWith("--"))
			throw new Error(`Unknown option: ${process.argv[i]}`)
		else args.push(process.argv[i])
	}
	classAllowlist(allow)
	const [mode, action, target, other] = args
	if (mode === "local" && action && target) {
		if (!existsSync(preload)) throw new Error(`Missing preload: ${preload}`)
		const runDir = path.join(cache, `run-${Date.now()}-${process.pid}`)
		mkdirSync(runDir)
		console.log(`Artifacts: ${runDir}`)
		const baseTree = tree(action, "base-tree", runDir)
		const candidateTree = tree(target, "candidate-tree", runDir)
		if (baseTree === candidateTree)
			throw new Error("Use separate trees or git refs for two builds")
		const base = await start(baseTree, "base", runDir)
		const candidate = await start(candidateTree, "candidate", runDir)
		const paths = await localPaths(base)
		writeFileSync(
			path.join(runDir, "urls.json"),
			JSON.stringify(paths, null, 2),
		)
		for (const [label, origin] of [
			["base", base],
			["candidate", candidate],
		]) {
			await snapshot(origin, paths, path.join(runDir, `${label}-warmup`), [
				"googlebot",
			])
			for (const round of [1, 2])
				await snapshot(
					origin,
					paths,
					path.join(runDir, `${label}-${round}`),
					Object.keys(clients),
				)
			if (
				compare(
					path.join(runDir, `${label}-1`),
					path.join(runDir, `${label}-2`),
					false,
					allow,
				)
			)
				throw new Error(
					`${label} self-check has noise; no candidate verdict is valid`,
				)
		}
		await reportManifests(base, candidate, runDir)
		if (
			compare(
				path.join(runDir, "base-2"),
				path.join(runDir, "candidate-2"),
				false,
				allow,
				runDir,
			)
		)
			process.exitCode = 1
	} else if (mode === "prod" && action === "snapshot" && target) {
		const directory = path.resolve(target)
		if (existsSync(directory) && readdirSync(directory).length)
			throw new Error("Snapshot directory must be empty")
		await snapshot(
			"https://goodwatch.app",
			await prodPaths(),
			directory,
			["googlebot", "browser"],
			true,
		)
	} else if (mode === "prod" && action === "compare" && target && other) {
		if (compare(path.resolve(target), path.resolve(other), true, allow))
			process.exitCode = 1
	} else
		throw new Error(
			"Usage: ./run.sh local <base-ref> <candidate-ref|worktree> [--allow-class <regex>]... | prod snapshot <dir> | prod compare <dirA> <dirB>",
		)
}
if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	for (const signal of ["SIGINT", "SIGTERM"])
		process.on(signal, () => {
			cleanup().finally(() => process.exit(1))
		})
	try {
		await main()
	} catch (error) {
		console.error(error)
		process.exitCode = 1
	} finally {
		await cleanup()
	}
}

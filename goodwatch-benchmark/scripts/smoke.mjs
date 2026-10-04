#!/usr/bin/env node
// Post-deploy smoke check. Run it through `./bench.sh smoke`, which loads config.env first.
//
// It finds the running webapp container, requests the pages in smoke/urls.json (edge cases included), checks the
// rendered HTML, scans the container's log from its start with the patterns in smoke/log-patterns.json, and compares
// the 5xx counters before and after. One line per check, exit code 1 on any failure. It sends only GET requests,
// fewer than 60, and changes nothing on the serving host.
//
// --target production (default): the container is found over SSH on the host that the target's name resolves to.
// --target local: a local production build. Pass --base-url, and --log-file or --container, and --metrics-url.
import { execFileSync } from "node:child_process"
import { lookup } from "node:dns/promises"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const USAGE = `Usage: ./bench.sh smoke [options]
  --target production|local   Where the webapp runs. Default: production.
  --commit SHA                Wait for a container that runs this commit (production).
  --newer-than NAME           Wait for a container other than NAME, such as the one before the deploy (production).
  --deploy-timeout S          How long to wait for that container and for its health. Default: 600.
  --base-url URL              Default: BENCH_TARGET_URL or https://goodwatch.app. Required for local.
  --log-file FILE             Local: the server's log, from its start.
  --container NAME            Local: a Docker container to read the log from.
  --metrics-url URL           Local: the server's metrics endpoint, such as http://127.0.0.1:9464/metrics.
  --log-wait S                How long after the process start slow subsystems may take. Default: 120.
  --urls FILE                 Default: smoke/urls.json.
  --patterns FILE             Default: smoke/log-patterns.json.
  --skip ID,ID                Check ids to skip, such as log:title-snapshot. Each prints a skip line.`

const options = {
	target: "production",
	"deploy-timeout": "600",
	"log-wait": "120",
	"base-url": "",
	urls: `${ROOT}/smoke/urls.json`,
	patterns: `${ROOT}/smoke/log-patterns.json`,
	skip: "",
}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 2) {
	const name = argv[i].replace(/^--/, "")
	if (name === "help" || name === "h") {
		console.log(USAGE)
		process.exit(0)
	}
	if (!argv[i].startsWith("--") || argv[i + 1] === undefined) {
		console.error(`Bad option: ${argv[i]}\n${USAGE}`)
		process.exit(2)
	}
	options[name] = argv[i + 1]
}
const local = options.target === "local"
if (!local && options.target !== "production") usageError("Target must be production or local")
const baseUrl = (options["base-url"] || (local ? "" : process.env.BENCH_TARGET_URL || "https://goodwatch.app")).replace(/\/$/, "")
if (!baseUrl) usageError("A local target needs --base-url")
const skipped = new Set(options.skip.split(",").filter(Boolean))
const logWaitSeconds = Number(options["log-wait"])
const deployTimeout = Number(options["deploy-timeout"])
const BROWSER_UA =
	process.env.BROWSER_UA ||
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
const BOT_UA = process.env.BOT_UA || "facebookexternalhit/1.1"
const CONTAINER_PREFIX = process.env.SMOKE_CONTAINER_PREFIX || "gk4owk8-"

function usageError(message) {
	console.error(`${message}\n${USAGE}`)
	process.exit(2)
}

// ---- Output: one line per check ----
const counts = { pass: 0, fail: 0, warn: 0, skip: 0 }
function report(result, id, detail = "") {
	counts[result]++
	console.log(`${result.toUpperCase().padEnd(4)}  ${id}${detail ? `  ${detail}` : ""}`)
}
/** Runs one check unless --skip names it. `run` returns a detail string, or throws with the reason it failed. */
async function check(id, run) {
	if (skipped.has(id)) return report("skip", id, "skipped with --skip")
	try {
		report("pass", id, (await run()) ?? "")
	} catch (error) {
		report("fail", id, error.message)
	}
}
const fail = (message) => {
	throw new Error(message)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// ---- The serving host (production) ----
let sshHost = ""
/** Runs a Bash script on the serving host and returns its output. The address is never printed. */
function onHost(script, timeoutSeconds = 60) {
	return execFileSync(
		"ssh",
		["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR", `${process.env.BENCH_SSH_USER || "root"}@${sshHost}`, "bash -s"],
		{ input: script, encoding: "utf8", timeout: timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "inherit"] },
	)
}
const quote = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`

/**
 * Waits on the host for one healthy webapp container that fits --commit and --newer-than, and for every older one to
 * be gone, so that public requests reach the new process only. Prints the container's name, commit, and start time.
 */
function findContainer() {
	const script = `
prefix=${quote(CONTAINER_PREFIX)}; want=${quote(options.commit ?? "")}; older=${quote(options["newer-than"] ?? "")}
deadline=$(( $(date +%s) + ${deployTimeout} )); said=''
while :; do
  names=$(docker ps --filter "name=^$prefix" --format '{{.Names}}')
  count=$(printf '%s\\n' "$names" | grep -c . || true)
  name=$(printf '%s\\n' "$names" | head -1)
  state="$count containers"
  if [ "$count" = 1 ]; then
    commit=$(docker exec "$name" printenv SOURCE_COMMIT 2>/dev/null || true)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || true)
    state="$name commit \${commit:0:8} health $health"
    fits=1
    case "$commit" in "$want"*) ;; *) fits=0 ;; esac
    [ -z "$older" ] || [ "$name" != "$older" ] || fits=0
    if [ "$fits" = 1 ] && { [ "$health" = healthy ] || [ "$health" = none ]; }; then
      printf 'found %s %s %s\\n' "$name" "$commit" "$(docker inspect -f '{{.State.StartedAt}}' "$name")"
      exit 0
    fi
  fi
  [ "$state" = "$said" ] || { echo "waiting: $state" >&2; said=$state; }
  [ "$(date +%s)" -lt "$deadline" ] || { echo "timeout: $state"; exit 0; }
  sleep 5
done`
	const output = onHost(script, deployTimeout + 60).trim().split("\n").pop()
	const [status, name, commit, startedAt] = output.split(" ")
	if (status !== "found") fail(`no container fits after ${deployTimeout} s (${output.replace(/^timeout: /, "")})`)
	return { name, commit, startedAt: Date.parse(startedAt) }
}

// ---- Log and metrics sources ----
let container = null
const patterns = JSON.parse(readFileSync(options.patterns, "utf8"))
const logPatterns = [
	patterns.start,
	...patterns.required.map((entry) => entry.pattern),
	...patterns.lastLine.map((entry) => entry.pattern),
	...patterns.forbidden.map((entry) => entry.pattern),
]

/** The log lines that match any pattern, from the process start. Filtered on the host, so a long log stays there. */
function readLogLines() {
	if (local) {
		const text = options["log-file"]
			? readFileSync(options["log-file"], "utf8")
			: execFileSync("docker", ["logs", options.container], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
		const any = new RegExp(logPatterns.join("|"))
		return text.split("\n").filter((line) => any.test(line))
	}
	// 2>&1 inside the host's shell: the app's errors go to the container's stderr.
	const script = `docker logs ${quote(container.name)} 2>&1 | grep -aE -f <(cat <<'SMOKE_PATTERNS'\n${logPatterns.join("\n")}\nSMOKE_PATTERNS\n) | cut -c1-600 || true`
	return onHost(script, 120).split("\n").filter(Boolean)
}

async function readMetrics() {
	if (local) {
		const response = await fetch(options["metrics-url"], { signal: AbortSignal.timeout(10_000) })
		if (!response.ok) fail(`metrics endpoint answered ${response.status}`)
		return await response.text()
	}
	// The image has BusyBox as wget. The port is not published, so the request runs inside the container.
	return onHost(`docker exec ${quote(container.name)} wget -qO- http://127.0.0.1:\${METRICS_PORT:-9464}/metrics`)
}

/** Sums a metric's samples by one label, for samples whose labels include `where`. */
function sumBy(text, metric, label, where = "") {
	const sums = new Map()
	for (const line of text.split("\n")) {
		if (!line.startsWith(`${metric}{`) || !line.includes(where)) continue
		const key = line.match(new RegExp(`${label}="([^"]*)"`))?.[1] ?? ""
		sums.set(key, (sums.get(key) ?? 0) + Number(line.slice(line.lastIndexOf(" ") + 1)))
	}
	return sums
}
const gauge = (text, metric) => {
	const line = text.split("\n").find((candidate) => candidate.startsWith(`${metric} `) || candidate.startsWith(`${metric}{`))
	return line ? Number(line.slice(line.lastIndexOf(" ") + 1)) : null
}

// ---- Requests ----
const bodies = new Map()
async function request(path, entry) {
	const headers = { "User-Agent": entry.client === "bot" ? BOT_UA : BROWSER_UA, "Accept-Encoding": "br, gzip" }
	if (entry.client !== "bot") {
		headers["Accept-Language"] = "en-US,en;q=0.9"
		if (entry.cookie) headers.Cookie = "gw_browser=1"
	}
	const started = performance.now()
	const response = await fetch(baseUrl + path, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) })
	const bytes = Buffer.from(await response.arrayBuffer())
	return { response, bytes, text: bytes.toString("utf8"), ms: Math.round(performance.now() - started) }
}

function checkHtml(html, expected, imageHost) {
	const textOf = (tag) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => decode(match[1].replace(/<[^>]+>/g, "")))
	if (expected.title && !textOf("title").some((text) => text.includes(expected.title))) fail(`<title> lacks "${expected.title}"`)
	if (expected.h1 && !textOf("h1").some((text) => text.includes(expected.h1))) fail(`no <h1> with "${expected.h1}"`)
	const notes = []
	if (expected.minTitleLinks) {
		const links = new Set(html.match(/href="\/(?:movie|show)\/\d+/g) ?? [])
		if (links.size < expected.minTitleLinks) fail(`${links.size} title links in the server HTML, expected at least ${expected.minTitleLinks}`)
		notes.push(`${links.size} title links`)
	}
	if (expected.image) {
		const images = html.split(`src="${imageHost}`).length - 1
		if (images < 1) fail(`no image src on ${imageHost}`)
		notes.push(`${images} images`)
	}
	if (expected.jsonLd) {
		const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
		if (!blocks.length) fail("no JSON-LD block")
		for (const [, json] of blocks) {
			try {
				JSON.parse(json)
			} catch {
				fail("a JSON-LD block doesn't parse")
			}
		}
		notes.push(`${blocks.length} JSON-LD`)
	}
	return notes
}
const decode = (text) => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

async function checkEntry(entry, set) {
	let path = entry.path
	let shown = path
	if (entry.pathFrom) {
		const source = bodies.get(entry.pathFrom.entry)
		path = source?.match(new RegExp(entry.pathFrom.pattern))?.[0]
		if (!path) fail(`the ${entry.pathFrom.entry} response references no ${entry.pathFrom.pattern}`)
		shown = path
	}
	const { response, bytes, text, ms } = await request(path, entry)
	// A path from config.env is a user's list: it is never printed.
	if (entry.fromEnv) shown = "(path from config.env)"
	bodies.set(entry.id, text)
	const got = `${response.status} ${shown} ${ms} ms`
	if (!entry.expect.includes(response.status)) fail(`${got}, expected ${entry.expect.join(" or ")}. Guards: ${entry.guards}`)
	const explain = (message) => fail(`${got}: ${message}. Guards: ${entry.guards}`)
	const type = response.headers.get("content-type") ?? ""
	if (entry.contentType && !new RegExp(entry.contentType).test(type)) explain(`content type ${type}`)
	if (entry.minBytes && bytes.length < entry.minBytes) explain(`${bytes.length} bytes, expected at least ${entry.minBytes}`)
	for (const [name, pattern] of Object.entries(entry.header ?? {})) {
		const value = response.headers.get(name) ?? ""
		if (!new RegExp(pattern).test(name === "location" ? value.replace(/^https?:\/\/[^/]+/, "") : value)) explain(`header ${name} is "${value}"`)
	}
	const isText = /^(text\/|application\/json)/.test(type)
	for (const marker of entry.contains ?? []) if (!text.includes(marker)) explain(`body lacks "${marker}"`)
	for (const marker of [...(entry.notContains ?? []), ...(isText ? set.neverContains : [])]) if (text.includes(marker)) explain(`body has "${marker}"`)
	const notes = []
	try {
		if (entry.html) notes.push(...checkHtml(text, entry.html, set.imageHost))
		if (entry.json) {
			const data = JSON.parse(text)
			for (const key of entry.json.keys ?? []) if (!(key in data)) fail(`JSON lacks "${key}"`)
			if (entry.json.arrays) {
				const items = entry.json.arrays.reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0)
				if (items < entry.json.minItems) fail(`${items} items in ${entry.json.arrays.join(" and ")}`)
				notes.push(`${items} items`)
			}
		}
	} catch (error) {
		explain(error.message)
	}
	return `${got}${notes.length ? `, ${notes.join(", ")}` : ""}`
}

// ---- Main ----
const startedAt = Date.now()
const set = JSON.parse(readFileSync(options.urls, "utf8"))
let processStartedAt = null

if (!local) {
	const hostname = new URL(baseUrl).hostname
	sshHost = process.env.SMOKE_SSH_HOST || (await lookup(hostname)).address
	await check("deploy:container", () => {
		container = findContainer()
		processStartedAt = container.startedAt
		if (options.commit && !container.commit.startsWith(options.commit)) fail(`runs ${container.commit}`)
		return `${container.name}, commit ${container.commit.slice(0, 8)}, healthy, up ${Math.round((Date.now() - container.startedAt) / 1000)} s`
	})
	if (!container) finish()
}

// A deploy answers 502 while the proxy switches containers. Wait for the home page before counting anything.
await check("deploy:reachable", async () => {
	for (let attempt = 1; ; attempt++) {
		const status = await fetch(`${baseUrl}/`, { headers: { "User-Agent": BROWSER_UA, Cookie: "gw_browser=1" }, redirect: "manual", signal: AbortSignal.timeout(15_000) }).then(
			(response) => response.arrayBuffer().then(() => response.status),
			(error) => error.message,
		)
		if (status === 200) return `${baseUrl} answers 200${attempt > 1 ? ` after ${attempt} tries` : ""}`
		if (attempt >= 18) fail(`${baseUrl}/ answers ${status} after ${attempt} tries`)
		await sleep(5000)
	}
})

let metricsBefore = null
await check("metrics:before", async () => {
	metricsBefore = await readMetrics()
	const uptime = gauge(metricsBefore, "goodwatch_process_uptime_seconds")
	if (uptime === null) fail("no goodwatch_process_uptime_seconds in the metrics")
	processStartedAt ??= Date.now() - uptime * 1000
	const commit = metricsBefore.match(/goodwatch_build_info\{[^}]*commit="([^"]*)"/)?.[1]
	return `process up ${Math.round(uptime)} s${commit ? `, build ${commit.slice(0, 8)}` : ""}`
})

for (const raw of set.entries) {
	const entry = { ...set.defaults, ...raw }
	const variable = entry.path?.match(/^\$\{([A-Z_]+)\}$/)?.[1]
	if (variable) {
		entry.fromEnv = true
		entry.path = process.env[variable]
		if (!entry.path) {
			report("warn", `url:${entry.id}`, `skipped: ${variable} is not set in config.env`)
			continue
		}
	}
	await check(`url:${entry.id}`, () => checkEntry(entry, set))
}

// The log, after the requests, so that errors from the edge-case pages are in it. Slow subsystems get until
// --log-wait seconds after the process start.
let lines = []
const logReadable = await (async () => {
	try {
		for (;;) {
			lines = readLogLines()
			const complete =
				[...patterns.required, ...patterns.lastLine].every(
					(entry) => skipped.has(`log:${entry.id}`) || lines.some((line) => new RegExp(entry.pattern).test(line)),
				)
			const left = processStartedAt === null ? 0 : processStartedAt + logWaitSeconds * 1000 - Date.now()
			if (complete || left <= 0) return true
			console.error(`waiting: slow subsystems have ${Math.ceil(left / 1000)} s left to report`)
			await sleep(Math.min(10_000, left + 1000))
		}
	} catch (error) {
		report("fail", "log:read", error.message.split("\n")[0])
		return false
	}
})()
if (logReadable) {
	const hasStart = lines.some((line) => new RegExp(patterns.start).test(line))
	for (const entry of patterns.required) {
		const id = `log:${entry.id}`
		const line = lines.find((candidate) => new RegExp(entry.pattern).test(candidate))
		if (line || hasStart) await check(id, () => (line ? line.slice(0, 160) : fail(`no line matches /${entry.pattern}/ within ${logWaitSeconds} s of the start. Guards: ${entry.guards}`)))
		else report("warn", id, "the log no longer holds the process start, so this can't be checked")
	}
	for (const entry of patterns.lastLine) {
		await check(`log:${entry.id}`, () => {
			const last = lines.filter((line) => new RegExp(entry.pattern).test(line)).pop()
			if (!last) fail(`no line matches /${entry.pattern}/ within ${logWaitSeconds} s of the start. Guards: ${entry.guards}`)
			if (!new RegExp(entry.mustMatch).test(last)) fail(`latest line: "${last.slice(0, 200)}". Guards: ${entry.guards}`)
			return last.slice(0, 160)
		})
	}
	for (const entry of patterns.forbidden) {
		await check(`log:no "${entry.pattern}"`, () => {
			const hits = lines.filter((line) => new RegExp(entry.pattern).test(line))
			if (hits.length) fail(`${hits.length} lines, first: "${hits[0].slice(0, 200)}". Guards: ${entry.guards}`)
		})
	}
}

if (metricsBefore) {
	let metricsAfter = null
	await check("metrics:redis-client-ready", async () => {
		metricsAfter = await readMetrics()
		const ready = gauge(metricsAfter, "goodwatch_redis_client_ready")
		if (ready !== 1) fail(`goodwatch_redis_client_ready is ${ready}`)
	})
	if (metricsAfter) {
		await check("metrics:redis-breakers-closed", () => {
			const open = gauge(metricsAfter, "goodwatch_redis_breaker_open_nodes")
			if (open !== 0) fail(`goodwatch_redis_breaker_open_nodes is ${open}`)
		})
		await check("metrics:no-new-5xx", () => {
			if (gauge(metricsAfter, "goodwatch_process_uptime_seconds") < gauge(metricsBefore, "goodwatch_process_uptime_seconds")) fail("the process restarted during the check")
			const before = sumBy(metricsBefore, "goodwatch_http_responses_total", "route", 'status_class="5xx"')
			const after = sumBy(metricsAfter, "goodwatch_http_responses_total", "route", 'status_class="5xx"')
			const rose = [...after].filter(([route, count]) => count > (before.get(route) ?? 0)).map(([route, count]) => `${route} +${count - (before.get(route) ?? 0)}`)
			if (rose.length) fail(`5xx responses rose during the check: ${rose.join(", ")}`)
			const total = [...after.values()].reduce((sum, count) => sum + count, 0)
			if (total) report("warn", "metrics:5xx-since-start", `${total} since the process started: ${[...after].map(([route, count]) => `${route} ${count}`).join(", ")}`)
			return "no route's 5xx counter rose"
		})
	}
}
finish()

function finish() {
	const seconds = Math.round((Date.now() - startedAt) / 1000)
	console.log(`\n${counts.fail ? "SMOKE CHECK FAILED" : "Smoke check passed"}: ${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings, ${counts.skip} skipped, in ${seconds} s`)
	process.exit(counts.fail ? 1 : 0)
}

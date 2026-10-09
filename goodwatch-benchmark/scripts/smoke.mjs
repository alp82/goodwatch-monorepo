#!/usr/bin/env node
// Post-deploy smoke check. Run it through `./bench.sh smoke`, which loads config.env first.
//
// It finds the running webapp container, requests the pages in smoke/urls.json (edge cases included), checks the
// rendered HTML, scans the container's log from its start with the patterns in smoke/log-patterns.json, and compares
// the 5xx counters before and after. One line per check, exit code 1 on any failure. It sends fewer than 60 GET
// requests and one POST that the search route rejects before it searches, and changes nothing on the serving host.
//
// The container's WEBAPP_ROLE (page, search, or both, the default) decides which checks apply. A search role is its
// own container: --container-prefix names it, and it gets the requests in smoke/search-role-urls.json. The default
// run also checks every search role that SMOKE_SEARCH_ROLES lists, and prints one skip line while it lists none.
//
// --target production (default): the container is found over SSH on the host that the target's name resolves to.
// --host NAME: one instance on a named host. The container is found on that host, and the requests go straight to
//   it through an SSH tunnel, not through the public route or a proxy.
// --target local: a local production build. Pass --base-url, and --log-file or --container, and --metrics-url.
import { execFileSync, spawn } from "node:child_process"
import { lookup } from "node:dns/promises"
import { readFileSync } from "node:fs"
import { connect, createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildFilesInHtml, staticOriginFromSetting, staticOriginInHtml } from "./static-host.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const USAGE = `Usage: ./bench.sh smoke [options]
  --target production|local   Where the webapp runs. Default: production.
  --commit SHA                Wait for a container that runs this commit (production).
  --newer-than NAME           Wait for a container other than NAME, such as the one before the deploy (production).
  --host NAME                 Check the instance on this host directly, such as vector1 or abio: a name from
                              goodwatch-hq/ansible/hosts.ini or a private address. Without it, the requests use the
                              public route and the container is the one on the host that the target's name resolves to.
  --container-prefix PREFIX   The start of the container's name: the Coolify application's id and a hyphen.
                              Default: gk4owk8-, the webapp. A search role has its own.
  --role page|search|both     Fail unless the container runs in this role. Without it, the role is read from the
                              container's WEBAPP_ROLE and only decides which checks apply. Local: the role to assume.
  --deploy-timeout S          How long to wait for that container and for its health. Default: 600.
  --base-url URL              Default: BENCH_TARGET_URL or https://goodwatch.app. Required for local.
  --log-file FILE             Local: the server's log, from its start.
  --container NAME            Local: a Docker container to read the log from.
  --metrics-url URL           Local: the server's metrics endpoint, such as http://127.0.0.1:9464/metrics.
  --log-wait S                How long after the process start slow subsystems may take. Default: 120.
  --urls FILE                 Default: smoke/urls.json, or smoke/search-role-urls.json for a search role.
  --patterns FILE             Default: smoke/log-patterns.json.
  --skip ID,ID                Check ids to skip, such as log:title-snapshot. Each prints a skip line.`

const options = {
	target: "production",
	"deploy-timeout": "600",
	"log-wait": "120",
	"base-url": "",
	urls: "",
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
if (local && options.host) usageError("--host is for production instances, not for a local target")
let baseUrl = (options["base-url"] || (local ? "" : process.env.BENCH_TARGET_URL || "https://goodwatch.app")).replace(/\/$/, "")
if (!baseUrl) usageError("A local target needs --base-url")
const siteOrigin = new URL(baseUrl).origin
const skipped = new Set(options.skip.split(",").filter(Boolean))
const logWaitSeconds = Number(options["log-wait"])
const deployTimeout = Number(options["deploy-timeout"])
const BROWSER_UA =
	process.env.BROWSER_UA ||
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
const BOT_UA = process.env.BOT_UA || "facebookexternalhit/1.1"
const CONTAINER_PREFIX = options["container-prefix"] || process.env.SMOKE_CONTAINER_PREFIX || "gk4owk8-"
const ROLES = ["page", "search", "both"]
if (options.role && !ROLES.includes(options.role)) usageError("Role must be page, search, or both")
if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(CONTAINER_PREFIX)) usageError("A container prefix is letters, digits, dots, underscores, and hyphens")
// The role of the process under test. Production reads it from the container. The app treats every other value as both.
let role = options.role || "both"
const asRole = (value) => (value === "page" || value === "search" ? value : "both")

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
async function check(id, run, failure = "fail") {
	if (skipped.has(id)) return report("skip", id, "skipped with --skip")
	try {
		report("pass", id, (await run()) ?? "")
	} catch (error) {
		report(failure, id, error.message)
	}
}
const fail = (message) => {
	throw new Error(message)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// ---- The serving host (production) ----
let sshHost = ""
// With --host: the host that SSH jumps through to reach the private network.
let sshJump = ""
const sshUser = process.env.BENCH_SSH_USER || "root"
const sshArgs = () => ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR", ...(sshJump ? ["-J", sshJump] : [])]
/** Runs a Bash script on the serving host and returns its output. The address is never printed. */
function onHost(script, timeoutSeconds = 60) {
	return execFileSync(
		"ssh",
		[...sshArgs(), `${sshUser}@${sshHost}`, "bash -s"],
		{ input: script, encoding: "utf8", timeout: timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "inherit"] },
	)
}

/** The private address of a host: an address as given, or a name from the Ansible inventory. */
function privateAddress(host) {
	if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host
	const inventory = readFileSync(process.env.SMOKE_HOSTS_FILE || resolve(ROOT, "../goodwatch-hq/ansible/hosts.ini"), "utf8")
	const address = inventory.match(new RegExp(`^${host.replace(/[^a-zA-Z0-9_-]/g, "")}\\s+ansible_host=(\\S+)`, "m"))?.[1]
	if (!address) usageError(`No host "${host}" in goodwatch-hq/ansible/hosts.ini. Pass a name from that file or a private address.`)
	return address
}

/**
 * Opens an SSH tunnel from a local port to the container's HTTP port on its Docker network, and returns the local
 * origin. The requests then reach this one process: no proxy, no load balancer, no public route.
 */
let tunnel = null
async function openTunnel() {
	const [address, port] = onHost(
		`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' ${quote(container.name)} | awk '{print $1}'; docker exec ${quote(container.name)} sh -c 'echo \${PORT:-3000}'`,
	).trim().split(/\s+/)
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(address ?? "") || !/^\d+$/.test(port ?? "")) fail("the container has no network address or port")
	const localPort = await new Promise((done, failed) => {
		const probe = createServer()
		probe.on("error", failed)
		probe.listen(0, "127.0.0.1", () => {
			const free = probe.address().port
			probe.close(() => done(free))
		})
	})
	tunnel = spawn("ssh", [...sshArgs(), "-o", "ExitOnForwardFailure=yes", "-N", "-L", `127.0.0.1:${localPort}:${address}:${port}`, `${sshUser}@${sshHost}`], { stdio: "ignore" })
	for (let attempt = 0; attempt < 40; attempt++) {
		if (tunnel.exitCode !== null) fail("the SSH tunnel to the container closed")
		const open = await new Promise((done) => {
			const socket = connect(localPort, "127.0.0.1")
			socket.once("connect", () => done(true) || socket.destroy())
			socket.once("error", () => done(false))
		})
		if (open) return `http://127.0.0.1:${localPort}`
		await sleep(250)
	}
	fail("the SSH tunnel to the container didn't open within 10 s")
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
      printf 'found %s %s %s %s\\n' "$name" "$commit" "$(docker inspect -f '{{.State.StartedAt}}' "$name")" "$(docker exec "$name" printenv WEBAPP_ROLE 2>/dev/null | tr -cd 'a-zA-Z' | tr 'A-Z' 'a-z')"
      exit 0
    fi
  fi
  [ "$state" = "$said" ] || { echo "waiting: $state" >&2; said=$state; }
  [ "$(date +%s)" -lt "$deadline" ] || { echo "timeout: $state"; exit 0; }
  sleep 5
done`
	const output = onHost(script, deployTimeout + 60).trim().split("\n").pop()
	const [status, name, commit, startedAt, containerRole] = output.split(" ")
	if (status !== "found") fail(`no container fits after ${deployTimeout} s (${output.replace(/^timeout: /, "")})`)
	return { name, commit, startedAt: Date.parse(startedAt), role: asRole(containerRole) }
}

// ---- Log and metrics sources ----
let container = null
const allPatterns = JSON.parse(readFileSync(options.patterns, "utf8"))
// A pattern with "roles" applies to processes in those roles only. Set once the role is known.
let patterns = allPatterns
const ROLE_LINE = "^Process role: (page|search|both)"
const logPatterns = [
	allPatterns.start,
	ROLE_LINE,
	...allPatterns.required.map((entry) => entry.pattern),
	...allPatterns.lastLine.map((entry) => entry.pattern),
	...allPatterns.forbidden.map((entry) => entry.pattern),
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
	Object.assign(headers, entry.requestHeaders)
	const started = performance.now()
	const response = await fetch(baseUrl + path, { method: entry.method ?? "GET", body: entry.body, headers, redirect: "manual", signal: AbortSignal.timeout(60_000) })
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
let processStartedAt = null

if (!local) {
	const hostname = new URL(baseUrl).hostname
	const publicHost = process.env.SMOKE_SSH_HOST || (await lookup(hostname)).address
	if (options.host) {
		// The named host is on the private network. SSH jumps through BENCH_SSH_JUMP, or through the host that the
		// target's name resolves to. That host itself (abio) needs no jump.
		sshHost = privateAddress(options.host)
		sshJump = process.env.BENCH_SSH_JUMP || `${sshUser}@${publicHost}`
		if (sshHost === (process.env.BENCH_RESOLVE_IP || "10.0.0.21") && !process.env.BENCH_SSH_JUMP) {
			sshHost = publicHost
			sshJump = ""
		}
	} else {
		sshHost = publicHost
	}
	await check("deploy:container", () => {
		container = findContainer()
		processStartedAt = container.startedAt
		if (options.commit && !container.commit.startsWith(options.commit)) fail(`runs ${container.commit}`)
		return `${container.name}${options.host ? ` on ${options.host}` : ""}, commit ${container.commit.slice(0, 8)}, role ${container.role}, healthy, up ${Math.round((Date.now() - container.startedAt) / 1000)} s`
	})
	if (!container) finish()
	role = container.role
	if (options.role) {
		await check("deploy:role", () => (role === options.role ? `WEBAPP_ROLE makes it a ${role} process` : fail(`the container runs as ${role}, expected ${options.role}`)))
		if (role !== options.role) finish()
	}
	// A search role answers on its own container only: the public route would reach it for two paths.
	if (role === "search" && !options.host) {
		report("fail", "deploy:tunnel", "a search role is checked on its own container: pass --host")
		finish()
	}
	if (options.host) {
		await check("deploy:tunnel", async () => {
			baseUrl = await openTunnel()
			return `requests go to the container on ${options.host} through an SSH tunnel`
		})
		if (!tunnel) finish()
	}
}

// A local server has no container to ask: its log names the role at the start. A log without the line is from a
// build before the role setting, which runs as both.
if (local && !options.role) {
	try {
		role = readLogLines().map((line) => line.match(new RegExp(ROLE_LINE))?.[1]).find(Boolean) ?? "both"
	} catch {
		// The log checks report an unreadable log.
	}
}

// The checks that apply to this role. `direct` is true when the requests reach this one process and no proxy route.
const direct = local || Boolean(options.host)
const inRole = (entry) => !entry.roles || entry.roles.includes(role)
patterns = { ...allPatterns, required: allPatterns.required.filter(inRole), lastLine: allPatterns.lastLine.filter(inRole), forbidden: allPatterns.forbidden.filter(inRole) }
const set = JSON.parse(readFileSync(options.urls || `${ROOT}/smoke/${role === "search" ? "search-role-urls" : "urls"}.json`, "utf8"))
// A search role renders no page that the check may ask for: its readiness endpoint says that it answers.
const reachablePath = role === "search" ? "/health/ready" : "/"

// A deploy answers 502 while the proxy switches containers. Wait for the home page before counting anything.
await check("deploy:reachable", async () => {
	for (let attempt = 1; ; attempt++) {
		const status = await fetch(`${baseUrl}${reachablePath}`, { headers: { "User-Agent": BROWSER_UA, Cookie: "gw_browser=1" }, redirect: "manual", signal: AbortSignal.timeout(15_000) }).then(
			(response) => response.arrayBuffer().then(() => response.status),
			(error) => error.message,
		)
		if (status === 200) return `${baseUrl}${reachablePath === "/" ? "" : reachablePath} answers 200${attempt > 1 ? ` after ${attempt} tries` : ""}`
		if (attempt >= 18) fail(`${baseUrl}${reachablePath} answers ${status} after ${attempt} tries`)
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
	// An entry with "directRoles" needs a process in one of those roles. Through the public route, the proxy finds it.
	if (direct && entry.directRoles && !entry.directRoles.includes(role)) {
		report("skip", `url:${entry.id}`, `a ${role} process doesn't serve it: the proxy sends it to a search role`)
		continue
	}
	await check(`url:${entry.id}`, () => checkEntry(entry, set))
}

// The origin's build file was checked above. Check the static copy separately, without a site cookie.
if (set.static) {
	let staticOrigin = null
	let namedOrigin = null
	let buildPath = null
	await check("static:mode", () => {
		const html = bodies.get(set.static.entry) || ""
		namedOrigin = staticOriginInHtml(html, siteOrigin)
		staticOrigin = namedOrigin || staticOriginFromSetting(process.env.BENCH_STATIC_HOST)
		const files = buildFilesInHtml(html, siteOrigin)
		const build = files.find((url) => url.origin === (namedOrigin || siteOrigin) && new RegExp(set.static.pattern).test(url.pathname))
		if (!build) fail("the page references no build file")
		buildPath = build.pathname + build.search
		const value = metricsBefore ? gauge(metricsBefore, "goodwatch_static_assets_in_use") : null
		const mode = metricsBefore?.match(/goodwatch_static_assets_in_use\{[^}]*mode="([^"]*)"/)?.[1]
		return `pages name ${namedOrigin ? "the static hostname" : "the site's host"}${value === null ? "" : `; goodwatch_static_assets_in_use=${value}${mode ? `, mode=${mode}` : ""}`}${staticOrigin ? "" : "; static hostname was not checked because BENCH_STATIC_HOST is not set"}`
	})
	if (staticOrigin && buildPath) {
		const failure = namedOrigin ? "fail" : "warn"
		const staticRequest = async (path) => {
			const response = await fetch(staticOrigin + path, { headers: { "User-Agent": BROWSER_UA }, redirect: "manual", signal: AbortSignal.timeout(15_000) })
			await response.arrayBuffer()
			return response
		}
		await check("static:build-file", async () => {
			const response = await staticRequest(buildPath)
			const explain = (message) => fail(`${message}. Guards: ${set.static.guards}`)
			if (response.status !== 200) explain(`build file answered ${response.status}, expected 200`)
			if (!response.headers.get("access-control-allow-origin")) explain("build file lacks Access-Control-Allow-Origin")
			const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(staticOrigin).hostname)
			if (!loopback && !response.headers.get("cf-cache-status")) explain("build file lacks CF-Cache-Status")
			if (!new RegExp(`(?:^|[,\\s])max-age=${set.static.maxAge}(?:[,\\s]|$)`).test(response.headers.get("cache-control") || "")) explain(`build file lacks max-age=${set.static.maxAge}`)
			return `200 for a build file on the static hostname, access-control-allow-origin ${response.headers.get("access-control-allow-origin")}, cf-cache-status ${response.headers.get("cf-cache-status") ?? "not required on loopback"}`
		}, failure)
		await check("static:root-404", async () => {
			const response = await staticRequest("/")
			if (response.status !== 404) fail(`static root answered ${response.status}, expected 404. Guards: ${set.static.guards}`)
			return "404 for / on the static hostname"
		}, failure)
	}
}

// The log, after the requests, so that errors from the edge-case pages are in it. Slow subsystems get until
// --log-wait seconds after the process start.
let lines = []
const logReadable = await (async () => {
	try {
		for (;;) {
			lines = readLogLines()
			// A "last line" entry is complete once its newest line says what it must: a search role writes
			// "query encoder not ready" every minute until its query models have loaded.
			const complete =
				patterns.required.every((entry) => skipped.has(`log:${entry.id}`) || lines.some((line) => new RegExp(entry.pattern).test(line))) &&
				patterns.lastLine.every((entry) => {
					const last = lines.filter((line) => new RegExp(entry.pattern).test(line)).pop()
					return skipped.has(`log:${entry.id}`) || (last !== undefined && new RegExp(entry.mustMatch).test(last))
				})
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
	for (const kind of ["required", "lastLine"])
		for (const entry of allPatterns[kind]) if (!inRole(entry)) report("skip", `log:${entry.id}`, `for the ${entry.roles.join(" and ")} role only, and this process runs as ${role}`)
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
await checkSearchRoles()
finish()

/**
 * The default production run also checks each search role in SMOKE_SEARCH_ROLES, a list of host:prefix pairs separated
 * by commas, such as "vector1:abc123-,vector1:def456-". Each one is this script again, for that container alone.
 */
async function checkSearchRoles() {
	if (local || options.host) return
	if (skipped.has("search-roles")) return report("skip", "search-roles", "skipped with --skip")
	const listed = (process.env.SMOKE_SEARCH_ROLES || "").split(",").map((item) => item.trim()).filter(Boolean)
	if (!listed.length) return report("skip", "search-roles", "no search role is listed: set SMOKE_SEARCH_ROLES in config.env once the search roles run")
	for (const item of listed) {
		const [host, prefix] = item.split(":")
		const id = `search-role:${item}`
		if (!host || !prefix) {
			report("fail", id, "SMOKE_SEARCH_ROLES entries are host:prefix, such as vector1:abc123-")
			continue
		}
		const args = [fileURLToPath(import.meta.url), "--host", host, "--container-prefix", prefix, "--role", "search", "--deploy-timeout", options["deploy-timeout"], "--log-wait", options["log-wait"]]
		if (options.commit) args.push("--commit", options.commit)
		if (options.skip) args.push("--skip", options.skip)
		console.log(`\n---- search role ${item} ----`)
		const code = await new Promise((done) => spawn(process.execPath, args, { stdio: "inherit" }).on("close", done))
		report(code === 0 ? "pass" : "fail", id, code === 0 ? "every check of this search role passed" : "see the lines above")
	}
}

function finish() {
	tunnel?.kill()
	const seconds = Math.round((Date.now() - startedAt) / 1000)
	console.log(`\n${counts.fail ? "SMOKE CHECK FAILED" : "Smoke check passed"}: ${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings, ${counts.skip} skipped, in ${seconds} s`)
	process.exit(counts.fail ? 1 : 0)
}

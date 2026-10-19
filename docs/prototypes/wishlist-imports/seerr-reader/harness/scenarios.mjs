// Seeds a disposable Seerr through its own API, runs the reader against every
// scenario in GATES.md, and scores each run. Runs inside a container on the
// harness's internal Docker network. See run.sh.
//
// Usage: node scenarios.mjs <seerr-base-url> <seerr-db-path> <out-dir> <label>
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { promisify } from "node:util"
import { connect, readWatchlist, ReaderError, EXIT } from "../reader.mjs"

const [baseUrl, dbPath, outDir, label] = process.argv.slice(2)
const API_KEY = "gw712-local-test-key"
const READER = new URL("../reader.mjs", import.meta.url).pathname
const PARSER = new URL("../../../../../goodwatch-webapp/app/server/imports/wishlist.server.ts", import.meta.url).pathname
const { parseWishlistFile } = await import(PARSER)
mkdirSync(outDir, { recursive: true })

const run = promisify(execFile)
const db = new DatabaseSync(dbPath)
db.exec("PRAGMA busy_timeout = 5000")

async function api(path, { user, method = "GET", body } = {}) {
	const response = await fetch(`${baseUrl}/api/v1${path}`, {
		method,
		headers: {
			"x-api-key": API_KEY,
			"content-type": "application/json",
			...(user ? { "x-api-user": String(user) } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	})
	const text = await response.text()
	if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 200)}`)
	return text ? JSON.parse(text) : undefined
}

const password = (name) => `pw-${name}-${label}`
async function createUser(name) {
	const user = await api("/user", {
		method: "POST",
		body: { email: `${name}@gw712.invalid`, username: name, password: password(name) },
	})
	return user.id
}

const addWish = (user, tmdbId, mediaType, title) =>
	api("/watchlist", { user, method: "POST", body: { tmdbId, mediaType, title: title ?? `${mediaType} ${tmdbId}` } })
const removeWish = (user, key) => {
	const [type, tmdbId] = key.split(":")
	return api(`/watchlist/${tmdbId}?mediaType=${type === "show" ? "tv" : "movie"}`, { user, method: "DELETE" })
}
const request = (user, tmdbId, mediaType) =>
	api("/request", {
		user,
		method: "POST",
		body: mediaType === "movie" ? { mediaType, mediaId: tmdbId } : { mediaType, mediaId: tmdbId, seasons: [1] },
	})
const setPlexToken = (user, token) => db.prepare("UPDATE user SET plexToken = ? WHERE id = ?").run(token, user)

// Seed `count` rows: alternate movie/show, and put `shared` IDs in both namespaces.
async function seedLocal(user, base, count, { shared = 0, titles = {} } = {}) {
	const identities = []
	for (let index = 0; index < shared && identities.length < count; index += 1) {
		identities.push(["movie", base + index], ["tv", base + index])
	}
	for (let index = shared; identities.length < count; index += 1)
		identities.push([index % 2 ? "tv" : "movie", base + index])
	identities.length = count
	for (const [mediaType, tmdbId] of identities) await addWish(user, tmdbId, mediaType, titles[`${mediaType}:${tmdbId}`])
	return identities.map(([mediaType, tmdbId]) => `${mediaType === "tv" ? "show" : "movie"}:${tmdbId}`)
}

const plexIdentities = (from, count, type) => Array.from({ length: count }, (_, i) => `${type}:${from + i}`)

const ALLOWED_ITEM_KEYS = new Set(["title", "mediaType", "tmdbId", "addedAt"])
const FORBIDDEN_TEXT = ["gw712.invalid", "plex-", "rk-", "gravatar", "requestedBy", "ratingKey", API_KEY]

function score(name, gateIds, expected, result, extra = {}) {
	const { file, report } = result
	const got = (file?.items ?? []).map((item) => (item.tmdbId ? `${item.mediaType}:${item.tmdbId}` : `untyped:${item.title}`))
	const expectedSet = new Set(expected)
	const gotSet = new Set(got)
	const missing = [...expectedSet].filter((key) => !gotSet.has(key)).length
	const extraRows = [...gotSet].filter((key) => !expectedSet.has(key)).length
	const duplicateOut = got.length - gotSet.size
	const exact = missing === 0 && extraRows === 0 && duplicateOut === 0
	let parser = { accepted: false, wants: 0, invalid: 0 }
	let projectionOk = true
	let leaks = []
	if (file) {
		const bytes = new TextEncoder().encode(JSON.stringify(file))
		const parsed = parseWishlistFile(bytes, (message) => {
			throw new Error(`parser rejected: ${message}`)
		})
		parser = {
			accepted: true,
			wants: parsed.observations.filter((o) => o.kind === "want").length,
			invalid: parsed.observations.filter((o) => o.kind !== "want").length,
			completeness: parsed.observations[0]?.wishlistEvidence?.completeness,
		}
		projectionOk = file.items.every((item) => Object.keys(item).every((key) => ALLOWED_ITEM_KEYS.has(key)))
		const text = JSON.stringify(file)
		leaks = FORBIDDEN_TEXT.filter((needle) => text.includes(needle))
		writeFileSync(`${outDir}/${name}.json`, `${JSON.stringify(file, null, 2)}\n`)
	}
	const falseComplete = file?.completeness === "complete" && !exact
	return {
		name,
		gates: gateIds,
		expectedTitles: expectedSet.size,
		outputTitles: got.length,
		missing,
		extra: extraRows,
		duplicateOut,
		exact,
		label: file?.completeness ?? "no file",
		falseComplete,
		parser,
		projectionOk,
		leaks,
		report,
		...extra,
	}
}

async function readAs(user, options = {}) {
	const seerr = await connect({ baseUrl, apiKey: API_KEY, apiUser: user })
	return readWatchlist({ getPage: seerr.getPage, ...options })
}

const results = []
const record = async (name, gates, expected, readFn, extra) => {
	try {
		results.push(score(name, gates, expected, await readFn(), extra))
	} catch (error) {
		if (!(error instanceof ReaderError)) throw error
		results.push({ name, gates, expectedTitles: new Set(expected).size, label: "no file", error: error.message, falseComplete: false, ...extra })
	}
	const last = results.at(-1)
	console.log(`${name}: ${last.label}${last.error ? ` (${last.error})` : ""}${last.exact === false ? " MISMATCH" : ""}`)
}

// Wait for Seerr.
for (let attempt = 0; ; attempt += 1) {
	try {
		await api("/status")
		break
	} catch (error) {
		if (attempt > 60) throw error
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
}

// --- Local list: sizes, namespaces, intent, scope ---------------------------
const sizes = {}
for (const [count, base, shared] of [
	[1, 10000, 0],
	[20, 11000, 3],
	[21, 12000, 3],
	[41, 13000, 5],
	[60, 14000, 6],
]) {
	const user = await createUser(`local${count}`)
	const titles =
		count === 60
			? { "movie:14010": "Title with a\nline break and a tab\there", "tv:14011": "Ünïcödé 🎬 title" }
			: {}
	sizes[count] = { user, expected: await seedLocal(user, base, count, { shared, titles }) }
}
// Acquisition requests: 5 titles only requested, 2 both requested and on the list.
const intentUser = sizes[60].user
for (const tmdbId of [19001, 19002, 19003]) await request(intentUser, tmdbId, "movie")
for (const tmdbId of [19004, 19005]) await request(intentUser, tmdbId, "tv")
await request(intentUser, 14000, "movie")
await request(intentUser, 14001, "tv")
// Another member with overlapping and separate titles.
const other = await createUser("other")
await seedLocal(other, 14000, 3)
await seedLocal(other, 18000, 5)

for (const count of [1, 20, 21, 41, 60])
	await record(`local-${count}`, count === 60 ? ["L1", "L2", "L3", "L4", "L5", "L6"] : ["L1", "L2", "L3", "L6"], sizes[count].expected, () =>
		readAs(sizes[count].user),
	)

// CLI, member's own sign-in (email + password, no admin key).
async function cli(name, gates, expected, env, args) {
	const out = `${outDir}/${name}.cli.json`
	const started = Date.now()
	let code = 0
	let stdout = ""
	try {
		;({ stdout } = await run("node", [READER, "--url", baseUrl, "--out", out, ...args], { env: { PATH: process.env.PATH, ...env } }))
	} catch (error) {
		code = error.code
		stdout = error.stdout
	}
	const file = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : undefined
	let report
	try {
		report = JSON.parse(stdout)
	} catch {}
	const scored = score(name, gates, expected, { file, report }, { exitCode: code, wallMs: Date.now() - started })
	results.push(scored)
	console.log(`${name}: exit ${code}, ${scored.label}`)
}
await cli("cli-own-signin-21", ["L1", "L5", "L6"], sizes[21].expected, { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: password("local21") }, [])
await cli("cli-api-key-60", ["L1", "L6"], sizes[60].expected, { SEERR_API_KEY: API_KEY }, ["--user-id", String(sizes[60].user)])
await cli("cli-wrong-key", ["L7"], [], { SEERR_API_KEY: "wrong" }, ["--user-id", String(sizes[60].user)])
await cli("cli-wrong-password", ["L7"], [], { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: "wrong" }, [])
await cli("cli-other-user", ["L5", "L7"], [], { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: password("local21") }, ["--user-id", String(other)])
await cli("cli-unreachable", ["L7"], [], { SEERR_API_KEY: API_KEY }, ["--user-id", "2", "--url", "http://gw712-nowhere:5055"])

// L7 shapes the server can't produce on demand: fake pages straight into the reader.
const fake = (pages) => ({ getPage: async (page) => pages(page) })
await record("stub-bad-envelope", ["L7"], [], () => readWatchlist(fake(() => ({ page: 1, results: "nope" }))))
await record("stub-unknown-rows", ["L3"], [], () =>
	readWatchlist(fake(() => ({ page: 1, totalPages: 1, totalResults: 1, results: [{ tmdbId: 5, mediaType: "movie", title: "New layout" }] }))),
)

// L3 traps: the list changes during the read.
const mutateAdd = await createUser("mutateadd")
const mutateAddExpected = await seedLocal(mutateAdd, 15000, 41)
await record("trap-added-during-read", ["L3"], mutateAddExpected, () =>
	readAs(mutateAdd, { onPage: async (done) => done === 1 && (await addWish(mutateAdd, 15999, "movie")) }),
)
const mutateRemove = await createUser("mutateremove")
const mutateRemoveSeeded = await seedLocal(mutateRemove, 16000, 41)
await record("trap-removed-during-read", ["L3"], mutateRemoveSeeded.filter((key) => key !== "movie:16000"), () =>
	readAs(mutateRemove, { onPage: async (done) => done === 1 && (await removeWish(mutateRemove, "movie:16000")) }),
)

// --- Plex fallback (zero local rows) ----------------------------------------
async function plexUser(name, token) {
	const user = await createUser(name)
	if (token) setPlexToken(user, token)
	return user
}
const plexCases = [
	["plex-no-token", undefined, [], ["P1"]],
	["plex-normal", "plex-normal", [...plexIdentities(5000, 13, "movie"), ...plexIdentities(6000, 12, "show")], ["P2"]],
	["plex-missing-guid", "plex-missing-guid", [...plexIdentities(5100, 20, "movie"), ...plexIdentities(5200, 3, "movie"), ...plexIdentities(6100, 2, "show")], ["P2", "P3"]],
	["plex-metadata-404", "plex-meta-404", [...plexIdentities(5300, 22, "movie"), ...plexIdentities(5400, 3, "show")], ["P2", "P3"]],
	["plex-metadata-500", "plex-meta-500", [...plexIdentities(5500, 11, "movie")], ["P4"]],
	["plex-list-500", "plex-list-500", plexIdentities(5700, 5, "movie"), ["P4"]],
	["plex-token-expired", "plex-expired", plexIdentities(5800, 5, "movie"), ["P4"]],
	["plex-fails-on-page-2", "plex-fail-page-2", plexIdentities(5900, 30, "movie"), ["P2", "P4"]],
	["plex-list-wide-etag", "plex-list-etag", plexIdentities(6200, 30, "movie"), ["P2", "P5"]],
	["plex-empty", "plex-empty", [], ["P1"]],
]
for (const [name, token, expected, gates] of plexCases) {
	const user = await plexUser(name.replaceAll("-", ""), token)
	await record(name, gates, expected, () => readAs(user))
}

// P6: local rows vanish between pages, so page 2 comes from Plex.
const switchUser = await createUser("switch")
const switchSeeded = await seedLocal(switchUser, 17000, 21)
setPlexToken(switchUser, "plex-switch")
await record("trap-local-to-plex-switch", ["P6", "L3"], plexIdentities(6300, 25, "movie"), () =>
	readAs(switchUser, {
		onPage: async (done) => {
			if (done !== 1) return
			for (const key of switchSeeded) await removeWish(switchUser, key)
		},
	}),
)

// Route comparison: local rows plus a Plex token.
const shadow = await createUser("shadow")
const shadowExpected = await seedLocal(shadow, 17500, 21, { shared: 2 })
setPlexToken(shadow, "plex-normal-v2")
await record("route-user-local-and-token", ["L1", "L3"], shadowExpected, () => readAs(shadow))
const discover = await api("/discover/watchlist?page=1", { user: shadow })
const userRoute = await api(`/user/${shadow}/watchlist?page=1`, { user: shadow })
const routeComparison = {
	user: "21 local rows and a Plex token (25 Plex rows)",
	userRoute: { totalResults: userRoute.totalResults, firstRowShape: userRoute.results[0] && Object.keys(userRoute.results[0]).includes("createdAt") ? "local" : "plex" },
	discoverRoute: { totalResults: discover.totalResults, firstRowShape: discover.results[0] && Object.keys(discover.results[0]).includes("createdAt") ? "local" : "plex" },
}
console.log("route comparison", JSON.stringify(routeComparison))

// Pagination stability: two full reads of the 60-row list return the same order.
const order = async () => (await readAs(sizes[60].user)).file.items.map((item) => `${item.mediaType}:${item.tmdbId}`).join(",")
const stableOrder = (await order()) === (await order())

const mock = await (await fetch("https://mock/__log")).json()
const summary = {
	label,
	scenarios: results.length,
	falseComplete: results.filter((r) => r.falseComplete).length,
	routeComparison,
	stableOrder,
	mockRequests: mock.length,
	results,
}
writeFileSync(`${outDir}/results.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(`done: ${results.length} scenarios, ${summary.falseComplete} false complete labels`)

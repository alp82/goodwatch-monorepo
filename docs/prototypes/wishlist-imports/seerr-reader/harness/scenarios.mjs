// Seeds a disposable Seerr through its own API, runs the reader against every
// scenario in GATES.md, and scores each run. Runs inside a container on the
// harness's internal Docker network. See run.sh.
//
// Usage: node scenarios.mjs <seerr-base-url> <seerr-db-path> <out-dir> <label>
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { promisify } from "node:util"
import { randomBytes } from "node:crypto"
import { connect, readWatchlist, ReaderError, EXIT } from "../reader.mjs"

const [baseUrl, dbPath, outDir, label] = process.argv.slice(2)
const API_KEY = "gw712-local-test-key"
// Synthetic Plex token for the background-refresh scenario. run.sh passes it
// in so it can check Seerr's stderr for it afterwards. Never print it.
const SECRET = process.env.GW712_SYNTHETIC_SECRET ?? `gw712-synthetic-secret-${randomBytes(8).toString("hex")}`
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

const ALLOWED_ITEM_KEYS = new Set(["title", "mediaType", "tmdbId", "addedAt", "sourceId"])
const PLEX_TOKENS = ["plex-normal", "plex-missing-guid", "plex-meta-404", "plex-meta-500", "plex-list-500", "plex-expired", "plex-fail-page-2", "plex-list-etag", "plex-empty", "plex-switch", "plex-other-type"]
const FORBIDDEN_TEXT = ["gw712.invalid", ...PLEX_TOKENS, SECRET, "rk-", "gravatar", "requestedBy", "ratingKey", API_KEY]
// Seerr marks every non-show Plex row as a movie, so the reader writes those
// as type unknown with the TMDB number in sourceId. Score them as Seerr's movie.
const scoreKey = (item) => {
	const plexNumber = /^plex-guid-tmdb:(\d+)$/.exec(item.sourceId ?? "")
	if (item.mediaType === "unknown" && plexNumber) return `movie:${plexNumber[1]}`
	return item.tmdbId ? `${item.mediaType}:${item.tmdbId}` : `untyped:${item.title}`
}

function score(name, gateIds, expected, result, extra = {}) {
	const { file, report } = result
	const got = (file?.items ?? []).map(scoreKey)
	const expectedSet = new Set(expected)
	const gotSet = new Set(got)
	const missing = [...expectedSet].filter((key) => !gotSet.has(key)).length
	const extraRows = [...gotSet].filter((key) => !expectedSet.has(key)).length
	const duplicateOut = got.length - gotSet.size
	const exact = missing === 0 && extraRows === 0 && duplicateOut === 0
	let parser = { accepted: false, wants: 0, invalid: 0, movieWants: 0 }
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
			// Movie wishes the import could apply without a member's choice. An
			// unknown-type row is stored on a movie placeholder but blocked.
			movieWants: parsed.observations.filter((o) => o.kind === "want" && o.mediaType === "movie" && !o.problem).length,
			movieWishKeys: parsed.observations.filter((o) => o.kind === "want" && o.mediaType === "movie" && !o.problem).map((o) => `movie:${o.tmdbId}`),
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
// `expect`: the labels this scenario may end with ("complete", "unknown",
// "no file"), and optional extra checks on the scored result.
function check(result, expect) {
	const failures = []
	if (!expect.labels.includes(result.label)) failures.push(`label ${result.label}, expected ${expect.labels.join(" or ")}`)
	if (result.falseComplete) failures.push("false complete")
	if (result.leaks?.length) failures.push(`leaked ${result.leaks.length} forbidden strings`)
	if (result.projectionOk === false) failures.push("extra item fields")
	if (result.parser?.invalid) failures.push(`${result.parser.invalid} invalid rows`)
	if (expect.noMovieWants && result.parser?.movieWants) failures.push(`${result.parser.movieWants} Plex rows became movie wishes`)
	if (expect.movieWishesOnlyFrom) {
		const stray = (result.parser?.movieWishKeys ?? []).filter((key) => !expect.movieWishesOnlyFrom.includes(key))
		if (stray.length) failures.push(`${stray.length} movie wishes didn't come from the local list`)
	}
	result.expect = expect.labels
	result.failures = failures
	return result
}
const record = async (name, gates, expected, readFn, expect) => {
	let result
	try {
		result = score(name, gates, expected, await readFn())
	} catch (error) {
		if (!(error instanceof ReaderError)) throw error
		result = { name, gates, expectedTitles: new Set(expected).size, label: "no file", error: error.message, falseComplete: false }
	}
	results.push(check(result, expect))
	console.log(`${name}: ${result.label}${result.error ? ` (${result.error})` : ""}${result.failures.length ? ` FAIL: ${result.failures.join("; ")}` : ""}`)
}
const COMPLETE = { labels: ["complete"] }
const UNKNOWN = { labels: ["unknown"] }
const NO_FILE = { labels: ["no file"] }
const NOT_COMPLETE = { labels: ["unknown", "no file"] }
const PLEX_UNKNOWN = { labels: ["unknown"], noMovieWants: true }
const PLEX_NOT_COMPLETE = { labels: ["unknown", "no file"], noMovieWants: true }

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
	COMPLETE)

// CLI, member's own sign-in (email + password, no admin key).
async function cli(name, gates, expected, env, args, expect) {
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
	const scored = check(score(name, gates, expected, { file, report }, { exitCode: code, wallMs: Date.now() - started }), expect)
	results.push(scored)
	console.log(`${name}: exit ${code}, ${scored.label}${scored.failures.length ? ` FAIL: ${scored.failures.join("; ")}` : ""}`)
}
await cli("cli-own-signin-21", ["L1", "L5", "L6"], sizes[21].expected, { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: password("local21") }, [], COMPLETE)
await cli("cli-api-key-60", ["L1", "L6"], sizes[60].expected, { SEERR_API_KEY: API_KEY }, ["--user-id", String(sizes[60].user)], COMPLETE)
await cli("cli-wrong-key", ["L7"], [], { SEERR_API_KEY: "wrong" }, ["--user-id", String(sizes[60].user)], NO_FILE)
await cli("cli-wrong-password", ["L7"], [], { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: "wrong" }, [], NO_FILE)
await cli("cli-other-user", ["L5", "L7"], [], { SEERR_EMAIL: "local21@gw712.invalid", SEERR_PASSWORD: password("local21") }, ["--user-id", String(other)], NO_FILE)
await cli("cli-unreachable", ["L7"], [], { SEERR_API_KEY: API_KEY }, ["--user-id", "2", "--url", "http://gw712-nowhere:5055"], NO_FILE)

// L7 shapes the server can't produce on demand: fake pages straight into the reader.
const fake = (pages) => ({ getPage: async (page) => pages(page) })
await record("stub-bad-envelope", ["L7"], [], () => readWatchlist(fake(() => ({ page: 1, results: "nope" }))), NO_FILE)
await record("stub-unknown-rows", ["L3"], [], () =>
	readWatchlist(fake(() => ({ page: 1, totalPages: 1, totalResults: 1, results: [{ tmdbId: 5, mediaType: "movie", title: "New layout" }] }))),
	UNKNOWN,
)
// L8: the reread must count toward the source check: local first, then
// Plex-shaped rows with the same IDs.
const localRow = (tmdbId) => ({ id: 1, tmdbId, mediaType: "movie", title: `Movie ${tmdbId}`, ratingKey: "", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" })
const plexRow = (tmdbId) => ({ id: tmdbId, ratingKey: "x", title: `Movie ${tmdbId}`, mediaType: "movie", tmdbId })
{
	let calls = 0
	await record("stub-reread-plex-shaped", ["L8", "L9"], ["movie:5"], () =>
		readWatchlist(fake(() => ({ page: 1, totalPages: 1, totalResults: 1, results: [(calls++ === 0 ? localRow : plexRow)(5)] }))),
		NOT_COMPLETE,
	)
}
// L9: page numbers and page counts must agree with Seerr's total.
await record("stub-page-999", ["L9"], ["movie:5"], () =>
	readWatchlist(fake(() => ({ page: 999, totalPages: 0, totalResults: 1, results: [localRow(5)] }))),
	NOT_COMPLETE,
)
await record("stub-wrong-page-number", ["L9"], ["movie:1", "movie:21"], () =>
	readWatchlist(
		fake((page) => ({
			page: 1,
			totalPages: 2,
			totalResults: 21,
			results: page === 1 ? Array.from({ length: 20 }, (_, i) => localRow(i + 1)) : [localRow(21)],
		})),
	),
	NOT_COMPLETE,
)

// L3 traps: the list changes during the read.
const mutateAdd = await createUser("mutateadd")
const mutateAddExpected = await seedLocal(mutateAdd, 15000, 41)
await record("trap-added-during-read", ["L3"], mutateAddExpected, () =>
	readAs(mutateAdd, { onPage: async (done, pass = 1) => pass === 1 && done === 1 && (await addWish(mutateAdd, 15999, "movie")) }),
	NOT_COMPLETE,
)
const mutateRemove = await createUser("mutateremove")
const mutateRemoveSeeded = await seedLocal(mutateRemove, 16000, 41)
await record("trap-removed-during-read", ["L3"], mutateRemoveSeeded.filter((key) => key !== "movie:16000"), () =>
	readAs(mutateRemove, { onPage: async (done, pass = 1) => pass === 1 && done === 1 && (await removeWish(mutateRemove, "movie:16000")) }),
	NOT_COMPLETE,
)
// L8: an edit that keeps the count. Read pages 1-2, delete row 21, append
// row 61, read page 3. Counts and page 1 still agree; row 41 is skipped.
const countKeep = await createUser("countkeep")
const countKeepSeeded = await seedLocal(countKeep, 20000, 60)
const row21 = countKeepSeeded[20]
await record(
	"trap-count-preserving-edit",
	["L3", "L8"],
	[...countKeepSeeded.filter((key) => key !== row21), "movie:20999"],
	() =>
		readAs(countKeep, {
			onPage: async (done, pass = 1) => {
				if (pass !== 1 || done !== 2) return
				await removeWish(countKeep, row21)
				await addWish(countKeep, 20999, "movie")
			},
		}),
	NOT_COMPLETE,
)

// --- Plex fallback (zero local rows) ----------------------------------------
async function plexUser(name, token) {
	const user = await createUser(name)
	if (token) setPlexToken(user, token)
	return user
}
const plexCases = [
	["plex-no-token", undefined, [], ["P1"], NO_FILE],
	["plex-normal", "plex-normal", [...plexIdentities(5000, 13, "movie"), ...plexIdentities(6000, 12, "show")], ["P2", "P7"], PLEX_UNKNOWN],
	["plex-missing-guid", "plex-missing-guid", [...plexIdentities(5100, 20, "movie"), ...plexIdentities(5200, 3, "movie"), ...plexIdentities(6100, 2, "show")], ["P2", "P3", "P7"], PLEX_UNKNOWN],
	["plex-metadata-404", "plex-meta-404", [...plexIdentities(5300, 22, "movie"), ...plexIdentities(5400, 3, "show")], ["P2", "P3", "P7"], PLEX_UNKNOWN],
	["plex-metadata-500", "plex-meta-500", [...plexIdentities(5500, 11, "movie")], ["P4"], NO_FILE],
	["plex-list-500", "plex-list-500", plexIdentities(5700, 5, "movie"), ["P4"], NO_FILE],
	["plex-token-expired", "plex-expired", plexIdentities(5800, 5, "movie"), ["P4"], NO_FILE],
	["plex-fails-on-page-2", "plex-fail-page-2", plexIdentities(5900, 30, "movie"), ["P2", "P4", "P7"], PLEX_UNKNOWN],
	["plex-list-wide-etag", "plex-list-etag", plexIdentities(6200, 30, "movie"), ["P2", "P5", "P7"], PLEX_UNKNOWN],
	["plex-empty", "plex-empty", [], ["P1"], NO_FILE],
	// Two Plex episodes among three movies: Seerr reports all five as movies.
	["plex-other-type", "plex-other-type", [...plexIdentities(7000, 3, "movie"), ...plexIdentities(7100, 2, "movie")], ["P2", "P7"], PLEX_UNKNOWN],
]
for (const [name, token, expected, gates, expect] of plexCases) {
	const user = await plexUser(name.replaceAll("-", ""), token)
	await record(name, gates, expected, () => readAs(user), expect)
}

// P6: local rows vanish between pages, so page 2 comes from Plex.
const switchUser = await createUser("switch")
const switchSeeded = await seedLocal(switchUser, 17000, 21)
setPlexToken(switchUser, "plex-switch")
await record("trap-local-to-plex-switch", ["P6", "L3"], plexIdentities(6300, 25, "movie"), () =>
	readAs(switchUser, {
		onPage: async (done, pass = 1) => {
			if (pass !== 1 || done !== 1) return
			for (const key of switchSeeded) await removeWish(switchUser, key)
		},
	}),
	// Page 1 really came from the local list, so its movies are wishes. No
	// Plex row may become one.
	{ labels: ["unknown"], movieWishesOnlyFrom: switchSeeded },
)

// Route comparison: local rows plus a Plex token.
const shadow = await createUser("shadow")
const shadowExpected = await seedLocal(shadow, 17500, 21, { shared: 2 })
setPlexToken(shadow, "plex-normal-v2")
await record("route-user-local-and-token", ["L1", "L3"], shadowExpected, () => readAs(shadow), COMPLETE)
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

// S1, last because it can stop Seerr: a cached Plex metadata entry older than
// 10 seconds makes Seerr refresh it in the background without a rejection
// handler. The mock fails that refresh. Seerr then prints an error that
// includes the request's X-Plex-Token (synthetic here). run.sh counts it in
// Seerr's stderr as a positive control and checks it isn't in anything kept.
const refreshUser = await plexUser("refreshfail", SECRET)
await record("plex-background-refresh-failure", ["P2", "S1"], plexIdentities(7200, 5, "movie"), () => readAs(refreshUser), PLEX_UNKNOWN)
await new Promise((resolve) => setTimeout(resolve, 11_000))
let afterRefresh
try {
	afterRefresh = (await readAs(refreshUser)).report.source
} catch (error) {
	afterRefresh = `read failed: ${error.message}`
}
await new Promise((resolve) => setTimeout(resolve, 2_000))
let seerrAliveAfterRefresh = true
try {
	await api("/status")
} catch {
	seerrAliveAfterRefresh = false
}
const refreshFailuresServed = (await (await fetch("https://mock/__log")).json()).filter((entry) => entry.injectedFailure).length

const failed = results.filter((r) => r.failures.length)
const summary = {
	label,
	scenarios: results.length,
	failedScenarios: failed.map((r) => r.name),
	falseComplete: results.filter((r) => r.falseComplete).length,
	routeComparison,
	stableOrder,
	mockRequests: mock.length,
	backgroundRefresh: { secondRead: afterRefresh, refreshFailuresServed, seerrAliveAfterRefresh },
	results,
}
writeFileSync(`${outDir}/results.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(`background refresh: ${refreshFailuresServed} failures served, Seerr alive afterwards: ${seerrAliveAfterRefresh}`)
console.log(`done: ${results.length} scenarios, ${failed.length} failed, ${summary.falseComplete} false complete labels`)
if (failed.length || refreshFailuresServed === 0) process.exitCode = 1

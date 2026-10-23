import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { readWatchlist, ReaderError } from "./reader.mjs"
import { fakeMdblist } from "./fake-mdblist.mjs"
import { parseWishlistFile } from "../../../../goodwatch-webapp/app/server/imports/wishlist.server.ts"

const here = dirname(fileURLToPath(import.meta.url))
const { rows } = JSON.parse(readFileSync(join(here, "fixtures/synthetic-watchlist.json"), "utf8"))
const noSleep = async () => {}
const fixedNow = () => new Date("2026-10-19T10:00:00.000Z")
const read = (fake, extra = {}) =>
	readWatchlist({ apiKey: "test-key", fetchImpl: fake.fetchImpl, sleep: noSleep, now: fixedNow, limit: 2, ...extra })
const parse = (file) =>
	parseWishlistFile(new TextEncoder().encode(JSON.stringify(file)), (message) => {
		throw new Error(message)
	})
async function failsWith(promise, code) {
	await assert.rejects(promise, (error) => {
		assert.ok(error instanceof ReaderError, String(error))
		assert.equal(error.code, code)
		return true
	})
}

test("G1, G2, G5, G6: every row is accounted for once with limit=2", async () => {
	const fake = fakeMdblist(rows)
	const { file, report } = await read(fake)
	assert.equal(report.requests, Math.ceil(rows.length / 2))
	assert.equal(report.rows.received, rows.length)
	assert.equal(report.rows.wishes + report.rows.unsupported + report.rows.repeats, report.rows.received)
	assert.deepEqual([report.rows.wishes, report.rows.unsupported, report.rows.repeats], [8, 2, 1])
	assert.equal(file.items.length, 10)
	assert.equal(file.completeness, "complete")
	assert.equal(report.exhaustion, "proven")
	// Cursor followed on every page but the last.
	assert.deepEqual(fake.log.map((entry) => !!entry.params.cursor), [false, true, true, true, true, true])
	assert.ok(fake.log.every((entry) => entry.path === "/watchlist/items" && !entry.params.mediatype))

	const byTitle = (title) => file.items.filter((item) => item.title === title)
	assert.equal(byTitle("Toy Story").length, 1)
	assert.deepEqual(byTitle("Dune").map((item) => item.tmdbId), [841, 438631])
	const [dark, darkSeason] = byTitle("Dark")
	assert.deepEqual(dark, { title: "Dark", mediaType: "show", year: 2017, imdbId: "tt5753856", sourceId: "mdblist-shows-70523" })
	assert.equal(dark.tmdbId, undefined, "the generic id is never a TMDB ID")
	// v1.1: a season row names its parent show. IDs come only from the nested show object.
	assert.deepEqual(darkSeason, { title: "Dark", mediaType: "season", year: 2017, tmdbId: 70523, imdbId: "tt5753856", sourceId: "mdblist-seasons-70523", season: 2 })
	// An episode row's own IDs never become parent-show IDs.
	const episode = file.items.find((item) => item.mediaType === "episode")
	assert.deepEqual(episode, { title: "Secrets", mediaType: "episode", sourceId: "mdblist-episodes-70523", season: 1, episode: 1 })
	const shared = file.items.filter((item) => item.tmdbId === 1399).map((item) => item.mediaType)
	assert.deepEqual(shared.sort(), ["movie", "show"])
	assert.equal(report.identity.showsWithoutIdsObject, 1)
	assert.equal(report.identity.showsWithIdsObject, 1)
	assert.equal(report.identity.missingCatalogId, 1)
})

test("v1.1: the file declares version 1.1 and never claims source Seen", async () => {
	const { file } = await read(fakeMdblist(rows))
	assert.equal(file.version, 1.1)
	assert.ok(file.items.every((item) => !("sourceSeen" in item) && !("sourceSeenAt" in item)))
})

test("v1.1: a season or episode row without coordinates stays visible as invalid", async () => {
	const { file } = await read(one({ movies: [], shows: [], seasons: [{ id: 5, title: "X", mediatype: "season" }], episodes: [{ id: 6, title: "Y", season: 1, mediatype: "episode" }], has_more: false }))
	assert.deepEqual(file.items.map((item) => [item.mediaType, item.season ?? null, item.episode ?? null]), [["season", null, null], ["episode", 1, null]])
	const parsed = parse(file)
	assert.deepEqual(parsed.observations.map((observation) => observation.problem?.outcome), ["invalid", "invalid"])
})

test("v1.1: parent show fields named for the show are used; flat season ids are not", async () => {
	const season = { id: 7, title: "Season title", season: 3, season_number: 3, mediatype: "season", ids: { tmdb: 555, imdb: "tt0000555" }, show_tmdb_id: 1399, show_imdb_id: "tt0944947" }
	const { file } = await read(one({ movies: [], shows: [], seasons: [season], has_more: false }))
	assert.equal(file.items[0].tmdbId, 1399)
	assert.equal(file.items[0].imdbId, "tt0944947")
	assert.equal(file.items[0].year, undefined, "a season's own year isn't the show's")
})

test("G7: the shipped parser accepts the file and keeps unsupported rows visible", async () => {
	const { file } = await read(fakeMdblist(rows))
	const parsed = parseWishlistFile(new TextEncoder().encode(JSON.stringify(file)), (message) => {
		throw new Error(message)
	})
	assert.equal(parsed.warnings.length, 0, "complete files carry no partial warning")
	const outcome = (index) => parsed.observations[index].problem?.outcome ?? "candidate"
	const summary = file.items.map((item, index) => `${item.mediaType}:${outcome(index)}`)
	assert.deepEqual(summary, [
		"movie:candidate",
		"show:candidate",
		"movie:candidate",
		"movie:candidate",
		"movie:candidate",
		"season:candidate", // parent show IDs proven

		"movie:candidate", // no ID, but title and year: the shared title-and-year rule decides
		"show:candidate",
		"movie:candidate",
		"episode:unmatched", // no parent show ID or year

	])
	assert.equal(parsed.observations[6].tmdbId, null)
	assert.equal(parsed.observations[5].mediaType, "show", "a season wish's effective identity is the show")
	assert.equal(parsed.observations[5].tmdbId, 70523)
})

test("G8: no added date is written, and exportedAt is the capture time", async () => {
	const { file, report } = await read(fakeMdblist(rows))
	assert.ok(file.items.every((item) => !("addedAt" in item)))
	assert.equal(file.exportedAt, "2026-10-19T10:00:00Z")
	assert.deepEqual(report.addedLikeKeys, [])
})

test("cursor inside pagination is followed the same way", async () => {
	const { file, report } = await read(fakeMdblist(rows, { cursorAt: "pagination", hasMoreHeader: false, hasMoreField: true }))
	assert.equal(file.completeness, "complete")
	assert.equal(report.rows.received, rows.length)
	assert.ok(report.cursorLocations["pagination.next_cursor"] >= 5)
})

test("G2: no explicit end signal means unknown, never complete", async () => {
	const { file } = await read(fakeMdblist(rows, { hasMoreHeader: false }))
	assert.equal(file.completeness, "unknown")
	const parsed = parse(file)
	assert.equal(parsed.warnings.length, 1)
})

test("G3: a reported total that disagrees makes the file partial", async () => {
	assert.equal((await read(fakeMdblist(rows, { total: "right" }))).file.completeness, "complete")
	const { file, report } = await read(fakeMdblist(rows, { total: "wrong" }))
	assert.equal(file.completeness, "partial")
	assert.match(report.warnings.join(" "), /reported 12 items but sent 11/)
})

test("G3: the cross-check agrees on the fixture and catches a lost row", async () => {
	const ok = await read(fakeMdblist(rows), { crossCheck: true })
	assert.equal(ok.file.completeness, "complete")
	assert.equal(ok.report.crossCheck.missingFromCombined + ok.report.crossCheck.missingFromFilters, 0)
	assert.equal(ok.report.requests, 6 + 4 + 1 + 1 + 1) // combined + movie(7 rows) + show(2) + season(1) + episode(1)
	const lost = await read(fakeMdblist(rows, { skipInFilteredRead: "show" }), { crossCheck: true })
	assert.equal(lost.file.completeness, "partial")
	assert.equal(lost.report.crossCheck.missingFromFilters, 1)
})

test("G4: failures never become an export", async (t) => {
	const cases = [
		["401 on the first page", { faults: { 1: { status: 401, error: "Invalid API key!" } } }, "unauthorized"],
		["403 mid-way", { faults: { 3: { status: 403 } } }, "forbidden"],
		["daily limit", { faults: { 2: { status: 429, error: "Daily API limit exceeded!", retryAfter: 3600 } } }, "daily-limit"],
		["429 twice", { faults: { 2: { status: 429, error: "API rate limit exceeded!", retryAfter: 1 }, 3: { status: 429, error: "API rate limit exceeded!", retryAfter: 1 } } }, "rate-limited"],
		["429 with a long wait", { faults: { 2: { status: 429, error: "API rate limit exceeded!", retryAfter: 600 } } }, "rate-limited"],
		["500 three times", { faults: { 2: { status: 500 }, 3: { status: 502 }, 4: { status: 503 } } }, "server-error"],
		["network down", { faults: { 1: "network", 2: "network", 3: "network" } }, "network"],
		["HTML body", { faults: { 2: "html" } }, "not-json"],
		["unknown envelope", { faults: { 1: "envelope" } }, "unknown-envelope"],
		["has more, no cursor", { dropCursorOnPage: 2 }, "missing-cursor"],
		["repeated cursor", { repeatCursor: true }, "cursor-loop"],
		["wrong key", { key: "other" }, "unauthorized"],
	]
	for (const [name, options, code] of cases) {
		await t.test(name, () => failsWith(read(fakeMdblist(rows, options)), code))
	}
	await t.test("page cap", () => failsWith(read(fakeMdblist(rows), { maxPages: 3 }), "page-cap"))
	await t.test("no key", () => failsWith(readWatchlist({ apiKey: "" }), "no-key"))
})

test("one short 429 and one 5xx are retried and counted", async () => {
	const fake = fakeMdblist(rows, { faults: { 2: { status: 429, error: "API rate limit exceeded!", retryAfter: 2 }, 5: { status: 500 } } })
	const waits = []
	const { file, report } = await read(fake, { sleep: async (ms) => waits.push(ms) })
	assert.equal(file.completeness, "complete")
	assert.equal(report.retries, 2)
	assert.equal(report.requests, 8)
	assert.deepEqual(waits, [2000, 1000])
})

test("the report never carries the key, titles, IDs or cursor values", async () => {
	const { report } = await read(fakeMdblist(rows, { cursorAt: "pagination" }))
	const text = JSON.stringify(report)
	for (const secret of ["test-key", "Toy Story", "tt0114709", "m862", "Yzo"]) assert.ok(!text.includes(secret), secret)
	await read(fakeMdblist(rows, { faults: { 1: { status: 401 } } })).catch((error) => {
		assert.ok(!JSON.stringify(error.report).includes("test-key"))
		assert.ok(!error.message.includes("test-key"))
	})
})

test("CLI: a failed run leaves the previous file untouched and refuses Git paths", () => {
	const dir = mkdtempSync(join(process.env.READER_TEST_TMP ?? tmpdir(), "mdblist-711-"))
	const out = join(dir, "watchlist.json")
	writeFileSync(out, "previous")
	const keyFile = join(dir, "key")
	writeFileSync(keyFile, "bad-key", { mode: 0o600 })
	const run = (args, env = {}) => {
		try {
			execFileSync(process.execPath, [join(here, "reader.mjs"), ...args], { env: { ...process.env, MDBLIST_API_KEY: "", ...env }, stdio: "pipe" })
			return 0
		} catch (error) {
			return error.status
		}
	}
	// Point the CLI at a closed local port so the request fails without reaching MDBList.
	const status = run(["--key-file", keyFile, "--out", out, "--report", join(dir, "report.json")], { MDBLIST_TEST_BASE: "http://127.0.0.1:9" })
	assert.equal(status, 2)
	assert.equal(readFileSync(out, "utf8"), "previous")
	assert.ok(existsSync(join(dir, "report.json")))
	assert.equal(run(["--out", join(here, "nope.json")]), 2)
	assert.ok(!existsSync(join(here, "nope.json")))
})

// ---------- review fixes (Astra on 960d739c) ----------

const movie = rows[0].row
const one = (json) => fakeMdblist(rows, { faults: { 1: { json } } })

test("review 1: a malformed known bucket fails instead of giving a complete empty file", async () => {
	await failsWith(read(one({ movies: [], shows: { items: [movie] }, has_more: false })), "malformed-bucket")
	await failsWith(read(one({ movies: null, shows: [], has_more: false })), "malformed-bucket")
})

test("review 1: unexplained structure gives unknown coverage, never complete", async () => {
	const extraKey = await read(one({ movies: [movie], shows: [], list_meta: { items: 3 }, has_more: false }))
	assert.equal(extraKey.file.completeness, "unknown")
	const badRow = await read(one({ movies: [movie, null], shows: [], has_more: false }))
	assert.equal(badRow.file.completeness, "unknown")
	assert.equal(badRow.report.rows.malformed, 1)
	const badPagination = await read(one({ movies: [movie], shows: [], pagination: "x", has_more: false }))
	assert.equal(badPagination.file.completeness, "unknown")
})

test("review 2: any reported total must reconcile before complete", async () => {
	const totalCount = await read(one({ movies: [movie], shows: [], pagination: { total_count: 9 }, has_more: false }))
	assert.equal(totalCount.file.completeness, "partial")
	const stringTotal = await read(one({ movies: [movie], shows: [], pagination: { total: "9" }, has_more: false }))
	assert.equal(stringTotal.file.completeness, "partial")
	const unreadable = await read(one({ movies: [movie], shows: [], pagination: { total: "many" }, has_more: false }))
	assert.equal(unreadable.file.completeness, "unknown")
	const matching = await read(one({ movies: [movie], shows: [], pagination: { total_count: 1 }, has_more: false }))
	assert.equal(matching.file.completeness, "complete")
	// A disagreeing total on an earlier page still blocks complete, even when the last page agrees.
	const earlier = await read(fakeMdblist(rows, { extraPagination: (page, count) => ({ total: page === 0 ? count + 5 : count }) }))
	assert.equal(earlier.file.completeness, "partial")
	const steady = await read(fakeMdblist(rows, { extraPagination: (page, count) => ({ total: count }) }))
	assert.equal(steady.file.completeness, "complete")
})

test("review 3: a conflicting row never hides a valid row as a repeat", async () => {
	const conflicting = { ...movie, mediatype: "show" }
	const { file, report } = await read(one({ movies: [conflicting, movie], shows: [], has_more: false }))
	assert.equal(report.rows.repeats, 0)
	assert.equal(file.items.length, 2)
	assert.ok(file.items.some((item) => item.mediaType === "movie" && item.tmdbId === 862))
	assert.equal(report.rows.identityConflicts, 1)
	const changedTitle = await read(one({ movies: [movie, { ...movie, title: "Toy Story (Different)" }], shows: [], has_more: false }))
	assert.equal(changedTitle.report.rows.repeats, 0)
	assert.equal(changedTitle.report.rows.identityConflicts, 1)
})

test("review 3: rows without any native ID are never collapsed", async () => {
	const bare = { title: "Same Name", release_year: 2000, mediatype: "movie" }
	const { file, report } = await read(one({ movies: [bare, { ...bare }], shows: [], has_more: false }))
	assert.equal(report.rows.repeats, 0)
	assert.equal(file.items.length, 2)
})

// ---------- CLI ----------

import { createServer } from "node:http"
import { symlinkSync, mkdirSync, chmodSync } from "node:fs"

async function serve(fake) {
	const server = createServer(async (request, response) => {
		const answer = await fake.fetchImpl(new URL(request.url, "http://127.0.0.1"))
		response.writeHead(answer.status, Object.fromEntries(answer.headers))
		response.end(await answer.text())
	})
	await new Promise((done) => server.listen(0, "127.0.0.1", done))
	return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}
function cli(args, env = {}) {
	return new Promise((done) => {
		const child = execFile(process.execPath, [join(here, "reader.mjs"), ...args], { env: { ...process.env, MDBLIST_API_KEY: "test-key", ...env } }, (error, stdout, stderr) =>
			done({ status: error ? error.code : 0, stdout, stderr }),
		)
		child.stdin?.end()
	})
}
import { execFile } from "node:child_process"
const scratch = () => mkdtempSync(join(process.env.READER_TEST_TMP ?? tmpdir(), "mdblist-711-"))

test("review 4: a symlink into a Git work tree is refused", async () => {
	const dir = scratch()
	symlinkSync(here, join(dir, "link"))
	const result = await cli(["--out", join(dir, "link", "w.json"), "--report", join(dir, "r.json")])
	assert.equal(result.status, 2)
	assert.match(result.stderr, /Git work tree/)
	assert.ok(!existsSync(join(here, "w.json")))
	const reportLink = await cli(["--out", join(dir, "w.json"), "--report", join(dir, "link", "r.json")])
	assert.equal(reportLink.status, 2)
	assert.ok(!existsSync(join(here, "r.json")))
})

test("review 5: wishlist, report and key paths must differ", async () => {
	const dir = scratch()
	const out = join(dir, "w.json")
	writeFileSync(out, "previous")
	const same = await cli(["--out", out, "--report", out])
	assert.equal(same.status, 2)
	assert.equal(readFileSync(out, "utf8"), "previous")
	const key = join(dir, "key")
	writeFileSync(key, "test-key", { mode: 0o600 })
	const keyReport = await cli(["--key-file", key, "--out", out, "--report", key], { MDBLIST_API_KEY: "" })
	assert.equal(keyReport.status, 2)
	assert.equal(readFileSync(key, "utf8"), "test-key")
	symlinkSync(out, join(dir, "alias.json"))
	const alias = await cli(["--out", out, "--report", join(dir, "alias.json")])
	assert.equal(alias.status, 2)
	assert.equal(readFileSync(out, "utf8"), "previous")
})

test("review 5: if the report can't be written, the wishlist stays as it was", async () => {
	const server = await serve(fakeMdblist(rows))
	try {
		const dir = scratch()
		const out = join(dir, "w.json")
		writeFileSync(out, "previous")
		const locked = join(dir, "locked")
		mkdirSync(locked)
		chmodSync(locked, 0o500)
		const result = await cli(["--out", out, "--report", join(locked, "r.json"), "--limit", "2"], { MDBLIST_TEST_BASE: server.base })
		assert.equal(result.status, 2)
		assert.equal(readFileSync(out, "utf8"), "previous")
		// The same run with a writable report replaces both.
		const ok = await cli(["--out", out, "--report", join(dir, "r.json"), "--limit", "2"], { MDBLIST_TEST_BASE: server.base })
		assert.equal(ok.status, 0, ok.stderr)
		assert.equal(JSON.parse(readFileSync(out, "utf8")).items.length, 10)
		assert.ok(existsSync(join(dir, "r.json")))
		assert.deepEqual(readdirSync(dir).filter((name) => name.includes(".tmp-")), [])
	} finally {
		server.close()
	}
})
import { readdirSync } from "node:fs"

// ---------- real-run fixes (October 23, 2026) ----------

test("fix 1: watchlist_at becomes addedAt only when it is a valid timestamp", async () => {
	const at = (row, value) => ({ ...row, ids: { ...row.ids, mdblist: `${row.ids.mdblist}-${String(value)}` }, watchlist_at: value })
	const body = {
		movies: [at(rows[0].row, "2026-10-20T08:15:30.123Z"), at(rows[2].row, null), at(rows[3].row, "yesterday"), at(rows[4].row, "2026-02-30T10:00:00Z")],
		shows: [{ ...rows[7].row, watchlist_at: "2026-10-21T09:00:00Z" }],
		has_more: false,
	}
	const { file, report } = await read(one(body))
	assert.deepEqual(file.items.map((item) => item.addedAt ?? null), ["2026-10-20T08:15:30.123Z", null, null, null, "2026-10-21T09:00:00Z"])
	assert.equal(report.identity.addedAtFromWatchlistAt, 2)
	assert.equal(report.identity.watchlistAtUnreadable, 2)
	const parsed = parse(file)
	assert.equal(parsed.observations[0].addedAt, "2026-10-20T08:15:30.123Z")
	assert.equal(parsed.observations[4].addedAt, "2026-10-21T09:00:00Z")
	assert.ok(parsed.observations.every((observation) => !observation.problem))
})

test("fix 2: X-Total-Items and X-Matched-Items must agree before complete", async () => {
	assert.equal((await read(fakeMdblist(rows, { countHeaders: true }), { crossCheck: true })).file.completeness, "complete")
	const total = await read(fakeMdblist(rows, { countHeaders: (filter, count) => ({ total: count + 1 }) }))
	assert.equal(total.file.completeness, "partial")
	const matched = await read(fakeMdblist(rows, { countHeaders: (filter, count, pageRows) => ({ matched: pageRows + 1 }) }))
	assert.equal(matched.file.completeness, "partial")
	const unreadable = await read(fakeMdblist(rows, { countHeaders: () => ({ total: "lots" }) }))
	assert.equal(unreadable.file.completeness, "unknown")
	// A filtered read checks its own total.
	const filtered = await read(fakeMdblist(rows, { countHeaders: (filter, count) => ({ total: filter === "show" ? count + 3 : count }) }), { crossCheck: true })
	assert.equal(filtered.file.completeness, "partial")
	assert.match(filtered.report.warnings.join(" "), /show cross-check/)
})

test("fix 3: requests carry a User-Agent, and a 403 isn't reported as a bad key", async () => {
	const fake = fakeMdblist(rows)
	await read(fake)
	assert.ok(fake.log.every((entry) => /^goodwatch-mdblist-reader\//.test(entry.headers["user-agent"] ?? "")))
	await assert.rejects(read(fakeMdblist(rows, { faults: { 1: { status: 403 } } })), (error) => {
		assert.equal(error.code, "forbidden")
		assert.doesNotMatch(error.message, /API key/)
		return true
	})
	await assert.rejects(read(fakeMdblist(rows, { faults: { 1: { status: 401 } } })), (error) => {
		assert.match(error.message, /API key/)
		return true
	})
})

test("fix 4: field names ending in _at are reported as date-like", async () => {
	const row = { ...movie, added_at: null, watchlist_at: "2026-10-20T08:15:30.123Z", last_watched_at: null, release_date: "1995-11-22" }
	const { report } = await read(one({ movies: [row], shows: [], has_more: false }))
	assert.deepEqual([...report.addedLikeKeys].sort(), ["added_at", "last_watched_at", "release_date", "watchlist_at"])
})

test("an empty .git folder isn't a Git work tree, a real marker is", async () => {
	const dir = scratch()
	mkdirSync(join(dir, "empty", ".git"), { recursive: true })
	const ok = await cli(["--out", join(dir, "empty", "w.json"), "--report", join(dir, "empty", "r.json")], { MDBLIST_TEST_BASE: "http://127.0.0.1:9" })
	assert.doesNotMatch(ok.stderr, /Git work tree/)
	mkdirSync(join(dir, "worktree"))
	writeFileSync(join(dir, "worktree", ".git"), "gitdir: /somewhere/.git/worktrees/x\n")
	const refused = await cli(["--out", join(dir, "worktree", "w.json"), "--report", join(dir, "worktree", "r.json")])
	assert.match(refused.stderr, /Git work tree/)
})

// ---------- review of a84c8971 ----------

test("P1: a missing count header means unknown coverage, never complete", async () => {
	const none = await read(fakeMdblist(rows, { countHeaders: false }))
	assert.equal(none.file.completeness, "unknown")
	assert.match(none.report.warnings.join(" "), /X-Total-Items/)
	const noMatched = await read(fakeMdblist(rows, { countHeaders: () => ({ matched: null }) }))
	assert.equal(noMatched.file.completeness, "unknown")
	const noTotal = await read(fakeMdblist(rows, { countHeaders: () => ({ total: null }) }))
	assert.equal(noTotal.file.completeness, "unknown")
	// One page without the header is enough.
	const onePage = await read(fakeMdblist(rows, { countHeaders: (filter, count, pageRows) => (pageRows === 1 ? { matched: null } : {}) }))
	assert.equal(onePage.file.completeness, "unknown")
	const singleBody = await read(fakeMdblist(rows, { faults: { 1: { json: { movies: [movie], shows: [], has_more: false }, countHeaders: false } } }))
	assert.equal(singleBody.file.completeness, "unknown")
})

test("P1: a filtered cross-check read without count headers means unknown", async () => {
	const filtered = await read(fakeMdblist(rows, { countHeaders: (filter) => (filter === "season" ? { total: null, matched: null } : {}) }), { crossCheck: true })
	assert.equal(filtered.file.completeness, "unknown")
	assert.match(filtered.report.warnings.join(" "), /season cross-check/)
	const matchedOnly = await read(fakeMdblist(rows, { countHeaders: (filter) => (filter === "movie" ? { matched: null } : {}) }), { crossCheck: true })
	assert.equal(matchedOnly.file.completeness, "unknown")
})

test("P2: the same row with and without a valid watchlist_at is two rows, not a repeat", async () => {
	const undated = { ...movie, watchlist_at: null }
	const dated = { ...movie, watchlist_at: "2026-10-20T08:15:30.123Z" }
	const { file, report } = await read(one({ movies: [undated, dated], shows: [], has_more: false }))
	assert.equal(report.rows.repeats, 0)
	assert.equal(report.rows.identityConflicts, 1)
	assert.deepEqual(file.items.map((item) => item.addedAt ?? null), [null, "2026-10-20T08:15:30.123Z"])
	const twice = await read(one({ movies: [dated, { ...dated }], shows: [], has_more: false }))
	assert.equal(twice.report.rows.repeats, 1, "identical dated rows are still one repeat")
})

test("P3: response field names that contain the key are redacted in the report", async () => {
	const key = "test-key"
	const body = {
		movies: [{ ...movie, [key]: 1, [`x_${key}_y`]: { [key]: true } }],
		shows: [],
		[`${key}`]: "top",
		[`list_${key}`]: [{ title: "z" }],
		pagination: { [`total_${key}`]: 1, has_more: false },
		has_more: false,
	}
	const { report } = await read(one(body))
	assert.ok(!JSON.stringify(report).includes(key))
	assert.ok(JSON.stringify(report).includes("[redacted]"))
	await read(fakeMdblist(rows, { faults: { 1: { json: { movies: [{ ...movie, [key]: 1 }], shows: {} } } } })).catch((error) => {
		assert.equal(error.code, "malformed-bucket")
		assert.ok(!JSON.stringify(error.report).includes(key))
	})
})

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
	const [dark, darkSeason, darkEpisode] = byTitle("Dark")
	assert.deepEqual(dark, { title: "Dark", mediaType: "show", year: 2017, imdbId: "tt5753856", sourceId: "mdblist-shows-70523" })
	assert.equal(dark.tmdbId, undefined, "the generic id is never a TMDB ID")
	assert.equal(darkSeason.mediaType, "season")
	assert.equal(darkEpisode.mediaType, "episode")
	const shared = file.items.filter((item) => item.tmdbId === 1399).map((item) => item.mediaType)
	assert.deepEqual(shared.sort(), ["movie", "show"])
	assert.equal(report.identity.showsWithoutIdsObject, 1)
	assert.equal(report.identity.showsWithIdsObject, 1)
	assert.equal(report.identity.missingCatalogId, 1)
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
		"season:invalid",
		"movie:candidate", // no ID, but title and year: the shared title-and-year rule decides
		"show:candidate",
		"movie:candidate",
		"episode:invalid",
	])
	assert.equal(parsed.observations[6].tmdbId, null)
	assert.ok(parsed.observations.every((observation, index) => !["season", "episode"].includes(file.items[index].mediaType) || !observation.wishlistOriginal))
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
		["403 mid-way", { faults: { 3: { status: 403 } } }, "unauthorized"],
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

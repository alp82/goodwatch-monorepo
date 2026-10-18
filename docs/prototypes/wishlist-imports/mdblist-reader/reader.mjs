#!/usr/bin/env node
// Prototype for #711: a local, read-only reader of a member's MDBList personal Watchlist.
// It writes the shared wishlist file (v1) and a sanitized shape report. It reads one route,
// GET /watchlist/items, and never calls a write route.

import { existsSync, readFileSync, renameSync, statSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { homedir } from "node:os"

export const API_BASE = "https://api.mdblist.com"
const ROUTE = "/watchlist/items"
const KNOWN_BUCKETS = { movies: "movie", shows: "show", seasons: "season", episodes: "episode" }
const MEDIA_FILTERS = ["movie", "show", "season", "episode"]
const MAX_ITEMS = 50_000

export class ReaderError extends Error {
	constructor(code, message, report) {
		super(message)
		this.code = code
		this.report = report
	}
}

const positiveInt = (value) => {
	const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
	return typeof number === "number" && Number.isSafeInteger(number) && number > 0 ? number : null
}
const imdb = (value) => (typeof value === "string" && /^tt\d{7,10}$/.test(value) ? value : null)
const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
const typeName = (value) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value)

function parseHasMore(value) {
	if (value === undefined || value === null) return undefined
	if (value === true || value === 1) return true
	if (value === false || value === 0) return false
	const text = String(value).trim().toLowerCase()
	if (["true", "1", "yes"].includes(text)) return true
	if (["false", "0", "no"].includes(text)) return false
	return undefined
}

/** Finds the next cursor without guessing one location. Two different values fail. */
function findCursor(body) {
	const places = []
	if (body.next_cursor !== undefined) places.push(["next_cursor", body.next_cursor])
	if (isObject(body.pagination)) {
		for (const key of ["next_cursor", "nextCursor", "cursor"]) {
			if (body.pagination[key] !== undefined) places.push([`pagination.${key}`, body.pagination[key]])
		}
	}
	const present = places.filter(([, value]) => value !== null && value !== "")
	const values = new Set(present.map(([, value]) => String(value)))
	if (values.size > 1) return { conflict: true, locations: present.map(([where]) => where) }
	return {
		cursor: present.length ? String(present[0][1]) : null,
		locations: places.map(([where, value]) => `${where}${value === null || value === "" ? "(empty)" : ""}`),
	}
}

function findHasMore(body, headers) {
	const signals = []
	const header = parseHasMore(headers.get("x-has-more"))
	if (header !== undefined) signals.push(["header:X-Has-More", header])
	for (const [where, value] of [
		["has_more", body.has_more],
		["pagination.has_more", isObject(body.pagination) ? body.pagination.has_more : undefined],
		["pagination.hasMore", isObject(body.pagination) ? body.pagination.hasMore : undefined],
	]) {
		const parsed = parseHasMore(value)
		if (parsed !== undefined) signals.push([where, parsed])
	}
	const values = new Set(signals.map(([, value]) => value))
	return {
		hasMore: values.size === 1 ? [...values][0] : undefined,
		conflict: values.size > 1,
		locations: signals.map(([where]) => where),
	}
}

function reportedTotal(body) {
	if (!isObject(body.pagination)) return {}
	const totals = {}
	for (const [key, value] of Object.entries(body.pagination)) {
		if (/total|count/i.test(key) && typeof value === "number") totals[key] = value
	}
	return totals
}

/** A stable identity for one source row, used only to spot exact repeats. */
function rowIdentity(bucket, row) {
	const ids = isObject(row.ids) ? row.ids : {}
	return JSON.stringify([
		bucket,
		ids.mdblist ?? null,
		row.id ?? null,
		ids.tmdb ?? null,
		ids.imdb ?? row.imdb_id ?? null,
		row.season ?? row.season_number ?? null,
		row.episode ?? row.episode_number ?? null,
		row.id === undefined && ids.mdblist === undefined && ids.tmdb === undefined
			? [row.title ?? null, row.release_year ?? null]
			: null,
	])
}

/** Maps one MDBList row to a shared-format item. It only copies IDs from fields that name them. */
export function mapRow(bucket, row, counters) {
	const scope = KNOWN_BUCKETS[bucket] ?? null
	const ids = isObject(row.ids) ? row.ids : null
	const item = {}
	if (typeof row.title === "string") item.title = row.title

	let mediaType = scope ?? `unsupported:${bucket}`
	if (typeof row.mediatype === "string" && scope && row.mediatype !== scope) {
		mediaType = `conflict:${scope}/${row.mediatype}`
		counters.mediaTypeConflicts++
	}
	item.mediaType = mediaType

	const year = positiveInt(row.release_year)
	if (year && year >= 1800 && year <= 9999) item.year = year

	if (mediaType === "movie" || mediaType === "show") {
		const tmdbId = ids ? positiveInt(ids.tmdb) : null
		if (tmdbId) item.tmdbId = tmdbId
		const fromIds = ids ? imdb(ids.imdb) : null
		const flat = imdb(row.imdb_id)
		if (fromIds && flat && fromIds !== flat) counters.imdbConflicts++
		else if (fromIds || flat) item.imdbId = fromIds ?? flat
		if (!item.tmdbId && !item.imdbId) counters.missingCatalogId++
	}

	// Native IDs stay source-scoped. The generic `id` is never treated as a TMDB ID.
	if (ids && typeof ids.mdblist === "string" && ids.mdblist) item.sourceId = ids.mdblist
	else if (row.id !== undefined && row.id !== null) item.sourceId = `mdblist-${bucket}-${row.id}`
	return item
}

function describeShape(target, row) {
	for (const [key, value] of Object.entries(row)) {
		const entry = (target[key] ??= { types: {}, count: 0 })
		entry.count++
		entry.types[typeName(value)] = (entry.types[typeName(value)] ?? 0) + 1
		if (isObject(value)) {
			entry.keys ??= {}
			describeShape(entry.keys, value)
		}
	}
}

/**
 * Reads the whole Watchlist with cursor pagination. It throws ReaderError on any failure, so a
 * failed or partial read never comes back as a finished export.
 */
export async function readWatchlist({
	apiKey,
	fetchImpl = globalThis.fetch,
	sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
	now = () => new Date(),
	limit = 100,
	crossCheck = false,
	maxPages = 1000,
	maxRetryAfterSeconds = 60,
	base = API_BASE,
}) {
	if (typeof apiKey !== "string" || !apiKey.trim()) throw new ReaderError("no-key", "No MDBList API key was found.", null)
	const started = Date.now()
	const report = {
		route: ROUTE,
		limit,
		requests: 0,
		retries: 0,
		pages: [],
		cursorLocations: {},
		hasMoreLocations: {},
		otherTopLevelKeys: {},
		rateLimit: null,
		shape: {},
		rows: { received: 0, repeats: 0, wishes: 0, unsupported: 0, byBucket: {} },
		identity: {
			missingCatalogId: 0,
			imdbConflicts: 0,
			mediaTypeConflicts: 0,
			showsWithIdsObject: 0,
			showsWithoutIdsObject: 0,
			rowsWithIdAndIdsTmdb: 0,
			rowsWhereIdEqualsIdsTmdb: 0,
		},
		addedLikeKeys: [],
		exhaustion: null,
		crossCheck: crossCheck ? { ran: false } : "off",
		warnings: [],
		elapsedMs: 0,
	}
	const fail = (code, message) => {
		report.elapsedMs = Date.now() - started
		report.failure = code
		throw new ReaderError(code, message.replaceAll(apiKey, "[key]"), report)
	}

	async function request(params) {
		const url = new URL(ROUTE, base)
		for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value))
		url.searchParams.set("apikey", apiKey)
		let rateRetries = 0
		let serverRetries = 0
		for (;;) {
			report.requests++
			let response
			try {
				response = await fetchImpl(url, { method: "GET", headers: { accept: "application/json" } })
			} catch {
				if (serverRetries < 2) {
					serverRetries++
					report.retries++
					await sleep(1000 * 3 ** (serverRetries - 1))
					continue
				}
				fail("network", "MDBList didn't answer. Nothing was written.")
			}
			const remaining = response.headers.get("x-ratelimit-remaining")
			if (remaining !== null) {
				report.rateLimit = {
					limit: Number(response.headers.get("x-ratelimit-limit")),
					remaining: Number(remaining),
					resetsAt: Number(response.headers.get("x-ratelimit-reset")) || null,
				}
			}
			if (response.status === 401 || response.status === 403)
				fail("unauthorized", `MDBList refused the API key (HTTP ${response.status}). Nothing was written.`)
			if (response.status === 429) {
				const text = await response.text().catch(() => "")
				if (/daily/i.test(text)) fail("daily-limit", "The MDBList daily request limit is used up. Try again after 00:00 UTC. Nothing was written.")
				const wait = Number(response.headers.get("retry-after"))
				if (rateRetries < 1 && Number.isFinite(wait) && wait >= 0 && wait <= maxRetryAfterSeconds) {
					rateRetries++
					report.retries++
					await sleep(wait * 1000)
					continue
				}
				fail("rate-limited", "MDBList asked the reader to slow down for too long. Nothing was written.")
			}
			if (response.status >= 500) {
				if (serverRetries < 2) {
					serverRetries++
					report.retries++
					await sleep(1000 * 3 ** (serverRetries - 1))
					continue
				}
				fail("server-error", `MDBList kept failing (HTTP ${response.status}). Nothing was written.`)
			}
			if (response.status !== 200) fail(`http-${response.status}`, `MDBList answered HTTP ${response.status}. Nothing was written.`)
			let body
			try {
				body = JSON.parse(await response.text())
			} catch {
				fail("not-json", "MDBList sent something that isn't JSON. Nothing was written.")
			}
			if (!isObject(body) || !Object.entries(KNOWN_BUCKETS).some(([bucket]) => Array.isArray(body[bucket])))
				fail("unknown-envelope", "MDBList's answer has no movies or shows list. Nothing was written.")
			return { body, headers: response.headers }
		}
	}

	/** Follows cursors until the end is proven, or fails. */
	async function readAll(filter) {
		const rows = []
		const seenCursors = new Set()
		let cursor
		const totals = []
		for (let page = 0; ; page++) {
			if (page >= maxPages) fail("page-cap", `The reader stopped after ${maxPages} pages. Nothing was written.`)
			const { body, headers } = await request({ limit, cursor, mediatype: filter })
			const pageSummary = { filter: filter ?? "all", buckets: {} }
			for (const [key, value] of Object.entries(body)) {
				if (Array.isArray(value)) {
					pageSummary.buckets[key] = value.length
					for (const row of value) rows.push([key, isObject(row) ? row : {}])
				} else if (!["pagination", "next_cursor", "has_more"].includes(key)) {
					report.otherTopLevelKeys[key] = typeName(value)
				}
			}
			if (rows.length > MAX_ITEMS) fail("too-many", "The Watchlist has more than 50,000 rows. Nothing was written.")
			const found = findCursor(body)
			if (found.conflict) fail("cursor-conflict", "MDBList sent two different next cursors. Nothing was written.")
			for (const where of found.locations) report.cursorLocations[where] = (report.cursorLocations[where] ?? 0) + 1
			const more = findHasMore(body, headers)
			if (more.conflict) fail("has-more-conflict", "MDBList said both that more items exist and that none do. Nothing was written.")
			for (const where of more.locations) report.hasMoreLocations[where] = (report.hasMoreLocations[where] ?? 0) + 1
			const total = reportedTotal(body)
			if (Object.keys(total).length) totals.push(total)
			pageSummary.cursor = found.cursor ? "present" : "absent"
			pageSummary.hasMore = more.hasMore ?? "not stated"
			if (filter === undefined) report.pages.push(pageSummary)

			if (found.cursor) {
				if (seenCursors.has(found.cursor)) fail("cursor-loop", "MDBList sent the same cursor twice. Nothing was written.")
				seenCursors.add(found.cursor)
				if (more.hasMore === false) report.warnings.push("A page said no more items but still sent a cursor; the reader followed it.")
				cursor = found.cursor
				continue
			}
			if (more.hasMore === true) fail("missing-cursor", "MDBList said more items exist but sent no cursor. Nothing was written.")
			return { rows, proven: more.hasMore === false, totals }
		}
	}

	const combined = await readAll(undefined)
	report.exhaustion = combined.proven ? "proven" : "not proven"

	const counters = report.identity
	const items = []
	const seen = new Set()
	const identities = new Map()
	for (const [bucket, row] of combined.rows) {
		report.rows.received++
		report.rows.byBucket[bucket] = (report.rows.byBucket[bucket] ?? 0) + 1
		report.shape[bucket] ??= {}
		describeShape(report.shape[bucket], row)
		if (bucket === "shows") isObject(row.ids) ? counters.showsWithIdsObject++ : counters.showsWithoutIdsObject++
		if (isObject(row.ids) && row.id !== undefined && row.ids.tmdb !== undefined) {
			counters.rowsWithIdAndIdsTmdb++
			if (positiveInt(row.id) === positiveInt(row.ids.tmdb)) counters.rowsWhereIdEqualsIdsTmdb++
		}
		const identity = rowIdentity(bucket, row)
		if (seen.has(identity)) {
			report.rows.repeats++
			continue
		}
		seen.add(identity)
		identities.set(identity, bucket)
		const item = mapRow(bucket, row, counters)
		if (item.mediaType === "movie" || item.mediaType === "show") report.rows.wishes++
		else report.rows.unsupported++
		items.push(item)
	}
	report.addedLikeKeys = Object.values(report.shape)
		.flatMap((shape) => Object.keys(shape))
		.filter((key, index, all) => /added|listed|created|date/i.test(key) && all.indexOf(key) === index)

	let completeness = combined.proven ? "complete" : "unknown"
	if (!combined.proven) report.warnings.push("The last page didn't say that no more items exist, so the file says its coverage is unknown.")
	if (Object.keys(report.rows.byBucket).some((bucket) => !KNOWN_BUCKETS[bucket])) {
		completeness = "unknown"
		report.warnings.push("MDBList sent a list the reader doesn't know. Its rows stay visible as unsupported.")
	}

	const lastTotals = combined.totals.at(-1)
	if (lastTotals) {
		report.reportedTotals = lastTotals
		const total = lastTotals.total ?? lastTotals.total_items ?? lastTotals.totalItems
		if (typeof total === "number" && total !== report.rows.received) {
			completeness = "partial"
			report.warnings.push(`MDBList reported ${total} items but sent ${report.rows.received}.`)
		}
	}

	if (crossCheck) {
		const union = new Map()
		let crossRows = 0
		for (const filter of MEDIA_FILTERS) {
			const { rows, proven } = await readAll(filter)
			if (!proven) report.warnings.push(`The ${filter} cross-check didn't prove its last page.`)
			for (const [bucket, row] of rows) {
				crossRows++
				union.set(rowIdentity(bucket, row), bucket)
			}
		}
		const missingFromCombined = [...union.keys()].filter((key) => !identities.has(key)).length
		const missingFromFilters = [...identities.keys()].filter((key) => !union.has(key)).length
		report.crossCheck = { ran: true, rowsReceived: crossRows, uniqueIdentities: union.size, missingFromCombined, missingFromFilters }
		if (missingFromCombined || missingFromFilters) {
			completeness = "partial"
			report.warnings.push("The per-type reads and the combined read disagree.")
		}
	}

	report.completeness = completeness
	report.elapsedMs = Date.now() - started
	const file = {
		format: "goodwatch-wishlist",
		version: 1,
		source: "mdblist",
		profileLabel: "MDBList Watchlist",
		exportedAt: now().toISOString().replace(/\.\d{3}Z$/, "Z"),
		completeness,
		items,
	}
	return { file, report }
}

// ---------- command line ----------

const DEFAULT_DIR = join(homedir(), "goodwatch-private", "711")

function insideGitWorkTree(path) {
	for (let dir = dirname(resolve(path)); ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".git"))) return true
		if (dirname(dir) === dir) return false
	}
}

function writePrivate(path, data) {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
	const temporary = `${path}.tmp-${process.pid}`
	writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
	renameSync(temporary, path)
}

function parseArgs(argv) {
	const options = {
		keyFile: join(DEFAULT_DIR, "mdblist-api-key"),
		out: join(DEFAULT_DIR, "mdblist-watchlist.json"),
		report: join(DEFAULT_DIR, "mdblist-shape-report.json"),
		limit: 100,
		crossCheck: false,
	}
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index]
		const next = () => argv[++index]
		if (arg === "--key-file") options.keyFile = next()
		else if (arg === "--out") options.out = next()
		else if (arg === "--report") options.report = next()
		else if (arg === "--limit") options.limit = Number(next())
		else if (arg === "--cross-check") options.crossCheck = true
		else if (arg === "--help") options.help = true
		else throw new Error(`Unknown option ${arg}`)
	}
	if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000) throw new Error("--limit takes 1 to 1000.")
	return options
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	if (options.help) {
		console.log("node reader.mjs [--key-file PATH] [--out PATH] [--report PATH] [--limit N] [--cross-check]")
		return
	}
	for (const path of [options.out, options.report]) {
		if (insideGitWorkTree(path)) throw new Error(`Refusing to write ${path}: it is inside a Git work tree.`)
	}
	let apiKey = process.env.MDBLIST_API_KEY
	if (!apiKey) {
		if (!existsSync(options.keyFile)) throw new Error(`No key. Save your MDBList API key to ${options.keyFile}.`)
		if (statSync(options.keyFile).mode & 0o077) console.warn(`Warning: ${options.keyFile} is readable by other users. Run chmod 600 on it.`)
		apiKey = readFileSync(options.keyFile, "utf8").trim()
	}
	try {
		const { file, report } = await readWatchlist({
			apiKey,
			limit: options.limit,
			crossCheck: options.crossCheck,
			// Tests only: point the reader at a local stand-in.
			base: process.env.MDBLIST_TEST_BASE || API_BASE,
		})
		writePrivate(options.out, file)
		writePrivate(options.report, report)
		console.log(
			`Wrote ${file.items.length} entries (${report.rows.wishes} movies and shows, ${report.rows.unsupported} unsupported, ${report.rows.repeats} repeats skipped). Coverage: ${file.completeness}. Requests: ${report.requests}, retries: ${report.retries}, ${report.elapsedMs} ms.`,
		)
		console.log(`Wishlist file: ${options.out}\nShape report: ${options.report}`)
		for (const warning of report.warnings) console.log(`Note: ${warning}`)
	} catch (error) {
		if (error instanceof ReaderError) {
			if (error.report) writePrivate(options.report, error.report)
			console.error(`${error.message}\nShape report: ${options.report}`)
			process.exitCode = 2
			return
		}
		throw error
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error(String(error?.message ?? error))
		process.exitCode = 2
	})
}

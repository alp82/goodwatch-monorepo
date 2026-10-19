#!/usr/bin/env node
// Prototype for #712: read one Seerr user's Watchlist and write a shared
// wishlist file (format "goodwatch-wishlist", version 1).
//
// Seerr's GET /api/v1/user/:id/watchlist returns the local Watchlist when it
// has any rows. With zero local rows it silently asks Plex instead, and the
// response doesn't say which one answered. The reader tells them apart by
// row shape and labels coverage from what it can check.
import { writeFileSync, renameSync } from "node:fs"
import { pathToFileURL } from "node:url"

const PAGE_SIZE = 20
const MAX_PAGES = 2600 // 52,000 rows, above the 50,000-entry upload limit.
const LOCAL_KEYS = ["createdAt", "updatedAt", "tmdbId", "mediaType"]
const PLEX_KEYS = new Set(["id", "ratingKey", "title", "mediaType", "tmdbId"])

export class ReaderError extends Error {}

const isCount = (value) => Number.isSafeInteger(value) && value >= 0

function checkEnvelope(body, page) {
	if (
		!body ||
		typeof body !== "object" ||
		!isCount(body.totalPages) ||
		!isCount(body.totalResults) ||
		!Array.isArray(body.results) ||
		body.results.length > PAGE_SIZE
	)
		throw new ReaderError(`Page ${page}: Seerr answered with an unexpected layout.`)
	return body
}

/** Which Seerr backend produced this row, judged by its shape. */
export function rowOrigin(row) {
	if (!row || typeof row !== "object") return "unrecognized"
	if (LOCAL_KEYS.every((key) => key in row)) return "local"
	const keys = Object.keys(row)
	if (
		!("createdAt" in row) &&
		keys.every((key) => PLEX_KEYS.has(key)) &&
		row.id === row.tmdbId
	)
		return "plex"
	return "unrecognized"
}

function pageOrigin(rows) {
	if (!rows.length) return "empty"
	const origins = new Set(rows.map(rowOrigin))
	return origins.size === 1 ? [...origins][0] : "mixed"
}

const MEDIA_TYPES = { movie: "movie", tv: "show" }

/** Keep only what the shared file needs. Seerr rows also carry the user and media records. */
export function project(row, origin) {
	let mediaType = MEDIA_TYPES[row?.mediaType] ?? "unknown"
	const tmdbId = Number.isSafeInteger(row?.tmdbId) && row.tmdbId > 0 ? row.tmdbId : undefined
	const rawTitle = typeof row?.title === "string" ? row.title.trim() : ""
	// Strip control characters: the shared parser rejects them.
	const title = rawTitle.replace(/\p{Cc}+/gu, " ").replace(/ {2,}/g, " ").slice(0, 1000) || (tmdbId ? `TMDB ${mediaType} ${tmdbId}` : "Unknown title")
	// Seerr labels every Plex row that isn't a show as a movie, whatever its
	// Plex type. Such a row keeps its TMDB number only as source evidence, so
	// it can't become a movie wish by accident.
	if (origin === "plex" && mediaType === "movie") {
		const item = { title, mediaType: "unknown" }
		if (tmdbId) item.sourceId = `plex-guid-tmdb:${tmdbId}`
		return item
	}
	const item = { title, mediaType }
	if (tmdbId) item.tmdbId = tmdbId
	// Only the member's own "add to Watchlist" creates local rows, and merges
	// keep the timestamp, so this is the UTC date the local Seerr record was
	// created. It isn't a Plex add date. Plex rows carry no date.
	if (origin === "local" && typeof row.createdAt === "string") {
		const day = row.createdAt.slice(0, 10)
		if (/^\d{4}-\d{2}-\d{2}$/.test(day)) item.addedAt = day
	}
	return item
}

const identity = (item) =>
	item.tmdbId ? `${item.mediaType}:${item.tmdbId}` : item.sourceId ? `source:${item.sourceId}` : undefined

/** Problems with one page's envelope, judged against Seerr's own total. */
function envelopeProblems(body, requested) {
	const problems = []
	const total = body.totalResults
	if (total === 0) {
		if (body.results.length) problems.push(`Page ${requested} has titles but Seerr's total is 0.`)
		return problems
	}
	const pages = Math.ceil(total / PAGE_SIZE)
	if (body.page !== requested) problems.push(`Seerr answered page ${body.page} when asked for page ${requested}.`)
	if (body.totalPages !== pages) problems.push(`Seerr reported ${body.totalPages} pages for ${total} titles.`)
	const rows = Math.max(0, Math.min(PAGE_SIZE, total - PAGE_SIZE * (requested - 1)))
	if (body.results.length !== rows) problems.push(`Page ${requested} has ${body.results.length} titles; Seerr's total implies ${rows}.`)
	return problems
}

/**
 * Read every page twice and decide what the capture can honestly claim.
 * `getPage(n)` returns the parsed JSON body of page n or throws.
 * `onPage(done, pass)` lets the harness change Seerr between pages.
 *
 * Seerr pages with LIMIT/OFFSET and no snapshot, so an edit during a read
 * can skip one title and repeat another while every count still agrees. Two
 * full passes with the same identity sequence are evidence that the list
 * held still, not proof: an edit undone before the second pass reaches the
 * same page could still go unnoticed.
 */
export async function readWatchlist({ getPage, onPage }) {
	const started = Date.now()
	let requests = 0
	const fetchPage = async (page) => {
		requests += 1
		return checkEnvelope(await getPage(page), page)
	}
	const readPass = async (pass) => {
		const first = await fetchPage(1)
		if (first.totalPages > MAX_PAGES) throw new ReaderError("This Watchlist is larger than GoodWatch imports at once.")
		const pages = [{ requested: 1, body: first }]
		for (let page = 2; page <= first.totalPages; page += 1) {
			await onPage?.(page - 1, pass)
			pages.push({ requested: page, body: await fetchPage(page) })
		}
		return pages
	}
	const passOne = await readPass(1)
	await onPage?.(passOne.length, 1)
	const passTwo = await readPass(2)
	const allPages = [...passOne, ...passTwo]

	const reasons = []
	const addReason = (reason) => reasons.includes(reason) || reasons.push(reason)
	for (const { body, requested } of allPages) for (const problem of envelopeProblems(body, requested)) addReason(problem)

	const origins = allPages.map(({ body }) => pageOrigin(body.results))
	const nonEmpty = origins.filter((origin) => origin !== "empty")
	const source =
		nonEmpty.length === 0
			? "none"
			: nonEmpty.some((origin) => origin === "unrecognized" || origin === "mixed")
				? "unrecognized"
				: nonEmpty.every((origin) => origin === "local")
					? "local"
					: nonEmpty.every((origin) => origin === "plex")
						? "plex"
						: "mixed"
	if (source === "plex") addReason("Seerr answered from the Plex fallback, which can drop rows and hide failures.")
	if (source === "mixed") addReason("Pages came from different Seerr sources.")
	if (source === "unrecognized") addReason("Some rows have a layout this reader doesn't recognize.")
	if (origins.some((origin, index) => origin === "plex" && allPages[index].body.results.some((row) => row.mediaType === "movie")))
		addReason("Seerr reports every Plex title that isn't a show as a movie, so those titles need a type before import.")

	// One pass: its items in order, and what it says about counts and repeats.
	const summarize = (pages, passOrigins) => {
		const keys = []
		const items = []
		let rows = 0
		let duplicates = 0
		let withoutId = 0
		const seen = new Set()
		pages.forEach(({ body }, index) => {
			for (const row of body.results) {
				rows += 1
				const item = project(row, passOrigins[index])
				const key = identity(item)
				keys.push(key ?? `row:${rows}`)
				if (!key) withoutId += 1
				else if (seen.has(key)) {
					duplicates += 1
					continue
				} else seen.add(key)
				items.push({ key, item })
			}
		})
		return { total: pages[0].body.totalResults, totalPages: pages[0].body.totalPages, keys, items, rows, duplicates, withoutId, distinct: seen.size }
	}
	const one = summarize(passOne, origins.slice(0, passOne.length))
	const two = summarize(passTwo, origins.slice(passOne.length))
	for (const [label, pass] of [["first", one], ["second", two]]) {
		if (pass.rows !== pass.total) addReason(`Seerr reported ${pass.total} titles but sent ${pass.rows} in the ${label} pass.`)
		if (pass.duplicates) addReason(`${pass.duplicates} titles arrived more than once in the ${label} pass.`)
		if (pass.withoutId) addReason(`${pass.withoutId} titles have no TMDB ID.`)
		if (pass.rows === pass.total && pass.distinct + pass.withoutId !== pass.total)
			addReason("The number of distinct titles doesn't match Seerr's total.")
	}
	if (one.total !== two.total || one.totalPages !== two.totalPages) addReason("Seerr's total changed between the two passes.")
	else if (one.keys.join("\n") !== two.keys.join("\n")) addReason("The two passes returned different titles or a different order.")

	const completeness = source === "local" && reasons.length === 0 ? "complete" : "unknown"
	// Both passes, first-seen order. An incomplete capture is reviewed anyway,
	// and an import never removes wishes.
	const merged = new Map()
	for (const { key, item } of [...one.items, ...two.items]) if (!merged.has(key)) merged.set(key, item)
	const items = [...merged.values()]

	let emptyReason
	if (items.length === 0)
		emptyReason =
			passOne[0].body.totalPages === 1
				? "Seerr has no local Watchlist titles for this user and no Plex account to fall back to."
				: "Seerr has no local Watchlist titles, so it asked Plex. Plex returned nothing, or the Plex read failed. Seerr's answer doesn't say which."

	return {
		file:
			items.length === 0
				? undefined
				: {
						format: "goodwatch-wishlist",
						version: 1,
						source: "seerr",
						exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
						completeness,
						items,
					},
		report: {
			source,
			completeness: items.length ? completeness : "none",
			emptyReason,
			reasons,
			reportedTotal: one.total,
			rowsReceived: one.rows,
			distinctTitles: one.distinct,
			duplicates: one.duplicates,
			withoutId: one.withoutId,
			secondPass: { reportedTotal: two.total, rowsReceived: two.rows, distinctTitles: two.distinct, sameSequence: one.keys.join("\n") === two.keys.join("\n") },
			pages: passOne.length,
			pageOrigins: origins.slice(0, passOne.length),
			secondPassOrigins: origins.slice(passOne.length),
			requests,
			milliseconds: Date.now() - started,
		},
	}
}

/** HTTP access to one Seerr instance. Auth: API key (+ user ID), a session cookie, or local sign-in. */
export async function connect({ baseUrl, apiKey, apiUser, cookie, email, password, fetchImpl = fetch }) {
	const base = new URL(baseUrl)
	const headers = { accept: "application/json" }
	if (apiKey) headers["x-api-key"] = apiKey
	if (apiKey && apiUser) headers["x-api-user"] = String(apiUser)
	if (cookie) headers.cookie = cookie
	const call = async (path, init = {}) => {
		let response
		try {
			response = await fetchImpl(new URL(path, base), { ...init, headers: { ...headers, ...init.headers }, redirect: "error" })
		} catch (error) {
			throw new ReaderError(`Can't reach Seerr at ${base.origin}: ${error.cause?.code ?? error.message}`)
		}
		if (response.status === 401 || response.status === 403)
			throw new ReaderError("Seerr refused the request. Check the key or sign-in, and that this user's Watchlist is yours to read.")
		if (!response.ok) throw new ReaderError(`Seerr answered HTTP ${response.status}.`)
		try {
			return { body: await response.json(), response }
		} catch {
			throw new ReaderError("Seerr answered with something that isn't JSON.")
		}
	}
	if (!apiKey && !cookie && email && password) {
		const { response } = await call("/api/v1/auth/local", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, password }),
		})
		const session = response.headers.getSetCookie?.().find((value) => value.startsWith("connect.sid="))
		if (!session) throw new ReaderError("Seerr signed in but sent no session.")
		headers.cookie = session.split(";")[0]
	}
	let userId = apiUser
	if (!userId) {
		const { body } = await call("/api/v1/auth/me")
		userId = body?.id
	}
	if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) throw new ReaderError("Couldn't tell which Seerr user this is.")
	return {
		userId: Number(userId),
		getPage: async (page) => (await call(`/api/v1/user/${Number(userId)}/watchlist?page=${page}`)).body,
	}
}

export const EXIT = { written: 0, usage: 2, empty: 3, failed: 4 }

async function main(argv) {
	const args = {}
	for (let index = 0; index < argv.length; index += 2) args[argv[index].replace(/^--/, "")] = argv[index + 1]
	if (!args.url || !args.out) {
		console.error(
			"Usage: node reader.mjs --url <seerr-url> --out <file.json> [--user-id <n>]\n" +
				"Auth from the environment: SEERR_API_KEY (with --user-id to read that user), SEERR_COOKIE, or SEERR_EMAIL and SEERR_PASSWORD.",
		)
		return EXIT.usage
	}
	try {
		const seerr = await connect({
			baseUrl: args.url,
			apiKey: process.env.SEERR_API_KEY,
			apiUser: args["user-id"],
			cookie: process.env.SEERR_COOKIE,
			email: process.env.SEERR_EMAIL,
			password: process.env.SEERR_PASSWORD,
		})
		const { file, report } = await readWatchlist({ getPage: seerr.getPage })
		console.log(JSON.stringify(report, null, 2))
		if (!file) {
			console.error(report.emptyReason)
			return EXIT.empty
		}
		const temporary = `${args.out}.partial`
		writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
		renameSync(temporary, args.out)
		console.error(`Wrote ${file.items.length} titles to ${args.out}, coverage ${file.completeness}.`)
		return EXIT.written
	} catch (error) {
		if (!(error instanceof ReaderError)) throw error
		console.error(error.message)
		return EXIT.failed
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main(process.argv.slice(2))

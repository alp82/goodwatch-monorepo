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
	const mediaType = MEDIA_TYPES[row?.mediaType] ?? "unknown"
	const tmdbId = Number.isSafeInteger(row?.tmdbId) && row.tmdbId > 0 ? row.tmdbId : undefined
	const rawTitle = typeof row?.title === "string" ? row.title.trim() : ""
	// Strip control characters: the shared parser rejects them.
	const title = rawTitle.replace(/\p{Cc}+/gu, " ").replace(/ {2,}/g, " ").slice(0, 1000) || (tmdbId ? `TMDB ${mediaType} ${tmdbId}` : "Unknown title")
	const item = { title, mediaType }
	if (tmdbId) item.tmdbId = tmdbId
	// Local rows are only created by the member's own "add to Watchlist", so
	// createdAt is the Seerr-added time. Plex rows carry no date.
	if (origin === "local" && typeof row.createdAt === "string") {
		const day = row.createdAt.slice(0, 10)
		if (/^\d{4}-\d{2}-\d{2}$/.test(day)) item.addedAt = day
	}
	return item
}

const identity = (item) => (item.tmdbId ? `${item.mediaType}:${item.tmdbId}` : undefined)

/**
 * Read every page and decide what the capture can honestly claim.
 * `getPage(n)` returns the parsed JSON body of page n or throws.
 * `onPage` lets the harness change Seerr between pages.
 */
export async function readWatchlist({ getPage, onPage }) {
	const started = Date.now()
	const pages = []
	let requests = 0
	const fetchPage = async (page) => {
		requests += 1
		return checkEnvelope(await getPage(page), page)
	}
	const first = await fetchPage(1)
	pages.push(first)
	const totalPages = first.totalPages
	if (totalPages > MAX_PAGES) throw new ReaderError("This Watchlist is larger than GoodWatch imports at once.")
	for (let page = 2; page <= totalPages; page += 1) {
		await onPage?.(page - 1)
		pages.push(await fetchPage(page))
	}
	// A second read of page 1 catches a list that changed during the read.
	const recheck = totalPages > 0 ? await fetchPage(1) : first

	const origins = pages.map((page) => pageOrigin(page.results))
	const totals = new Set(pages.map((page) => page.totalResults).concat(recheck.totalResults))
	const rowsReceived = pages.reduce((sum, page) => sum + page.results.length, 0)
	const seen = new Set()
	const items = []
	let duplicates = 0
	let withoutId = 0
	pages.forEach((page, index) => {
		for (const row of page.results) {
			const item = project(row, origins[index])
			const key = identity(item)
			if (!key) withoutId += 1
			else if (seen.has(key)) {
				duplicates += 1
				continue
			} else seen.add(key)
			items.push(item)
		}
	})
	const firstKeys = (body) => body.results.map((row) => identity(project(row))).join(",")
	const recheckMatches = recheck.totalResults === first.totalResults && firstKeys(recheck) === firstKeys(first)

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
	const reasons = []
	if (source === "plex") reasons.push("Seerr answered from the Plex fallback, which can drop rows and hide failures.")
	if (source === "mixed") reasons.push("Pages came from different Seerr sources.")
	if (origins.includes("unrecognized") || origins.includes("mixed")) reasons.push("Some rows have a layout this reader doesn't recognize.")
	if (totals.size > 1) reasons.push("Seerr's total changed during the read.")
	if (!recheckMatches) reasons.push("Page 1 changed during the read.")
	if (rowsReceived !== first.totalResults) reasons.push(`Seerr reported ${first.totalResults} titles but sent ${rowsReceived}.`)
	if (duplicates) reasons.push(`${duplicates} titles arrived more than once.`)
	if (withoutId) reasons.push(`${withoutId} titles have no TMDB ID.`)
	if (seen.size + withoutId !== first.totalResults && rowsReceived === first.totalResults)
		reasons.push("The number of distinct titles doesn't match Seerr's total.")
	const completeness = source === "local" && reasons.length === 0 ? "complete" : "unknown"

	let emptyReason
	if (items.length === 0)
		emptyReason =
			first.totalPages === 1
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
			reportedTotal: first.totalResults,
			rowsReceived,
			distinctTitles: seen.size,
			duplicates,
			withoutId,
			pages: pages.length,
			pageOrigins: origins,
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

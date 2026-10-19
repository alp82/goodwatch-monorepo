// Owner step for #712, part 1 of 2. Reads the Plex token from stdin, makes
// the Plex requests Seerr's fallback would make, and writes a recording to
// stdout for plex-replay.mjs. Nothing is written to disk, and the token is
// removed from the recording. Plex requests are GETs with Seerr's headers
// (server/api/plextv.ts).
//
// Seerr caches one Plex list response per token and sends that response's
// ETag with every later list request, whatever the page. This script follows
// the same rule, so the replay sees the same conditional requests and the
// same 200 or 304 answers that Seerr would get.
import { createInterface } from "node:readline"

const PLEX = "https://discover.provider.plex.tv"
const PAGE_SIZE = 20
const MAX_PAGES = 25 // 500 titles
// The reader reads every page twice, and the replay runs the reader twice.
const PASSES = 4

const lines = createInterface({ input: process.stdin })
let token = ""
for await (const line of lines) {
	token = line.trim()
	break
}
lines.close()
if (!token) {
	console.error("No token on stdin.")
	process.exit(1)
}

let requests = 0
let networkErrors = 0
async function get(path, headers = {}) {
	requests += 1
	try {
		const response = await fetch(`${PLEX}${path}`, {
			headers: { "X-Plex-Token": token, "Content-Type": "application/json", Accept: "application/json", ...headers },
		})
		const text = await response.text()
		let body
		try {
			body = text ? JSON.parse(text) : undefined
		} catch {}
		return { status: response.status, etag: response.headers.get("etag") ?? undefined, body }
	} catch {
		networkErrors += 1
		return { status: 0 }
	}
}

const validList = (body) =>
	!!body?.MediaContainer && typeof body.MediaContainer === "object" && typeof body.MediaContainer.totalSize === "number"
const listItems = (body) => body?.MediaContainer?.Metadata ?? body?.MediaContainer?.Video ?? []

// 1. List requests in Seerr's order, with Seerr's cache rule.
const list = {} // "start|ifNoneMatch" -> responses in the order they came
let cached
let capped = false
const conditionalPages = { requests: 0, notModified: 0 }
async function listPage(start) {
	const ifNoneMatch = cached?.etag ?? ""
	const response = await get(
		`/library/sections/watchlist/all?X-Plex-Container-Start=${start}&X-Plex-Container-Size=${PAGE_SIZE}`,
		ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {},
	)
	const key = `${start}|${ifNoneMatch}`
	;(list[key] ??= []).push(response)
	if (start > 0 && ifNoneMatch) {
		conditionalPages.requests += 1
		if (response.status === 304) conditionalPages.notModified += 1
	}
	if (response.status >= 200 && response.status <= 299 && validList(response.body)) cached = { etag: response.etag, body: response.body }
	// Seerr treats 4xx, 5xx and network errors as an empty result.
	return response.status >= 200 && response.status < 400 && !!cached
}
for (let pass = 0; pass < PASSES; pass += 1) {
	const ok = await listPage(0)
	let pages = ok ? Math.ceil(cached.body.MediaContainer.totalSize / PAGE_SIZE) : 0
	if (pages > MAX_PAGES) {
		capped = true
		pages = MAX_PAGES
	}
	// The reader keeps reading later pages after a failed one, and so does this.
	for (let page = 2; page <= pages; page += 1) await listPage((page - 1) * PAGE_SIZE)
}

// 2. Metadata for every item any list response named.
const ratingKeys = new Set()
for (const responses of Object.values(list)) for (const response of responses) for (const item of listItems(response.body)) ratingKeys.add(item.ratingKey)
const metadata = {}
const counts = { checked: 0, withTmdbGuid: 0, withoutTmdbGuid: 0, notFound: 0, otherErrors: 0, movies: 0, shows: 0, otherTypes: 0 }
const keys = [...ratingKeys]
for (let index = 0; index < keys.length; index += 4) {
	await Promise.all(
		keys.slice(index, index + 4).map(async (ratingKey) => {
			const response = await get(`/library/metadata/${encodeURIComponent(ratingKey)}`)
			metadata[ratingKey] = { status: response.status, body: response.body }
			counts.checked += 1
			if (response.status === 404) return (counts.notFound += 1)
			const entry = response.body?.MediaContainer?.Metadata?.[0] ?? response.body?.MediaContainer?.Video?.[0]
			if (!entry) return (counts.otherErrors += 1)
			if (entry.type === "movie") counts.movies += 1
			else if (entry.type === "show") counts.shows += 1
			else counts.otherTypes += 1
			if (entry.Guid?.some((guid) => String(guid.id).startsWith("tmdb"))) counts.withTmdbGuid += 1
			else counts.withoutTmdbGuid += 1
		}),
	)
}

const first = list["0|"]?.[0]
const direct = {
	firstPageStatus: first?.status ?? null,
	totalSize: validList(first?.body) ? first.body.MediaContainer.totalSize : null,
	usesVideoKey: !!first?.body?.MediaContainer?.Video,
	hasEtag: !!first?.etag,
	laterPagesAskedWithCachedEtag: conditionalPages.requests,
	laterPagesAnswered304: conditionalPages.notModified,
	cappedAtPages: capped ? MAX_PAGES : null,
	networkErrors,
	plexRequests: requests,
}

// The recording holds titles and Plex keys; it only ever lives in the pipe
// and the replay's memory. Remove the token wherever a response echoed it.
const recording = JSON.stringify({ direct, metadataCounts: counts, list, metadata }).split(token).join("[removed]")
token = ""
process.stdout.write(`${recording}\n`)

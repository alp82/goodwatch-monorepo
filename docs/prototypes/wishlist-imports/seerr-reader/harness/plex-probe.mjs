// Measures how a real Plex Watchlist behaves through Seerr's fallback, for
// the owner step in #712. Writes counts only: no titles, IDs or token.
//
// Usage: node plex-probe.mjs <seerr-base-url> <seerr-db-path> <token-file> <summary-out>
//
// Requests to Plex are GETs with the same headers Seerr sends
// (server/api/plextv.ts). Nothing is written to Plex.
import { readFileSync, writeFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { connect, readWatchlist } from "../reader.mjs"

const [seerrUrl, dbPath, tokenFile, summaryOut] = process.argv.slice(2)
const token = readFileSync(tokenFile, "utf8").trim()
if (!token) throw new Error("The token file is empty.")
const PLEX = "https://discover.provider.plex.tv"
const plexHeaders = { "X-Plex-Token": token, "Content-Type": "application/json", Accept: "application/json" }
const METADATA_CAP = 500
let plexRequests = 0

async function plex(path, headers = {}) {
	plexRequests += 1
	const response = await fetch(`${PLEX}${path}`, { headers: { ...plexHeaders, ...headers } })
	let body
	if (response.status === 200) body = await response.json().catch(() => undefined)
	return { status: response.status, etag: response.headers.get("etag") ?? undefined, body }
}
const listPage = (start, size = 20, headers) =>
	plex(`/library/sections/watchlist/all?X-Plex-Container-Start=${start}&X-Plex-Container-Size=${size}`, headers)

// 1. The list endpoint, read the way Seerr reads it.
const first = await listPage(0)
const totalSize = first.body?.MediaContainer?.totalSize
const direct = {
	firstPageStatus: first.status,
	totalSize: Number.isInteger(totalSize) ? totalSize : null,
	firstPageItems: first.body?.MediaContainer?.Metadata?.length ?? first.body?.MediaContainer?.Video?.length ?? 0,
	usesVideoKey: !!first.body?.MediaContainer?.Video,
	hasEtag: !!first.etag,
}
if (direct.totalSize > 20) {
	const second = await listPage(20)
	const conditional = await listPage(20, 20, first.etag ? { "If-None-Match": first.etag } : {})
	direct.secondPageStatus = second.status
	direct.sameEtagOnBothPages = !!first.etag && first.etag === second.etag
	// 304 here means Seerr would serve page 1 again as page 2.
	direct.secondPageWithFirstEtagStatus = conditional.status
}

// 2. Metadata for each item: how many have no TMDB GUID or fail to load.
const keys = []
for (let start = 0; start < Math.min(direct.totalSize ?? 0, METADATA_CAP); start += 50) {
	const page = await listPage(start, 50)
	for (const item of page.body?.MediaContainer?.Metadata ?? page.body?.MediaContainer?.Video ?? []) keys.push(item.ratingKey)
}
const metadata = { checked: 0, withTmdbGuid: 0, withoutTmdbGuid: 0, notFound: 0, otherErrors: 0, movies: 0, shows: 0, otherTypes: 0 }
for (let index = 0; index < keys.length; index += 4) {
	await Promise.all(
		keys.slice(index, index + 4).map(async (key) => {
			const result = await plex(`/library/metadata/${encodeURIComponent(key)}`)
			metadata.checked += 1
			if (result.status === 404) return (metadata.notFound += 1)
			const entry = result.body?.MediaContainer?.Metadata?.[0] ?? result.body?.MediaContainer?.Video?.[0]
			if (!entry) return (metadata.otherErrors += 1)
			if (entry.type === "movie") metadata.movies += 1
			else if (entry.type === "show") metadata.shows += 1
			else metadata.otherTypes += 1
			if (entry.Guid?.some((guid) => String(guid.id).startsWith("tmdb"))) metadata.withTmdbGuid += 1
			else metadata.withoutTmdbGuid += 1
		}),
	)
}

// 3. The same list through a disposable Seerr user with zero local rows.
const api = (path, init = {}) =>
	fetch(`${seerrUrl}/api/v1${path}`, {
		...init,
		headers: { "x-api-key": "gw712-local-test-key", "content-type": "application/json", ...init.headers },
	}).then((response) => response.json())
const user = await api("/user", {
	method: "POST",
	body: JSON.stringify({ email: "plex-check@gw712.invalid", username: "plexcheck", password: "plex-check-only" }),
})
const db = new DatabaseSync(dbPath)
db.exec("PRAGMA busy_timeout = 5000")
db.prepare("UPDATE user SET plexToken = ? WHERE id = ?").run(token, user.id)
const seerr = await connect({ baseUrl: seerrUrl, apiKey: "gw712-local-test-key", apiUser: user.id })
const strip = ({ report, file }) => ({ ...report, fileWritten: !!file, fileLabel: file?.completeness ?? null })
const coldCache = strip(await readWatchlist({ getPage: seerr.getPage }))
const warmCache = strip(await readWatchlist({ getPage: seerr.getPage }))
// Remove the token from the disposable database right away.
db.prepare("UPDATE user SET plexToken = NULL WHERE id = ?").run(user.id)

const summary = {
	measuredAt: new Date().toISOString(),
	direct,
	metadata: { ...metadata, cappedAt: keys.length < (direct.totalSize ?? 0) ? METADATA_CAP : null },
	throughSeerr: { coldCache, warmCache },
	plexRequests,
}
writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
console.log(JSON.stringify(summary, null, 2))

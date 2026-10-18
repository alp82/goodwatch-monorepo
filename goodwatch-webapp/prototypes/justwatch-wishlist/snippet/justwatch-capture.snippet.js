// GoodWatch #708 JustWatch Watchlist capture. Read-only: it sends list queries to https://apis.justwatch.com/graphql and nothing else.
// It reads your JustWatch sign-in from this tab, never stores or downloads it, and saves one JSON file to your Downloads folder.
(async () => {
// Throwaway #708 prototype. Plain browser-and-Node JavaScript with no imports, so
// build-snippet.mjs can paste it into a console snippet unchanged (minus `export`).
// Written independently from the observed JustWatch protocol; no third-party code is copied.

const GRAPHQL_URL = "https://apis.justwatch.com/graphql"
const PAGE_SIZE = 20
const MAX_PAGES = 600
const MAX_ATTEMPTS = 3

const LIST_QUERY = `query GoodWatchListCapture($country: Country!, $language: Language!, $listType: TitleListTypeV2!, $after: String, $first: Int!) {
  titleListV2(country: $country, titleListType: $listType, sortBy: LAST_ADDED, first: $first, after: $after, filter: {includeTitlesWithoutUrl: true}) {
    totalCount
    pageInfo { endCursor hasNextPage }
    edges {
      node {
        id
        objectId
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          fullPath
          externalIds { imdbId tmdbId }
        }
        watchlistEntryV2 { createdAt }
        ... on Movie { seenlistEntry { createdAt } }
        ... on Show {
          tvShowTrackingEntry { createdAt }
          seenState(country: $country) { progress }
        }
      }
    }
  }
}`

/** The field set the public CSV exporter is known to use, for a server that rejects `objectId`. */
const FALLBACK_QUERY = LIST_QUERY.replace("        objectId\n", "")

/**
 * Reads one JustWatch list to its end and records why it stopped.
 * `request(body)` returns `{ status, body }`; status 0 means no response.
 */
async function captureList({
	request,
	query = LIST_QUERY,
	country,
	language = "en",
	listType,
	pageSize = PAGE_SIZE,
	maxPages = MAX_PAGES,
	sleep = async () => {},
	pageDelayMs = 400,
	onPage = () => {},
}) {
	const started = Date.now()
	const pages = []
	const nodes = []
	const byId = new Map()
	const duplicates = []
	const skipped = []
	const graphqlErrors = []
	const cursors = new Set()
	let after = null
	let terminal = null
	let requests = 0
	while (!terminal) {
		if (pages.length >= maxPages) {
			terminal = "page-limit"
			break
		}
		if (pages.length) await sleep(pageDelayMs)
		let response = null
		let lastStatus = 0
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			requests++
			try {
				response = await request({
					query,
					variables: {
						country,
						language,
						listType,
						first: pageSize,
						after,
					},
				})
			} catch {
				response = { status: 0, body: null }
			}
			lastStatus = response.status
			const transient = response.status === 0 || response.status === 408 || response.status === 429 || response.status >= 500
			if (!transient) break
			if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** attempt)
		}
		if (lastStatus !== 200 && Array.isArray(response?.body?.errors))
			for (const error of response.body.errors)
				graphqlErrors.push({ page: pages.length, code: String(error?.extensions?.code ?? ""), message: String(error?.message ?? "").slice(0, 200), path: "" })
		if (lastStatus === 401 || lastStatus === 403) {
			terminal = "auth"
			break
		}
		if (lastStatus !== 200) {
			terminal = `http-${lastStatus || "no-response"}`
			break
		}
		const body = response.body ?? {}
		const errors = Array.isArray(body.errors) ? body.errors : []
		for (const error of errors)
			graphqlErrors.push({
				page: pages.length,
				code: String(error?.extensions?.code ?? ""),
				message: String(error?.message ?? "").slice(0, 200),
				path: Array.isArray(error?.path) ? error.path.join(".") : "",
			})
		if (
			errors.some((error) =>
				["UNAUTHENTICATED", "AUTHORIZATION_REQUIRED", "FORBIDDEN"].includes(
					error?.extensions?.code,
				),
			)
		) {
			terminal = "auth"
			break
		}
		const page = body.data?.titleListV2
		if (!page || !Array.isArray(page.edges)) {
			terminal = "no-list-data"
			break
		}
		const record = {
			after,
			totalCount: Number.isInteger(page.totalCount) ? page.totalCount : null,
			edges: page.edges.length,
			endCursor: page.pageInfo?.endCursor ?? null,
			hasNextPage: page.pageInfo?.hasNextPage === true,
			errors: errors.length,
		}
		pages.push(record)
		for (const [position, edge] of page.edges.entries()) {
			const node = edge?.node
			if (!node || typeof node.id !== "string" || !node.id) {
				skipped.push({ page: pages.length - 1, position, reason: "no-native-id" })
				continue
			}
			if (byId.has(node.id)) {
				duplicates.push({ id: node.id, page: pages.length - 1, position })
				continue
			}
			byId.set(node.id, node)
			nodes.push(node)
		}
		onPage({ pages: pages.length, unique: nodes.length, total: record.totalCount })
		if (!record.hasNextPage) terminal = "exhausted"
		else if (!page.edges.length) terminal = "empty-page"
		else if (!record.endCursor) terminal = "missing-cursor"
		else if (cursors.has(record.endCursor)) terminal = "repeated-cursor"
		else {
			cursors.add(record.endCursor)
			after = record.endCursor
		}
	}
	const totals = [...new Set(pages.map((page) => page.totalCount))]
	const lastTotal = pages.at(-1)?.totalCount ?? null
	const accounted = nodes.length + skipped.length
	const reasons = []
	if (terminal !== "exhausted") reasons.push(`stopped: ${terminal}`)
	if (graphqlErrors.length) reasons.push(`${graphqlErrors.length} GraphQL errors`)
	if (totals.length !== 1 || lastTotal === null)
		reasons.push(`totalCount changed: ${totals.join(" → ")}`)
	else if (accounted !== lastTotal)
		reasons.push(`accounted ${accounted} of reported ${lastTotal}`)
	if (duplicates.length) reasons.push(`${duplicates.length} repeated native IDs across pages`)
	return {
		listType,
		country,
		language,
		query: query === LIST_QUERY ? "full" : "fallback",
		terminal,
		completeness: reasons.length
			? terminal === "exhausted"
				? "unknown"
				: "partial"
			: "complete",
		completenessReasons: reasons,
		requests,
		durationMs: Date.now() - started,
		pages,
		totals,
		duplicates,
		skipped,
		graphqlErrors,
		nodes,
	}
}

/**
 * Two back-to-back Watchlist runs. Offset cursors can't see an addition and a removal that
 * cancel out within one run; a second run that returns the same native IDs can.
 * Returns the run to convert and the completeness the file may claim.
 */
function reconcileRuns(first, second) {
	const a = new Set(first.nodes.map((node) => node.id))
	const b = new Set(second.nodes.map((node) => node.id))
	const onlyFirst = [...a].filter((id) => !b.has(id)).length
	const onlySecond = [...b].filter((id) => !a.has(id)).length
	const reasons = []
	if (first.completeness !== "complete") reasons.push(`run 1: ${first.completenessReasons.join("; ")}`)
	if (second.completeness !== "complete") reasons.push(`run 2: ${second.completenessReasons.join("; ")}`)
	if (onlyFirst || onlySecond) reasons.push(`runs disagree: ${onlyFirst} only in run 1, ${onlySecond} only in run 2`)
	const chosen = second.completeness === "complete" || first.completeness !== "complete" ? second : first
	const completeness = reasons.length ? (chosen.completeness === "partial" ? "partial" : "unknown") : "complete"
	return { capture: { ...chosen, completeness, completenessReasons: reasons }, chosen: chosen === first ? 1 : 2, onlyFirst, onlySecond }
}

const MEDIA = { MOVIE: "movie", SHOW: "show" }
const isDate = (value) =>
	typeof value === "string" &&
	/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) &&
	Number.isFinite(Date.parse(value))
const cleanText = (value, max) =>
	typeof value === "string" &&
	value.trim() &&
	value.length <= max &&
	![...value].some((character) => character.charCodeAt(0) < 32)
		? value
		: null

/**
 * Turns a Watchlist capture into shared wishlist JSON v1 plus an explicit loss ledger.
 * Only provider-returned external IDs are written; nothing is looked up or guessed.
 */
function toSharedWishlist(capture, { profileLabel, exportedAt }) {
	if (capture.listType !== "WATCHLIST")
		throw new Error("Only a Watchlist capture can become a wishlist file.")
	const loss = {}
	const count = (field, note) => {
		loss[field] ??= { count: 0, note }
		loss[field].count++
	}
	const excluded = []
	const items = []
	for (const node of capture.nodes) {
		const content = node.content ?? {}
		if (!node.watchlistEntryV2) {
			// The list query said Watchlist but the node carries no Watchlist entry.
			excluded.push({ id: node.id, reason: "no-watchlist-entry" })
			continue
		}
		const mediaType = MEDIA[node.objectType] ?? "unknown"
		if (mediaType === "unknown")
			count("objectType", `Provider type ${node.objectType} has no shared-format type; kept as unknown.`)
		const title = cleanText(content.title, 1000)
		const item = { title: title ?? "", mediaType }
		if (!title) count("title", "Missing or unreadable title; the parser marks the row invalid.")
		const year = content.originalReleaseYear
		if (Number.isInteger(year) && year >= 1800 && year <= 9999) item.year = year
		else if (year != null) count("year", "Year outside 1800-9999 dropped.")
		const ids = content.externalIds ?? {}
		if (ids.tmdbId != null && ids.tmdbId !== "") {
			const tmdb = typeof ids.tmdbId === "number" ? ids.tmdbId : /^\d{1,15}$/.test(String(ids.tmdbId)) ? Number(ids.tmdbId) : Number.NaN
			if (Number.isSafeInteger(tmdb) && tmdb > 0) item.tmdbId = tmdb
			else count("externalIds.tmdbId", "Malformed provider TMDB ID dropped, not repaired.")
		} else count("externalIds.tmdbId:absent", "Provider returned no TMDB ID.")
		if (ids.imdbId != null && ids.imdbId !== "") {
			if (/^tt\d{7,10}$/.test(String(ids.imdbId))) item.imdbId = String(ids.imdbId)
			else count("externalIds.imdbId", "Malformed provider IMDb ID dropped, not repaired.")
		} else count("externalIds.imdbId:absent", "Provider returned no IMDb ID.")
		item.sourceId = node.id
		if (typeof content.fullPath === "string" && content.fullPath.startsWith("/"))
			item.sourceUrl = `https://www.justwatch.com${content.fullPath}`
		const added = node.watchlistEntryV2?.createdAt
		if (isDate(added)) item.addedAt = added
		else if (added != null) count("watchlistEntryV2.createdAt", "Unreadable added date dropped, not replaced with export time.")
		else count("watchlistEntryV2.createdAt:absent", "No added date; left absent.")
		if (node.objectId != null) count("objectId", "Numeric JustWatch object ID not carried; sourceId holds the native ID.")
		if (node.seenlistEntry) count("seenlistEntry", "Seen on JustWatch and also on the Watchlist; the file can't say so. GoodWatch's own Seen state decides rewatch.")
		if (node.tvShowTrackingEntry) count("tvShowTrackingEntry", "Tracking start date not carried.")
		if (node.seenState && typeof node.seenState.progress === "number" && node.seenState.progress > 0)
			count("seenState.progress", "Show progress above zero not carried; the wish is kept.")
		items.push(item)
	}
	count("content.title:localized", "Titles are in the capture language, not the original title.")
	loss["content.title:localized"].count = items.length
	return {
		file: {
			format: "goodwatch-wishlist",
			version: 1,
			source: "justwatch",
			...(profileLabel ? { profileLabel } : {}),
			...(/^[A-Z]{2}$/.test(capture.country) ? { country: capture.country } : {}),
			exportedAt,
			completeness: capture.completeness,
			items,
		},
		loss,
		excluded,
	}
}

/** A private record of membership signals per native ID, without titles or tokens. */
function evidenceOf(capture) {
	return {
		listType: capture.listType,
		query: capture.query,
		terminal: capture.terminal,
		completeness: capture.completeness,
		completenessReasons: capture.completenessReasons,
		requests: capture.requests,
		durationMs: capture.durationMs,
		pages: capture.pages.map(({ after, ...page }) => ({ ...page, hadCursor: after !== null })),
		totals: capture.totals,
		duplicates: capture.duplicates.length,
		skipped: capture.skipped.length,
		graphqlErrors: capture.graphqlErrors,
		members: capture.nodes.map((node) => ({
			id: node.id,
			objectType: node.objectType,
			watchlist: !!node.watchlistEntryV2,
			seen: !!node.seenlistEntry,
			tracked: !!node.tvShowTrackingEntry,
			progress: typeof node.seenState?.progress === "number" ? node.seenState.progress : null,
			tmdb: node.content?.externalIds?.tmdbId ?? null,
			imdb: node.content?.externalIds?.imdbId ?? null,
		})),
	}
}

// Appended inside the snippet's async function after capture-core.js. Browser only.
if (location.origin !== "https://www.justwatch.com") {
	alert("Open https://www.justwatch.com in this tab first, then paste again.")
	return
}
let user = null
try {
	user = JSON.parse(localStorage.getItem("jw/user") ?? "null")
} catch {}
if (!user?.jwLoginId || typeof user.accessToken !== "string") {
	alert("Sign in to JustWatch in this tab, reload the page, then paste again.")
	return
}
let expiry = null
try {
	expiry = JSON.parse(atob(user.accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000
} catch {}
if (expiry && expiry < Date.now() + 5 * 60_000) {
	alert("Your JustWatch sign-in is about to expire. Reload the page, then paste again.")
	return
}
const country = (location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] ?? "").toUpperCase()
if (!country) {
	alert("Open your Watchlist page (for example https://www.justwatch.com/de/watchlist), then paste again.")
	return
}
const language = (document.documentElement.lang || "en").slice(0, 2).toLowerCase()
const headers = { "content-type": "application/json", authorization: `Bearer ${user.accessToken}` }
if (typeof user.jwId === "string") headers["device-id"] = user.jwId
const request = async (body) => {
	const response = await fetch(GRAPHQL_URL, { method: "POST", headers, body: JSON.stringify(body), credentials: "omit" })
	let json = null
	try {
		json = await response.json()
	} catch {}
	return { status: response.status, body: json }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (label) => ({ pages, unique, total }) => console.log(`[GoodWatch] ${label}: page ${pages}, ${unique} of ${total}`)
let query = LIST_QUERY
const run = async (listType, label) => {
	let capture = await captureList({ request, query, country, language, listType, sleep, onPage: log(label) })
	if (["no-list-data", "http-400"].includes(capture.terminal) && capture.pages.length === 0 && query === LIST_QUERY) {
		console.log("[GoodWatch] JustWatch rejected the full query; retrying with the smaller one.")
		query = FALLBACK_QUERY
		capture = await captureList({ request, query, country, language, listType, sleep, onPage: log(label) })
	}
	return capture
}

console.log("[GoodWatch] Reading your Watchlist twice and your Seen list once. Don't change your lists until the file downloads.")
const first = await run("WATCHLIST", "Watchlist run 1")
await sleep(1500)
const second = await run("WATCHLIST", "Watchlist run 2")
await sleep(1500)
const seen = await run("SEENLIST", "Seen list")
const exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
const reconciled = reconcileRuns(first, second)
const shared = toSharedWishlist(reconciled.capture, { exportedAt })
const bundle = {
	kind: "goodwatch-708-justwatch-capture",
	version: 1,
	capturedAt: exportedAt,
	country,
	language,
	snippet: "prototype/justwatch-roundtrip",
	watchlistRuns: [evidenceOf(first), evidenceOf(second)],
	reconciled: { chosenRun: reconciled.chosen, completeness: reconciled.capture.completeness, reasons: reconciled.capture.completenessReasons },
	seenlist: evidenceOf(seen),
	sharedFile: shared.file,
	loss: shared.loss,
	excluded: shared.excluded,
}
const blob = new Blob([JSON.stringify(bundle, null, 1)], { type: "application/json" })
const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "justwatch-708-capture.json" })
document.body.append(link)
link.click()
link.remove()
console.log(
	`[GoodWatch] Saved justwatch-708-capture.json. Watchlist: ${first.nodes.length} titles (${first.completeness}), second run ${second.nodes.length} (${second.completeness}), file says ${reconciled.capture.completeness}. Seen list ${seen.nodes.length}.`,
)

})()

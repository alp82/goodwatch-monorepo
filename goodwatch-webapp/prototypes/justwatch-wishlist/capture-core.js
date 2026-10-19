// Throwaway #708 prototype. Plain browser-and-Node JavaScript with no imports, so
// build-snippet.mjs can paste it into a console snippet unchanged (minus `export`).
// Written independently from the observed JustWatch protocol; no third-party code is copied.

export const GRAPHQL_URL = "https://apis.justwatch.com/graphql"
export const PAGE_SIZE = 20
export const MAX_PAGES = 600
const MAX_ATTEMPTS = 3

export const LIST_QUERY = `query GoodWatchListCapture($country: Country!, $language: Language!, $listType: TitleListTypeV2!, $after: String, $first: Int!) {
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

// Server text is never saved: errors become one of these categories, and IDs, cursors and
// types are kept only when they match a strict shape.
export const ERROR_CATEGORIES = ["auth", "rate-limit", "validation", "internal", "other"]
const AUTH_CODES = ["UNAUTHENTICATED", "AUTHORIZATION_REQUIRED", "FORBIDDEN"]
const VALIDATION_CODES = ["GRAPHQL_VALIDATION_FAILED", "GRAPHQL_PARSE_FAILED", "BAD_USER_INPUT"]
export function errorCategory(error) {
	const code = typeof error?.extensions?.code === "string" ? error.extensions.code : ""
	if (AUTH_CODES.includes(code)) return "auth"
	if (VALIDATION_CODES.includes(code)) return "validation"
	if (code === "INTERNAL_SERVER_ERROR") return "internal"
	if (/rate.?limit|too many requests/i.test(`${code} ${typeof error?.message === "string" ? error.message : ""}`)) return "rate-limit"
	return "other"
}
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const SAFE_TYPE = /^[A-Z_]{1,32}$/
const SAFE_PATH = /^\/[A-Za-z0-9\-._~\/%]{1,500}$/
const safeType = (value) => (typeof value === "string" && SAFE_TYPE.test(value) ? value : "OTHER")
const safeTmdb = (value) => (value == null || value === "" ? null : /^\d{1,15}$/.test(String(value)) ? String(value) : "malformed")
const safeImdb = (value) => (value == null || value === "" ? null : /^tt\d{7,10}$/.test(String(value)) ? String(value) : "malformed")

/** The field set the public CSV exporter is known to use, for a server that rejects `objectId`. */
export const FALLBACK_QUERY = LIST_QUERY.replace("        objectId\n", "")

/**
 * Reads one JustWatch list to its end and records why it stopped.
 * `request(body)` returns `{ status, body }`; status 0 means no response.
 */
export async function captureList({
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
			for (const error of response.body.errors) graphqlErrors.push({ page: pages.length, category: errorCategory(error) })
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
		for (const error of errors) graphqlErrors.push({ page: pages.length, category: errorCategory(error) })
		if (errors.some((error) => errorCategory(error) === "auth")) {
			terminal = "auth"
			break
		}
		const page = body.data?.titleListV2
		if (!page || !Array.isArray(page.edges)) {
			terminal = "no-list-data"
			break
		}
		const endCursor = typeof page.pageInfo?.endCursor === "string" && page.pageInfo.endCursor ? page.pageInfo.endCursor : null
		const hasNextPage = typeof page.pageInfo?.hasNextPage === "boolean" ? page.pageInfo.hasNextPage : null
		// The record keeps no server strings: the cursor stays in this loop only.
		const record = {
			hadCursor: after !== null,
			totalCount: Number.isInteger(page.totalCount) ? page.totalCount : null,
			edges: page.edges.length,
			hadEndCursor: endCursor !== null,
			hasNextPage,
			errors: errors.length,
		}
		pages.push(record)
		for (const [position, edge] of page.edges.entries()) {
			const node = edge?.node
			if (!node || typeof node.id !== "string" || !SAFE_ID.test(node.id)) {
				skipped.push({ page: pages.length - 1, position, reason: node ? "unreadable-native-id" : "no-node" })
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
		if (hasNextPage === false) terminal = "exhausted"
		else if (hasNextPage === null) terminal = "invalid-page-info"
		else if (!page.edges.length) terminal = "empty-page"
		else if (!endCursor) terminal = "missing-cursor"
		else if (cursors.has(endCursor)) terminal = "repeated-cursor"
		else {
			cursors.add(endCursor)
			after = endCursor
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
	if (skipped.length) reasons.push(`${skipped.length} entries without a readable native ID`)
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
export function reconcileRuns(first, second) {
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
 * Turns a Watchlist capture into shared wishlist JSON v1.1 plus an explicit loss ledger.
 * Only provider-returned external IDs are written; nothing is looked up or guessed.
 * `seen` is the Seen list capture: it only adds source Seen evidence to wishes, never wishes.
 */
export function toSharedWishlist(capture, { profileLabel, exportedAt, seen }) {
	const seenDates = new Map()
	for (const node of seen?.nodes ?? []) seenDates.set(node.id, isDate(node.seenlistEntry?.createdAt) ? node.seenlistEntry.createdAt : null)
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
		if (!node.watchlistEntryV2 || typeof node.watchlistEntryV2 !== "object") {
			// The list query said Watchlist but the node carries no Watchlist entry.
			excluded.push({ id: node.id, reason: "no-watchlist-entry" })
			continue
		}
		const mediaType = MEDIA[node.objectType] ?? "unknown"
		if (mediaType === "unknown")
			count(`objectType:${safeType(node.objectType)}`, "Kept as unknown. Season rows (v1.1, #715) need a season number and parent-show IDs, which this capture doesn't request or verify.")
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
		if (typeof content.fullPath === "string" && SAFE_PATH.test(content.fullPath))
			item.sourceUrl = `https://www.justwatch.com${content.fullPath}`
		const added = node.watchlistEntryV2?.createdAt
		if (isDate(added)) item.addedAt = added
		else if (added != null) count("watchlistEntryV2.createdAt", "Unreadable added date dropped, not replaced with export time.")
		else count("watchlistEntryV2.createdAt:absent", "No added date; left absent.")
		if (node.objectId != null) count("objectId", "Numeric JustWatch object ID not carried; sourceId holds the native ID.")
		// Source Seen evidence (v1.1, #715): the wish's own Seen entry or its ID in the Seen capture.
		// Never from tracking or show progress; an unknown date stays absent.
		if (node.seenlistEntry || seenDates.has(node.id)) {
			item.sourceSeen = true
			const seenAt = isDate(node.seenlistEntry?.createdAt) ? node.seenlistEntry.createdAt : seenDates.get(node.id)
			if (seenAt) item.sourceSeenAt = seenAt
			else count("sourceSeenAt:absent", "Seen on JustWatch without a readable Seen date (shows have none); sourceSeenAt omitted.")
		}
		if (node.tvShowTrackingEntry) count("tvShowTrackingEntry", "Tracking start date not carried.")
		if (node.seenState && typeof node.seenState.progress === "number" && node.seenState.progress > 0)
			count("seenState.progress", "Show progress above zero not carried; the wish is kept.")
		items.push(item)
	}
	count("content.title:localized", "Titles are in the capture language, not the original title.")
	loss["content.title:localized"].count = items.length
	// A returned entry that can't be shown to be a wish means the file can't claim the whole list.
	const reasons = [...(capture.completenessReasons ?? [])]
	if (excluded.length) reasons.push(`${excluded.length} returned entries without Watchlist membership`)
	const completeness = capture.completeness === "complete" && excluded.length ? "unknown" : capture.completeness
	return {
		file: {
			format: "goodwatch-wishlist",
			version: 1.1,
			source: "justwatch",
			...(profileLabel ? { profileLabel } : {}),
			...(/^[A-Z]{2}$/.test(capture.country) ? { country: capture.country } : {}),
			exportedAt,
			completeness,
			items,
		},
		completenessReasons: reasons,
		loss,
		excluded,
	}
}

/** A private record of membership signals per native ID, without titles or tokens. */
export function evidenceOf(capture) {
	return {
		listType: capture.listType,
		query: capture.query,
		terminal: capture.terminal,
		completeness: capture.completeness,
		completenessReasons: capture.completenessReasons,
		requests: capture.requests,
		durationMs: capture.durationMs,
		pages: capture.pages,
		totals: capture.totals,
		duplicates: capture.duplicates.length,
		skipped: capture.skipped.length,
		graphqlErrors: capture.graphqlErrors,
		members: capture.nodes.map((node) => ({
			id: node.id,
			objectType: safeType(node.objectType),
			watchlist: !!node.watchlistEntryV2 && typeof node.watchlistEntryV2 === "object",
			seen: !!node.seenlistEntry,
			tracked: !!node.tvShowTrackingEntry,
			progress: Number.isFinite(node.seenState?.progress) ? node.seenState.progress : null,
			tmdb: safeTmdb(node.content?.externalIds?.tmdbId),
			imdb: safeImdb(node.content?.externalIds?.imdbId),
		})),
	}
}

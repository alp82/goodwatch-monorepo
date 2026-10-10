// The related map of a title page, on the server: its setting, the packs the browser draws from, and the section's
// first picture.
//
// - A pack is one title's neighborhood (see related-map-pack.ts). The browser holds one per title it shows and draws
//   every step from memory (ui/related-map/engine.ts).
// - The section's first picture needs only the title's nearest titles: two requests to Qdrant, the same for every
//   visitor. A title page waits for them for as long as it waits for its other parts, and a page without them shows
//   the related titles carousel instead and is not kept by any cache.
// - The pack the browser asks for adds the filtered list of each of the title's chips, so that the first use of a
//   chip is drawn from memory: up to six more requests. Crawlers never ask for it.
// - A page is more of one filter's order: one request.
// - The engine and the style are files of the client build. The page names them, and holds neither.
// All three are kept for a day under their own cache names. A changed shape gets a new name.
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { counter } from "~/server/metrics/registry.server"
import {
	MAX_PAGE,
	NEAR_TITLES,
	type PackHit,
	type PackSource,
	chipListLength,
	floorOf,
	isDocumentRequest,
	levelIn,
	packKey,
	packLinks,
	packTitle,
	packTitles,
	pageWindow,
	tokenCondition,
	tokensOf,
} from "~/server/related-map-pack"
import { relatedPanelEmbedded } from "~/server/related-prefetch"
import { prefetchRelatedTitlesState } from "~/server/related.server"
import { separateEntryUrl } from "~/server/separate-entry.server"
import { buildBaseFilterConditions } from "~/server/utils/recommend"
import type { RawPack, RawTitle } from "~/ui/related-map/engine"
import { relatedMap } from "~/ui/related-map/map"
import {
	type TraitToken,
	chipTokens,
	filterName,
	traitWords,
} from "~/ui/related-map/traits"
import { cached } from "~/utils/cache"
import { MEDIA_COLLECTION, recommend, scroll } from "~/utils/qdrant"
import { titleKey } from "~/utils/title-key"

type MediaType = "movie" | "show"

// --- The setting --------------------------------------------------------------------------------------------------

let warned = ""
/**
 * Whether title pages show the related map. REC_RELATED_MAP is read on every request, like the other feature
 * settings (features.server.ts), but this one is on unless it says `off`: then the related titles carousel serves.
 */
export function relatedMapEnabled(): boolean {
	const raw = (process.env.REC_RELATED_MAP ?? "").trim().toLowerCase()
	if (raw === "off") return false
	if (raw && raw !== "on" && raw !== warned) {
		warned = raw
		console.warn(`REC_RELATED_MAP="${raw}" is not off or on. Using on.`)
	}
	return true
}

// --- Packs --------------------------------------------------------------------------------------------------------

const PAYLOAD = [
	"tmdb_id",
	"media_type",
	"title",
	"release_year",
	"poster_path",
	"fingerprint_scores_v1",
]

/** What the cache keeps of a title: its pack, or the note that the title has no fingerprint (`c` is null). */
type Kept = { c: RawTitle | null; n: RawTitle[]; fl: Record<string, number> }
/** More of one filter's order around a title. */
export type RawPage = Pick<RawPack, "n" | "fl">

/** The titles most alike a title that pass a filter, in Qdrant's order. */
const around = (
	point: number,
	tokens: TraitToken[],
	limit: number,
	offset = 0,
): Promise<PackHit[]> => {
	const { must, must_not } = buildBaseFilterConditions({
		mediaType: "all",
		minVotingCount: 10000,
		minScore: 60,
		additionalMust: [
			{ key: "release_year", range: { lte: new Date().getFullYear() } },
			...tokens.map(tokenCondition),
		],
	})
	return recommend<PackSource>({
		collectionName: MEDIA_COLLECTION,
		positive: [point],
		using: "fingerprint_v1",
		filter: { must, must_not },
		limit,
		offset,
		withPayload: { include: PAYLOAD },
		hnswEf: 128,
		exact: false,
	})
}

async function buildNearest(params: {
	type: MediaType
	id: number
}): Promise<Kept> {
	const point = titleKey(params.type, params.id)
	const [own, nearest] = await Promise.all([
		scroll<PackSource>({
			collectionName: MEDIA_COLLECTION,
			filter: { must: [{ has_id: [point] }] },
			limit: 1,
			withPayload: { include: PAYLOAD },
			withVector: false,
		}),
		around(point, [], NEAR_TITLES),
	])
	const center = own[0]?.payload
	if (!center?.fingerprint_scores_v1) return { c: null, n: [], fl: {} }
	return {
		c: packTitle(center, 1000),
		n: packTitles(packKey(center), [nearest]),
		fl: { "": floorOf(nearest, NEAR_TITLES) },
	}
}

const nearestOf = (type: MediaType, id: number) =>
	cached({
		name: "related-map-nearest-v1",
		target: buildNearest,
		params: { type, id },
		ttlMinutes: 60 * 24,
	})

async function buildPack(params: {
	type: MediaType
	id: number
}): Promise<Kept> {
	const near = await nearestOf(params.type, params.id)
	if (!near.c) return near
	const levels = near.c[5]
	const tokens = tokensOf(
		chipTokens((key) => levelIn(levels, key), traitWords()).join(","),
	)
	const length = chipListLength(tokens.length)
	const point = titleKey(params.type, params.id)
	// A list that fails is left out: the browser asks for it as a page when its chip is used.
	const lists = await Promise.all(
		tokens.map((token) => around(point, [token], length).catch(() => null)),
	)
	const fl = { ...near.fl }
	lists.forEach((hits, i) => {
		const token = tokens[i]
		if (hits) fl[`${token.key}${token.op}${token.value}`] = floorOf(hits, length)
	})
	return {
		c: near.c,
		n: packTitles(
			near.c[0],
			lists.filter((hits): hits is PackHit[] => hits !== null),
			near.n,
		),
		fl,
	}
}

const asPack = (kept: Kept): RawPack | null =>
	kept.c ? { c: kept.c, n: kept.n, fl: kept.fl } : null

/** The pack of a title, or null when the title has no fingerprint. */
export const relatedMapPack = async (
	type: MediaType,
	id: number,
): Promise<RawPack | null> =>
	asPack(
		await cached({
			name: "related-map-pack-v1",
			target: buildPack,
			params: { type, id },
			ttlMinutes: 60 * 24,
		}),
	)

async function buildPage(params: {
	type: MediaType
	id: number
	f: string
	d: number
}): Promise<RawPage> {
	const [limit, offset] = pageWindow(params.d)
	const hits = await around(
		titleKey(params.type, params.id),
		tokensOf(params.f),
		limit,
		offset,
	)
	return {
		n: packTitles(packKey({ media_type: params.type, tmdb_id: params.id }), [
			hits,
		]),
		fl: { [params.f]: floorOf(hits, limit) },
	}
}

/**
 * A further page of a title's neighborhood under a filter (`filter` is empty for the plain order). Null when the
 * filter is not one the chips can make, or the page is out of range.
 */
export async function relatedMapPage(
	type: MediaType,
	id: number,
	filter: string,
	page: number,
): Promise<RawPage | null> {
	const f = filterName(filter)
	if (f === null || !Number.isInteger(page) || page < 0 || page > MAX_PAGE)
		return null
	return cached({
		name: "related-map-page-v1",
		target: buildPage,
		params: { type, id, f, d: page },
		ttlMinutes: 60 * 24,
	})
}

// --- The section --------------------------------------------------------------------------------------------------

let script: string | null | undefined
/**
 * The address of the map's script among the client build's files, or null on a server without it (the development
 * server, where the section starts the engine from a lazy chunk). The build writes the script with a hashed name and
 * its address into a file next to the server bundle (vite.config.js).
 */
function relatedMapScript(): string | null {
	if (script === undefined) {
		script = null
		const file = separateEntryUrl("related-map.assets.json", import.meta.url)
		try {
			if (existsSync(file))
				script = (JSON.parse(readFileSync(file, "utf8")) as { script: string })
					.script
			else if (process.env.NODE_ENV === "production")
				console.error(
					`Missing ${fileURLToPath(file)}; the related map starts after hydration`,
				)
		} catch (error) {
			console.error("Related map: no script address", error)
		}
	}
	return script
}

/**
 * The section's markup of the documents that are being rendered, by title. A document's loader data doesn't carry
 * the markup (it would be in the document twice): the section reads it from here while the server renders
 * (ui/related-map/RelatedMap.tsx), and the browser keeps what the document holds.
 */
const DOCUMENT_MARKUP_MAX = 256
type WithMarkup = typeof globalThis & {
	__gwRelatedMapMarkup?: Map<string, string>
}
function keepForDocument(key: string, html: string) {
	const all = globalThis as WithMarkup
	all.__gwRelatedMapMarkup ??= new Map()
	const kept = all.__gwRelatedMapMarkup
	kept.delete(key)
	kept.set(key, html)
	// Maps iterate in insertion order: the oldest goes first.
	if (kept.size > DOCUMENT_MARKUP_MAX)
		kept.delete(kept.keys().next().value as string)
}

const outcomes = counter(
	"goodwatch_related_map_total",
	"Related map outcomes of title page renders",
	["source", "result"],
)

/**
 * What a title page's loader has for the related map:
 * - a pack: the page draws the map.
 * - "none": the title has no fingerprint. The page is complete without the map.
 * - "late": the lookup ran out of its budget or failed. The page is incomplete (see incomplete-page.ts).
 * - "off": the setting says so.
 */
export type RelatedMapLookup = RawPack | "none" | "late" | "off"

/** A timed-out lookup keeps filling its data cache; only the document stops waiting. */
export async function relatedMapLookup(params: {
	type: MediaType
	id: number
	/** How long the document waits for the lookup. */
	budgetMs: number
}): Promise<RelatedMapLookup> {
	if (!relatedMapEnabled()) return "off"
	let timer: ReturnType<typeof setTimeout> | undefined
	const pending = (
		Number.isSafeInteger(params.id)
			? nearestOf(params.type, params.id)
			: Promise.reject(new Error("not a title id"))
	)
		.then((kept) => asPack(kept) ?? ("none" as const))
		.catch((error: unknown) => {
			console.error("Related map lookup failed", {
				...params,
				error: error instanceof Error ? error.message : error,
			})
			return "error" as const
		})
	try {
		const result = await Promise.race([
			pending,
			new Promise<"budget">((done) => {
				// A timer that fires late, after a long render of another request, runs before the answers that
				// arrived in the meantime. setImmediate lets those answers win.
				timer = setTimeout(
					() => setImmediate(() => done("budget")),
					params.budgetMs,
				)
			}),
		])
		outcomes.inc([
			params.type,
			typeof result === "string" ? result : "map",
		])
		return result === "budget" || result === "error" ? "late" : result
	} finally {
		clearTimeout(timer)
	}
}

/** What the title route's loader hands to the section. */
export interface RelatedMapData {
	/** The address of the map's script, a path among the build's files. Without it the section loads a lazy chunk. */
	script: string | null
	/**
	 * The section's inner markup: the picture of the page's title, drawn by the engine, and the plain title links.
	 * Only in the data of a navigation inside the app. A document holds the markup itself.
	 */
	html?: string
}

/**
 * The section of a title page from its pack, or undefined when the page shows the related titles carousel.
 * `document`: the answer is rendered into a document now, and not sent to a browser as loader data.
 */
export function relatedMapData(
	lookup: RelatedMapLookup,
	title: string,
	document: boolean,
): RelatedMapData | undefined {
	if (typeof lookup === "string") return undefined
	const html = relatedMap(null).section({
		root: lookup.c[0],
		title,
		pack: lookup,
		links: packLinks(lookup),
	})
	if (document) keepForDocument(lookup.c[0], html)
	return { script: relatedMapScript(), ...(!document && { html }) }
}

// --- The title page's loader --------------------------------------------------------------------------------------

/**
 * The related titles of a title page, asked for while its details load: the map's pack, or with the map off the
 * first panel of the related titles carousel as dehydrated query state. With the map on the carousel only stands in
 * for a missing map, and then asks for its panel from the browser.
 */
export async function prefetchRelatedSection(params: {
	tmdbId: number
	sourceMediaType: MediaType
	/** How long the document waits for the lookup. */
	budgetMs: number
}) {
	if (!relatedMapEnabled())
		return {
			lookup: "off" as const,
			panelState: await prefetchRelatedTitlesState(params),
		}
	return {
		lookup: await relatedMapLookup({
			type: params.sourceMediaType,
			id: params.tmdbId,
			budgetMs: params.budgetMs,
		}),
		panelState: null,
	}
}

/**
 * What the loader answers with for the related titles: the map's section, or the carousel's panel, and whether the
 * page has everything a complete document holds (see incomplete-page.ts).
 */
export function relatedSectionData(
	section: Awaited<ReturnType<typeof prefetchRelatedSection>>,
	title: string,
	request: Request,
) {
	const relatedMap = relatedMapData(
		section.lookup,
		title,
		isDocumentRequest(request),
	)
	return {
		relatedMap,
		panelState: section.panelState,
		complete: section.panelState
			? relatedPanelEmbedded(section.panelState)
			: section.lookup !== "late",
	}
}

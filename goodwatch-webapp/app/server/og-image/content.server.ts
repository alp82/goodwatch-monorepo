// Maps a page path to what its Open Graph card shows. Image fields hold remote URLs here;
// the renderer inlines them.
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import {
	type CombinationType,
	type DiscoverParams,
	type StreamingPreset,
	type WatchedType,
	getDiscoverResults,
} from "~/server/discover.server"
import { getPersonProfile } from "~/server/person.server"
import {
	type NavType,
	type PageData,
	defaultDiscoverParams,
	navLabel,
} from "~/ui/explore/config"
import { mainHierarchy, mainNavigation } from "~/ui/explore/main-nav"
import type { OgContent } from "~/ui/og-image/OgCard"
import {
	DEPARTMENT_LABELS,
	HOME_COPY,
	MEDIA_LABELS,
	STATIC_PAGE_COPY,
	categoryIndexCopy,
	collectionCopy,
	personTag,
	seasonsLabel,
	typeIndexCopy,
} from "~/ui/og-image/copy"
import { canonicalTitleId } from "~/utils/title-identity"

type Category = keyof typeof mainHierarchy

const TMDB_IMAGES = "https://image.tmdb.org/t/p"
const tmdbImage = (size: string, path?: string | null) =>
	path
		? `${TMDB_IMAGES}/${size}${path.startsWith("/") ? "" : "/"}${path}`
		: null
// Some pages use local .webp backdrops, which satori can't decode.
const tmdbBackdrop = (path?: string | null) =>
	path?.startsWith("/images/") ? null : tmdbImage("w1280", path)
const hasKey = (object: object, key: string) =>
	Object.prototype.hasOwnProperty.call(object, key)
const stripEmoji = (text: string) =>
	text.replace(/\p{Extended_Pictographic}/gu, "").trim()
const TITLE_MAX_LENGTH = 80
const clip = (text: string) =>
	text.length <= TITLE_MAX_LENGTH
		? text
		: `${text.slice(0, TITLE_MAX_LENGTH - 1).trim()}…`

const positiveId = (segment: string | undefined) => {
	const id = Number(segment?.split("-")[0])
	return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Turns any page path into the canonical path its card is cached under, such as
 * "/movie/27205" for "/movie/27205-inception". Returns null for paths that can't have a card.
 * Unknown static paths share the home card.
 */
export function canonicalOgPath(path: string): string | null {
	const segments = path.split("/").filter(Boolean)
	const [first, second, third] = segments

	if (first === "movie" || first === "show" || first === "tv") {
		const id = positiveId(second)
		if (!id || segments.length > 2) return null
		return first === "movie"
			? `/movie/${canonicalTitleId("movie", id)}`
			: `/show/${id}`
	}
	if (first === "person") {
		const id = positiveId(second)
		if (!id || segments.length > 2) return null
		return `/person/${id}`
	}
	if (first === "movies" || first === "shows") {
		if (segments.length === 1) return `/${first}`
		if (!hasKey(mainHierarchy, second) || segments.length > 3) return null
		if (third && !hasKey(mainHierarchy[second as Category], third)) return null
		return `/${segments.join("/")}`
	}
	if (first === "discover") return "/discover"

	const clean = `/${segments.join("/")}`
	return hasKey(STATIC_PAGE_COPY, clean) ? clean : "/"
}

// The same defaults the discover pages use for a visitor without settings. Unset filters are
// empty strings there too, even where the type doesn't allow it.
const DISCOVER_DEFAULTS: DiscoverParams = {
	type: "all",
	country: "",
	language: "en",
	watchedType: "" as WatchedType,
	minAgeRating: "",
	maxAgeRating: "",
	minYear: "",
	maxYear: "",
	minScore: "",
	maxScore: "",
	withCast: "",
	withCastCombinationType: "" as CombinationType,
	withoutCast: "",
	withCrew: "",
	withCrewCombinationType: "" as CombinationType,
	withoutCrew: "",
	withGenres: "",
	withoutGenres: "",
	withKeywords: "",
	withoutKeywords: "",
	streamingPreset: "" as StreamingPreset,
	withStreamingProviders: "",
	withStreamingTypes: "free,flatrate",
	similarTitles: "",
	fingerprintPillars: "",
	fingerprintPillarMinTier: "",
	fingerprintConditions: "",
	suitabilityFilters: "",
	contextFilters: "",
	sortBy: "popularity",
	sortDirection: "desc",
	page: 1,
}

async function discoverBackdrops(
	params: Partial<DiscoverParams>,
	size = "w780",
) {
	const results = await getDiscoverResults({
		...DISCOVER_DEFAULTS,
		...defaultDiscoverParams,
		...params,
	})
	return results.map((r) => tmdbImage(size, r.backdrop_path))
}

// Rotates a list by a hash of the page path, so pages that share the same results
// still lead with different titles.
const rotateByPath = <T>(items: T[], path: string) => {
	const n = Math.min(items.length, 8)
	if (!n) return items
	const k = [...path].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % n
	return [...items.slice(k), ...items.slice(0, k)]
}

// The details loaders throw a 404 Response for unknown titles; any other error is an outage.
async function loadDetails(type: "movie" | "show", id: number) {
	try {
		return type === "movie"
			? await getDetailsForMovie({
					movieId: String(id),
					country: "US",
					language: "en",
				})
			: await getDetailsForShow({
					showId: String(id),
					country: "US",
					language: "en",
				})
	} catch (error) {
		if (error instanceof Response && error.status === 404) return null
		throw error
	}
}

async function titleContent(
	type: "movie" | "show",
	id: number,
): Promise<OgContent | null> {
	const media = await loadDetails(type, id)
	if (!media) return null
	const d = media.details
	const runtime =
		d.media_type === "movie"
			? d.runtime
				? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`
				: ""
			: d.number_of_seasons
				? seasonsLabel(d.number_of_seasons)
				: ""
	const score = d.goodwatch_overall_score_normalized_percent
	return {
		kind: "title",
		tag: [MEDIA_LABELS[type], d.release_year, runtime]
			.filter(Boolean)
			.join(" · "),
		title: clip(d.title),
		score:
			typeof score === "number" && score >= 0 && score <= 100 ? score : null,
		poster: tmdbImage("w500", d.poster_path),
	}
}

async function personContent(id: number): Promise<OgContent | null> {
	const person = await getPersonProfile(id)
	if (!person) return null
	const department =
		DEPARTMENT_LABELS[person.known_for_department] ??
		person.known_for_department
	return {
		kind: "person",
		tag: personTag(department, person.stats.titles),
		name: clip(person.name),
		photo: tmdbImage("h632", person.profile_path),
	}
}

async function browseContent(path: string): Promise<OgContent | null> {
	const [type, category, pageKey] = path.split("/").filter(Boolean) as [
		NavType,
		Category?,
		string?,
	]
	const typeLabel = navLabel[type]
	const discoverType = type === "shows" ? "show" : "movie"

	if (!category) {
		const backdrops = await discoverBackdrops({
			type: discoverType,
			minScore: "75",
		})
		return {
			kind: "page",
			...typeIndexCopy(typeLabel),
			backdrop: rotateByPath(backdrops, path)[0] ?? null,
		}
	}

	const main = mainNavigation[category]
	const pages: Record<string, PageData> = mainHierarchy[category]
	if (pageKey) {
		const page = hasKey(pages, pageKey) ? pages[pageKey] : undefined
		if (!page) return null
		const backdrop =
			tmdbBackdrop(page.backdrop_path) ??
			rotateByPath(
				await discoverBackdrops(
					{ type: discoverType, ...page.discoverParams },
					"w1280",
				),
				path,
			)[0] ??
			null
		return {
			kind: "collection",
			...collectionCopy(typeLabel, main.label, stripEmoji(page.label)),
			subtitle: page.subtitle,
			backdrop,
			providerId:
				category === "streaming"
					? page.discoverParams.withStreamingProviders || null
					: null,
		}
	}

	const first = Object.values(pages).find(
		(p) => p.type === "all" || p.type === type,
	)
	const backdrop =
		tmdbBackdrop(first?.backdrop_path) ??
		(
			await discoverBackdrops(
				{ type: discoverType, ...first?.discoverParams },
				"w1280",
			)
		)[0] ??
		null
	return {
		kind: "collection",
		...categoryIndexCopy(typeLabel, main.label),
		subtitle: main.subtitle,
		backdrop,
		providerId: null,
	}
}

async function staticPageContent(path: string): Promise<OgContent> {
	const page = STATIC_PAGE_COPY[path] ?? HOME_COPY
	const backdrops = await discoverBackdrops({ type: "movie", minScore: "80" })
	// Taste pages skip the rotation, so they lead with a different title than the other main pages.
	const backdrop = path.startsWith("/taste")
		? backdrops[2]
		: rotateByPath(backdrops, path)[0]
	return { kind: "page", ...page, backdrop: backdrop ?? null }
}

/**
 * What the card for a canonical path (see canonicalOgPath) shows, or null when the page has
 * no data. Throws when the data can't be loaded.
 */
export async function resolveOgContent(
	path: string,
): Promise<OgContent | null> {
	const [first, second] = path.split("/").filter(Boolean)
	if (first === "movie" || first === "show")
		return titleContent(first, Number(second))
	if (first === "person") return personContent(Number(second))
	if (first === "movies" || first === "shows") return browseContent(path)
	return staticPageContent(path)
}

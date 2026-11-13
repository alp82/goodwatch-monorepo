// What the cards of a title's sub-pages show (TitleSubPageCards.tsx), from the same reads as the pages: the title's
// details for the fingerprint and at a glance, its tropes for the tropes card. A sub-page that answers 404 (no
// fingerprint, no tropes) has no card: its builder returns null too. Posters are TMDB URLs here; og-image.server.tsx
// inlines them.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	dollars,
	genresOf,
	languages,
	madeIn,
	minutesWords,
	released,
} from "~/ui/details/at-a-glance/facts"
import { readTitle } from "~/ui/details/fingerprint-section/reading"
import { ageRating, fingerprintInput } from "~/ui/details/title-words"
import type { AllTropesResponse } from "~/ui/details/tropes/tropes-data"
import type {
	OgTitleFingerprintContent,
	OgTitleGlanceContent,
	OgTitleTropesContent,
} from "~/ui/og-image/TitleSubPageCards"
import {
	TITLE_SUB_PAGE_CARD_COPY as COPY,
	MEDIA_LABELS,
} from "~/ui/og-image/copy"
import { languageName, regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"

type Media = MovieResult | ShowResult

export type TitleSubPage = "fingerprint" | "tropes" | "at-a-glance"
export const TITLE_SUB_PAGES: readonly TitleSubPage[] = [
	"fingerprint",
	"tropes",
	"at-a-glance",
]

const poster = (media: Media) =>
	media.details.poster_path
		? tmdbImageUrl(media.details.poster_path, "w500")
		: null

/** The fingerprint card: the strongest feelings the title page names, at most four. Null without a fingerprint. */
export function fingerprintCardContent(
	media: Media,
): OgTitleFingerprintContent | null {
	const input = fingerprintInput(media)
	if (!input) return null
	const reading = readTitle(input)
	return {
		kind: "title-fingerprint",
		tag: [
			COPY.fingerprintTag,
			MEDIA_LABELS[media.mediaType],
			media.details.release_year,
		]
			.filter(Boolean)
			.join(" · "),
		title: media.details.title,
		poster: poster(media),
		lines: reading.rows.slice(0, 4).map((row) => ({
			text: row.r.effect.name,
			color: row.color,
			size: row.k,
		})),
	}
}

// A name longer than this would crowd the cloud: only the signature tropes may be longer (the card clips them).
const MAX_NAME = 26
const CLOUD_NAMES = 10

/**
 * The tropes card: the signature tropes in their order, then the rarest of the rest (fewest titles in the catalog
 * carry them), up to ten. Null for a title without tropes.
 */
export function tropesCardContent(
	media: Media,
	all: AllTropesResponse,
): OgTitleTropesContent | null {
	if (!all.total) return null
	const byId = new Map(all.tropes.map((t) => [t.id, t]))
	const signature = all.signature.flatMap((id) => {
		const t = byId.get(id)
		return t ? [t] : []
	})
	const taken = new Set(signature.map((t) => t.id))
	const rest = all.tropes
		.filter((t) => !taken.has(t.id) && t.name.length <= MAX_NAME)
		.sort(
			(a, b) =>
				(a.titles ?? Number.POSITIVE_INFINITY) -
				(b.titles ?? Number.POSITIVE_INFINITY),
		)
	return {
		kind: "title-tropes",
		title: media.details.title,
		poster: poster(media),
		total: all.total,
		tropes: [...signature, ...rest].slice(0, CLOUD_NAMES).map((t) => t.name),
	}
}

const TILES = 6

/**
 * The at a glance card's tiles, in this order, each only where its data is: released (a show: first aired), runtime
 * (a show: seasons, then episodes), the US age rating, where it's made, its language, the box office, its genres.
 */
export function glanceCardContent(media: Media): OgTitleGlanceContent {
	const d = media.details as Media["details"] & {
		runtime?: number | null
		number_of_seasons?: number
		number_of_episodes?: number
		revenue?: number | null
	}
	const t = COPY.tiles
	const rel = released(media)
	const lang = languages(media)
	const country = madeIn(media)[0]
	const rated = ageRating(media, "US")
	const genres = genresOf(media)
	const tiles: ({ label: string; value: string } | null)[] = [
		rel && {
			label: media.mediaType === "movie" ? t.released : t.firstAired,
			value: String(rel.year),
		},
		media.mediaType === "movie" && d.runtime
			? { label: t.runtime, value: minutesWords(d.runtime) }
			: null,
		media.mediaType === "show" && d.number_of_seasons
			? { label: t.seasons, value: String(d.number_of_seasons) }
			: null,
		media.mediaType === "show" && d.number_of_episodes
			? { label: t.episodes, value: String(d.number_of_episodes) }
			: null,
		rated ? { label: t.rated, value: rated } : null,
		country ? { label: t.madeIn, value: regionName(country) } : null,
		lang ? { label: t.language, value: languageName(lang.original) } : null,
		d.revenue && d.revenue > 0
			? { label: t.boxOffice, value: dollars(d.revenue) }
			: null,
		genres.length ? { label: t.genres, value: genres[0] } : null,
	]
	return {
		kind: "title-glance",
		title: media.details.title,
		poster: poster(media),
		tiles: tiles
			.filter((tile): tile is { label: string; value: string } => !!tile?.value)
			.slice(0, TILES),
	}
}

export interface TitleSubPageDeps {
	details: (type: "movie" | "show", id: number) => Promise<Media | null>
	tropes: (type: "movie" | "show", id: number) => Promise<AllTropesResponse>
}

/** The card of a title's sub-page, or null when the title or the sub-page has none. Read errors propagate. */
export async function titleSubPageContent(
	type: "movie" | "show",
	id: number,
	page: TitleSubPage,
	deps: TitleSubPageDeps,
) {
	const [media, tropes] = await Promise.all([
		deps.details(type, id),
		page === "tropes" ? deps.tropes(type, id) : null,
	])
	if (!media) return null
	if (page === "fingerprint") return fingerprintCardContent(media)
	if (page === "tropes") return tropes && tropesCardContent(media, tropes)
	return glanceCardContent(media)
}

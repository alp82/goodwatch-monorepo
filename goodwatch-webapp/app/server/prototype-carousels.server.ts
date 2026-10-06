// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// The switch of the prototype. It is off unless the server runs with PROTO_CAROUSELS=1, so a stray merge ships
// nothing. With it on, `?proto=today|rows|list|explore` on a title page picks a variant and sets a cookie, so the
// choice survives navigation between titles. `?proto=off` clears it. A page rendered with a variant is `no-store`:
// the page cache never keeps it. The cookie isn't part of the page cache key, so run the prototype with
// PAGE_CACHE=off (a stored plain page would otherwise answer a visitor who holds the cookie).
import { MOODS } from "~/server/explorer/islands.server"
import { MISSING_SCORE } from "~/server/title-snapshot/format.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	DISTINCT_FINGERPRINT_KEYS,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
import type { QdrantMediaPayload } from "~/server/utils/recommend"
import {
	CAROUSEL_PROTOTYPE_COOKIE,
	type CarouselPrototypeData,
	isCarouselVariant,
} from "~/ui/prototype-carousels/variant"
import { MEDIA_COLLECTION, scroll } from "~/utils/qdrant"
import type { RelatedCard, RelatedPanel } from "~/utils/related-panel"
import { titleKey } from "~/utils/title-key"

const DISTINCT = new Set<string>(DISTINCT_FINGERPRINT_KEYS)
const SHARED_FROM = 7
const REASONS_PER_TITLE = 3

type Scores = (key: string) => number | undefined

/**
 * The fingerprints of the related titles. From the title snapshot in memory when the server has one (production):
 * no query. A server without a snapshot (the development machine can't load it) reads them from Qdrant in one
 * request, the way related.server.ts reads the source title's score without a snapshot. Not cached: prototype only.
 */
async function fingerprintsOf(keys: number[]): Promise<Map<number, Scores>> {
	const found = new Map<number, Scores>()
	const snapshot = getTitleSnapshot()
	if (snapshot) {
		const index = new Map<string, number>(
			VALID_FINGERPRINT_KEYS.map((key, i) => [key, i]),
		)
		for (const key of keys) {
			const scores = snapshot.fingerprint(key)
			if (!scores) continue
			found.set(key, (attribute) => {
				const value = scores[index.get(attribute) ?? -1]
				return value === undefined || value === MISSING_SCORE
					? undefined
					: value
			})
		}
		return found
	}
	if (!keys.length) return found
	try {
		const points = await scroll<
			Pick<QdrantMediaPayload, "fingerprint_scores_v1">
		>({
			collectionName: MEDIA_COLLECTION,
			filter: { must: [{ has_id: keys }] },
			limit: keys.length,
			withPayload: { include: ["fingerprint_scores_v1"] },
			withVector: false,
		})
		for (const point of points) {
			const scores = point.payload?.fingerprint_scores_v1
			if (scores) found.set(Number(point.id), (attribute) => scores[attribute])
		}
	} catch (error) {
		console.error("Carousel prototype: reasons lookup failed", error)
	}
	return found
}

/**
 * The attributes a related title shares most strongly with the source: both score 7 or more, the source's own
 * highlight attributes first. Real data, prototype ranking.
 */
function sharedAttributes(
	source: Scores,
	highlights: Set<string>,
	other: Scores | undefined,
): string[] {
	if (!other) return []
	const shared: { key: string; weight: number }[] = []
	for (const key of DISTINCT) {
		const a = source(key)
		const b = other(key)
		if (a === undefined || b === undefined) continue
		if (a < SHARED_FROM || b < SHARED_FROM) continue
		shared.push({
			key,
			weight: Math.min(a, b) + (highlights.has(key) ? 1.5 : 0),
		})
	}
	return shared
		.sort((x, y) => y.weight - x.weight)
		.slice(0, REASONS_PER_TITLE)
		.map((entry) => entry.key)
}

/** The Explorer's mood island this title fits best, by the Explorer's own rules. */
function moodIslandOf(media: MovieResult | ShowResult) {
	const scores = media.fingerprint?.scores
	if (!scores) return null
	const genres = (media.details.genres ?? []) as unknown as string[]
	let best: { id: string; name: string; color: string } | null = null
	let bestMargin = Number.NEGATIVE_INFINITY
	for (const island of MOODS) {
		const level = island.level((key) => scores[key] ?? 0, genres)
		const margin = level - island.from
		if (margin >= 0 && margin > bestMargin) {
			bestMargin = margin
			best = { id: island.id, name: island.name, color: island.color }
		}
	}
	return best
}

const cookieOf = (request: Request) =>
	new RegExp(`(?:^|;\\s*)${CAROUSEL_PROTOTYPE_COOKIE}=([a-z]+)`).exec(
		request.headers.get("Cookie") ?? "",
	)?.[1]

/**
 * What a title page's loader adds while the prototype is on for the request: the variant with what it shows, and the
 * response headers. Null means today's page, untouched. Null data with headers turns the prototype off.
 */
export async function carouselPrototype(
	request: Request,
	media: MovieResult | ShowResult,
	relatedState: { queries: readonly unknown[] },
): Promise<{
	data: CarouselPrototypeData | null
	headers: Record<string, string>
} | null> {
	if (process.env.PROTO_CAROUSELS !== "1") return null
	const asked = new URL(request.url).searchParams.get("proto")
	const headers: Record<string, string> = { "Cache-Control": "no-store" }
	if (asked === "off")
		return {
			data: null,
			headers: {
				...headers,
				"Set-Cookie": `${CAROUSEL_PROTOTYPE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
			},
		}
	const variant = asked ?? cookieOf(request)
	if (!isCarouselVariant(variant)) return null
	if (asked)
		headers["Set-Cookie"] =
			`${CAROUSEL_PROTOTYPE_COOKIE}=${variant}; Path=/; Max-Age=604800; SameSite=Lax`

	const data: CarouselPrototypeData = { variant, reasons: {}, island: null }
	if (variant === "explore") data.island = moodIslandOf(media)
	if (variant === "list") {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		if (panel && scores) {
			const groups = [
				["movie", panel.movies],
				["show", panel.shows],
			] as const
			const fingerprints = await fingerprintsOf(
				groups.flatMap(([mediaType, cards]) =>
					cards.map((card) => titleKey(mediaType, card.tmdb_id)),
				),
			)
			const highlights = new Set(media.fingerprint?.highlightKeys ?? [])
			for (const [mediaType, cards] of groups)
				for (const card of cards) {
					const keys = sharedAttributes(
						(key) => scores[key],
						highlights,
						fingerprints.get(titleKey(mediaType, card.tmdb_id)),
					)
					if (keys.length) data.reasons[`${mediaType}-${card.tmdb_id}`] = keys
				}
		}
	}
	return { data, headers }
}

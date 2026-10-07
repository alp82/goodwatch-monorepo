// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// The switch of the prototype. It is off unless the server runs with PROTO_CAROUSELS=1, so a stray merge ships
// nothing. With it on, `?proto=today|rows|list|explore|explore1..5|walk1..5|dive1..5|ring1..9|sea1..6` on a title page picks a variant and sets a cookie, so the
// choice survives navigation between titles. `?proto=off` clears it. A page rendered with a variant is `no-store`:
// the page cache never keeps it. The cookie isn't part of the page cache key, so run the prototype with
// PAGE_CACHE=off (a stored plain page would otherwise answer a visitor who holds the cookie).
import { MOODS } from "~/server/explorer/islands.server"
import { diveSectionHtml } from "~/server/prototype-dive-view.server"
import { diveModel } from "~/server/prototype-dive.server"
import { ringSectionHtml } from "~/server/prototype-ring-view.server"
import { ringModel } from "~/server/prototype-ring.server"
import { seaSectionHtml } from "~/server/prototype-sea-view.server"
import { walkSectionHtml } from "~/server/prototype-walk.server"
import { getRelatedPanel } from "~/server/related.server"
import { MISSING_SCORE } from "~/server/title-snapshot/format.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	DISTINCT_FINGERPRINT_KEYS,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
import type { QdrantMediaPayload } from "~/server/utils/recommend"
import {
	type DiveModel,
	type DiveVariant,
	isDiveVariant,
} from "~/ui/prototype-carousels/dive-model"
import {
	type ExploreModel,
	type ExploreVariant,
	type PxType,
	buildExploreModel,
	isExploreVariant,
} from "~/ui/prototype-carousels/explore-model"
import {
	type RingModel,
	type RingShape,
	isRingVariant,
	isSeaVariant,
} from "~/ui/prototype-carousels/ring-model"
import {
	CAROUSEL_PROTOTYPE_COOKIE,
	type CarouselPrototypeData,
	isCarouselVariant,
} from "~/ui/prototype-carousels/variant"
import {
	type WalkModel,
	type WalkVariant,
	buildWalkModel,
	isWalkVariant,
} from "~/ui/prototype-carousels/walk-model"
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
export async function fingerprintsOf(
	keys: number[],
): Promise<Map<number, Scores>> {
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

/**
 * What an explore variant shows around a title: its related titles with reasons. Without `scores` (a step onto
 * another title in the browser) the center's fingerprint is read together with its neighbors'.
 */
export async function exploreModel(input: {
	variant: ExploreVariant
	type: PxType
	tmdbId?: number
	panel: RelatedPanel
	scores?: Scores
	highlightKeys?: string[]
}): Promise<ExploreModel | undefined> {
	const keys = [
		...input.panel.movies.map((card) => titleKey("movie", card.tmdb_id)),
		...input.panel.shows.map((card) => titleKey("show", card.tmdb_id)),
	]
	const centerKey =
		input.tmdbId === undefined ? undefined : titleKey(input.type, input.tmdbId)
	const fingerprints = await fingerprintsOf(
		input.scores || centerKey === undefined ? keys : [centerKey, ...keys],
	)
	const scores =
		input.scores ??
		(centerKey === undefined ? undefined : fingerprints.get(centerKey))
	if (!scores) return undefined
	// A title stepped onto has no highlight attributes at hand: its highest scores stand in.
	const highlightKeys =
		input.highlightKeys ??
		[...DISTINCT]
			.sort((a, b) => (scores(b) ?? 0) - (scores(a) ?? 0))
			.slice(0, 5)
	return buildExploreModel({
		variant: input.variant,
		type: input.type,
		scores,
		highlightKeys,
		movies: input.panel.movies,
		shows: input.panel.shows,
		fingerprint: (type, id) => fingerprints.get(titleKey(type, id)),
	})
}

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value

/**
 * What a walk variant shows around a title. The page passes the title it already has; a step in the browser
 * passes only the id, and the title's name, poster, and scores are read from Qdrant with one more point.
 */
export async function walkModel(input: {
	variant: WalkVariant
	type: PxType
	tmdbId: number
	panel: RelatedPanel
	center?: {
		title: string
		year: string
		poster: string
		score: number
		scores: Record<string, number>
	}
}): Promise<WalkModel | undefined> {
	const keys = [
		...input.panel.movies.map((card) => titleKey("movie", card.tmdb_id)),
		...input.panel.shows.map((card) => titleKey("show", card.tmdb_id)),
	]
	let center = input.center
	const [fingerprints] = await Promise.all([
		fingerprintsOf(keys),
		center
			? undefined
			: scroll<QdrantMediaPayload>({
					collectionName: MEDIA_COLLECTION,
					filter: { must: [{ has_id: [titleKey(input.type, input.tmdbId)] }] },
					limit: 1,
					withPayload: {
						include: [
							"title",
							"poster_path",
							"release_year",
							"goodwatch_overall_score_normalized_percent",
							"fingerprint_scores_v1",
						],
					},
					withVector: false,
				})
					.then(([point]) => {
						const payload = point?.payload
						if (!payload?.fingerprint_scores_v1) return
						center = {
							title: first(payload.title) ?? "",
							year: String(payload.release_year ?? ""),
							poster: first(payload.poster_path) ?? "",
							score: Math.round(
								payload.goodwatch_overall_score_normalized_percent ?? 0,
							),
							scores: payload.fingerprint_scores_v1,
						}
					})
					.catch((error) =>
						console.error("Carousel prototype: center lookup failed", error),
					),
	])
	if (!center) return undefined
	const { scores, ...card } = center
	return buildWalkModel({
		variant: input.variant,
		center: { type: input.type, id: input.tmdbId, ...card },
		scores: (key) => scores[key],
		movies: input.panel.movies,
		shows: input.panel.shows,
		fingerprint: (type, id) => fingerprints.get(titleKey(type, id)),
		year: new Date().getFullYear(),
	})
}

/** The text links of a dive section: the related titles of the overall panel, the page's type first. */
export function diveLinks(
	type: PxType,
	panel: RelatedPanel,
): DiveModel["links"] {
	const year = new Date().getFullYear()
	const of = (listType: PxType, cards: RelatedCard[]) =>
		cards
			.filter(
				(card) =>
					card.poster_path &&
					Number(card.release_year) > 0 &&
					Number(card.release_year) <= year,
			)
			.map((card) => ({
				type: listType,
				id: card.tmdb_id,
				title: card.title,
				year: card.release_year,
			}))
	const movies = of("movie", panel.movies)
	const shows = of("show", panel.shows)
	return type === "movie" ? [...movies, ...shows] : [...shows, ...movies]
}

/**
 * What a dive variant shows around a title. The page passes the title it already has and its related panel: the
 * walk's second axis is chosen from the panel's fingerprints, and the panel gives the text links. A step in the
 * browser passes the axis on. A request without one (the page's panel missed its time budget) chooses it here.
 */
export async function diveStage(input: {
	variant: DiveVariant
	type: PxType
	tmdbId: number
	axis?: string
	lock?: string | null
	from?: { type: PxType; id: number; via: string } | null
	panel?: RelatedPanel
	center?: {
		title: string
		year: string
		poster: string
		scores: Record<string, number>
	}
}): Promise<DiveModel | undefined> {
	const panel =
		input.panel ??
		(input.axis
			? undefined
			: await getRelatedPanel({
					tmdbId: input.tmdbId,
					sourceMediaType: input.type,
				}))
	const neighbors = panel
		? [
				...(
					await fingerprintsOf([
						...panel.movies.map((card) => titleKey("movie", card.tmdb_id)),
						...panel.shows.map((card) => titleKey("show", card.tmdb_id)),
					])
				).values(),
			]
		: undefined
	const center = input.center
	return diveModel({
		variant: input.variant,
		type: input.type,
		tmdbId: input.tmdbId,
		center: center
			? {
					title: {
						type: input.type,
						id: input.tmdbId,
						title: center.title,
						year: center.year,
						poster: center.poster,
						score: 0,
					},
					scores: (key) => center.scores[key],
				}
			: undefined,
		axis: input.axis,
		neighbors,
		lock: input.lock,
		from: input.from,
		links: panel ? diveLinks(input.type, panel) : undefined,
	})
}

/**
 * What a ring variant shows around a title (fifth round). The page passes the title it already has and its related
 * panel. A step in the browser passes the walk's axes and the page title's traits on, so nothing is chosen again:
 * the related panel of the title stepped onto is read only when the server has to choose (no axes yet, a preset, or
 * "surprise me").
 */
export async function ringStage(input: {
	variant: RingShape
	type: PxType
	tmdbId: number
	axes?: string[]
	traits?: string[]
	pick?: { preset?: string; slot?: number } | null
	lock?: string | null
	from?: { type: PxType; id: number; via: string } | null
	anchor?: { type: PxType; id: number; dir: string } | null
	more?: string | null
	panel?: RelatedPanel
	center?: {
		title: string
		year: string
		poster: string
		scores: Record<string, number>
	}
}): Promise<RingModel | undefined> {
	let loaded: Promise<RelatedPanel> | undefined
	const panelOf = () => {
		loaded ??= input.panel
			? Promise.resolve(input.panel)
			: getRelatedPanel({ tmdbId: input.tmdbId, sourceMediaType: input.type })
		return loaded
	}
	const center = input.center
	return ringModel({
		variant: input.variant,
		type: input.type,
		tmdbId: input.tmdbId,
		center: center
			? {
					title: {
						type: input.type,
						id: input.tmdbId,
						title: center.title,
						year: center.year,
						poster: center.poster,
						score: 0,
					},
					scores: (key) => center.scores[key],
				}
			: undefined,
		axes: input.axes,
		traits: input.traits,
		pick: input.pick,
		neighbors: async () => {
			const panel = await panelOf()
			return [
				...(
					await fingerprintsOf([
						...panel.movies.map((card) => titleKey("movie", card.tmdb_id)),
						...panel.shows.map((card) => titleKey("show", card.tmdb_id)),
					])
				).values(),
			]
		},
		lock: input.lock,
		from: input.from,
		anchor: input.anchor,
		more: input.more,
		links: input.panel ? diveLinks(input.type, input.panel) : undefined,
	})
}

const cookieOf = (request: Request) =>
	new RegExp(`(?:^|;\\s*)${CAROUSEL_PROTOTYPE_COOKIE}=([a-z0-9]+)`).exec(
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
	if (variant === "explore" || isExploreVariant(variant))
		data.island = moodIslandOf(media)
	if (isExploreVariant(variant)) {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		if (panel && scores)
			data.explore = await exploreModel({
				variant,
				type: media.mediaType,
				panel,
				scores: (key) => scores[key],
				highlightKeys: media.fingerprint?.highlightKeys ?? [],
			})
	}
	if (isWalkVariant(variant)) {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		const tmdbId = media.details.tmdb_id
		const model =
			panel && scores
				? await walkModel({
						variant,
						type: media.mediaType,
						tmdbId,
						panel,
						center: {
							title: media.details.title,
							year: String(media.details.release_year ?? ""),
							poster: media.details.poster_path,
							score: 0,
							scores,
						},
					})
				: undefined
		data.walk = {
			html: walkSectionHtml({
				variant,
				title: media.details.title,
				rootKey: `${media.mediaType}-${tmdbId}`,
				model,
			}),
		}
	}
	if (isDiveVariant(variant)) {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		const tmdbId = media.details.tmdb_id
		const model =
			panel && scores
				? await diveStage({
						variant,
						type: media.mediaType,
						tmdbId,
						panel,
						center: {
							title: media.details.title,
							year: String(media.details.release_year ?? ""),
							poster: media.details.poster_path,
							scores,
						},
					})
				: undefined
		data.dive = {
			html: diveSectionHtml({
				variant,
				title: media.details.title,
				rootKey: `${media.mediaType}-${tmdbId}`,
				model,
			}),
		}
	}
	if (isRingVariant(variant)) {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		const tmdbId = media.details.tmdb_id
		const model =
			panel && scores
				? await ringStage({
						variant,
						type: media.mediaType,
						tmdbId,
						panel,
						center: {
							title: media.details.title,
							year: String(media.details.release_year ?? ""),
							poster: media.details.poster_path,
							scores,
						},
					})
				: undefined
		data.ring = {
			html: ringSectionHtml({
				variant,
				title: media.details.title,
				rootKey: `${media.mediaType}-${tmdbId}`,
				model,
			}),
		}
	}
	if (isSeaVariant(variant)) {
		const panel = (
			relatedState.queries[0] as { state?: { data?: RelatedPanel } } | undefined
		)?.state?.data
		const scores = media.fingerprint?.scores as
			| Record<string, number>
			| undefined
		const tmdbId = media.details.tmdb_id
		const model =
			panel && scores
				? await ringStage({
						variant,
						type: media.mediaType,
						tmdbId,
						panel,
						center: {
							title: media.details.title,
							year: String(media.details.release_year ?? ""),
							poster: media.details.poster_path,
							scores,
						},
					})
				: undefined
		data.sea = {
			html: seaSectionHtml({
				variant,
				title: media.details.title,
				rootKey: `${media.mediaType}-${tmdbId}`,
				model,
			}),
		}
	}
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

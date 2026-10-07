// PROTOTYPE for "Prototype native-scroll carousels on title pages", fourth round. Throwaway code: not for production.
//
// Where the dive variants get their titles. The third round looked only at the 64 titles of the overall related
// panel, so a direction ended after one step. Here every direction of every center is its own Qdrant request, built
// like the request behind today's related tabs (related.server.ts: nearest fingerprints to the title, with a filter
// on fingerprint scores), with one change: the filter asks for titles that score higher (or lower) than the center
// on the direction's attributes, and not for titles within one point. So the nearest titles that really are darker
// come back, from the whole catalog of presentable titles with 10,000 votes, however far down the plain neighbor
// list they are.
//
// A request's answer is kept for a day under its own cache name with a prototype prefix.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	type QdrantMediaPayload,
	buildBaseFilterConditions,
} from "~/server/utils/recommend"
import {
	type Axis,
	type Candidate,
	type Direction,
	type DiveModel,
	type DiveVariant,
	axisOf,
	buildDiveModel,
	chooseSecondAxis,
	directionOf,
	directionsOf,
	farther,
	keyOf,
} from "~/ui/prototype-carousels/dive-model"
import type {
	PxTitle,
	PxType,
	Scores,
} from "~/ui/prototype-carousels/explore-model"
import { cached } from "~/utils/cache"
import { MEDIA_COLLECTION, recommend, scroll } from "~/utils/qdrant"
import { titleKey } from "~/utils/title-key"

const INDEX = new Map<string, number>(
	VALID_FINGERPRINT_KEYS.map((key, i) => [key, i]),
)
const toScores =
	(values: number[]): Scores =>
	(key) => {
		const value = values[INDEX.get(key) ?? -1]
		return value === undefined || value < 0 ? undefined : value
	}
const pack = (scores: Record<string, number>) =>
	VALID_FINGERPRINT_KEYS.map((key) => scores[key] ?? -1)

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value

/** A title as the cache keeps it: what a poster needs, its similarity, and its 74 scores. */
type Stored = {
	type: PxType
	id: number
	title: string
	year: string
	poster: string
	near: number
	scores: number[]
}

const CANDIDATES = 150

// Between two titles that are about as close, the one more people know wins: a run reads as true only to someone
// who knows its titles. Up to 0.03 of similarity, for a title with a million votes.
const knownBonus = (payload: QdrantMediaPayload) =>
	0.015 *
	Math.min(
		2,
		Math.log10(
			Math.max(1, (payload.goodwatch_overall_score_voting_count ?? 0) / 10000),
		),
	)

async function findCandidates(params: {
	type: PxType
	id: number
	direction: string
	/** The center's scores on the direction's attributes: part of the cache key, so new scores ask again. */
	at: Record<string, number>
}): Promise<Stored[]> {
	const axis = directionOf(params.direction)?.axis
	if (!axis) return []
	const up = params.direction.endsWith("+")
	const higher = up ? axis.plus : axis.minus
	const lower = up ? axis.minus : axis.plus
	const scoreKey = (key: string) => `fingerprint_scores_v1.${key}`
	const should = [
		...higher.map((key) => ({
			key: scoreKey(key),
			range: { gte: (params.at[key] ?? 0) + 1 },
		})),
		...lower
			.filter((key) => (params.at[key] ?? 0) >= 1)
			.map((key) => ({
				key: scoreKey(key),
				range: { lte: (params.at[key] ?? 0) - 1 },
			})),
	]
	if (!should.length) return []
	const { must, must_not } = buildBaseFilterConditions({
		mediaType: "all",
		minVotingCount: 10000,
		minScore: 60,
		additionalMust: [
			{ should },
			{ key: "release_year", range: { lte: new Date().getFullYear() } },
		],
	})
	const results = await recommend<QdrantMediaPayload>({
		collectionName: MEDIA_COLLECTION,
		positive: [titleKey(params.type, params.id)],
		using: "fingerprint_v1",
		filter: { must, must_not },
		limit: CANDIDATES,
		withPayload: {
			include: [
				"tmdb_id",
				"media_type",
				"title",
				"release_year",
				"poster_path",
				"goodwatch_overall_score_voting_count",
				"fingerprint_scores_v1",
			],
		},
		hnswEf: 64,
		exact: false,
	})
	const center = (key: string) => params.at[key]
	const direction = directionOf(params.direction)
	if (!direction) return []
	const stored: Stored[] = []
	for (const { payload, score } of results) {
		const scores = payload.fingerprint_scores_v1
		const poster = first(payload.poster_path)
		if (!scores || !poster) continue
		// Only the titles the word is true for are kept: the cache entry stays small.
		if (farther(direction, center, (key) => scores[key]) === null) continue
		stored.push({
			type: payload.media_type,
			id: payload.tmdb_id,
			title: first(payload.title) ?? "",
			year: String(payload.release_year ?? ""),
			poster,
			near: Math.round((score + knownBonus(payload)) * 1000) / 1000,
			scores: pack(scores),
		})
	}
	return stored
}

/** The titles that lie in a direction from a center, most similar first. */
export async function candidatesOf(
	type: PxType,
	id: number,
	scores: Scores,
	direction: Direction,
): Promise<Candidate[]> {
	const { axis } = direction
	const at = Object.fromEntries(
		[...axis.plus, ...axis.minus].map((key) => [key, scores(key) ?? 0]),
	)
	const stored = await cached({
		name: "proto363-dive-candidates-v2",
		metricName: "proto363-dive-candidates",
		target: findCandidates,
		params: { type, id, direction: direction.id, at },
		ttlMinutes: 60 * 24,
	}).catch((error) => {
		console.error("Carousel prototype: direction lookup failed", error)
		return [] as Stored[]
	})
	return stored.map(({ near, scores: values, ...title }) => ({
		title: { ...title, score: 0 },
		near,
		s: toScores(values),
	}))
}

export interface Known {
	title: PxTitle
	scores: Scores
}

/** Titles by key, with their scores: the center of a step, and the title the visitor came from. */
export async function titlesOf(
	keys: { type: PxType; id: number }[],
): Promise<Map<string, Known>> {
	const found = new Map<string, Known>()
	if (!keys.length) return found
	const points = await scroll<QdrantMediaPayload>({
		collectionName: MEDIA_COLLECTION,
		filter: {
			must: [{ has_id: keys.map((key) => titleKey(key.type, key.id)) }],
		},
		limit: keys.length,
		withPayload: {
			include: [
				"tmdb_id",
				"media_type",
				"title",
				"poster_path",
				"release_year",
				"fingerprint_scores_v1",
			],
		},
		withVector: false,
	}).catch((error) => {
		console.error("Carousel prototype: title lookup failed", error)
		return []
	})
	for (const { payload } of points) {
		const scores = payload?.fingerprint_scores_v1
		if (!scores) continue
		const title: PxTitle = {
			type: payload.media_type,
			id: payload.tmdb_id,
			title: first(payload.title) ?? "",
			year: String(payload.release_year ?? ""),
			poster: first(payload.poster_path) ?? "",
			score: 0,
		}
		found.set(keyOf(title), { title, scores: (key) => scores[key] })
	}
	return found
}

/** How many titles a direction shows at rest, as the one dived into, and next to the one dived into. */
export const DIVE_COUNTS: Record<
	DiveVariant,
	{ rest: number; dive: number; beside: number }
> = {
	dive1: { rest: 2, dive: 7, beside: 0 },
	dive2: { rest: 3, dive: 9, beside: 3 },
	dive3: { rest: 5, dive: 9, beside: 5 },
	dive4: { rest: 3, dive: 6, beside: 3 },
	dive5: { rest: 3, dive: 9, beside: 3 },
}

/**
 * What a dive variant shows around a title. The page passes the title it already has and the fingerprints of its
 * related titles, from which the walk's second axis is chosen. A step passes the axis it was given.
 */
export async function diveModel(input: {
	variant: DiveVariant
	type: PxType
	tmdbId: number
	center?: Known
	/** The walk's second axis, or the neighbors to choose it from. */
	axis?: string
	neighbors?: Scores[]
	lock?: string | null
	from?: { type: PxType; id: number; via: string } | null
	links?: DiveModel["links"]
}): Promise<DiveModel | undefined> {
	const centerKey = { type: input.type, id: input.tmdbId }
	const lookups = [
		...(input.center ? [] : [centerKey]),
		...(input.from ? [input.from] : []),
	]
	const known = await titlesOf(lookups)
	const center = input.center ?? known.get(keyOf(centerKey))
	if (!center) return undefined
	const second: Axis =
		(input.axis ? axisOf(input.axis) : undefined) ??
		chooseSecondAxis(center.scores, input.neighbors ?? [])
	const directions = directionsOf(second)
	const lock = directions.some((entry) => entry.id === input.lock)
		? (input.lock ?? null)
		: null
	const from = input.from ? known.get(keyOf(input.from)) : undefined
	const via = directions.find((entry) => entry.id === input.from?.via)
	const lists = await Promise.all(
		directions.map((direction) =>
			candidatesOf(input.type, input.tmdbId, center.scores, direction),
		),
	)
	// A step has no related panel at hand: its text links are the nearest titles of the four directions, in turn.
	const stepLinks: DiveModel["links"] = []
	if (!input.links) {
		const seen = new Set<string>()
		for (let i = 0; i < 8; i++)
			for (const list of lists) {
				const title = list[i]?.title
				if (!title || seen.has(keyOf(title))) continue
				seen.add(keyOf(title))
				stepLinks.push({
					type: title.type,
					id: title.id,
					title: title.title,
					year: title.year,
				})
			}
	}
	return buildDiveModel({
		variant: input.variant,
		center: center.title,
		scores: center.scores,
		second,
		candidates: Object.fromEntries(
			directions.map((direction, i) => [direction.id, lists[i]]),
		),
		...DIVE_COUNTS[input.variant],
		lock,
		from: from && via ? { title: from.title, via: via.id } : null,
		links: input.links ?? stepLinks,
	})
}

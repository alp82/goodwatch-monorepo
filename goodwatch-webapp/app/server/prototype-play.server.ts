// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The data path of the play forms. Earlier rounds asked the server for markup on every step (one request, six
// cached Qdrant lookups, a render), and the stage waited for it. Here the browser holds the data before the tap:
//
// - A pack is one title's neighborhood, small enough to prefetch: the title, and up to PACK_TITLES titles around it,
//   each with what a poster needs and its 74 fingerprint levels as one character each.
// - A pack is built from one plain nearest-neighbors request to Qdrant (180 titles with scores). The six filtered
//   requests per title of the dive path are gone: the plain neighbors of a title already hold titles that lie
//   further in most directions, and a direction that has none among them is a direction that ends.
// - Which titles go into the pack is chosen here with the dive model's own test (`farther`), so that every direction
//   of every fixed axis and the title's own strongest traits have titles to show, next to the plain nearest ones.
// - The engine (ui/prototype-carousels/play-engine.ts) does the rest in the browser: directions, ranks,
//   differences, filters. A step with the pack in memory makes no request.
//
// A pack is kept for a day under its own cache name with a prototype prefix.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	type QdrantMediaPayload,
	buildBaseFilterConditions,
} from "~/server/utils/recommend"
import {
	ALL_AXES,
	type Direction,
	MIN_NEAR,
	bandOf,
	directionOf,
	farther,
	traitAxis,
} from "~/ui/prototype-carousels/dive-model"
import type { PxType, Scores } from "~/ui/prototype-carousels/explore-model"
import { playEngine } from "~/ui/prototype-carousels/play-engine"
import { PLAY_FORMS } from "~/ui/prototype-carousels/play-forms"
import {
	type PlayMeta,
	type PlayVariant,
	playMeta,
} from "~/ui/prototype-carousels/play-meta"
import { playCss } from "~/ui/prototype-carousels/play-css"
import { SCRUB_FORMS, scrubKit } from "~/ui/prototype-carousels/scrub-forms"
import { scrubExtra } from "~/ui/prototype-carousels/scrub-meta"
import { cached } from "~/utils/cache"
import { MEDIA_COLLECTION, recommend, scroll } from "~/utils/qdrant"
import { titleKey } from "~/utils/title-key"

/** A title in a pack: key ("m603", "s1396"), title, year, poster path, similarity in thousandths, score string. */
export type PackTitle = [string, string, string, string, number, string]
export type PlayPack = { c: PackTitle; n: PackTitle[] }
/** What the cache keeps: a pack, or the note that the title has no fingerprint. */
type Kept = { c: PackTitle | null; n: PackTitle[] }

const POOL = 180
const PACK_TITLES = 110
const NEAREST = 48

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value

const CODE = "0123456789a"
const encode = (scores: Record<string, number> | undefined) =>
	VALID_FINGERPRINT_KEYS.map((key) => {
		const value = scores?.[key]
		return value === undefined || value < 0 || value > 10
			? "-"
			: CODE[Math.round(value)]
	}).join("")

// The dive path's bonus for a title more people know: up to 0.03 of similarity.
const knownBonus = (payload: QdrantMediaPayload) =>
	0.015 *
	Math.min(
		2,
		Math.log10(
			Math.max(1, (payload.goodwatch_overall_score_voting_count ?? 0) / 10000),
		),
	)

const PAYLOAD = [
	"tmdb_id",
	"media_type",
	"title",
	"release_year",
	"poster_path",
	"goodwatch_overall_score_voting_count",
	"fingerprint_scores_v1",
]

async function buildPack(params: {
	type: PxType
	id: number
}): Promise<Kept> {
	const point = titleKey(params.type, params.id)
	const { must, must_not } = buildBaseFilterConditions({
		mediaType: "all",
		minVotingCount: 10000,
		minScore: 60,
		additionalMust: [
			{ key: "release_year", range: { lte: new Date().getFullYear() } },
		],
	})
	const [own, results] = await Promise.all([
		scroll<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			filter: { must: [{ has_id: [point] }] },
			limit: 1,
			withPayload: { include: PAYLOAD },
			withVector: false,
		}),
		recommend<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			positive: [point],
			using: "fingerprint_v1",
			filter: { must, must_not },
			limit: POOL,
			withPayload: { include: PAYLOAD },
			hnswEf: 128,
			exact: false,
		}),
	])
	const center = own[0]?.payload
	const centerScores = center?.fingerprint_scores_v1
	if (!center || !centerScores) return { c: null, n: [] }
	const c: Scores = (key) => centerScores[key]
	const pool = results
		.filter(
			({ payload }) =>
				payload.fingerprint_scores_v1 && first(payload.poster_path),
		)
		.map(({ payload, score }) => ({
			payload,
			s: ((key) => payload.fingerprint_scores_v1?.[key]) as Scores,
			near: Math.round((score + knownBonus(payload)) * 1000),
		}))
		.filter((entry) => entry.near >= MIN_NEAR * 1000)
		.sort((a, b) => b.near - a.near)

	const chosen = new Set<(typeof pool)[number]>()
	const take = (entries: typeof pool, count: number) => {
		for (const entry of entries.slice(0, count)) chosen.add(entry)
	}
	take(pool, NEAREST)
	// Per direction, the nearest titles of each band ("a bit", the plain word, "much"), as a dive shows them.
	const spread = (direction: Direction, perBand: number) => {
		const bands: (typeof pool)[] = [[], [], []]
		for (const entry of pool) {
			const delta = farther(direction, c, entry.s)
			if (delta !== null) bands[bandOf(direction, delta)].push(entry)
		}
		for (const band of bands) take(band, perBand)
	}
	for (const axis of ALL_AXES)
		for (const sign of ["-", "+"]) {
			const direction = directionOf(`${axis.id}${sign}`)
			if (direction) spread(direction, 3)
		}
	// The title's strongest traits, more and less of each.
	const own8 = VALID_FINGERPRINT_KEYS.filter((key) => traitAxis(key))
		.sort((a, b) => (centerScores[b] ?? 0) - (centerScores[a] ?? 0))
		.slice(0, 10)
	for (const key of own8)
		for (const sign of ["-", "+"]) {
			const direction = directionOf(`t.${key}${sign}`)
			if (direction) spread(direction, 2)
		}
	const pack = (
		payload: QdrantMediaPayload,
		near: number,
	): PackTitle => [
		`${payload.media_type === "movie" ? "m" : "s"}${payload.tmdb_id}`,
		first(payload.title) ?? "",
		String(payload.release_year ?? ""),
		(first(payload.poster_path) ?? "").replace(/^\/+/, ""),
		near,
		encode(payload.fingerprint_scores_v1),
	]
	return {
		c: pack(center, 1000),
		n: pool
			.filter((entry) => chosen.has(entry))
			.slice(0, PACK_TITLES)
			.map((entry) => pack(entry.payload, entry.near)),
	}
}

/** The pack of a title, or null when the title has no fingerprint. */
export async function playPack(
	type: PxType,
	id: number,
): Promise<PlayPack | null> {
	const kept = await cached({
		name: "proto363-play-pack-v1",
		metricName: "proto363-play-pack",
		target: buildPack,
		params: { type, id },
		ttlMinutes: 60 * 24,
	}).catch((error) => {
		console.error("Carousel prototype: pack lookup failed", error)
		return null
	})
	return kept?.c ? { c: kept.c, n: kept.n } : null
}

let meta: PlayMeta | undefined
export const metaOf = () => {
	meta ??= playMeta()
	return meta
}

interface PlayHead {
	css: string
	script: string
}

const heads = new Map<string, Promise<PlayHead>>()
/**
 * The section's style and inline script for one form, built once: the engine's own source with the fingerprint
 * vocabulary and the form as its arguments. Minified when the build tool's minifier is at hand (it is on the
 * development machine). The section reads it from a global while the server renders (see PlaySection.tsx).
 */
export function playHead(variant: PlayVariant): Promise<PlayHead> {
	let head = heads.get(variant)
	if (!head) {
		head = (async () => {
			// A scrub form is its own function and the kit the scrub forms share (ui/prototype-carousels/scrub-forms.ts).
			const form = SCRUB_FORMS[variant]
				? `function(c){return(${SCRUB_FORMS[variant].toString()})(c,(${scrubKit.toString()})(c,${JSON.stringify(scrubExtra())}))}`
				: PLAY_FORMS[variant].toString()
			let script = `(${playEngine.toString()})(${JSON.stringify(metaOf())},window,{${variant}:${form}})`
			try {
				const name = "esbuild"
				const esbuild = (await import(/* @vite-ignore */ name)) as {
					transform: (
						code: string,
						options: Record<string, unknown>,
					) => Promise<{ code: string }>
				}
				script = (
					await esbuild.transform(script, { minify: true, target: "es2019" })
				).code.trim()
			} catch (error) {
				console.error("Carousel prototype: the engine is not minified", error)
			}
			const ready = { css: playCss(variant), script }
			const all = globalThis as { __gwPlayHead?: Record<string, PlayHead> }
			all.__gwPlayHead = { ...all.__gwPlayHead, [variant]: ready }
			return ready
		})()
		heads.set(variant, head)
	}
	return head
}

/** The section's markup for a title page: the engine's own picture of the page's title, and the plain title links. */
export async function playSectionHtml(input: {
	variant: PlayVariant
	type: PxType
	id: number
	title: string
	links: { type: PxType; id: number; title: string; year: string }[]
	path: (title: { type: PxType; id: number; title: string }) => string
}): Promise<string> {
	const [pack] = await Promise.all([
		playPack(input.type, input.id),
		playHead(input.variant),
	])
	const engine = playEngine(metaOf(), null, PLAY_FORMS)
	return engine.section({
		form: input.variant,
		root: `${input.type === "movie" ? "m" : "s"}${input.id}`,
		title: input.title,
		pack,
		links: input.links.map((link) => ({
			href: input.path(link),
			text: `${link.title} (${link.year})`,
		})),
	})
}

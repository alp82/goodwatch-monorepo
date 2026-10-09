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
import { BEST_FORMS, bestKit } from "~/ui/prototype-carousels/best-forms"
import {
	BEST_WORDS,
	bestExtra,
	bestTraits,
	sameFranchise,
} from "~/ui/prototype-carousels/best-meta"
import { PLAY_FORMS } from "~/ui/prototype-carousels/play-forms"
import { ROAM_FORMS, roamKit } from "~/ui/prototype-carousels/roam-forms"
import {
	ROAM_WITH,
	ROAM_WITHOUT,
	filterName,
	isSwitch,
	roamExtra,
	roamSwitches,
} from "~/ui/prototype-carousels/roam-meta"
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
/** `tr`: the four traits a ninth round pack was widened along. */
export type PlayPack = {
	c: PackTitle
	n: PackTitle[]
	tr?: string[]
	fl?: Record<string, number>
}
/** What the cache keeps: a pack, or the note that the title has no fingerprint. */
type Kept = {
	c: PackTitle | null
	n: PackTitle[]
	tr?: string[]
	fl?: Record<string, number>
}

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

// --- Ninth round: a pack that reaches further ---------------------------------------------------------------------
//
// The seventh round's pack is a slice of the 180 nearest titles, and they agree with the title on almost every
// attribute: whatever trait a form lays them out along, the same crowd reshuffles. This pack keeps the size and the
// one-request-per-title rule, and spends it differently:
// - Four traits per title (ui/prototype-carousels/best-meta.ts), or the walk's four when the browser names them, so
//   that a walk keeps its directions.
// - The 24 nearest titles, as before.
// - Per trait a ladder: for every level from 0 to 10, the nearest titles that sit on it, far levels first. The
//   nearest 180 rarely reach three levels away, so each direction with room gets one or two filtered requests
//   ("at least three more", "at least six more") that find the nearest titles out there.
// - At most one more title of the page title's franchise, and one per other franchise.
const NEAR2 = 24
const PACK2 = 84
const PER_LEVEL = 3
const WORDS = new Set(BEST_WORDS.map(([key]) => key))

async function buildPack2(params: {
	type: PxType
	id: number
	tr: string
	mode: string
}): Promise<Kept> {
	const point = titleKey(params.type, params.id)
	const base = (extra: unknown[] = []) =>
		buildBaseFilterConditions({
			mediaType: "all",
			minVotingCount: 10000,
			minScore: 60,
			additionalMust: [
				{ key: "release_year", range: { lte: new Date().getFullYear() } },
				...extra,
			],
		})
	const around = (extra: unknown[], limit: number) => {
		const { must, must_not } = base(extra)
		return recommend<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			positive: [point],
			using: "fingerprint_v1",
			filter: { must, must_not },
			limit,
			withPayload: { include: PAYLOAD },
			hnswEf: 128,
			exact: false,
		})
	}
	const [own, results] = await Promise.all([
		scroll<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			filter: { must: [{ has_id: [point] }] },
			limit: 1,
			withPayload: { include: PAYLOAD },
			withVector: false,
		}),
		around([], POOL),
	])
	const center = own[0]?.payload
	const centerScores = center?.fingerprint_scores_v1
	if (!center || !centerScores) return { c: null, n: [] }
	type Entry = { payload: QdrantMediaPayload; near: number; key: string }
	const entry = (hit: { payload: QdrantMediaPayload; score: number }): Entry => ({
		payload: hit.payload,
		near: Math.round((hit.score + knownBonus(hit.payload)) * 1000),
		key: `${hit.payload.media_type}${hit.payload.tmdb_id}`,
	})
	const usable = (hit: { payload: QdrantMediaPayload }) =>
		Boolean(hit.payload.fingerprint_scores_v1 && first(hit.payload.poster_path))
	const level = (e: { payload: QdrantMediaPayload }, key: string) =>
		Math.round(e.payload.fingerprint_scores_v1?.[key] ?? 0)
	const pool = results
		.filter(usable)
		.map(entry)
		.sort((a, b) => b.near - a.near)
	const asked = params.tr.split(",").filter((key) => WORDS.has(key))
	const traits =
		asked.length >= 2
			? asked.slice(0, 4)
			: bestTraits(
					(key) => centerScores[key] ?? 0,
					pool.slice(0, 64).map((e) => (key: string) => level(e, key)),
					params.mode === "mid" ? 3 : 4,
					params.mode === "mid",
				)
	// The far ends: per trait and direction with room, the nearest titles at least three and at least six away.
	const wanted: { key: string; range: Record<string, number>; limit: number }[] = []
	for (const key of traits) {
		const at = Math.round(centerScores[key] ?? 0)
		for (const [step, limit] of [
			[3, 12],
			[6, 8],
		]) {
			if (at + step <= 10) wanted.push({ key, range: { gte: at + step }, limit })
			if (at - step >= 0) wanted.push({ key, range: { lte: at - step }, limit })
		}
	}
	const far = await Promise.all(
		wanted.map(({ key, range, limit }) =>
			around([{ key: `fingerprint_scores_v1.${key}`, range }], limit).catch(
				() => [],
			),
		),
	)
	const all = new Map<string, Entry>()
	for (const e of pool) all.set(e.key, e)
	for (const hits of far)
		for (const hit of hits.filter(usable)) {
			const e = entry(hit)
			if (!all.has(e.key)) all.set(e.key, e)
		}
	const candidates = [...all.values()].sort((a, b) => b.near - a.near)
	const name = (e: Entry) => first(e.payload.title) ?? ""
	const centerName = first(center.title) ?? ""
	const chosen: Entry[] = []
	const taken = new Set<string>()
	const add = (e: Entry) => {
		if (taken.has(e.key) || e.key === `${center.media_type}${center.tmdb_id}`)
			return false
		const title = name(e)
		if (
			sameFranchise(centerName, title)
				? chosen.some((c) => sameFranchise(centerName, name(c)))
				: chosen.some((c) => sameFranchise(name(c), title))
		)
			return false
		taken.add(e.key)
		chosen.push(e)
		return true
	}
	let nearest = 0
	for (const e of pool) {
		if (nearest >= NEAR2) break
		if (add(e)) nearest++
	}
	const ladders = traits.map((key) => {
		const by = new Map<number, Entry[]>()
		for (const e of candidates) {
			const l = level(e, key)
			by.set(l, [...(by.get(l) ?? []), e])
		}
		return { key, by, at: Math.round(centerScores[key] ?? 0) }
	})
	for (let round = 0; round < PER_LEVEL; round++)
		for (let d = 10; d >= 1; d--)
			for (const { key, by, at } of ladders)
				for (const sign of [1, -1]) {
					const l = at + d * sign
					if (l < 0 || l > 10 || chosen.length >= PACK2) continue
					if (chosen.filter((e) => level(e, key) === l).length > round) continue
					for (const e of by.get(l) ?? []) if (add(e)) break
				}
	const pack = (payload: QdrantMediaPayload, near: number): PackTitle => [
		`${payload.media_type === "movie" ? "m" : "s"}${payload.tmdb_id}`,
		first(payload.title) ?? "",
		String(payload.release_year ?? ""),
		(first(payload.poster_path) ?? "").replace(/^\/+/, ""),
		near,
		encode(payload.fingerprint_scores_v1),
	]
	return {
		c: pack(center, 1000),
		n: chosen
			.sort((a, b) => b.near - a.near)
			.map((e) => pack(e.payload, e.near)),
		tr: traits,
	}
}

/**
 * The ninth round's pack of a title, widened along `traits` (the walk's four) or along the title's own four when
 * none are named. Its own cache name: the shape differs from the seventh round's.
 */
export async function playPack2(
	type: PxType,
	id: number,
	traits: string[] = [],
	mode = "",
): Promise<PlayPack | null> {
	const kept = await cached({
		name: "proto363-play-pack-v3",
		metricName: "proto363-play-pack",
		target: buildPack2,
		params: {
			type,
			id,
			tr: traits.filter((key) => WORDS.has(key)).join(","),
			mode: mode === "mid" ? "mid" : "",
		},
		ttlMinutes: 60 * 24,
	}).catch((error) => {
		console.error("Carousel prototype: pack lookup failed", error)
		return null
	})
	return kept?.c ? { c: kept.c, n: kept.n, tr: kept.tr } : null
}

// --- Tenth round: a pack whose order is similarity, with what the switches need, and more on request --------------
//
// The roam forms put a title on the ring of its similarity, so this pack is the plain nearest titles in Qdrant's
// own order, with the score as it is (no bonus for known titles). Around them:
// - The walk's switches (ui/prototype-carousels/roam-meta.ts): per switch, the nearest titles that are "without" the
//   trait (level 4 or less) or "with" it (6 or more). One filtered request each, so that the first flip of a
//   switch is drawn from memory.
// - `f`, a filter of several switches, when the walk carries one: the nearest titles that pass all of it.
// - `d`, further out: a later page of the same order, plain or filtered, which the browser merges into the pack.
// - Per filter the score of the last title Qdrant gave (`fl`): down to it the pack is complete, and the browser
//   shows no title from below it until the next page is there, so nothing is ever pushed aside by a late arrival.
//   0 means Qdrant had no more.
// - No franchise is thinned out here: the browser shows one title per franchise (roam-forms.ts), because pages
//   that are built apart can't agree on which one that is.
const NEAR4 = 80
const FLIP4 = 24
const FILTER4 = 40
const PAGE4 = 240
const MAX_PAGE4 = 6

async function buildPack4(params: {
	type: PxType
	id: number
	tr: string
	f: string
	d: number
}): Promise<Kept> {
	const point = titleKey(params.type, params.id)
	const around = (extra: unknown[], limit: number, offset = 0) => {
		const { must, must_not } = buildBaseFilterConditions({
			mediaType: "all",
			minVotingCount: 10000,
			minScore: 60,
			additionalMust: [
				{ key: "release_year", range: { lte: new Date().getFullYear() } },
				...extra,
			],
		})
		return recommend<QdrantMediaPayload>({
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
	const condition = (name: string) => ({
		key: `fingerprint_scores_v1.${name.slice(0, -1)}`,
		range: name.endsWith("+") ? { gte: ROAM_WITH } : { lte: ROAM_WITHOUT },
	})
	const filter = params.f ? params.f.split(",").filter(isSwitch) : []
	const paged = params.d >= 0
	// A page: the first of a filter holds 80, every later one 240.
	const pageOf = (d: number): [number, number] =>
		d === 0 ? [NEAR4, 0] : [PAGE4, NEAR4 + (d - 1) * PAGE4]
	const [limit, offset] = pageOf(Math.max(0, params.d))
	const [own, main] = await Promise.all([
		scroll<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			filter: { must: [{ has_id: [point] }] },
			limit: 1,
			withPayload: { include: PAYLOAD },
			withVector: false,
		}),
		paged ? around(filter.map(condition), limit, offset) : around([], NEAR4),
	])
	const center = own[0]?.payload
	const centerScores = center?.fingerprint_scores_v1
	if (!center || !centerScores) return { c: null, n: [] }
	const usable = (hit: { payload: QdrantMediaPayload }) =>
		Boolean(hit.payload.fingerprint_scores_v1 && first(hit.payload.poster_path))
	const switches =
		params.tr === "0"
			? []
			: params.tr
				? params.tr.split(",").filter(isSwitch).slice(0, 4)
				: roamSwitches(
						(key) => centerScores[key] ?? 0,
						main
							.filter(usable)
							.slice(0, 64)
							.map((hit) => (key: string) => Math.round(hit.payload.fingerprint_scores_v1?.[key] ?? 0)),
					)
	const fl: Record<string, number> = {}
	const lowest = (hits: { score: number }[], asked: number) =>
		hits.length < asked ? 0 : Math.floor(hits[hits.length - 1].score * 10000) / 10
	fl[paged ? filterName(filter) : ""] = lowest(main, paged ? limit : NEAR4)
	const groups = [main]
	if (!paged) {
		const single = switches.map((name) => [name])
		const wanted = filter.length > 1 || (filter.length === 1 && !switches.includes(filter[0])) ? [...single, filter] : single
		const more = await Promise.all(
			wanted.map((names) =>
				around(names.map(condition), names.length > 1 ? FILTER4 : FLIP4).catch(() => null),
			),
		)
		more.forEach((hits, i) => {
			if (!hits) return
			fl[filterName(wanted[i])] = lowest(hits, wanted[i].length > 1 ? FILTER4 : FLIP4)
			groups.push(hits)
		})
	}
	const chosen: { payload: QdrantMediaPayload; score: number }[] = []
	const taken = new Set<string>()
	for (const hits of groups)
		for (const hit of hits.filter(usable)) {
			const key = `${hit.payload.media_type}${hit.payload.tmdb_id}`
			if (taken.has(key)) continue
			taken.add(key)
			chosen.push(hit)
		}
	const pack = (payload: QdrantMediaPayload, near: number): PackTitle => [
		`${payload.media_type === "movie" ? "m" : "s"}${payload.tmdb_id}`,
		first(payload.title) ?? "",
		String(payload.release_year ?? ""),
		(first(payload.poster_path) ?? "").replace(/^\/+/, ""),
		near,
		encode(payload.fingerprint_scores_v1),
	]
	return {
		c: pack(center, 1000),
		n: chosen
			.sort((a, b) => b.score - a.score)
			.map((hit) => pack(hit.payload, Math.round(hit.score * 10000) / 10)),
		tr: switches,
		fl,
	}
}

/**
 * The tenth round's pack of a title. `switches`: the walk's, "0" for a form without any, or empty for the title's
 * own. `filter`: the switches that are flipped. `page`: -1 for the pack itself, 0 and up for more of one filter.
 */
export async function playPack4(
	type: PxType,
	id: number,
	switches = "",
	filter = "",
	page = -1,
): Promise<PlayPack | null> {
	const kept = await cached({
		name: "proto363-roam-pack-v2",
		metricName: "proto363-play-pack",
		target: buildPack4,
		params: {
			type,
			id,
			tr: switches === "0" ? "0" : switches.split(",").filter(isSwitch).slice(0, 4).join(","),
			f: filterName(filter.split(",")),
			d: Math.max(-1, Math.min(MAX_PAGE4, Math.floor(page))),
		},
		ttlMinutes: 60 * 24,
	}).catch((error) => {
		console.error("Carousel prototype: pack lookup failed", error)
		return null
	})
	return kept?.c ? { c: kept.c, n: kept.n, tr: kept.tr, fl: kept.fl } : null
}

let meta: PlayMeta | undefined
export const metaOf = () => {
	meta ??= playMeta()
	return meta
}

/** The roam forms without switches: their pack is the plain neighborhood. */
const ROAM_PLAIN = ["roam3", "roam4"]

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
				: BEST_FORMS[variant]
					? `function(c){return(${BEST_FORMS[variant].toString()})(c,(${bestKit.toString()})(c,${JSON.stringify(bestExtra())}))}`
					: ROAM_FORMS[variant]
						? `function(c){return(${ROAM_FORMS[variant].toString()})(c,(${roamKit.toString()})(c,${JSON.stringify(roamExtra())}))}`
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
	// The ninth round's forms get the pack that reaches further. The compass asks for traits with room both ways.
	const [pack] = await Promise.all([
		ROAM_FORMS[input.variant]
			? playPack4(input.type, input.id, ROAM_PLAIN.includes(input.variant) ? "0" : "")
			: BEST_FORMS[input.variant]
				? playPack2(input.type, input.id, [], input.variant === "best2" ? "mid" : "")
				: playPack(input.type, input.id),
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

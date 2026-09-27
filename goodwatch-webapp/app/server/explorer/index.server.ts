// Explorer's server: the islands map and everything the map asks for as the person moves across it. Everything runs
// in memory over the title snapshot: the pool and the layouts that are the same for everyone are built once and kept;
// the personal part (taste match, Seen, Want to See, on my services, and the filters) is added per request. No request
// reads Crate or Qdrant besides the viewer's own rows (the viewer context) and, once per snapshot version in the
// background, the pool's display fields.
import {
	type ExplorerBridge,
	type ExplorerCard,
	type ExplorerFilters,
	type ExplorerIsland,
	type ExplorerIslandTree,
	type ExplorerMap,
	type ExplorerPairs,
	type ExplorerService,
	type ExplorerTitle,
	GROUPINGS,
	type Grouping,
	isGrouping,
	matchBandOf,
} from "~/domain/explorer"
import {
	availabilityLoaded,
	availabilityLoadedAt,
	servicesFor,
} from "~/server/availability-index.server"
import { getFeatureMode } from "~/server/features.server"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import {
	duplicateProviderMapping,
	getShorterProviderLabel,
} from "~/utils/streaming-links"
import type { TitleKey } from "~/utils/title-key"
import {
	type Layout,
	keep,
	sharedLayout,
	streamingLayout,
	tasteLayout,
} from "./groupings.server"
import {
	type ExplorerPool,
	cosineOf,
	explorerPool,
	keepExplorerPoolWarm,
} from "./pool.server"
import {
	DEFAULT_BRANCHING,
	type TreeShape,
	bridgeMembers,
	buildTree,
	pairCounts,
	visibleMembers,
} from "./trees.server"
import { phraseOf, sentence } from "./words.server"

/** The snapshot hasn't loaded yet (the first seconds after the server starts). */
export class ExplorerUnavailable extends Error {
	constructor() {
		super("The title snapshot hasn't loaded yet")
		this.name = "ExplorerUnavailable"
	}
}

export interface ExplorerQuery {
	grouping?: string | null
	/** "mine" or "all"; by default On my services is on when the viewer has services. */
	services?: string | null
	/** "0" turns Not seen yet off; it's on by default. */
	unseen?: string | null
}

const TOP_TITLES = 12
const TOP_PER_BAND = 5
const LOVED_FROM = 8
// A country's first request after the server starts waits this long for its availability.
const AVAILABILITY_WAIT_MS = 1500
const PROVIDERS_KEEP_MS = 6 * 60 * 60 * 1000

// While Explorer can be seen, the pool builds as soon as the snapshot loads, so no request waits for it.
if (getFeatureMode("explorer") !== "off") keepExplorerPoolWarm(getTitleSnapshot)

// ---------------------------------------------------------------- the personal part, per request

interface Seat {
	pool: ExplorerPool
	ctx: ViewerContext
	taste: Taste
	filters: ExplorerFilters
	/** The country's availability is still loading: On my services and Streaming can't apply. */
	approximate: boolean
	/** Per pool title, the taste match, 0 without one. */
	match: Uint8Array
	/** Per pool title, 1 when it passes the filters. */
	visible: Uint8Array
	/** Per pool title, the subscription services that carry it in the viewer's country; null while loading. */
	lists: readonly (readonly number[])[] | null
	/** The viewer's services, without the duplicates saved alongside them. */
	services: number[]
	/** The same, for lookups. */
	mine: ReadonlySet<number>
}

async function seatFor(
	ctx: ViewerContext,
	query: ExplorerQuery,
	needsAvailability: boolean,
): Promise<Seat> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new ExplorerUnavailable()
	const [pool, taste] = await Promise.all([
		explorerPool(snapshot),
		loadTaste(ctx.viewer),
	])
	const services = baseServices(ctx.services)
	const filters: ExplorerFilters = {
		onMyServices: services.length > 0 && query.services !== "all",
		notSeenYet: query.unseen !== "0",
	}
	if (
		services.length > 0 &&
		(filters.onMyServices || needsAvailability) &&
		!waitedFor.has(ctx.country)
	) {
		// Only the country's first request waits; later ones get the approximate answer until it has loaded.
		waitedFor.add(ctx.country)
		await availabilityLoaded(ctx.country, AVAILABILITY_WAIT_MS)
	}
	const lists = poolServices(pool, ctx.country)

	const match = new Uint8Array(pool.n)
	if (taste.signal === "some") {
		const matches = taste.match(Array.from(pool.keys))
		for (let i = 0; i < pool.n; i++) match[i] = matches[i] ?? 0
	}
	const mine = new Set(services)
	const visible = new Uint8Array(pool.n)
	for (let i = 0; i < pool.n; i++) {
		const key = pool.keys[i]
		if (filters.notSeenYet && (ctx.seen.has(key) || ctx.skipped.has(key)))
			continue
		if (filters.onMyServices && lists && !lists[i].some((id) => mine.has(id)))
			continue
		visible[i] = 1
	}
	return {
		pool,
		ctx,
		taste,
		filters,
		approximate: services.length > 0 && !lists,
		match,
		visible,
		lists,
		services,
		mine,
	}
}

const waitedFor = new Set<string>()

// Saved services include the duplicates they stand for (Amazon Video next to Amazon Prime Video), and the availability
// index files every title under the base service; islands and the services list show each base service once.
const baseOf = new Map(
	Object.entries(duplicateProviderMapping).flatMap(([base, copies]) =>
		copies.map((copy) => [copy, Number(base)] as const),
	),
)
const baseServices = (ids: number[]) => [
	...new Set(ids.map((id) => baseOf.get(id) ?? id)),
]

const servicesKept = new Map<
	string,
	{ version: string; loadedAt: number; lists: number[][] }
>()

/** The services per pool title in the country, from the availability index; rebuilt when either changes. */
function poolServices(
	pool: ExplorerPool,
	country: string,
): readonly (readonly number[])[] | null {
	const loadedAt = availabilityLoadedAt(country)
	if (loadedAt === null) {
		servicesFor(country, []) // starts the country's load
		return null
	}
	const hit = servicesKept.get(country)
	if (hit && hit.version === pool.version && hit.loadedAt === loadedAt)
		return hit.lists
	const found = servicesFor(country, Array.from(pool.keys))
	if (found.some((list) => list === null)) return null
	const lists = found as number[][]
	servicesKept.set(country, { version: pool.version, loadedAt, lists })
	return lists
}

const providersKept = new Map<
	string,
	{ at: number; byId: Map<number, { name: string; logo: string | null }> }
>()

async function providersOf(country: string) {
	const hit = providersKept.get(country)
	if (hit && Date.now() - hit.at < PROVIDERS_KEEP_MS) return hit.byId
	const byId = new Map<number, { name: string; logo: string | null }>()
	try {
		for (const p of await getStreamingProviders({ country }))
			if (!byId.has(p.id))
				byId.set(p.id, {
					name: getShorterProviderLabel(p.name),
					logo: p.logo_path || null,
				})
		providersKept.set(country, { at: Date.now(), byId })
	} catch (error) {
		console.error(`Explorer: streaming services of ${country} not read`, error)
	}
	return byId
}

async function servicesOf(
	ids: readonly number[],
	seat: Seat,
	onlyNamed = false,
): Promise<ExplorerService[]> {
	const byId = await providersOf(seat.ctx.country)
	return ids
		.filter((id) => !onlyNamed || byId.has(id))
		.map((id) => ({
			id,
			name: byId.get(id)?.name ?? `Service ${id}`,
			logo: byId.get(id)?.logo ?? null,
			mine: seat.mine.has(id),
		}))
		.sort((a, b) => Number(b.mine) - Number(a.mine))
}

function titleOf(seat: Seat, i: number): ExplorerTitle {
	const { pool, ctx } = seat
	const key = pool.keys[i]
	const facts = pool.facts[i]
	const display = pool.display[i]
	return {
		key,
		mediaType: facts.mediaType,
		tmdbId: facts.tmdbId,
		title: display.title,
		year: display.year ?? (pool.years[i] || null),
		poster: display.poster,
		backdrop: display.backdrop,
		genres: display.genres,
		score: facts.score,
		match: seat.match[i] || null,
		services: seat.lists ? seat.lists[i].filter((id) => seat.mine.has(id)) : [],
		seen: ctx.seen.has(key),
		wantToSee: ctx.wishlist.has(key),
		rating: ctx.ratings.get(key) ?? null,
	}
}

// ---------------------------------------------------------------- groupings for the viewer

function offered(seat: Seat): Grouping[] {
	return GROUPINGS.filter(
		(g) =>
			(g !== "streaming" || seat.services.length > 0) &&
			(g !== "taste" || seat.taste.signal === "some"),
	)
}

/** The grouping shown for a requested one: Genre in place of Streaming without services, and of Taste without taste. */
function groupingFor(seat: Seat, requested: Grouping): Grouping {
	if (requested === "streaming" && (!seat.services.length || !seat.lists))
		return "genre"
	if (requested === "taste" && seat.taste.signal !== "some") return "genre"
	return requested
}

async function layoutFor(seat: Seat, grouping: Grouping): Promise<Layout> {
	const { pool } = seat
	if (grouping === "taste") {
		// Personal, but the same taste vector always gives the same bands.
		const vector = seat.taste.vector
		const build = () => tasteLayout(pool, seat.match)
		return vector
			? keep(
					`${pool.version}|taste|${Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString("base64")}`,
					build,
				)
			: build()
	}
	if (grouping === "streaming") {
		const lists = seat.lists as readonly (readonly number[])[]
		const byId = await providersOf(seat.ctx.country)
		const services = [...seat.services].sort((a, b) => a - b)
		return keep(
			`${pool.version}|streaming|${seat.ctx.country}|${availabilityLoadedAt(seat.ctx.country)}|${services.join(",")}`,
			() =>
				streamingLayout(
					pool,
					services.map((id) => ({
						id,
						name: byId.get(id)?.name ?? `Service ${id}`,
					})),
					(i) => lists[i],
				),
		)
	}
	return sharedLayout(pool, grouping)
}

const requestedGrouping = (value: string | null | undefined): Grouping =>
	isGrouping(value) ? value : "genre"

async function prepare(
	ctx: ViewerContext,
	query: ExplorerQuery,
): Promise<{ seat: Seat; grouping: Grouping; layout: Layout }> {
	const requested = requestedGrouping(query.grouping)
	const seat = await seatFor(ctx, query, requested === "streaming")
	const grouping = groupingFor(seat, requested)
	return { seat, grouping, layout: await layoutFor(seat, grouping) }
}

const islandIndex = (layout: Layout, id: string | null | undefined) =>
	layout.islands.findIndex((island) => island.id === id)

// ---------------------------------------------------------------- the map

/** The islands of a grouping, with their counts, positions, match bands, and first titles. */
export async function getExplorerMap(
	ctx: ViewerContext,
	query: ExplorerQuery,
): Promise<ExplorerMap> {
	const requested = requestedGrouping(query.grouping)
	const { seat, grouping, layout } = await prepare(ctx, query)
	const hasTaste = seat.taste.signal === "some"
	const onIsland = new Uint8Array(seat.pool.n)
	const islands: ExplorerIsland[] = []
	layout.islands.forEach((def, j) => {
		const members = visibleMembers(layout, j, seat.visible)
		if (members.length < 3) return
		const picks = new Set(members.slice(0, TOP_TITLES))
		const bands: [number, number, number] = [0, 0, 0]
		const perBand = [0, 0, 0]
		const histogram = new Int32Array(100)
		for (const i of members) {
			onIsland[i] = 1
			const m = seat.match[i]
			if (!m) continue
			histogram[m]++
			const band = matchBandOf(m)
			bands[band]++
			if (perBand[band] < TOP_PER_BAND) {
				perBand[band]++
				picks.add(i)
			}
		}
		const matched = bands[0] + bands[1] + bands[2]
		islands.push({
			id: def.id,
			name: def.name,
			color: def.color,
			count: members.length,
			medianMatch: hasTaste && matched ? medianOf(histogram, matched) : null,
			bands: hasTaste ? bands : null,
			x: layout.x[j],
			y: layout.y[j],
			apart: layout.apart[j],
			titles: members.filter((i) => picks.has(i)).map((i) => titleOf(seat, i)),
		})
	})
	return {
		grouping,
		requested,
		groupings: offered(seat),
		filters: seat.filters,
		approximate: seat.approximate,
		taste: {
			signal: seat.taste.signal,
			ratings: seat.taste.ratings,
			liked: seat.taste.liked,
		},
		services: await servicesOf(seat.services, seat),
		total: onIsland.reduce((sum, v) => sum + v, 0),
		islands,
	}
}

function medianOf(histogram: Int32Array, total: number): number {
	const middle = Math.floor(total / 2)
	let seen = 0
	for (let m = 0; m < histogram.length; m++) {
		seen += histogram[m]
		if (seen > middle) return m
	}
	return 0
}

// ---------------------------------------------------------------- trees, bridges, pairs

const treeOf = (seat: Seat, shape: TreeShape, count: number) => ({
	count,
	titles: shape.titles.map((i) => titleOf(seat, i)),
	parent: shape.parent,
	generation: shape.generation,
})

/** One island's tree: its first posters, then each title's closest titles on the island, generation by generation. */
export async function getIsland(
	ctx: ViewerContext,
	query: ExplorerQuery & { id: string; branching?: number[] },
): Promise<ExplorerIslandTree | null> {
	const { seat, grouping, layout } = await prepare(ctx, query)
	const j = islandIndex(layout, query.id)
	if (j < 0) return null
	const members = visibleMembers(layout, j, seat.visible)
	const shape = buildTree(
		seat.pool,
		members,
		query.branching ?? DEFAULT_BRANCHING,
	)
	return { grouping, id: query.id, ...treeOf(seat, shape, members.length) }
}

/** The bridge between two islands: the titles they share, laid out as a tree. */
export async function getBridge(
	ctx: ViewerContext,
	query: ExplorerQuery & { a: string; b: string; branching?: number[] },
): Promise<ExplorerBridge | null> {
	const { seat, grouping, layout } = await prepare(ctx, query)
	const a = islandIndex(layout, query.a)
	const b = islandIndex(layout, query.b)
	if (a < 0 || b < 0 || a === b) return null
	const [first, second] = a < b ? [a, b] : [b, a]
	const { kind, members } = bridgeMembers(
		seat.pool,
		layout,
		first,
		second,
		seat.visible,
	)
	const shape = buildTree(
		seat.pool,
		members,
		query.branching ?? DEFAULT_BRANCHING,
	)
	return {
		grouping,
		a: layout.islands[first].id,
		b: layout.islands[second].id,
		kind,
		...treeOf(seat, shape, members.length),
	}
}

/** For every pair of islands, what their bridge would hold, so the map can label and preview bridges. */
export async function getIslandPairs(
	ctx: ViewerContext,
	query: ExplorerQuery,
): Promise<ExplorerPairs> {
	const { seat, grouping, layout } = await prepare(ctx, query)
	return {
		grouping,
		pairs: pairCounts(layout, seat.visible).map((p) => ({
			a: layout.islands[p.a].id,
			b: layout.islands[p.b].id,
			kind: p.kind,
			count: p.count,
			strength: Math.round(p.strength * 1000) / 1000,
		})),
	}
}

// ---------------------------------------------------------------- the near card

/** The card of the title nearest the person's focus: match, why, services, and their state for the actions. */
export async function getNearCard(
	ctx: ViewerContext,
	key: TitleKey,
): Promise<ExplorerCard | null> {
	const seat = await seatFor(ctx, { unseen: "0", services: "all" }, false)
	const { pool, taste } = seat
	const i = pool.indexOf(key)
	if (i < 0) return null

	let like: ExplorerCard["like"] = null
	let why: string | null = null
	if (taste.signal === "some") {
		let best = -1
		let closest = Number.NEGATIVE_INFINITY
		for (const [rated, score] of ctx.ratings) {
			if (score < LOVED_FROM || rated === key) continue
			const l = pool.indexOf(rated)
			if (l < 0) continue
			const cosine = cosineOf(pool, i, l)
			if (cosine > closest) {
				closest = cosine
				best = l
			}
		}
		if (best >= 0)
			like = { key: pool.keys[best], title: pool.display[best].title }
		const reasons = sentence(taste.reasons(key, 2).map(phraseOf))
		const text = [reasons, like ? `like ${like.title}` : ""]
			.filter(Boolean)
			.join(", ")
		why = text ? text.charAt(0).toUpperCase() + text.slice(1) : null
	}
	return {
		title: titleOf(seat, i),
		why,
		like,
		services: await servicesOf(seat.lists?.[i] ?? [], seat, true),
		signUp: ctx.viewer.kind === "guest" && taste.signal !== "some",
	}
}

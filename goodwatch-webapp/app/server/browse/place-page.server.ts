// What a place page loads: the place's content (lede, what sets it apart, essentials, kinds, ways onward), its dials,
// lattice and pool, and the steering rows' data (decades and countries with counts, what to blend in). The list is a
// window of titles from an offset (`?at=`), so the page can show exactly as many as fit its height and step on with
// Prev and Next. Read-only.
import { type Family, type Ingredient, LEVELS, browsePath } from "~/domain/browse/address"
import { AXIS_KEYS, type Places, MIN_PAGE } from "~/server/browse/places.server"
import type { KindOf, PlaceRef, ShowTitle, Sort, TitleList, TraitWord } from "~/domain/browse/types"
import { type PantryGroup, pantry, shortsOf } from "~/server/browse/blend.server"
import { pitchFor } from "~/domain/browse/pitches"
import type { DialsData, FieldPlace } from "~/server/browse/dials.server"
import { copyFor } from "~/domain/browse/copy-lookup"
import { tropeBySlug } from "~/domain/tropes/catalog"
import type { PoolItem } from "~/domain/browse/tune"
import type { PlaceData } from "~/server/browse/place-data.server"
import { loadDials } from "~/server/browse/dials.server"
import type { BrowseLoadArgs } from "~/server/browse/load-args"
import { loadPage } from "~/server/browse/place-data.server"
import { cachedPage } from "./page-cache.server"
import { tropeMembersVersion } from "./trope-members.server"
import { WINDOW } from "~/domain/browse/window"
import { mapBreathing } from "./breathe"

export type DialsPlace = Extract<DialsData, { view: "place" }>

export interface SteerCount {
	place: PlaceRef
	/** Well-known titles of the page's list with this added. */
	n: number
}

/** One more ingredient of a family that sits well with the page ("Add a genre": comedies, dramas, ...). */
export interface SteerAdd {
	family: Family
	items: SteerCount[]
}

export interface Steer {
	/** The decade and the country the list is narrowed to, by slug. */
	when: string | null
	from: string | null
	/** Every decade with its count, oldest first. */
	decades: SteerCount[]
	/** Every country with a fair number of titles here, most first (not only a top handful). */
	countries: SteerCount[]
	/** Genres and moods to blend in, those that sit best with the page first. */
	adds: SteerAdd[]
	/** The offset of the window's first title. */
	at: number
}

/** What the title needs to be the blend itself: words you can swap or take out, and Add with its pantry. */
export interface TitleData {
	shorts: Record<string, string>
	swaps: { part: PlaceRef; options: PlaceRef[] }[]
	pantry: PantryGroup[]
	/** A blend's own words: what only the blend has. Empty for one place. */
	together: TraitWord[]
	pitch: string | null
	hasBest: boolean
}

/** One part of the selection, explained for "About this selection". */
export interface AboutPart {
	place: PlaceRef
	/** "Mood", "Genre", "Era", "Country", "Trope", ... */
	family: string
	/** One line: what it is (the copy deck's short line, a trope's one-liner). */
	line: string | null
	/** Its own page. */
	to: string
}

/** "About this selection": every part explained, the moods the selection leans to, and how many titles have it all. */
export interface About {
	parts: AboutPart[]
	/** The 16 moods on the lattice, the selection's own lit, the rest by how much the selection leans to them. */
	moods: FieldPlace[]
	/** Well-known titles that have every part. */
	count: number
}

export interface PlacePageData {
	/** "About this selection". */
	about: About
	room: PlaceData
	title: TitleData
	dz: DialsPlace
	/** The titles the dials rank: the list's own (kind, sort, switches and steering applied), plus what a widening dial reaches. */
	pool: PoolItem[]
	/** The window from `steer.at` in `titles`; `total` counts the whole narrowed list. */
	list: TitleList
	steer: Steer
	/** The kinds inside the place with their shares, for the steering's kind bars. */
	kinds: KindOf[]
	people: PlaceData["people"]
	awards: PlaceData["awards"]
}

const SOFT: Family[] = ["mood", "theme", "style", "trait"]

interface ListOpts {
	sort?: Sort
	page?: number
	mine?: boolean
	unseen?: boolean
	kindId?: string
	size?: number
}

/** The atlas's own parts, for the one case its list can't say: a kind of the place, narrowed by a decade or country. */
interface KitInside {
	rows(parts: Ingredient[]): number[]
	kindRows(parts: Ingredient[]): { id: string; rows: number[] }[]
	titles(rows: number[]): Promise<ShowTitle[]>
	b: { rank: ArrayLike<number> }
}

/**
 * The place's list narrowed by the steering parts. Without a kind that is the blend's own list. A kind belongs to the
 * place, not to the blend, so with both its rows are the kind's rows that the blend also has, in popular order.
 */
async function listOf(
	atlas: Places,
	parts: Ingredient[],
	extra: Ingredient[],
	opts: ListOpts,
): Promise<TitleList> {
	if (!extra.length) return atlas.list(parts, opts)
	if (!opts.kindId) return atlas.list([...parts, ...extra], { ...opts })
	const k = atlas as unknown as KitInside
	const inBlend = new Set(k.rows([...parts, ...extra]))
	const kindRows = k.kindRows(parts).find((x) => x.id === opts.kindId)?.rows ?? k.rows(parts)
	const rows = kindRows.filter((r) => inBlend.has(r)).sort((x, y) => k.b.rank[x] - k.b.rank[y])
	const size = opts.size ?? 30
	const pages = Math.max(1, Math.min(25, Math.ceil(rows.length / size)))
	const page = Math.min(pages, Math.max(1, opts.page ?? 1))
	return {
		titles: await k.titles(rows.slice((page - 1) * size, page * size)),
		total: rows.length,
		page,
		pages,
		sort: "popular",
		discoverHref: null,
	}
}

/** Titles `at` to `at + WINDOW` of the narrowed list: the two pages of WINDOW that hold them. */
async function windowOf(
	atlas: Places,
	parts: Ingredient[],
	extra: Ingredient[],
	opts: ListOpts,
	at: number,
): Promise<TitleList> {
	const first = Math.floor(at / WINDOW) + 1
	const a = await listOf(atlas, parts, extra, { ...opts, page: first, size: WINDOW })
	const skip = at - (a.page - 1) * WINDOW
	if (skip <= 0 || a.page >= a.pages) return { ...a, titles: a.titles.slice(Math.max(0, skip)) }
	const b = await listOf(atlas, parts, extra, { ...opts, page: first + 1, size: WINDOW })
	return { ...a, titles: [...a.titles, ...b.titles].slice(skip, skip + WINDOW) }
}

/**
 * Everything a place page (a mood, a genre, a theme, a style, or any blend) loads. Read-only. At its plain address
 * (no list state in the query) the page depends only on the catalog and the viewer's settings, so it is built once
 * per data version (page-cache.server); a single place is also shared across the fleet, a blend stays in-process.
 */
export async function loadPlacePage(args: BrowseLoadArgs): Promise<PlacePageData> {
	if (args.url.search) return buildPlacePage(args)
	let complete = true
	return cachedPage(args.atlas, {
		name: "place",
		key: args.url.pathname,
		build: async () => {
			// Until the trope members load, the steering has no trope row: such a build is served, then rebuilt.
			complete = tropeMembersVersion() > 0
			return buildPlacePage(args)
		},
		complete: () => complete,
		shared: args.address.parts.length === 1,
	})
}

async function buildPlacePage(args: BrowseLoadArgs): Promise<PlacePageData> {
	const { atlas, address, url } = args
	const parts = address.parts
	const lead = parts[0]
	const q = url.searchParams
	// A decade or a country set in the steering is a part of the blend like any other (old `?when=` and `?from=`
	// addresses redirect to the same blend before they get here).
	const whenIn = parts.find((p, i) => i > 0 && p.family === "decade")
	const fromIn = parts.find((p, i) => i > 0 && p.family === "country")
	const when = whenIn?.slug ?? null
	const from = fromIn?.slug ?? null
	const without = (x?: Ingredient) => (x ? parts.filter((p) => p !== x) : parts)
	const extra: Ingredient[] = []
	const at = Math.max(0, Math.min(25 * WINDOW - 1, Math.floor(Number(q.get("at")) || 0)))

	// The place's content first: its essentials take the best-known titles. The first dial is the intensity, so the
	// content's own list (which would narrow to a band) is not used.
	const room = (await loadPage({ atlas, address: { ...address, level: undefined } })) as PlaceData
	const dz = (await loadDials(args)) as DialsPlace

	// The pool, rebuilt when the list's controls or the steering narrow or re-order it.
	let pool = dz.pool
	const narrowed = !!(
		address.kind_ ||
		address.mine ||
		address.unseen ||
		address.sort ||
		extra.length
	)
	if (narrowed) {
		const much = dz.dials.filter((d) => d.kind === "much")
		const intensity = much.length ? await atlas.intensity(parts, 0) : null
		const keys = [...(intensity ? [intensity.trait.key] : []), ...AXIS_KEYS]
		const opts = { mine: address.mine, unseen: address.unseen }
		const own = await listOf(atlas, parts, extra, {
			...opts,
			sort: address.sort,
			kindId: address.kind_,
			size: 84,
		})
		// A widening dial ("a touch of heartwarming") reaches past the place's own titles; a kind keeps to its own.
		const widen = !address.kind_ && SOFT.includes(lead.family) && !!intensity
		const bands = widen
			? await Promise.all(
					LEVELS.map((level) =>
						atlas.list([...parts, ...extra], { ...opts, level, sort: "top", size: 32 }),
					),
				)
			: []
		const seen = new Set<number>()
		const next: PoolItem[] = []
		const push = (titles: ShowTitle[], member: boolean) => {
			const scores = atlas.scores(titles, keys)
			titles.forEach((t, i) => {
				if (seen.has(t.card.key)) return
				seen.add(t.card.key)
				next.push({
					t,
					s: [
						...(scores[t.card.key] ?? keys.map(() => 0)),
						member ? (i / Math.max(1, titles.length)) * 0.7 : 1,
						t.card.release_year ?? 0,
					],
					m: member ? 1 : 0,
				})
			})
		}
		push(own.titles, true)
		for (const b of bands) push(b.titles, false)
		pool = next
	}

	// The steering rows' counts: each decade with the country kept, each country with the decade kept.
	const decades =
		lead.family === "decade"
			? []
			: (
					await mapBreathing(atlas.members("decade", 0), (place) => ({
						place,
						n: atlas.count([...without(whenIn), place]),
					}))
				)
					.filter((d) => d.n > 0)
					.sort((a, b) => a.place.slug.localeCompare(b.place.slug))
	const countries =
		lead.family === "country"
			? []
			: (
					await mapBreathing(atlas.members("country", 0), (place) => ({
						place,
						n: atlas.count([...without(fromIn), place]),
					}))
				)
					.filter((c) => c.n >= 6 || c.place.slug === from)
					.sort((a, b) => b.n - a.n)

	// One more genre or mood: those that sit best with the page (their share inside it, against their size), with a
	// full page left. A family already in the address is offered too, as long as the part isn't there yet.
	const taken = (f: Family, slug: string) => parts.some((p) => p.family === f && p.slug === slug)
	const addsOf = async (family: Family): Promise<SteerAdd> => ({
		family,
		items: (
			await mapBreathing(
				atlas.members(family, 0).filter((m) => !taken(family, m.slug)),
				(place) => {
					const n = atlas.count([...parts, place])
					const size = Math.max(1, atlas.count([place]))
					return { place, n, fit: (n / size) * Math.log10(Math.max(2, n)) }
				},
			)
		)
			.filter((x) => x.n >= MIN_PAGE)
			.sort((a, b) => b.fit - a.fit)
			.slice(0, 8)
			.map(({ place, n }) => ({ place, n })),
	})
	// a trope too, the ones this page plays far more than elsewhere (members load once per process; until then
	// the row stays out).
	const adds: SteerAdd[] = []
	for (const f of lead.family === "mood"
		? ["genre", "mood", "trope"]
		: ["mood", "genre", "trope"]) {
		const add = await addsOf(f as Family)
		if (add.items.length >= 2) adds.push(add)
	}

	const blend = await atlas.blend(parts, { suggestions: 0, titles: 0 })
	const count = atlas.count(parts)
	const title: TitleData = {
		shorts: shortsOf(atlas, parts),
		swaps: blend.swaps,
		pantry: await pantry(atlas, parts),
		together: parts.length > 1 ? blend.traits : [],
		pitch: pitchFor(address.kind, parts) ?? null,
		hasBest: count >= MIN_PAGE,
	}

	const kinds = (await atlas.kinds(parts, 3).catch(() => [])).filter((k) =>
		room.kinds.some((r) => r.id === k.id),
	)
	const list = await windowOf(
		atlas,
		parts,
		extra,
		{
			sort: address.sort,
			mine: address.mine,
			unseen: address.unseen,
			kindId: address.kind_,
		},
		at,
	)
	// "About this selection": each part in one line, and the moods the whole selection leans to (its share in each
	// mood against the mood's share overall), for the lattice glyph on the About control.
	const familyWord: Record<Family, string> = {
		mood: "Mood",
		genre: "Genre",
		theme: "Theme",
		style: "Style",
		trait: "Feel",
		decade: "Era",
		country: "Country",
		service: "Streaming",
		trope: "Trope",
	}
	const all = Math.max(1, atlas.count([]))
	const leans = atlas.members("mood", 0).map((m) => {
		const inSel = atlas.count([...parts, m]) / Math.max(1, count)
		const overall = atlas.count([m]) / all
		const at = (key: string) => atlas.dials(m).find((d) => d.key === key)?.at ?? 0.5
		return { m, lift: overall > 0 ? inSel / overall : 0, tone: at("tone"), pace: at("pace") }
	})
	const topLift = Math.max(1.0001, ...leans.map((l) => l.lift))
	const one = (p: PlaceRef) =>
		browsePath({
			view: "place",
			kind: address.kind,
			parts: [{ family: p.family, slug: p.slug }],
			country: address.country,
		})
	const about: About = {
		count,
		parts: room.parts.map((p) => ({
			place: p,
			family: familyWord[p.family],
			line:
				p.family === "trope"
					? (tropeBySlug(p.slug)?.line ?? null)
					: (copyFor(address.kind, p.family, p.slug)?.short ?? null),
			to: one(p),
		})),
		moods: leans.map(({ m, lift, tone, pace }) => ({
			place: m,
			to: one(m),
			tone,
			pace,
			titles: [],
			here: parts.some((p) => p.family === "mood" && p.slug === m.slug),
			near: Math.max(0, Math.min(1, (lift - 1) / (topLift - 1))),
		})),
	}
	return {
		about,
		room,
		dz,
		pool,
		list,
		title,
		steer: { when, from, decades, countries, adds, at },
		kinds,
		people: room.people,
		awards: room.awards,
	}
}

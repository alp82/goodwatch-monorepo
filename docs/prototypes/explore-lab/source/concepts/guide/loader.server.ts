// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The programme guide's loader. A page is a short list
// of channels (rows); each channel is a place with real titles. The hub and the family pages hand rows out in batches
// (`?from=`), so the first paint stays small and more arrive as you move down.
import {
	type Address,
	type Family,
	type Ingredient,
	add,
	best as bestAddress,
	place,
} from "../../kit/address"
import type { ConceptLoader } from "../../kit/contract"
import type { Kit } from "../../kit/data.server"
import type { PlaceRef, ShowTitle, SourceKey } from "../../kit/types"
import { bestCopy, familyCopy, placeCopy } from "./copy"
import { LINEUPS, SHOW_SLUG } from "./lineup"
import type { Cell, Channel, GuideData, MapCountry } from "./types"

/** Rows in the first paint, and in each batch after it. */
const FIRST = 5
const STEP = 4
/** Titles per channel. */
const CELLS = 12

type TitleKey = ShowTitle["card"]["key"]

// The kit keeps a title's source scores and analysis lines to itself; the screen needs both for every focused title.
interface Peek {
	b: { snap: { rowOf(key: TitleKey): number } }
	sourcesOf(row: number): Partial<Record<SourceKey, number>>
	lines(keys: TitleKey[], terms: string[]): Promise<void>
	lineCache: Map<TitleKey, string>
}

async function cells(kit: Kit, titles: ShowTitle[]): Promise<Cell[]> {
	const peek = kit as unknown as Peek
	const missing = titles.filter((t) => !t.line).map((t) => t.card.key)
	if (missing.length) await peek.lines(missing, []).catch(() => undefined)
	return titles.map((t) => ({
		...t,
		line: t.line ?? peek.lineCache.get(t.card.key),
		sources: peek.sourcesOf(peek.b.snap.rowOf(t.card.key)),
	}))
}

const short = (kit: Kit, p: PlaceRef) => placeCopy(kit.kind, p.family, p.slug, p.code)?.short

async function placeChannel(kit: Kit, p: Ingredient): Promise<Channel> {
	const ref = kit.ref(p)
	return {
		id: `${p.family}:${p.slug}`,
		sort: "place",
		place: ref,
		name: ref.label,
		line: short(kit, ref),
		// A decade's or a service's two words say little; their line says it better.
		words: ["decade", "service"].includes(p.family)
			? undefined
			: kit.traits([p], { n: 2, less: 0 }).more,
		open: place(kit.kind, [p], kit.country),
		cells: await cells(kit, await kit.showcase([p], CELLS, { lines: true })),
	}
}

async function bestChannel(kit: Kit, parts: Ingredient[] = [], year?: number): Promise<Channel> {
	const list = await kit.best({ parts, year, limit: CELLS })
	const filled = await cells(
		kit,
		list.rows.map((r) => r.title),
	)
	return {
		id: "best",
		sort: "best",
		place: null,
		name: "Best of all time",
		line: bestCopy(kit.kind)?.short,
		open: bestAddress(kit.kind),
		cells: filled.map((c, i) => ({
			...c,
			sources: list.rows[i].sources,
			rank: list.rows[i].rank,
		})),
	}
}

async function popularChannel(kit: Kit): Promise<Channel> {
	return {
		id: "popular",
		sort: "popular",
		place: null,
		name: "Popular right now",
		line: "What everyone else is watching this week.",
		open: null,
		out: kit.discoverHref([], "popular"),
		cells: await cells(kit, await kit.showcase([], CELLS, { by: "popular", lines: true })),
	}
}

/** Builds the rows up to the batch's end in order (so no title repeats across rows), and returns the batch. */
async function batch(
	specs: (() => Promise<Channel>)[],
	url: URL,
): Promise<{ channels: Channel[]; next: number | null; total: number }> {
	const from = Math.max(0, Math.min(specs.length, Number(url.searchParams.get("from")) || 0))
	const to = Math.min(specs.length, from === 0 ? FIRST : from + STEP)
	const built: Channel[] = []
	for (const spec of specs.slice(0, to)) built.push(await spec())
	return {
		channels: built.slice(from).filter((c) => c.cells.length >= 4),
		next: to < specs.length ? to : null,
		total: specs.length,
	}
}

const exists = (kit: Kit, p: Ingredient) => kit.has(p.family, p.slug) && kit.count([p]) >= 24

function lineupOf(kit: Kit) {
	const today = LINEUPS[new Date().getUTCDay()]
	const seen = new Set<string>()
	const channels = today.channels
		.map((p) =>
			kit.kind === "show" && p.family === "genre" && SHOW_SLUG[p.slug]
				? { ...p, slug: SHOW_SLUG[p.slug] }
				: p,
		)
		.filter((p) => {
			const id = `${p.family}:${p.slug}`
			if (seen.has(id) || !exists(kit, p)) return false
			seen.add(id)
			return true
		})
	return { ...today, channels }
}

function mapCountries(kit: Kit): MapCountry[] {
	const members = kit.members("country")
	const max = Math.max(1, ...members.map((m) => kit.count([m])))
	return members.map((m) => ({
		code: m.code ?? "",
		name: m.label,
		slug: m.slug,
		weight: kit.count([m]) / max,
	}))
}

const listOf = (kit: Kit, a: Address) =>
	kit.list(a.parts, {
		sort: a.sort,
		page: a.page,
		mine: a.mine,
		unseen: a.unseen,
		level: a.level,
		venn: a.venn,
		kindId: a.kind_,
		year: a.year,
	})

export const load: ConceptLoader<GuideData> = async ({ kit, address, url }) => {
	const kind = kit.kind

	if (address.view === "best") {
		const list = await kit.best({
			parts: address.parts,
			year: address.year,
			limit: 50,
		})
		const top = await cells(
			kit,
			list.rows.slice(0, CELLS).map((r) => r.title),
		)
		const thisYear = new Date().getUTCFullYear()
		return {
			view: "best",
			title: kit.name(address.parts, { best: true, year: address.year }),
			lede: address.parts.length || address.year ? null : (bestCopy(kind)?.lede ?? null),
			best: list,
			top: {
				id: "best",
				sort: "best",
				place: null,
				name: "The top of the list",
				line: "The first twelve. The whole ranking is right below.",
				open: null,
				cells: top.map((c, i) => ({
					...c,
					sources: list.rows[i].sources,
					rank: list.rows[i].rank,
				})),
			},
			filters: address.parts.map((p) => kit.ref(p)),
			moods: kit.members("mood"),
			genres: kit.members("genre"),
			decades: kit.members("decade").reverse(),
			years: Array.from({ length: 6 }, (_, i) => thisYear - i),
		}
	}

	if (address.view === "family" && address.family) {
		const family: Family = address.family
		let members = kit.members(family)
		if (family === "decade") members = [...members].reverse()
		const waiting = family === "service" && !kit.streamingReady
		const rows = await batch(
			members.map((m) => () => placeChannel(kit, m)),
			url,
		)
		return {
			view: "family",
			family,
			label: family,
			lede: familyCopy(kind, family)?.lede ?? null,
			...rows,
			countries: family === "country" ? mapCountries(kit) : null,
			waiting,
		}
	}

	if (address.view === "place" && address.parts.length) {
		const parts = address.parts
		const lead = parts[0]
		const single = parts.length === 1
		const refs = parts.map((p) => kit.ref(p))
		const waiting = parts.some((p) => p.family === "service") && !kit.streamingReady
		// The decade's own words first: the kit asks for it before any showcase.
		const era = single && lead.family === "decade" ? await kit.era(lead.slug, 0) : null
		const { more, less } = kit.traits(parts, { n: 4, less: 2 })
		const channels: Channel[] = []
		const name = kit.name(parts)
		// One side of a split of two: the first row follows the circles.
		const side =
			!single && parts.length === 2 && address.venn && address.venn !== "both" ? address.venn : null
		const only = side ? refs[side === "a" ? 0 : 1] : null
		channels.push({
			id: "essentials",
			sort: "essentials",
			place: single ? refs[0] : null,
			name: single ? "Start here" : only ? `Only ${only.label}` : "On both",
			line: single
				? "A handful that show what it's about."
				: only
					? `${only.label}, without ${refs[side === "a" ? 1 : 0].label.toLowerCase()}.`
					: "What the channels have in common.",
			open: null,
			cells: await cells(
				kit,
				side
					? (await kit.list(parts, { venn: side, size: CELLS })).titles
					: await kit.showcase(parts, CELLS, { lines: true }),
			),
		})
		let blend = null
		if (single) {
			if (["genre", "mood", "decade", "country", "theme", "style"].includes(lead.family)) {
				const kinds = await kit.kinds(parts, 10)
				for (const k of kinds)
					if (k.titles.length >= 5)
						channels.push({
							id: `kind:${k.id}`,
							sort: "kind",
							place: null,
							name: k.name,
							// What sets the kind apart inside the place, as words.
							words: k.traits,
							open: { ...place(kind, parts, kit.country), kind_: k.id },
							cells: await cells(kit, k.titles),
						})
			}
			const neighbors = await kit.neighbors(lead, { n: 3, titles: 10 })
			for (const n of neighbors)
				if (n.titles.length >= 5)
					channels.push({
						id: `${n.place.family}:${n.place.slug}`,
						sort: "place",
						place: n.place,
						name: n.place.label,
						line: n.differs ? `Next door. ${cap(n.differs)}.` : "Next door.",
						open: place(kind, [n.place], kit.country),
						split: place(kind, [lead, n.place], kit.country),
						cells: await cells(kit, n.titles),
					})
			blend = await kit.blend(parts, { suggestions: 7, titles: 3 })
			blend.suggestions = blend.suggestions.filter((x) => x.place.slug !== "tv-movie").slice(0, 6)
		} else {
			blend = await kit.blend(parts, { suggestions: 4, titles: 10 })
			for (const s of blend.suggestions)
				if (s.titles.length >= 5)
					channels.push({
						id: `add:${s.place.family}:${s.place.slug}`,
						sort: "add",
						place: s.place,
						name: s.place.label,
						line: `Add it: ${kit.name([...parts, s.place]).toLowerCase()}.`,
						open: add(place(kind, parts, kit.country), s.place),
						cells: await cells(kit, s.titles),
					})
		}
		const [people, awards, list] = await Promise.all([
			single ? kit.people(parts, 8).catch(() => []) : Promise.resolve([]),
			single ? kit.awards(parts, 6).catch(() => []) : Promise.resolve([]),
			listOf(kit, address),
		])
		return {
			view: "place",
			title: name,
			parts: refs,
			lede: single ? (placeCopy(kind, lead.family, lead.slug, refs[0].code)?.lede ?? null) : null,
			more,
			less,
			channels,
			era,
			decades: single && lead.family === "decade" ? kit.members("decade") : null,
			profile:
				single && lead.family === "service" ? kit.serviceProfile(lead.slug, kit.country) : null,
			countries: single && lead.family === "country" ? mapCountries(kit) : null,
			blend,
			people,
			awards,
			list,
			waiting,
		}
	}

	const lineup = lineupOf(kit)
	const rows = await batch(
		[
			() => bestChannel(kit),
			...lineup.channels.slice(0, 3).map((p) => () => placeChannel(kit, p)),
			() => popularChannel(kit),
			...lineup.channels.slice(3).map((p) => () => placeChannel(kit, p)),
		],
		url,
	)
	return { view: "hub", day: lineup.day, note: lineup.note, ...rows }
}

const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

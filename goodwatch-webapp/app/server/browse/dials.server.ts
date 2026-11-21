// The loader: for every page a pool of titles with a
// few scores each, and the page's dials. The dials' stops are real addresses (`?level=`, `?tone=`, ...); the page
// arrives ranked for the stops in the address, and the browser re-ranks the same pool while a knob is dragged.
import {
	type Address,
	FAMILY,
	type Family,
	type Ingredient,
	LEVELS,
	type Level,
	familyPage,
	browsePath,
	ing,
	kindLabel,
	kindNoun,
	kindOne,
	place,
	top as topAddress,
} from "~/domain/browse/address"
import type { BrowseLoadArgs } from "./load-args"
import { AXIS_KEYS, type Places } from "~/server/browse/places.server"
import { copyFor } from "~/domain/browse/copy-lookup"
import type {
	AwardWin,
	BestRow,
	Blend,
	Era,
	KindOf,
	Neighbor,
	Person,
	PlaceRef,
	PrintBar,
	ServiceProfile,
	ShowTitle,
	TitleList,
	TraitWord,
} from "~/domain/browse/types"
import { BAND_WORDS } from "~/domain/browse/words"
import {
	type DialSpec,
	type Exit,
	type PoolItem,
	type Stop,
	clamp01,
	percentile,
	rank,
	settingsOf,
	spread,
} from "~/domain/browse/tune"
import {
	AGE_TEXT,
	AXIS_TEXT,
	type AxisId,
	type Evening,
	LOVE_TEXT,
	REACH_TEXT,
	eveningsFor,
} from "~/domain/browse/dial-words"

/** The dial parameters a page adds to the address (the first "much" dial uses the address's `level`). */
const PARAMS = ["tone", "pace", "world", "mind", "reach", "yr", "love", "age", "m1", "m2"] as const
const FIVE = [0, 0.25, 0.5, 0.75, 1]
const NEUTRAL = "#e5e7eb"
export const SHOWN = 24

type Params = Record<string, string | undefined>

/** A place on the two directions the field is drawn on, 0-1 across its family. */
export interface FieldPlace {
	place: PlaceRef
	to: string
	tone: number
	pace: number
	/** The copy deck's one line. */
	line?: string
	/** How it differs from the page's place, and a poster trio (not for the page's own place). */
	differs?: string
	titles: ShowTitle[]
	here?: boolean
	/** 0-1: how alike it is to the page's place. */
	near?: number
}

export interface EveningBand extends Evening {
	level: Level
	name: string
	titles: ShowTitle[]
	to: string
}

interface Head {
	title: string
	kicker: string
	lede: string | null
	crumbs: { label: string; to?: string }[]
}

export type DialsData =
	| (Head & {
			view: "hub"
			dials: DialSpec[]
			pool: PoolItem[]
			moods: FieldPlace[]
			doors: { family: Family; label: string; line: string; to: string; titles: ShowTitle[] }[]
			best: ShowTitle[]
			topTo: string
	  })
	| (Head & {
			view: "family"
			family: Family
			/** How the cards are arranged when no dial is set. */
			arranged: string
			dials: DialSpec[]
			places: (FieldPlace & { words?: TraitWord[]; s: number[] })[]
			groups?: { label: string; color: string; traits: { place: PlaceRef; to: string }[] }[]
			countries?: { code: string; name: string; href: string; weight: number }[]
	  })
	| (Head & {
			view: "place"
			parts: PlaceRef[]
			lead: PlaceRef
			single: boolean
			hue?: string
			more: TraitWord[]
			less: TraitWord[]
			dials: DialSpec[]
			pool: PoolItem[]
			list: TitleList
			print?: (PrintBar & { to?: string })[]
			standouts?: TraitWord[]
			evenings?: { trait: TraitWord; bands: EveningBand[] }
			kinds?: (KindOf & { to: string })[]
			field?: FieldPlace[]
			near?: (Neighbor & { to: string })[]
			nearTitle?: string
			era?: Era
			service?: ServiceProfile & { newTo: string }
			country?: {
				code: string
				countries: { code: string; name: string; href: string; weight: number }[]
			}
			blend?: Blend
			removes?: { part: PlaceRef; to: string; name: string }[]
			suggestions?: { place: PlaceRef; name: string; to: string; titles: ShowTitle[] }[]
			people: Person[]
			awards: AwardWin[]
			hand: { discover: string | null; topTo: string }
	  })
	| (Head & {
			view: "top"
			dials: DialSpec[]
			rows: BestRow[]
			/** Per row: the scores the dials read (love, age, tone). */
			scores: Record<number, number[]>
			published: boolean
			filters: {
				label: string
				value: string | null
				options: { label: string; to: string; on: boolean }[]
				clear: string
			}[]
	  })

// ---------------------------------------------------------------------------------------------------------
// Dials

function paramsOf(url: URL): Params {
	const out: Params = {}
	for (const key of PARAMS) out[key] = url.searchParams.get(key) ?? undefined
	return out
}

/** The same page with one dial moved (or put to rest), every other dial where it is. */
function linker(address: Address, params: Params) {
	return (id: string, value: string | undefined) => {
		const a: Address = { ...address, page: undefined, sort: undefined }
		if (id === "level") return browsePath({ ...a, level: value as Level | undefined }, params)
		return browsePath(a, { ...params, [id]: value })
	}
}

function fiveStops(
	id: string,
	names: readonly string[],
	blurbs: readonly string[],
	link: ReturnType<typeof linker>,
): Stop[] {
	return FIVE.map((at, i) => ({
		id: String(i + 1),
		name: names[i],
		at,
		blurb: blurbs[i],
		to: link(id, String(i + 1)),
	}))
}

function axisDial(
	axis: AxisId,
	col: number,
	values: number[],
	ctx: { link: ReturnType<typeof linker>; params: Params; absolute?: boolean; noun: string },
	exits?: { low: Exit | null; high: Exit | null; home: number | null; homeLabel: string },
): DialSpec {
	const text = AXIS_TEXT[axis]
	return {
		id: axis,
		kind: "axis",
		question: text.question,
		color: NEUTRAL,
		col,
		lo: percentile(values, 0.06),
		hi: percentile(values, 0.94),
		stops: fiveStops(axis, ctx.absolute ? text.absolute : text.stops, text.blurbs, ctx.link),
		home: exits?.home ?? null,
		homeLabel: exits?.homeLabel,
		value: ctx.params[axis] ?? null,
		off: ctx.link(axis, undefined),
		low: text.low,
		high: text.high,
		lowExit: exits?.low ?? null,
		highExit: exits?.high ?? null,
	}
}

function reachDial(
	col: number,
	ctx: { link: ReturnType<typeof linker>; params: Params },
): DialSpec {
	return {
		id: "reach",
		kind: "reach",
		question: REACH_TEXT.question,
		color: NEUTRAL,
		col,
		lo: 0,
		hi: 1,
		stops: fiveStops("reach", REACH_TEXT.stops, REACH_TEXT.blurbs, ctx.link),
		home: null,
		value: ctx.params.reach ?? null,
		off: ctx.link("reach", undefined),
		low: REACH_TEXT.low,
		high: REACH_TEXT.high,
	}
}

/** "How scary?": a touch, plenty, all the way. */
function muchDial(
	id: string,
	trait: TraitWord,
	col: number,
	value: string | undefined,
	link: ReturnType<typeof linker>,
	opts: { widens: boolean; home: boolean; label: string },
): DialSpec {
	const at: Record<Level, number> = { touch: 0.12, plenty: 0.55, full: 0.95 }
	return {
		id,
		kind: "much",
		question: `How ${trait.word === "situationally funny" ? "funny" : trait.word}?`,
		color: trait.color,
		col,
		lo: 4,
		hi: 10,
		stops: LEVELS.map((level) => ({
			id: level,
			name: BAND_WORDS[level].name,
			at: at[level],
			blurb: MUCH_BLURB[level](trait.word === "situationally funny" ? "funny" : trait.word),
			to: link(id, level),
		})),
		home: opts.home ? clamp01((trait.value - 4) / 6) : null,
		homeLabel: opts.label,
		value: value ?? null,
		off: link(id, undefined),
		low: "A touch",
		high: "All the way",
		widens: opts.widens,
	}
}

const MUCH_BLURB: Record<Level, (adj: string) => string> = {
	touch: (adj) => `A little ${adj}, not the main event.`,
	plenty: (adj) => `Properly ${adj}, start to finish.`,
	full: (adj) => `As ${adj} as it gets.`,
}

const keyOfTrait = (t: TraitWord) => t.key

/** Titles into pool items with their scores; `extra` appends columns after the fingerprint ones. */
function toPool(
	atlas: Places,
	groups: { titles: ShowTitle[]; member: boolean }[],
	keys: string[],
	extra: (t: ShowTitle, index: number, member: boolean) => number[] = () => [],
): PoolItem[] {
	const seen = new Set<number>()
	const out: PoolItem[] = []
	for (const g of groups) {
		const scores = atlas.scores(g.titles, keys)
		g.titles.forEach((t, i) => {
			if (seen.has(t.card.key)) return
			seen.add(t.card.key)
			out.push({
				t,
				s: [...(scores[t.card.key] ?? keys.map(() => 0)), ...extra(t, i, g.member)],
				m: g.member ? 1 : 0,
			})
		})
	}
	return out
}

/** The directions whose titles differ most here: those dials have something to say. */
function liveAxes(pool: PoolItem[], firstCol: number, n: number): AxisId[] {
	const members = pool.filter((i) => i.m)
	return AXIS_KEYS.map((axis, i) => ({
		axis: axis as AxisId,
		spread: spread(members.map((m) => m.s[firstCol + i])),
	}))
		.sort((a, b) => b.spread - a.spread)
		.slice(0, n)
		.map((x) => x.axis)
		.sort((a, b) => AXIS_KEYS.indexOf(a) - AXIS_KEYS.indexOf(b))
}

// ---------------------------------------------------------------------------------------------------------
// Shared pieces

const placeTo = (atlas: Places, p: Ingredient, country?: string) =>
	browsePath(place(atlas.kind, [p], country ?? atlas.country))

const hubCrumb = (atlas: Places) => ({
	label: kindLabel(atlas.kind),
	to: browsePath({ view: "hub", kind: atlas.kind, parts: [], country: "us" }),
})

/** A family on the two directions of the field: every member's position, 0-1. */
function positions(
	atlas: Places,
	family: Family,
): Map<string, { tone: number; pace: number; all: number[] }> {
	const out = new Map<string, { tone: number; pace: number; all: number[] }>()
	for (const m of atlas.members(family)) {
		const dials = atlas.dials(m)
		const at = (key: string) => dials.find((d) => d.key === key)?.at ?? 0.5
		out.set(m.slug, {
			tone: at("tone"),
			pace: at("pace"),
			all: AXIS_KEYS.map((k) => at(k)),
		})
	}
	return out
}

const FIELD_FAMILIES: Family[] = ["mood", "genre", "theme", "style"]

// ---------------------------------------------------------------------------------------------------------
// Pages

/**
 * The hub's dials and the pool of titles they rank: titles from all over (what is watched now and the best-loved), so
 * every corner of the dials has something. `axes` are the directions offered, in order; the pool's score columns
 * follow them.
 */
async function tuneHub(atlas: Places, address: Address, url: URL, axes: AxisId[]) {
	const params = paramsOf(url)
	const link = linker(address, params)
	const noun = kindNoun(atlas.kind)
	const [popular, top] = await Promise.all([
		atlas.list([], { size: 96 }),
		atlas.list([], { sort: "top", size: 120 }),
	])
	const pool = toPool(
		atlas,
		[
			// The first rows are what the page shows at rest; past them only titles people rate well.
			{
				titles: popular.titles.filter(
					(t, i) => i < 6 || (t.card.goodwatch_overall_score_normalized_percent ?? 0) >= 62,
				),
				member: true,
			},
			{ titles: top.titles, member: true },
		],
		axes,
	)
	const ctx = { link, params, absolute: true, noun }
	const dials = axes.map((axis, col) =>
		axisDial(
			axis,
			col,
			pool.map((i) => i.s[col]),
			ctx,
		),
	)
	return { pool, dials, noun }
}

/**
 * For a hub tile: the hub's dials over the given directions, their pool, and every mood's position on each direction
 * (0-1), so a page can name the mood the dials land on.
 */
export async function hubTune(
	atlas: Places,
	address: Address,
	url: URL,
	axes: AxisId[] = ["tone", "pace"],
) {
	const { pool, dials } = await tuneHub(atlas, address, url, axes)
	const pos = positions(atlas, "mood")
	const moods = atlas.members("mood").map((m) => ({
		place: m,
		to: placeTo(atlas, m),
		at: Object.fromEntries(
			axes.map((a) => [a, pos.get(m.slug)?.all[AXIS_KEYS.indexOf(a)] ?? 0.5]),
		) as Record<string, number>,
	}))
	return { pool, dials, moods }
}

async function loadHub(atlas: Places, address: Address, url: URL): Promise<DialsData> {
	const { pool, dials, noun } = await tuneHub(atlas, address, url, ["tone", "pace"])
	const pos = positions(atlas, "mood")
	const shown = rank(pool, dials, settingsOf(dials), 6)
	for (const i of shown) atlas.used.add(i.t.card.key)
	const moods: FieldPlace[] = await Promise.all(
		atlas.members("mood").map(async (m) => ({
			place: m,
			to: placeTo(atlas, m),
			tone: pos.get(m.slug)?.tone ?? 0.5,
			pace: pos.get(m.slug)?.pace ?? 0.5,
			line: copyFor(atlas.kind, "mood", m.slug)?.short,
			titles: await atlas.showcase([m], 3),
		})),
	)
	const doorFamilies: Family[] = ["genre", "decade", "country", "service", "trait"]
	const doors = await Promise.all(
		doorFamilies.map(async (family) => {
			const members = atlas.members(family)
			const picks =
				family === "decade"
					? [members.at(-1), members.at(-4), members.at(-6)]
					: family === "trait"
						? ["scare", "wholesome", "surrealism"].map((s) => members.find((m) => m.slug === s))
						: members.slice(0, 3)
			const titles = (
				await Promise.all(
					picks.filter((p): p is PlaceRef => !!p).map((p) => atlas.showcase([p], 1, { by: "fit" })),
				)
			).flat()
			return {
				family,
				label:
					family === "trait"
						? "By how much"
						: family === "service"
							? "By streaming service"
							: `By ${FAMILY[family].one.toLowerCase()}`,
				line:
					family === "trait"
						? "A touch of scary, or all the way? Pick a trait and how much of it."
						: (copyFor(atlas.kind, "hub", FAMILY[family].many.toLowerCase())?.short ??
							copyFor(
								atlas.kind,
								"hub",
								family === "service"
									? "services"
									: `${family === "country" ? "countrie" : family}s`,
							)?.short ??
							""),
				to: browsePath(familyPage(atlas.kind, family, atlas.country)),
				titles,
			}
		}),
	)
	const bestList = await atlas.best({ limit: 8 })
	return {
		view: "hub",
		title: atlas.kind === "show" ? "What kind of night is it?" : "What kind of night is it?",
		kicker: kindLabel(atlas.kind),
		lede: `Turn the two dials until it sounds like tonight. The ${noun} follow along, and so do the moods that fit.`,
		crumbs: [],
		dials,
		pool,
		moods,
		doors,
		best: bestList.rows.map((r) => r.title),
		topTo: browsePath(topAddress(atlas.kind)),
	}
}

async function loadFamily(atlas: Places, address: Address, url: URL): Promise<DialsData> {
	const family = address.family as Family
	const params = paramsOf(url)
	const link = linker(address, params)
	const noun = kindNoun(atlas.kind)
	const members = atlas.members(family)
	const copyKey =
		family === "service" ? "services" : family === "country" ? "countries" : `${family}s`
	const head: Head = {
		title: `${kindLabel(atlas.kind)} by ${
			family === "service"
				? "streaming service"
				: family === "trait"
					? "how much"
					: FAMILY[family].one.toLowerCase()
		}`,
		kicker: kindLabel(atlas.kind),
		lede:
			family === "trait"
				? `Every ${kindOne(atlas.kind)} has a little of this and a lot of that. Pick one thing, then decide how much of it you want tonight: a touch, plenty, or all the way.`
				: (copyFor(atlas.kind, "hub", copyKey)?.lede ?? null),
		crumbs: [hubCrumb(atlas), { label: FAMILY[family].many }],
	}
	if (family === "trait") {
		const groups = new Map<
			string,
			{ label: string; color: string; traits: { place: PlaceRef; to: string }[] }
		>()
		const labels: Record<string, string> = {
			feel: "How it feels",
			humor: "How it's funny",
			world: "Where it's set",
			story: "What it's about",
			craft: "How it's told",
		}
		for (const m of members) {
			const word = atlas.traits([m], { n: 1 }).more.find((t) => t.part.slug === m.slug)
			const fam =
				word?.family ??
				atlas.print([m]).find((b) => b.key === m.slug.replace(/-/g, "_"))?.family ??
				"story"
			const g = groups.get(fam) ?? {
				label: labels[fam] ?? fam,
				color: m.hue ?? NEUTRAL,
				traits: [],
			}
			g.traits.push({ place: m, to: placeTo(atlas, m) })
			groups.set(fam, g)
		}
		const featured = [
			"scare",
			"wholesome",
			"romance",
			"adrenaline",
			"situational-comedy",
			"surrealism",
			"melancholy",
			"wonder",
		]
			.map((s) => members.find((m) => m.slug === s))
			.filter((m): m is PlaceRef => !!m)
		const places = await Promise.all(
			featured.map(async (m) => ({
				place: m,
				to: placeTo(atlas, m),
				tone: 0.5,
				pace: 0.5,
				s: [],
				line: eveningsFor(m.slug, m.adj ?? m.label).plenty.line,
				titles: await atlas.showcase([m], 3),
			})),
		)
		return {
			view: "family",
			family,
			...head,
			arranged: "",
			dials: [],
			places,
			groups: ["feel", "humor", "world", "story", "craft"]
				.map((k) => groups.get(k))
				.filter((g): g is NonNullable<typeof g> => !!g),
		}
	}
	const field = FIELD_FAMILIES.includes(family)
	const pos = field ? positions(atlas, family) : null
	const ordered =
		family === "decade"
			? [...members].reverse()
			: pos
				? [...members].sort((a, b) => (pos.get(a.slug)?.tone ?? 0) - (pos.get(b.slug)?.tone ?? 0))
				: members
	const shownMembers = family === "country" ? ordered.slice(0, 12) : ordered
	const places = await Promise.all(
		shownMembers.map(async (m, i) => ({
			place: m,
			to: placeTo(atlas, m),
			tone: pos?.get(m.slug)?.tone ?? 0.5,
			pace: pos?.get(m.slug)?.pace ?? 0.5,
			s: pos
				? (pos.get(m.slug)?.all ?? [])
				: [shownMembers.length > 1 ? i / (shownMembers.length - 1) : 0],
			line: copyFor(atlas.kind, family, m.slug)?.short,
			words: atlas.traits([m], { n: 2 }).more,
			titles: await atlas.showcase([m], 3),
		})),
	)
	const ctx = { link, params, noun }
	let dials: DialSpec[] = []
	let arranged = ""
	if (pos) {
		dials = (["tone", "pace", "world", "mind"] as AxisId[])
			.slice(0, family === "mood" || family === "genre" ? 3 : 2)
			.map((axis) => ({
				...axisDial(axis, AXIS_KEYS.indexOf(axis), [0, 1], ctx),
				lo: 0,
				hi: 1,
			}))
		arranged = `From the lightest to the darkest. Turn a dial to bring the ones that fit to the front.`
	} else if (family === "service") {
		dials = [
			{
				...reachDial(0, ctx),
				question: "Something for everyone, or for film lovers?",
				low: "For everyone",
				high: "For film lovers",
				stops: fiveStops(
					"reach",
					["The biggest", "Big", "In between", "Smaller", "The most select"],
					[
						"The giants: a bit of everything, and a lot of it.",
						"Big catalogs with a clear favorite genre or two.",
						"Mid-size services that know what they're for.",
						"Smaller catalogs with a point of view.",
						"Small, hand-picked, and proud of it.",
					],
					link,
				),
			},
		]
		arranged = "From the biggest catalogs to the most select."
	} else if (family === "decade") arranged = "From now back to the early talkies."
	return {
		view: "family",
		family,
		...head,
		arranged,
		dials,
		places,
		countries:
			family === "country"
				? members.map((m, i) => ({
						code: (m.code ?? m.slug).toUpperCase(),
						name: m.label,
						href: placeTo(atlas, m),
						weight: 1 - (i / Math.max(1, members.length)) * 0.3,
					}))
				: undefined,
	}
}

async function loadPlace(atlas: Places, address: Address, url: URL): Promise<DialsData> {
	const parts = address.parts
	const refs = parts.map((p) => atlas.ref(p))
	const single = parts.length === 1
	const lead = refs[0]
	const family = lead.family
	const noun = kindNoun(atlas.kind)
	const params = paramsOf(url)
	const link = linker(address, params)
	const title = atlas.name(parts)
	const lower = title.charAt(0).toLowerCase() + title.slice(1)
	const soft = (p: Ingredient) => ["mood", "theme", "style", "trait"].includes(p.family)

	// The "much" dials: one per ingredient that has a lead trait (the first runs on the atlas's `level`).
	const muchParts = single
		? ["mood", "theme", "style", "trait", "genre"].includes(family)
			? [parts[0]]
			: []
		: parts
				.filter((p) => ["mood", "theme", "style", "trait", "genre"].includes(p.family))
				.slice(0, 3)
	const intensity = muchParts.length
		? await atlas.intensity(single ? parts : [muchParts[0]], 0)
		: null
	const muchTraits: TraitWord[] = muchParts
		.map((p, i) =>
			i === 0 && intensity
				? intensity.trait
				: (atlas.traits([p], { n: 1 }).more[0] as TraitWord | undefined),
		)
		.filter((t): t is TraitWord => !!t)
	const muchKeys = muchTraits.map(keyOfTrait)
	const widen = single && soft(parts[0]) && muchTraits.length > 0

	// The pool: the place's own titles, plus (for a widening dial) the titles with a touch, plenty and all of it.
	const wantsReach = single && ["decade", "country", "service"].includes(family)
	const [own, topRated, ...bands] = await Promise.all([
		atlas.list(parts, { size: 84 }),
		wantsReach ? atlas.list(parts, { sort: "top", size: 60 }) : Promise.resolve(null),
		...(widen ? LEVELS.map((level) => atlas.list(parts, { level, sort: "top", size: 32 })) : []),
	])
	const ownCount = own.titles.length
	const cols = [...muchKeys, ...AXIS_KEYS]
	const A = muchKeys.length
	const pool = toPool(
		atlas,
		[
			{ titles: own.titles, member: true },
			...(topRated ? [{ titles: topRated.titles, member: true }] : []),
			...bands.map((b) => ({ titles: (b as TitleList).titles, member: false })),
		],
		cols,
		(t, i, member) => [
			// reach: 0 for what everyone watches, 1 for what few have found
			member && i < ownCount && own.titles[i]?.card.key === t.card.key
				? (i / Math.max(1, ownCount)) * 0.7
				: 1,
			t.card.release_year ?? 0,
		],
	)
	const REACH = cols.length
	const YEAR = cols.length + 1

	const ctx = { link, params, noun }
	const dials: DialSpec[] = []
	muchTraits.forEach((trait, i) => {
		const id = i === 0 ? "level" : `m${i}`
		dials.push(
			muchDial(id, trait, i, i === 0 ? address.level : params[id], link, {
				widens: widen,
				home: single && soft(parts[0]),
				label: `Where ${lower} sit`,
			}),
		)
	})
	// Directions. Past either end of a direction lies another place of the family: the one most like this place
	// among those that sit clearly further that way.
	const inField = single && FIELD_FAMILIES.includes(family)
	const pos = inField ? positions(atlas, family) : null
	const alike = inField
		? await atlas.neighbors(parts[0], { n: 40, within: "family", titles: 0 })
		: []
	const members = pool.filter((i) => i.m)
	const exitsTaken = new Set<string>()
	const addAxis = (axis: AxisId) => {
		const col = A + AXIS_KEYS.indexOf(axis)
		const a = AXIS_KEYS.indexOf(axis)
		const mine = pos?.get(lead.slug)?.all[a]
		// Each direction leads to its own place: one a neighbor dial already leads to is skipped, and a direction
		// with nowhere of its own to go shows no exit.
		const further = (dir: 1 | -1): Exit | null => {
			if (mine === undefined || !pos) return null
			const hit = alike.find(
				(n) =>
					!exitsTaken.has(n.place.slug) &&
					((pos.get(n.place.slug)?.all[a] ?? mine) - mine) * dir >= 0.12,
			)
			if (!hit) return null
			exitsTaken.add(hit.place.slug)
			return { place: hit.place, to: placeTo(atlas, hit.place) }
		}
		dials.push(
			axisDial(
				axis,
				col,
				members.map((m) => m.s[col]),
				ctx,
				pos ? { low: further(-1), high: further(1), home: null, homeLabel: "" } : undefined,
			),
		)
	}
	if (single && family === "decade") {
		const start = Number(parts[0].slug.slice(0, 4))
		const decades = atlas.members("decade")
		const at = decades.findIndex((d) => d.slug === parts[0].slug)
		const prev = decades.find((d) => Number(d.slug.slice(0, 4)) === start - 10) ?? null
		const next = decades.find((d) => Number(d.slug.slice(0, 4)) === start + 10) ?? null
		void at
		dials.push({
			id: "yr",
			kind: "year",
			question: "Early or late?",
			color: NEUTRAL,
			col: YEAR,
			lo: start,
			hi: start + 9,
			stops: Array.from({ length: 10 }, (_, i) => ({
				id: String(start + i),
				name: String(start + i),
				at: i / 9,
				blurb: `What came out in ${start + i}.`,
				to: link("yr", String(start + i)),
			})),
			home: null,
			value: params.yr ?? null,
			off: link("yr", undefined),
			low: String(start),
			high: String(start + 9),
			lowExit: prev ? { place: prev, to: placeTo(atlas, prev) } : null,
			highExit: next ? { place: next, to: placeTo(atlas, next) } : null,
		})
	}
	const axisCount = Math.max(1, 3 - dials.length - (wantsReach ? 1 : 0))
	for (const axis of liveAxes(pool, A, Math.min(axisCount, dials.length >= 3 ? 0 : axisCount)))
		addAxis(axis)
	if (wantsReach) dials.push(reachDial(REACH, ctx))

	const settings = settingsOf(dials)
	const list = await atlas.list(parts, {
		sort: address.sort,
		page: address.page,
		mine: address.mine,
		unseen: address.unseen,
		kindId: address.kind_,
		size: 24,
	})
	for (const i of rank(pool, dials, settings, SHOWN)) atlas.used.add(i.t.card.key)
	for (const t of list.titles) atlas.used.add(t.card.key)

	const { more, less } = atlas.traits(parts, { n: 4, less: 2 })
	const out: Extract<DialsData, { view: "place" }> = {
		view: "place",
		title,
		kicker: single ? FAMILY[family].one : "Blend",
		lede: single ? (copyFor(atlas.kind, family, lead.slug)?.lede ?? null) : null,
		crumbs: [
			hubCrumb(atlas),
			{
				label: FAMILY[family].many,
				to: browsePath(familyPage(atlas.kind, family, address.country)),
			},
			{ label: single ? lead.label : refs.map((r) => r.label).join(" + ") },
		],
		parts: refs,
		lead,
		single,
		hue: refs.find((r) => r.family === "mood")?.hue,
		more,
		less,
		dials,
		pool,
		list,
		people: [],
		awards: [],
		hand: {
			discover: list.discoverHref,
			topTo: browsePath(
				topAddress(
					atlas.kind,
					parts.filter((p) => ["mood", "genre", "decade"].includes(p.family)),
				),
			),
		},
	}

	if (single && family === "trait" && intensity) {
		const ev = eveningsFor(lead.slug, intensity.trait.word)
		const full = await atlas.intensity(parts, 8)
		out.evenings = {
			trait: intensity.trait,
			bands: (full?.bands ?? []).map((b) => ({
				level: b.level,
				name: b.name,
				...ev[b.level],
				titles: b.titles,
				to: link("level", b.level),
			})),
		}
		out.lede = `How ${intensity.trait.word} do you want it? A touch, plenty, or all the way make three very different evenings. Pick one, or turn the dial yourself.`
		out.kicker = "How much"
	}
	if (single && family === "genre") {
		out.print = atlas.print(parts).map((b) => {
			const slug = b.key.replace(/_/g, "-")
			return { ...b, to: atlas.has("trait", slug) ? placeTo(atlas, ing("trait", slug)) : undefined }
		})
		out.standouts = atlas.traits(parts, { n: 6 }).more
		out.kinds = (await atlas.kinds(parts, 4)).map((k) => ({
			...k,
			to: `${browsePath({ ...address, kind_: k.id, page: undefined, sort: undefined })}#titles`,
		}))
	}
	if (inField && pos) {
		const neighbors = await atlas.neighbors(parts[0], { n: 30, within: "family", titles: 3 })
		const top = Math.max(...neighbors.map((n) => n.similarity), 0.01)
		const low = Math.min(...neighbors.map((n) => n.similarity), 0)
		out.field = [
			{
				place: lead,
				to: placeTo(atlas, lead),
				tone: pos.get(lead.slug)?.tone ?? 0.5,
				pace: pos.get(lead.slug)?.pace ?? 0.5,
				titles: [],
				here: true,
				near: 1,
			},
			...neighbors.map((n) => ({
				place: n.place,
				to: placeTo(atlas, n.place),
				tone: pos.get(n.place.slug)?.tone ?? 0.5,
				pace: pos.get(n.place.slug)?.pace ?? 0.5,
				differs: n.differs,
				titles: n.titles,
				line: copyFor(atlas.kind, family, n.place.slug)?.short,
				near: top > low ? (n.similarity - low) / (top - low) : 0.5,
			})),
		]
	}
	if (single && family === "trait") {
		const near = await atlas.neighbors(parts[0], { n: 4, within: "all", titles: 3 })
		out.near = near.map((n) => ({ ...n, to: placeTo(atlas, n.place) }))
		out.nearTitle = `Where it runs strong`
	}
	if (single && (family === "country" || family === "decade")) {
		const near = await atlas.neighbors(parts[0], { n: 4, within: "family", titles: 3 })
		out.near = near.map((n) => ({ ...n, to: placeTo(atlas, n.place) }))
	}
	if (single && family === "decade") out.era = (await atlas.era(lead.slug, 0)) ?? undefined
	if (single && family === "service") {
		const profile = atlas.serviceProfile(lead.slug, address.country)
		if (profile) out.service = { ...profile, newTo: `/new/${address.country}/${lead.slug}` }
		const others = (profile?.others ?? []).slice(0, 4)
		out.near = await Promise.all(
			others.map(async (o) => ({
				place: o,
				differs: "",
				trait: null,
				overlap: 0,
				similarity: 0,
				titles: await atlas.showcase([o], 3),
				to: placeTo(atlas, o, address.country),
			})),
		)
		out.nearTitle = `Other services in ${profile?.countryName ?? "your country"}`
	}
	if (single && family === "country") {
		const all = atlas.members("country")
		out.country = {
			code: (lead.code ?? lead.slug).toUpperCase(),
			countries: all.map((m, i) => ({
				code: (m.code ?? m.slug).toUpperCase(),
				name: m.label,
				href: placeTo(atlas, m),
				weight: 1 - (i / Math.max(1, all.length)) * 0.3,
			})),
		}
	}
	const suggest = (blend: Blend) =>
		blend.suggestions
			.filter((s) => s.place.slug !== "tv-movie")
			.slice(0, 4)
			.map((s) => ({
				place: s.place,
				name: atlas.name([...parts, s.place]),
				titles: s.titles,
				to: browsePath(place(atlas.kind, [...parts, s.place], address.country)),
			}))
	if (!single) {
		const blend = await atlas.blend(parts, { suggestions: 6, titles: 3 })
		out.blend = blend
		out.removes = refs.map((r) => {
			const rest = parts.filter((p) => !(p.family === r.family && p.slug === r.slug))
			return {
				part: r,
				name: atlas.name(rest),
				to: browsePath(place(atlas.kind, rest, address.country)),
			}
		})
		out.suggestions = suggest(blend)
	} else if (family !== "service") {
		// One step into a blend: what goes well with this place.
		out.suggestions = suggest(await atlas.blend(parts, { suggestions: 6, titles: 3 }))
	}
	const [people, awards] = await Promise.all([
		atlas.people(parts, 6).catch(() => []),
		atlas.awards(parts, 6).catch(() => []),
	])
	out.people = people
	out.awards = awards
	return out
}

async function loadTop(atlas: Places, address: Address, url: URL): Promise<DialsData> {
	const params = paramsOf(url)
	const link = linker(address, params)
	const list = await atlas.best({ parts: address.parts, year: address.year, limit: 100 })
	const rows = list.rows
	const tones = atlas.scores(
		rows.map((r) => r.title),
		["tone"],
	)
	const avg = (xs: (number | undefined)[]) => {
		const v = xs.filter((x): x is number => typeof x === "number")
		return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
	}
	const scores: Record<number, number[]> = {}
	for (const r of rows) {
		const critics = avg([r.sources.metacritic, r.sources.rtCritics])
		const crowd = avg([
			r.sources.imdb,
			r.sources.letterboxd,
			r.sources.metacriticUsers,
			r.sources.rtAudience,
		])
		scores[r.title.card.key] = [
			critics !== null && crowd !== null ? crowd - critics : 0,
			r.title.card.release_year ?? 0,
			tones[r.title.card.key]?.[0] ?? 0,
		]
	}
	const col = (i: number) => rows.map((r) => scores[r.title.card.key][i])
	const ctx = { link, params, noun: "" }
	const loves = col(0)
	const span = Math.max(Math.abs(percentile(loves, 0.05)), Math.abs(percentile(loves, 0.95)), 1)
	const dials: DialSpec[] = [
		{
			id: "love",
			kind: "love",
			question: LOVE_TEXT.question,
			color: NEUTRAL,
			col: 0,
			lo: -span,
			hi: span,
			stops: fiveStops("love", LOVE_TEXT.stops, LOVE_TEXT.blurbs, link),
			home: null,
			value: params.love ?? null,
			off: link("love", undefined),
			low: LOVE_TEXT.low,
			high: LOVE_TEXT.high,
		},
		...(address.year
			? []
			: [
					{
						id: "age",
						kind: "year" as const,
						question: AGE_TEXT.question,
						color: NEUTRAL,
						col: 1,
						lo: percentile(col(1), 0.04),
						hi: percentile(col(1), 0.96),
						stops: fiveStops("age", AGE_TEXT.stops, AGE_TEXT.blurbs, link),
						home: null,
						value: params.age ?? null,
						off: link("age", undefined),
						low: AGE_TEXT.low,
						high: AGE_TEXT.high,
					},
				]),
		axisDial("tone", 2, col(2), ctx),
	]
	const filter = (family: Family, label: string, slugs?: string[]) => {
		const current = address.parts.find((p) => p.family === family)
		const others = address.parts.filter((p) => p.family !== family)
		const members = atlas.members(family).filter((m) => !slugs || slugs.includes(m.slug))
		const ordered = family === "decade" ? [...members].reverse() : members
		return {
			label,
			value: current ? atlas.ref(current).label : null,
			clear: browsePath(topAddress(atlas.kind, others, address.year)),
			options: ordered.map((m) => ({
				label: m.label,
				to: browsePath(
					topAddress(
						atlas.kind,
						[...others, ing(family, m.slug)],
						family === "decade" ? undefined : address.year,
					),
				),
				on: current?.slug === m.slug,
			})),
		}
	}
	const thisYear = new Date().getFullYear()
	const years = Array.from({ length: 12 }, (_, i) => thisYear - i)
	const noDecade = address.parts.filter((p) => p.family !== "decade")
	return {
		view: "top",
		title: atlas.name(address.parts, { top: true, year: address.year }),
		kicker: "Top",
		lede:
			address.parts.length || address.year
				? null
				: (copyFor(atlas.kind, "best", "all")?.lede ?? null),
		crumbs: [],
		dials,
		rows,
		scores,
		published: list.published,
		filters: [
			filter("mood", "Mood"),
			filter("genre", "Genre"),
			filter("decade", "Decade"),
			{
				label: "Year",
				value: address.year ? String(address.year) : null,
				clear: browsePath(topAddress(atlas.kind, address.parts)),
				options: years.map((y) => ({
					label: String(y),
					to: browsePath(topAddress(atlas.kind, noDecade, y)),
					on: address.year === y,
				})),
			},
		],
	}
}

/** The dials and their pool for a Browse page: the hub, a family index, a place or blend, or Top. */
export async function loadDials({ atlas, address, url }: BrowseLoadArgs): Promise<DialsData> {
	if (address.view === "top") return loadTop(atlas, address, url)
	if (address.view === "family" && address.family) return loadFamily(atlas, address, url)
	if (address.view === "place" && address.parts.length) return loadPlace(atlas, address, url)
	return loadHub(atlas, address, url)
}

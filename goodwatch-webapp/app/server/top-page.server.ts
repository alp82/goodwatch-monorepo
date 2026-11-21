// The Top page's data (`/movies/top`, `/shows/top`, `/all/top`, and their filters `?with=` and `?year=`).
//
// Without filters it is the published ranking (domain/top-lists.ts: the sitemap's well-known titles, top first, 250 a
// page). With a mood, genre, decade or year the place's titles rank by a score that trusts many ratings over few. An
// all-time list (no year, no decade) leaves out titles too new for their score to have settled.
//
// Three dials re-sort a page in the browser without leaving it: critics or the crowd, old or new, lighter or darker.
// Their stops are links too, so a tuned page is an address. docs/implementation/explore-rethink/spec.md
import {
	type Address,
	type Family,
	type Ingredient,
	type Kind,
	browsePath,
	ing,
	top,
} from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy"
import type { BestRow } from "~/domain/browse/types"
import {
	PER_PAGE,
	type TopKind,
	listCopy,
	pageCount,
	pageRange,
	pagePath,
	titleKindOf,
} from "~/domain/top-lists"
import type { Places } from "~/server/browse/places.server"
import { getRankedList } from "~/server/top-lists.server"
import { type DialSpec, type Stop, percentile } from "~/domain/browse/tune"
import { AGE_TEXT, AXIS_TEXT, LOVE_TEXT } from "~/domain/browse/dial-words"

export interface TopFilter {
	label: string
	/** The picked option's name, or null for "Any". */
	value: string | null
	options: { label: string; to: string; on: boolean }[]
	/** The page without this filter. */
	clear: string
}

export interface TopPage {
	kind: Kind
	listKind: TopKind
	/** Without filters: the published ranking, with its own canonical pages. */
	published: boolean
	heading: string
	intro: string
	title: string
	description: string
	page: number
	pages: number
	total: number
	/** The rank of the page's first title. */
	first: number
	rows: BestRow[]
	/** Per title: the values the dials read (crowd minus critics, release year, tone). */
	scores: Record<number, number[]>
	dials: DialSpec[]
	filters: TopFilter[]
	/** The canonical address of this page. */
	canonical: string
	prev?: string
	next?: string
}

/** The kind's list for the copy: "movies", "shows", or both together. */
export const topKindOf = (kind: Kind): TopKind =>
	kind === "all" ? "all" : kind === "show" ? "shows" : "movies"

const NEUTRAL = "#e5e7eb"
const FIVE = [0, 0.25, 0.5, 0.75, 1]
/** The dials' parameters in the address. */
export const TOP_DIALS = ["love", "age", "tone"] as const

const avg = (xs: (number | undefined)[]) => {
	const v = xs.filter((x): x is number => typeof x === "number")
	return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

/** The same Top page with one dial moved (or put to rest), the other dials where they are, back on page 1. */
function dialLink(address: Address, search: URLSearchParams) {
	return (id: string, value: string | undefined) => {
		const keep: Record<string, string | undefined> = {}
		for (const d of TOP_DIALS) keep[d] = search.get(d) ?? undefined
		keep[id] = value
		return browsePath({ ...address, page: undefined }, { ...keep, fine: undefined })
	}
}

function fiveStops(
	id: string,
	names: readonly string[],
	blurbs: readonly string[],
	link: ReturnType<typeof dialLink>,
): Stop[] {
	return FIVE.map((at, i) => ({
		id: String(i + 1),
		name: names[i],
		at,
		blurb: blurbs[i],
		to: link(id, String(i + 1)),
	}))
}

export async function loadTopPage(
	places: Places,
	address: Address,
	search: URLSearchParams,
): Promise<TopPage | null> {
	const kind = address.kind
	const listKind = topKindOf(kind)
	const parts = address.parts
	const year = address.year
	const filtered = parts.length > 0 || year !== undefined
	const page = address.page && address.page > 1 ? address.page : 1
	const settled = !year && !parts.some((p) => p.family === "decade")
	const list = await places.best({
		parts,
		year,
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE,
		settled,
	})
	const total = list.total
	const pages = pageCount(total)
	if (page > pages) return null
	const { first } = pageRange(page, total)
	const rows = list.rows

	// The dials read per title: who loves it more (the crowd's sources minus the critics'), its year, its tone.
	const tones = places.scores(
		rows.map((r) => r.title),
		["tone"],
	)
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
	const link = dialLink(address, search)
	const loves = col(0)
	const span = rows.length
		? Math.max(Math.abs(percentile(loves, 0.05)), Math.abs(percentile(loves, 0.95)), 1)
		: 1
	const tone = AXIS_TEXT.tone
	const dials: DialSpec[] = rows.length
		? [
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
					value: search.get("love"),
					off: link("love", undefined),
					low: LOVE_TEXT.low,
					high: LOVE_TEXT.high,
				},
				...(year
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
								value: search.get("age"),
								off: link("age", undefined),
								low: AGE_TEXT.low,
								high: AGE_TEXT.high,
							},
						]),
				{
					id: "tone",
					kind: "axis",
					question: tone.question,
					color: NEUTRAL,
					col: 2,
					lo: percentile(col(2), 0.06),
					hi: percentile(col(2), 0.94),
					stops: fiveStops("tone", tone.stops, tone.blurbs, link),
					home: null,
					value: search.get("tone"),
					off: link("tone", undefined),
					low: tone.low,
					high: tone.high,
				},
			]
		: []

	// "The top of" menus: each choice is an address (top cozy movies of 2026).
	const filter = (family: Family, label: string) => {
		const current = parts.find((p) => p.family === family)
		const others = parts.filter((p) => p.family !== family)
		const members = places.members(family)
		const ordered = family === "decade" ? [...members].reverse() : members
		const at = (next: Ingredient[], y?: number) => browsePath(top(kind, next, y))
		return {
			label,
			value: current ? places.ref(current).label : null,
			clear: at(others, year),
			options: ordered.map((m) => ({
				label: m.label,
				to: at([...others, ing(family, m.slug)], family === "decade" ? undefined : year),
				on: current?.slug === m.slug,
			})),
		}
	}
	const thisYear = new Date().getFullYear()
	const years = Array.from({ length: 12 }, (_, i) => thisYear - i)
	const noDecade = parts.filter((p) => p.family !== "decade")
	const filters: TopFilter[] = [
		filter("mood", "Mood"),
		filter("genre", "Genre"),
		filter("decade", "Decade"),
		{
			label: "Year",
			value: year ? String(year) : null,
			clear: browsePath(top(kind, parts)),
			options: years.map((y) => ({
				label: String(y),
				to: browsePath(top(kind, noDecade, y)),
				on: year === y,
			})),
		},
	]

	const pathOf = (p: number) =>
		filtered ? browsePath({ ...address, page: p > 1 ? p : undefined }) : pagePath(listKind, p)
	let heading: string
	let intro: string
	let title: string
	let description: string
	if (!filtered) {
		const ranked = await Promise.all(
			(kind === "all" ? (["movies", "shows"] as const) : [listKind as "movies" | "shows"]).map(
				(k) => getRankedList(titleKindOf(k)),
			),
		)
		const popular = ranked.reduce((n, l) => n + l.popular, 0)
		const copy = listCopy(listKind, { total, popular, page })
		heading = copy.heading
		intro = copy.intro
		title = copy.title
		description = copy.description
	} else {
		const name = places.name(parts, { top: true, year })
		heading = page > 1 ? `${name}, ${first} to ${pageRange(page, total).last}` : name
		intro =
			copyFor(listKind, "best", "all")?.lede ??
			"Ranked by GoodWatch score, trusting many ratings over few."
		title = `${heading} | GoodWatch`
		description = `${name}, ranked by one score from every source. See every score and where to stream it.`
	}

	return {
		kind,
		listKind,
		published: list.published,
		heading,
		intro,
		title,
		description,
		page,
		pages,
		total,
		first,
		rows,
		scores,
		dials,
		filters,
		canonical: pathOf(page),
		prev: page > 1 ? pathOf(page - 1) : undefined,
		next: page < pages ? pathOf(page + 1) : undefined,
	}
}

// The public awards pages: /awards, /awards/<body>, /awards/<body>/<year> and /awards/<body>/category/<slug>. They are
// built from the rows of `doc.award_title_display` (docs/tvdb-pipelines.md, "Award quality and display contract").
//
// Coverage is partial, so a density check decides what a page shows: a category counts when it reads as a complete
// result (a winner and nominees beside it), and a ceremony is published when enough of its categories count. A held
// ceremony isn't linked and its address answers 404. Results belong to titles: no people, no totals.

export type AwardCategoryId = string | number

export type AwardMediaKind = "movie" | "show"

export interface AwardBody {
	id: number
	slug: string
	/** The page name: "Oscars". */
	name: string
	/** The official name: "Academy Awards". */
	official: string
	kind: "Film" | "TV" | "Film and TV"
	/** The body's main category, the one a ceremony page leads with. */
	headline?: number
}

/** The public award families, with retained routing identities, in the order the hub lists them. */
export const AWARD_BODIES: readonly AwardBody[] = [
	{
		id: 1,
		slug: "oscars",
		name: "Oscars",
		official: "Academy Awards",
		kind: "Film",
		headline: 64,
	},
	{
		id: 5,
		slug: "emmys",
		name: "Emmys",
		official: "Primetime Emmy Awards",
		kind: "TV",
		headline: 126,
	},
	{
		id: 2,
		slug: "golden-globes",
		name: "Golden Globes",
		official: "Golden Globe Awards",
		kind: "Film and TV",
		headline: 25,
	},
	{
		id: 11,
		slug: "bafta",
		name: "BAFTA",
		official: "BAFTA Awards",
		kind: "Film and TV",
		headline: 256,
	},
	{
		id: 19,
		slug: "cesars",
		name: "César Awards",
		official: "César Awards",
		kind: "Film",
		headline: 586,
	},
	{
		id: 4,
		slug: "critics-choice",
		name: "Critics' Choice",
		official: "Critics' Choice Awards",
		kind: "Film and TV",
		headline: 74,
	},
	{
		id: 6,
		slug: "sag",
		name: "SAG Awards",
		official: "Screen Actors Guild Awards",
		kind: "Film and TV",
		headline: 170,
	},
	{
		id: 9,
		slug: "dga",
		name: "DGA Awards",
		official: "Directors Guild of America Awards",
		kind: "Film and TV",
		headline: 225,
	},
	{
		id: 7,
		slug: "wga",
		name: "WGA Awards",
		official: "Writers Guild of America Awards",
		kind: "Film and TV",
		headline: 186,
	},
	{
		id: 8,
		slug: "pga",
		name: "PGA Awards",
		official: "Producers Guild of America Awards",
		kind: "Film and TV",
		headline: 212,
	},
	{
		id: 3,
		slug: "mtv",
		name: "MTV Movie & TV Awards",
		official: "MTV Movie & TV Awards",
		kind: "Film and TV",
	},
	{
		id: 10,
		slug: "daytime-emmys",
		name: "Daytime Emmys",
		official: "Daytime Emmy Awards",
		kind: "TV",
	},
	{
		id: 21,
		slug: "baeksang",
		name: "Baeksang Arts Awards",
		official: "Baeksang Arts Awards",
		kind: "Film and TV",
	},
	{
		id: 18,
		slug: "national-television-awards",
		name: "National Television Awards",
		official: "National Television Awards",
		kind: "TV",
	},
	{
		id: 16,
		slug: "canadian-screen-awards",
		name: "Canadian Screen Awards",
		official: "Canadian Screen Awards",
		kind: "Film and TV",
	},
	{
		id: 15,
		slug: "gemini",
		name: "Gemini Awards",
		official: "Gemini Awards",
		kind: "TV",
	},
	{
		id: 14,
		slug: "genie",
		name: "Genie Awards",
		official: "Genie Awards",
		kind: "Film",
	},
]

const bodiesById = new Map(AWARD_BODIES.map((b) => [b.id, b]))

export const bodyBySlug = (slug: string | undefined) =>
	AWARD_BODIES.find((b) => b.slug === slug)

/** A URL slug for a category name: "Actor in a Leading Role" is "actor-in-a-leading-role", "Meilleur Film Étranger" is
 * "meilleur-film-etranger", "Sound Editing & Mixing" is "sound-editing-and-mixing". */
export const slugify = (text: string) =>
	text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

// ---------------------------------------------------------------------------------------------------------------------
// Density check

/** A category reads as complete when it has a winner (two at most: a tie or a duplicate) and two nominees beside it. */
export const CATEGORY_RULE = { minWinners: 1, maxWinners: 2, minTitles: 3 }

/**
 * A ceremony is "full" when it has at least 5 categories, 80% of them pass, and it has at least 60% of the categories
 * the body had in its biggest ceremony within 3 years. It is "partial" when at least 8 categories pass and they make
 * at least half of that reference. Anything else is held: not linked, and its address answers 404.
 */
export const CEREMONY_RULE = {
	minCategories: 5,
	fullShare: 0.8,
	refShare: 0.6,
	partialPassing: 8,
	partialRefShare: 0.5,
	refWindow: 3,
}

export type CeremonyTier = "full" | "partial" | "held"

/** One row of `doc.award_title_display`, the columns these pages read. */
export interface AwardRow {
	media_type: AwardMediaKind
	media_tmdb_id: number
	award_id: number
	category_id: AwardCategoryId
	category_name: string
	ceremony_year: string
	has_win: boolean
	has_nomination: boolean
}

export interface TitleRef {
	media_type: AwardMediaKind
	tmdb_id: number
}

export interface AwardCategory {
	id: AwardCategoryId
	name: string
	winners: TitleRef[]
	nominees: TitleRef[]
	passes: boolean
}

export interface Ceremony {
	award: number
	year: number
	/** Leading categories first (categoryRank). */
	categories: AwardCategory[]
	passing: number
	/** The most categories the body had in a ceremony within CEREMONY_RULE.refWindow years. */
	reference: number
	tier: CeremonyTier
}

export interface AwardIndex {
	ceremonies: Map<string, Ceremony>
	/** Newest first. */
	byBody: Map<number, Ceremony[]>
	/** Per body: category slug to category id. */
	categorySlugs: Map<number, Map<string, AwardCategoryId>>
	/** Per body: category id to category slug. */
	slugOfCategory: Map<number, Map<AwardCategoryId, string>>
	categoryNames: Map<AwardCategoryId, string>
}

const ceremonyKey = (award: number, year: number) => `${award}:${year}`

export const categoryPasses = (winners: number, nominees: number) =>
	winners >= CATEGORY_RULE.minWinners &&
	winners <= CATEGORY_RULE.maxWinners &&
	winners + nominees >= CATEGORY_RULE.minTitles

/** The tier of a ceremony from its category count, how many pass, and the body's reference count. */
export function ceremonyTier(
	categories: number,
	passing: number,
	reference: number,
): CeremonyTier {
	const r = CEREMONY_RULE
	if (
		categories >= r.minCategories &&
		passing / categories >= r.fullShare &&
		categories >= r.refShare * reference
	)
		return "full"
	if (passing >= r.partialPassing && passing >= r.partialRefShare * reference)
		return "partial"
	return "held"
}

export const isPublished = (tier: CeremonyTier) => tier !== "held"

// Picture or series first, then directing, acting, writing, then the crafts; inside a group, by category id.
function categoryRank(body: AwardBody, id: AwardCategoryId, name: string) {
	if (id === body.headline) return 0
	const n = name.toLowerCase()
	if (
		/(picture|best film|^film$|best movie|series|programme|cast in a motion picture|ensemble|producer)/.test(
			n,
		) &&
		!/(actor|actress|performance|directing|director|writing|screenplay|short)/.test(
			n,
		)
	)
		return 1
	if (/direct/.test(n)) return 2
	if (/(actor|actress|performance|star|host|hero|villain)/.test(n)) return 3
	if (/(writing|screenplay|written)/.test(n)) return 4
	return 5
}

/** Groups the rows into ceremonies and categories (winners, then nominees) and runs the density check. */
export function buildAwardIndex(rows: readonly AwardRow[]): AwardIndex {
	const grouped = new Map<string, Map<AwardCategoryId, AwardCategory>>()
	const categoryNames = new Map<AwardCategoryId, string>()
	for (const row of rows) {
		if (!/^\d{4}$/.test(String(row.ceremony_year))) continue
		const year = Number(row.ceremony_year)
		if (!bodiesById.has(row.award_id)) continue
		const key = ceremonyKey(row.award_id, year)
		let categories = grouped.get(key)
		if (!categories) {
			categories = new Map()
			grouped.set(key, categories)
		}
		const name = row.category_name.trim()
		categoryNames.set(row.category_id, name)
		let category = categories.get(row.category_id)
		if (!category) {
			category = {
				id: row.category_id,
				name,
				winners: [],
				nominees: [],
				passes: false,
			}
			categories.set(row.category_id, category)
		}
		const ref = { media_type: row.media_type, tmdb_id: row.media_tmdb_id }
		if (row.has_win) category.winners.push(ref)
		else if (row.has_nomination) category.nominees.push(ref)
	}

	const ceremonies = new Map<string, Ceremony>()
	const byBody = new Map<number, Ceremony[]>()
	for (const [key, categoryMap] of grouped) {
		const [award, year] = key.split(":").map(Number)
		const body = bodiesById.get(award) as AwardBody
		const categories = [...categoryMap.values()]
		for (const c of categories)
			c.passes = categoryPasses(c.winners.length, c.nominees.length)
		categories.sort(
			(a, b) =>
				categoryRank(body, a.id, a.name) - categoryRank(body, b.id, b.name) ||
				String(a.id).localeCompare(String(b.id)),
		)
		const ceremony: Ceremony = {
			award,
			year,
			categories,
			passing: categories.filter((c) => c.passes).length,
			reference: 0,
			tier: "held",
		}
		ceremonies.set(key, ceremony)
		const list = byBody.get(award) ?? []
		list.push(ceremony)
		byBody.set(award, list)
	}
	for (const list of byBody.values()) {
		list.sort((a, b) => b.year - a.year)
		for (const c of list) {
			c.reference = Math.max(
				...list
					.filter((o) => Math.abs(o.year - c.year) <= CEREMONY_RULE.refWindow)
					.map((o) => o.categories.length),
			)
			c.tier = ceremonyTier(c.categories.length, c.passing, c.reference)
		}
	}

	// Slugs come from the names; two categories of one body with the same slug keep it apart with the id.
	const categorySlugs = new Map<number, Map<string, AwardCategoryId>>()
	const slugOfCategory = new Map<number, Map<AwardCategoryId, string>>()
	for (const body of AWARD_BODIES) {
		const ids = new Set<AwardCategoryId>()
		for (const c of byBody.get(body.id) ?? [])
			for (const cat of c.categories) ids.add(cat.id)
		const slugs = new Map<string, AwardCategoryId>()
		const back = new Map<AwardCategoryId, string>()
		for (const id of [...ids].sort((a, b) =>
			String(a).localeCompare(String(b)),
		)) {
			let slug = slugify(categoryNames.get(id) ?? "") || String(id)
			if (slugs.has(slug)) slug = `${slug}-${id}`
			slugs.set(slug, id)
			back.set(id, slug)
		}
		categorySlugs.set(body.id, slugs)
		slugOfCategory.set(body.id, back)
	}
	return { ceremonies, byBody, categorySlugs, slugOfCategory, categoryNames }
}

/** Every title a published page can show: the winners and nominees of passing categories in published ceremonies. */
export function publishedTitleRefs(index: AwardIndex): TitleRef[] {
	const seen = new Map<string, TitleRef>()
	for (const c of index.ceremonies.values()) {
		if (!isPublished(c.tier)) continue
		for (const cat of c.categories)
			if (cat.passes)
				for (const ref of [...cat.winners, ...cat.nominees])
					seen.set(refKey(ref), ref)
	}
	return [...seen.values()]
}

export const refKey = (ref: TitleRef) => `${ref.media_type}:${ref.tmdb_id}`

// ---------------------------------------------------------------------------------------------------------------------
// Pages. Each takes the index and a lookup of the titles' display fields; a title the catalog doesn't have is left out.

export type TitleLookup<T> = (ref: TitleRef) => T | undefined

const pick = <T>(titles: TitleLookup<T>, refs: readonly TitleRef[]) =>
	refs.flatMap((ref) => titles(ref) ?? [])

const publishedOf = (index: AwardIndex, body: AwardBody) =>
	(index.byBody.get(body.id) ?? []).filter((c) => isPublished(c.tier))

export interface CeremonySummary<T> {
	body: AwardBody
	year: number
	/** Up to four winners from the leading categories. */
	winners: T[]
}

const HUB_WINNERS = 4

/**
 * /awards: the latest ceremony of each body when it was this year or last (an older "latest" reads as stale), and
 * every body with a published ceremony.
 */
export function hubPage<T>(
	index: AwardIndex,
	titles: TitleLookup<T>,
	currentYear: number,
) {
	const bodies = AWARD_BODIES.map((body) => ({
		body,
		years: publishedOf(index, body).map((c) => c.year),
	})).filter((b) => b.years.length)
	const recent: CeremonySummary<T>[] = bodies
		.flatMap(({ body }) => {
			const latest = publishedOf(index, body)[0]
			return latest.year >= currentYear - 1 ? [{ body, latest }] : []
		})
		.sort((a, b) => b.latest.year - a.latest.year)
		.map(({ body, latest }) => {
			const seen = new Set<string>()
			const refs = latest.categories
				.filter((cat) => cat.passes)
				.flatMap((cat) => cat.winners)
				.filter((ref) => !seen.has(refKey(ref)) && seen.add(refKey(ref)))
			return {
				body,
				year: latest.year,
				winners: pick(titles, refs).slice(0, HUB_WINNERS),
			}
		})
	return { recent, bodies }
}

export interface CategoryLink<T> {
	slug: string
	name: string
	/** The latest published winner. */
	latest: { year: number; title: T } | null
}

const LATEST_RESULTS = 8
/** A category gets a link on the body page when it passes in at least this many published ceremonies. */
export const CATEGORY_LINK_YEARS = 3

/** /awards/<body>: the latest ceremony's leading winners, the published years, the categories with enough years. */
export function bodyPage<T>(
	index: AwardIndex,
	titles: TitleLookup<T>,
	slug: string,
) {
	const body = bodyBySlug(slug)
	if (!body) return null
	const published = publishedOf(index, body)
	if (!published.length) return null
	const slugs =
		index.slugOfCategory.get(body.id) ?? new Map<AwardCategoryId, string>()
	const yearsOf = new Map<
		AwardCategoryId,
		{ year: number; winner: TitleRef }[]
	>()
	for (const c of published)
		for (const cat of c.categories)
			if (cat.passes) {
				const list = yearsOf.get(cat.id) ?? []
				list.push({ year: c.year, winner: cat.winners[0] })
				yearsOf.set(cat.id, list)
			}
	const latest = published[0]
	const categories: CategoryLink<T>[] = [...yearsOf.entries()]
		.filter(([, years]) => years.length >= CATEGORY_LINK_YEARS)
		.sort(
			([a, ya], [b, yb]) =>
				yb.length - ya.length ||
				(index.categoryNames.get(a) ?? "").localeCompare(
					index.categoryNames.get(b) ?? "",
				),
		)
		.map(([id, years]) => {
			const title = titles(years[0].winner)
			return {
				slug: slugs.get(id) ?? String(id),
				name: index.categoryNames.get(id) ?? "",
				latest: title ? { year: years[0].year, title } : null,
			}
		})
	return {
		body,
		years: published.map((c) => c.year),
		latest: {
			year: latest.year,
			results: latest.categories
				.filter((c) => c.passes)
				.flatMap((c) => {
					const winner = pick(titles, c.winners.slice(0, 1))[0]
					return winner
						? [{ category: c.name, slug: slugs.get(c.id) ?? "", winner }]
						: []
				})
				.slice(0, LATEST_RESULTS),
		},
		categories,
	}
}

export interface CategoryResult<T> {
	id: AwardCategoryId
	slug: string
	name: string
	winners: T[]
	nominees: T[]
}

/** /awards/<body>/<year>: a published ceremony's passing categories, each with its winner first, then its nominees. */
export function ceremonyPage<T>(
	index: AwardIndex,
	titles: TitleLookup<T>,
	slug: string,
	yearParam: string,
) {
	const body = bodyBySlug(slug)
	if (!body || !/^\d{4}$/.test(yearParam)) return null
	const year = Number(yearParam)
	const ceremony = index.ceremonies.get(ceremonyKey(body.id, year))
	if (!ceremony || !isPublished(ceremony.tier)) return null
	const years = publishedOf(index, body).map((c) => c.year)
	const slugs =
		index.slugOfCategory.get(body.id) ?? new Map<AwardCategoryId, string>()
	const categories: CategoryResult<T>[] = ceremony.categories
		.filter((c) => c.passes)
		.map((c) => ({
			id: c.id,
			slug: slugs.get(c.id) ?? "",
			name: c.name,
			winners: pick(titles, c.winners),
			nominees: pick(titles, c.nominees),
		}))
		// A category whose winner the catalog doesn't have would lead with nominees only.
		.filter((c) => c.winners.length)
	return {
		body,
		year,
		prev: years.find((y) => y < year) ?? null,
		next: years.filter((y) => y > year).at(-1) ?? null,
		categories,
	}
}

/** /awards/<body>/category/<slug>: the category's winners and nominees by year, published years where it passes. */
export function categoryPage<T>(
	index: AwardIndex,
	titles: TitleLookup<T>,
	slug: string,
	categorySlug: string,
) {
	const body = bodyBySlug(slug)
	if (!body) return null
	const id = index.categorySlugs.get(body.id)?.get(categorySlug)
	if (id == null) return null
	const years = publishedOf(index, body).flatMap((c) => {
		const cat = c.categories.find((x) => x.id === id && x.passes)
		if (!cat) return []
		const winners = pick(titles, cat.winners)
		return winners.length
			? [{ year: c.year, winners, nominees: pick(titles, cat.nominees) }]
			: []
	})
	if (!years.length) return null
	return {
		body,
		slug: categorySlug,
		name: index.categoryNames.get(id) ?? categorySlug,
		years,
	}
}

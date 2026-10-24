// "New on your services" (#489 Part C): what each address under /new answers, from the reads in
// new-on-services.server.ts (passed in, so that tests can fake them).
//
// - /new/us/netflix: a service's page in a country. Search engines may list it once it has titles.
// - /new/us: the country's page for every service, the same rules.
// - /new/netflix: the share link. It sends each viewer to the page of their own country (302, never stored).
// - /new: the member's own page, personal and never listed. A visitor goes to their country's page.
import { redirect } from "@remix-run/node"
import {
	BRANDS,
	type Brand,
	type DayGroup,
	type PageKind,
	brandBySlug,
	brandOfService,
	countryOffer,
	countryPath,
	dayGroupsOf,
	familyOf,
	pageCopy,
	rankByScore,
	readWhere,
	robotsFor,
	servicePath,
	sharePath,
	shareTarget,
	tallyWords,
	windowStart,
} from "~/domain/new-on-services"
import type { TitleKey } from "~/utils/title-key"

/** A title that arrived, as the reads give it. */
export type ArrivalTitle = {
	key: TitleKey
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: number | null
	/** Minutes; for a show, the usual episode length. */
	runtime: number | null
	poster_path: string | null
	backdrop_path: string | null
	score: number | null
	path: string
	/** The service it arrived on, as the id it counts as. */
	service: number
	at: number
	exact: boolean
}

/** A title as a page sends it: no backdrop, the page has one for its hero. */
export type NewTitle = Omit<ArrivalTitle, "backdrop_path">

export type NewSummary = {
	/** The countries the site has pages for, by name. */
	countries: { code: string; name: string }[]
	/** Titles first seen in the window per country and brand: what decides which pages are linked. */
	counts: Record<string, Record<string, number>>
	/** When the history of the brands last changed. */
	updatedAt: number | null
	/** Each brand's logo, by slug. */
	logos: Record<string, string | null>
}

export interface Viewer {
	/** The member's saved country, or the visitor's from the request. */
	country: string
	member: {
		/** Saved services, with their duplicates. */
		services: readonly number[]
		savedCountry: string | null
		/** Titles the member waits for: Want to See, or a show they watch. */
		waits: ReadonlyMap<TitleKey, "want" | "watching">
	} | null
}

export interface NewDeps {
	now(): number
	launch(): number
	summary(now: number): Promise<NewSummary>
	titles(input: {
		country: string
		services: readonly number[]
		now: number
	}): Promise<ArrivalTitle[]>
	viewer(request: Request): Promise<Viewer>
	serviceCards(
		ids: number[],
	): Promise<{ id: number; name: string; logo_path: string | null }[]>
}

export interface PageService {
	id: number
	slug: string | null
	name: string
	logo_path: string | null
}

export interface NewPageData {
	kind: PageKind
	/** The page's own address, its canonical one. */
	path: string
	country: { code: string; name: string }
	brand: PageService | null
	/** The ten best, by GoodWatch score. */
	ranked: NewTitle[]
	/** Every title day by day, the latest first, up to DAY_LIMIT titles. */
	days: DayGroup<NewTitle>[]
	/** Titles beyond DAY_LIMIT that day by day leaves out. */
	more: number
	total: number
	/** What a member waits for that arrived, the newest first. */
	waited: (NewTitle & { wait: "want" | "watching" })[]
	/** The services the titles arrived on, by the id they count as. */
	services: Record<number, PageService>
	/** The services row: one link per service page. */
	keys: (PageService & { path: string })[]
	otherCountries: { code: string; name: string; path: string }[]
	offer: { country: string; path: string; words: string } | null
	/** The link without the country that the share button copies. */
	share: string | null
	hero: string | null
	updatedAt: number | null
	now: number
	copy: { heading: string; title: string; description: string; tally: string }
	robots: "index, follow" | "noindex, follow"
	member: { hasServices: boolean } | null
}

/** How many titles day by day shows. A big country's page has hundreds; each service's page has the rest. */
export const DAY_LIMIT = 240
const TOP = 10

const NO_STORE = { "Cache-Control": "private, no-store" }
// Thrown, so that Remix answers with the not-found page; a returned Response would be read as page data.
const notFound = () => new Response("Not Found", { status: 404 })
// The same for everyone: no Cache-Control, like the canonical title redirects.
const moved = (to: string) => redirect(to, 301)
// Depends on who asks: never stored.
const sendTo = (to: string) => redirect(to, { status: 302, headers: NO_STORE })

const withoutBackdrop = ({ backdrop_path, ...title }: ArrivalTitle): NewTitle =>
	title

function brandService(brand: Brand, summary: NewSummary): PageService {
	return {
		id: brand.ids[0],
		slug: brand.slug,
		name: brand.name,
		logo_path: summary.logos[brand.slug] ?? null,
	}
}

async function servicesOf(
	families: readonly number[],
	summary: NewSummary,
	deps: NewDeps,
): Promise<Record<number, PageService>> {
	const services: Record<number, PageService> = {}
	const others: number[] = []
	for (const family of families) {
		const brand = brandOfService(family)
		if (brand) services[family] = brandService(brand, summary)
		else others.push(family)
	}
	if (others.length)
		for (const card of await deps.serviceCards(others))
			services[familyOf(card.id)] = { ...card, slug: null }
	return services
}

interface Build {
	kind: PageKind
	path: string
	country: { code: string; name: string }
	brand: Brand | null
	titles: ArrivalTitle[]
	families: readonly number[]
	summary: NewSummary
	viewer: Viewer
	now: number
	since: number
	deps: NewDeps
}

async function buildPage({
	kind,
	path,
	country,
	brand,
	titles,
	families,
	summary,
	viewer,
	now,
	since,
	deps,
}: Build): Promise<NewPageData> {
	const ranked = rankByScore(titles)
	const newest = [...titles]
		.sort((a, b) => b.at - a.at || a.key - b.key)
		.slice(0, DAY_LIMIT)
		.map(withoutBackdrop)
	const waits = viewer.member?.waits
	const waited = waits
		? titles
				.filter(({ key }) => waits.has(key))
				.sort((a, b) => b.at - a.at)
				.map((title) => ({
					...withoutBackdrop(title),
					wait: waits.get(title.key) as "want" | "watching",
				}))
		: []
	const lead =
		titles.find(({ key }) => key === waited[0]?.key) ?? ranked[0] ?? null
	const tally = tallyWords(titles, since, now)
	const counts = summary.counts[country.code] ?? {}
	const names = new Map(summary.countries.map(({ code, name }) => [code, name]))
	const brands =
		kind === "member"
			? BRANDS.filter((b) => families.includes(b.ids[0]))
			: BRANDS.filter((b) => (counts[b.slug] ?? 0) > 0 || b === brand)
	const services = await servicesOf(
		[...new Set([...families, ...titles.map(({ service }) => service)])],
		summary,
		deps,
	)
	return {
		kind,
		path,
		country,
		brand: brand ? brandService(brand, summary) : null,
		ranked: ranked.slice(0, TOP).map(withoutBackdrop),
		days: dayGroupsOf(newest),
		more: Math.max(0, titles.length - DAY_LIMIT),
		total: titles.length,
		waited,
		services,
		keys: brands.map((b) => ({
			...brandService(b, summary),
			path: servicePath(country.code, b),
		})),
		otherCountries:
			kind === "member"
				? []
				: summary.countries
						.filter(
							({ code }) =>
								code !== country.code &&
								Object.entries(summary.counts[code] ?? {}).some(
									([slug, count]) => count > 0 && (!brand || slug === brand.slug),
								),
						)
						.map(({ code, name }) => ({
							code,
							name,
							path: brand ? servicePath(code, brand) : countryPath(code),
						})),
		offer:
			kind === "member"
				? null
				: countryOffer(country.code, viewer.country, brand, names),
		share: kind === "service" && brand ? sharePath(brand) : null,
		hero: lead?.backdrop_path ?? null,
		updatedAt: summary.updatedAt,
		now,
		copy: {
			...pageCopy({
				kind,
				brand: brand?.name ?? null,
				country: country.code,
				countryName: country.name,
				tally,
				count: titles.length,
			}),
			tally,
		},
		robots: robotsFor(kind, titles.length),
		member: viewer.member
			? { hasServices: viewer.member.services.length > 0 }
			: null,
	}
}

const knownCountries = (summary: NewSummary) =>
	new Set(summary.countries.map(({ code }) => code))

const countryOf = (summary: NewSummary, code: string) => ({
	code,
	name: summary.countries.find((c) => c.code === code)?.name ?? code,
})

/** /new/:where: a country's page for every service, or the share link of a service. */
export async function loadWherePage(
	request: Request,
	segment: string,
	deps: NewDeps,
): Promise<NewPageData | Response> {
	const now = deps.now()
	const summary = await deps.summary(now)
	const where = readWhere(segment, knownCountries(summary))
	if (where.kind === "notFound") throw notFound()
	if (where.kind === "redirect") return moved(where.to)
	if (where.kind === "share") {
		const viewer = await deps.viewer(request)
		return sendTo(shareTarget(where.brand, viewer.country))
	}
	const families = BRANDS.map((brand) => brand.ids[0])
	const [titles, viewer] = await Promise.all([
		deps.titles({ country: where.country, services: families, now }),
		deps.viewer(request),
	])
	return buildPage({
		kind: "country",
		path: countryPath(where.country),
		country: countryOf(summary, where.country),
		brand: null,
		titles,
		families,
		summary,
		viewer,
		now,
		since: windowStart(now, deps.launch()),
		deps,
	})
}

/** /new/:country/:service: a service's page in a country. */
export async function loadServicePage(
	request: Request,
	countrySegment: string,
	slug: string,
	deps: NewDeps,
): Promise<NewPageData | Response> {
	const now = deps.now()
	const summary = await deps.summary(now)
	const where = readWhere(countrySegment, knownCountries(summary))
	const brand = brandBySlug(slug)
	if (!brand || where.kind === "notFound" || where.kind === "share")
		throw notFound()
	if (where.kind === "redirect") return moved(`${where.to}/${brand.slug}`)
	const families = [brand.ids[0]]
	const [titles, viewer] = await Promise.all([
		deps.titles({ country: where.country, services: families, now }),
		deps.viewer(request),
	])
	return buildPage({
		kind: "service",
		path: servicePath(where.country, brand),
		country: countryOf(summary, where.country),
		brand,
		titles,
		families,
		summary,
		viewer,
		now,
		since: windowStart(now, deps.launch()),
		deps,
	})
}

/** /new: the member's own page. A visitor goes to the page of their country. */
export async function loadMemberPage(
	request: Request,
	deps: NewDeps,
): Promise<NewPageData | Response> {
	const viewer = await deps.viewer(request)
	if (!viewer.member) return sendTo(countryPath(viewer.country))
	const now = deps.now()
	const { services } = viewer.member
	const country = viewer.member.savedCountry ?? viewer.country
	const [summary, titles] = await Promise.all([
		deps.summary(now),
		services.length
			? deps.titles({ country, services, now })
			: Promise.resolve([]),
	])
	return buildPage({
		kind: "member",
		path: "/new",
		country: countryOf(summary, country),
		brand: null,
		titles,
		families: [...new Set(services.map(familyOf))],
		summary,
		viewer,
		now,
		since: windowStart(now, deps.launch()),
		deps,
	})
}

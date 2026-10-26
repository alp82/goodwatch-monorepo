// "New on your services" (#489 Part C): what each address under /new answers, from the reads in
// new-on-services.server.ts (passed in, so that tests can fake them).
//
// - /new/us/netflix: a service's page in a country. Search engines may list it once it has titles.
// - /new/us: the country's page for every service, the same rules.
// - /new/netflix: the share link. It sends each viewer to the page of their own country (302, never stored).
// - /new: the member's own page, personal and never listed. A visitor goes to their country's page.
//
// One read per country gives every brand's list and the country's list (`CountryArrivals`). The counts behind the
// links between pages and behind the sitemap (`linksOf`, `loadPagesIndex`) are the lengths of those same lists, so a
// linked or listed page always has titles.
import { redirect } from "@remix-run/node"
import {
	BRANDS,
	type Arrival,
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
	shareCopy,
	sharePath,
	shareTarget,
	tallyWords,
	utcDay,
	windowStart,
} from "~/domain/new-on-services"
import { cardClient } from "~/server/og-image/clients"
import { PRIVATE_CACHE_CONTROL } from "~/utils/auth-cookie"
import { titlePath } from "~/utils/helpers"
import { lastGood } from "~/utils/last-good"
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
export type NewTitle = Omit<ArrivalTitle, "backdrop_path"> & {
	/**
	 * The subscription services that carry it in the page's country now, by id, the one it arrived on among them: the
	 * poster card shows the viewer's own (names and logos in the page's `offerServices`).
	 */
	offers?: number[]
}

/** A service's name and logo, for the poster cards' logos. */
export type OfferService = { name: string; logo_path: string | null }

/** One country's arrivals: each brand's page, by slug, and the country's page, each best first. */
export type CountryArrivals = {
	brands: Record<string, ArrivalTitle[]>
	all: ArrivalTitle[]
}

/** A page with titles: a brand's page in a country, or the country's page (`brand` null). */
export type NewPageCount = {
	country: string
	brand: string | null
	titles: number
	/** The latest arrival day. */
	latest: number | null
}

export type NewLinks = {
	pages: NewPageCount[]
	/** The countries whose read failed: their pages are missing, so the links are incomplete and never stored. */
	failed?: string[]
}

export type NewMeta = {
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
	/** The countries the site has pages for, with their names. */
	countries(): Promise<{ code: string; name: string }[]>
	meta(now: number): Promise<NewMeta>
	country(input: { country: string; now: number }): Promise<CountryArrivals>
	memberTitles(input: {
		country: string
		services: readonly number[]
		now: number
	}): Promise<ArrivalTitle[]>
	/** Every page with titles. `wait` false: null when the counts aren't ready within a page's budget. */
	links(now: number, wait: boolean): Promise<NewLinks | null>
	viewer(request: Request): Promise<Viewer>
	serviceCards(
		ids: number[],
	): Promise<{ id: number; name: string; logo_path: string | null }[]>
	/**
	 * The subscription services that carry each title in the country now, with names and logos; null for every title
	 * while the country's availability loads.
	 */
	offers(
		country: string,
		keys: TitleKey[],
	): Promise<({ id: number; name: string; logo_path: string | null }[] | null)[]>
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
	/** The names and logos of the services in the titles' `offers`. */
	offerServices: Record<number, OfferService>
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
	/** The links between pages weren't ready: the page leaves them out and isn't stored. */
	incomplete: boolean
}

/** How many titles day by day shows. A big country's page has hundreds; each service's page has the rest. */
export const DAY_LIMIT = 240
const TOP = 10

// Thrown, so that Remix answers with the not-found page; a returned Response would be read as page data.
const notFound = () => new Response("Not Found", { status: 404 })
// The same for everyone: no Cache-Control, like the canonical title redirects.
const moved = (to: string) => redirect(to, 301)
// Depends on who asks: never stored.
const sendTo = (to: string) =>
	redirect(to, { status: 302, headers: { "Cache-Control": PRIVATE_CACHE_CONTROL } })

/**
 * /new and a share link (/new/netflix) send each visitor elsewhere, so a link preview would show the card of the page
 * it lands on. A link-preview client (Slack, WhatsApp, X, ...) gets the link's own page instead: its head names the
 * link's own card. The page sends anyone who opens it on, since some in-app browsers send such a User-Agent too.
 */
export interface NewPreviewData {
	kind: "preview"
	path: string
	/** Where the link sends this reader. */
	to: string
	copy: { heading: string; title: string; description: string }
}

const isLinkPreview = (request: Request) =>
	cardClient(request.headers.get("user-agent")) === "preview"

const previewOf = (
	path: string,
	to: string,
	copy: NewPreviewData["copy"],
): NewPreviewData => ({ kind: "preview", path, to, copy })

const withoutBackdrop = ({ backdrop_path, ...title }: ArrivalTitle): NewTitle =>
	title

/**
 * Each title's current offers in the country (the card-services reader), the arrival service always among them, and
 * the names and logos of them all. `loading`: the country's availability isn't read yet, so only the arrival
 * services are known.
 */
export async function offersOf(
	country: string,
	titles: readonly { key: TitleKey; service: number }[],
	deps: Pick<NewDeps, "offers">,
): Promise<{
	offersOf: (title: { key: TitleKey; service: number }) => number[]
	services: Record<number, OfferService>
	loading: boolean
}> {
	const keys = [...new Set(titles.map(({ key }) => key))]
	const found = keys.length ? await deps.offers(country, keys) : []
	const byKey = new Map(keys.map((key, i) => [key, found[i] ?? null]))
	const services: Record<number, OfferService> = {}
	for (const list of found)
		for (const { id, name, logo_path } of list ?? []) services[id] = { name, logo_path }
	return {
		offersOf: ({ key, service }) => {
			const ids = (byKey.get(key) ?? []).map(({ id }) => id)
			return ids.includes(service) ? ids : [service, ...ids]
		},
		services,
		loading: keys.length > 0 && found.every((list) => list === null),
	}
}

const latestOf = (titles: readonly ArrivalTitle[]) =>
	titles.length ? Math.max(...titles.map(({ at }) => at)) : null

/** Every page with titles, from each country's arrivals: the brands' pages, then the country's page. */
export function linksOf(
	results: readonly { country: string; arrivals: CountryArrivals }[],
): NewLinks {
	const pages: NewPageCount[] = []
	for (const { country, arrivals } of results) {
		for (const brand of BRANDS) {
			const titles = arrivals.brands[brand.slug] ?? []
			if (titles.length)
				pages.push({
					country,
					brand: brand.slug,
					titles: titles.length,
					latest: latestOf(titles),
				})
		}
		if (arrivals.all.length)
			pages.push({
				country,
				brand: null,
				titles: arrivals.all.length,
				latest: latestOf(arrivals.all),
			})
	}
	return { pages }
}

/** Every page with titles across the countries, read a few countries at a time. A country whose read fails is left
 *  out with its pages, logged and named in `failed`: the other pages keep their links, while the links count as
 *  incomplete (not stored, and the pages index answers an error, so the sitemap keeps its last file). */
export async function linksAcross(
	countries: readonly string[],
	read: (country: string) => Promise<CountryArrivals>,
	concurrency: number,
): Promise<NewLinks> {
	const queue = [...countries].sort()
	const results = new Map<string, CountryArrivals>()
	const failed: string[] = []
	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			for (let code = queue.shift(); code; code = queue.shift()) {
				try {
					results.set(code, await read(code))
				} catch (error) {
					failed.push(code)
					console.error(
						`New on your services: ${code} left out of the links`,
						error,
					)
				}
			}
		}),
	)
	return {
		...linksOf(
			[...results.keys()]
				.sort()
				.map((country) => ({
					country,
					arrivals: results.get(country) as CountryArrivals,
				})),
		),
		failed: failed.sort(),
	}
}

/** A title's display fields, as the catalog gives them. A title the import hasn't finished can lack a name. */
export type ArrivalDisplay = {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string | null
	release_year: number | null
	runtime: number | null
	poster_path: string | null
	backdrop_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
}

/** Each list of arrivals as titles, best first. Titles the catalog lacks, adult titles and titles without a name are
 *  left out: a page can't show, or link to, a title it can't name. */
export function arrivalTitlesOf(
	lists: readonly Arrival[][],
	displays: ReadonlyMap<TitleKey, ArrivalDisplay>,
	adult: ReadonlySet<TitleKey>,
): ArrivalTitle[][] {
	return lists.map((arrivals) =>
		rankByScore(
			arrivals.flatMap((arrival): ArrivalTitle[] => {
				const display = displays.get(arrival.key)
				if (!display || adult.has(arrival.key)) return []
				const name = display.title?.trim()
				if (!name) return []
				return [
					{
						key: arrival.key,
						tmdb_id: display.tmdb_id,
						media_type: display.media_type,
						title: name,
						release_year: display.release_year,
						runtime: display.runtime,
						poster_path: display.poster_path,
						backdrop_path: display.backdrop_path,
						// The catalog keeps the score as a fraction; it is shown, and ranked, as a whole number.
						score:
							display.goodwatch_overall_score_normalized_percent === null
								? null
								: Math.round(display.goodwatch_overall_score_normalized_percent),
						path: titlePath(display.media_type, display.tmdb_id, name),
						service: arrival.service,
						at: arrival.at,
						exact: arrival.exact,
					},
				]
			}),
		),
	)
}

/** The brands with a page of their own in a country (/new/us/netflix), by slug: the title page links to them. */
export type NewPagesHere = { country: string; brands: string[] }

export function newPagesHere(links: NewLinks, country: string): NewPagesHere {
	return {
		country,
		brands: links.pages
			.filter((page) => page.country === country && page.brand !== null)
			.map(({ brand }) => brand as string),
	}
}

/**
 * The title page's lookup of the brands with a page in a country, from the last complete links: `lookup` only reads and
 * never loads, so a title request neither waits for the links nor starts their build. `refreshIfDue` loads them; the
 * server calls it at start and on a timer (new-on-services.server.ts). Incomplete links (a country's read failed) are
 * refused: the last complete links stay, and the next load waits `retryMs`.
 */
export function newPagesSnapshot(
	loadLinks: () => Promise<NewLinks>,
	{ maxAgeMs, retryMs }: { maxAgeMs: number; retryMs: number },
): {
	lookup: (country: string) => NewPagesHere | null
	refreshIfDue: () => Promise<void>
} {
	const snapshot = lastGood(
		async () => {
			const links = await loadLinks()
			if (links.failed?.length)
				throw new Error(`incomplete links: ${links.failed.join(", ")}`)
			return links
		},
		{ maxAgeMs, retryMs },
	)
	return {
		lookup: (country) => {
			const links = snapshot.peek()
			return links ? newPagesHere(links, country) : null
		},
		refreshIfDue: () => snapshot.refreshIfDue(),
	}
}

/** How many titles the start page's row has, at most: two rows of three on a phone, one row of six from 640 px. */
export const WEEK_ROW_LIMIT = 6

/** The start page's row (#489, Q67): this week's arrivals on a member's services, best first, and the services. */
export type NewWeekRow = {
	titles: NewTitle[]
	/** Every title of this week, of which the row shows the best. */
	total: number
	/** The names and logos of the services in the titles' `offers`. */
	services: Record<number, OfferService>
}

/** This week: today and the six days before it (UTC), from a member's titles, best first. */
export function weekTitlesOf(
	titles: readonly ArrivalTitle[],
	now: number,
): ArrivalTitle[] {
	const since = utcDay(now) - 6 * 86_400_000
	return titles.filter(({ at }) => at >= since)
}

function brandService(brand: Brand, meta: NewMeta): PageService {
	return {
		id: brand.ids[0],
		slug: brand.slug,
		name: brand.name,
		logo_path: meta.logos[brand.slug] ?? null,
	}
}

async function servicesOf(
	families: readonly number[],
	meta: NewMeta,
	deps: NewDeps,
): Promise<Record<number, PageService>> {
	const services: Record<number, PageService> = {}
	const others: number[] = []
	for (const family of families) {
		const brand = brandOfService(family)
		if (brand) services[family] = brandService(brand, meta)
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
	countries: { code: string; name: string }[]
	brand: Brand | null
	titles: ArrivalTitle[]
	families: readonly number[]
	meta: NewMeta
	links: NewLinks | null
	viewer: Viewer
	now: number
	since: number
	deps: NewDeps
}

async function buildPage({
	kind,
	path,
	country,
	countries,
	brand,
	titles,
	families,
	meta,
	links,
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
		? titles.flatMap((title) => {
				const wait = waits.get(title.key)
				return wait ? [{ ...withoutBackdrop(title), wait }] : []
			})
		: []
	waited.sort((a, b) => b.at - a.at)
	const lead =
		titles.find(({ key }) => key === waited[0]?.key) ?? ranked[0] ?? null
	const tally = tallyWords(titles, since, now)
	const names = new Map(countries.map(({ code, name }) => [code, name]))
	// Pages with titles: what the links lead to. Without the counts only the page itself is linked.
	const listed = new Set(
		(links?.pages ?? []).map((page) => `${page.country}/${page.brand ?? ""}`),
	)
	const hasTitles = (code: string, slug: string | null) =>
		listed.has(`${code}/${slug ?? ""}`)
	const brands =
		kind === "member"
			? BRANDS.filter((b) => families.includes(b.ids[0]))
			: BRANDS.filter((b) => b === brand || hasTitles(country.code, b.slug))
	const top = ranked.slice(0, TOP)
	const [services, offers] = await Promise.all([
		servicesOf(
			[...new Set([...families, ...titles.map(({ service }) => service)])],
			meta,
			deps,
		),
		offersOf(country.code, [...top, ...newest, ...waited], deps),
	])
	const withOffers = <T extends NewTitle>(title: T): T => ({
		...title,
		offers: offers.offersOf(title),
	})
	return {
		kind,
		path,
		country,
		brand: brand ? brandService(brand, meta) : null,
		ranked: top.map(withoutBackdrop).map(withOffers),
		days: dayGroupsOf(newest.map(withOffers)),
		more: Math.max(0, titles.length - DAY_LIMIT),
		total: titles.length,
		waited: waited.map(withOffers),
		services,
		offerServices: offers.services,
		keys: brands.map((b) => ({
			...brandService(b, meta),
			path: servicePath(country.code, b),
		})),
		otherCountries:
			kind === "member"
				? []
				: countries
						.filter(
							({ code }) =>
								code !== country.code && hasTitles(code, brand?.slug ?? null),
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
		updatedAt: meta.updatedAt,
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
		// Without the links, or before the country's availability is read (the cards would miss the services a title is
		// on besides the one it arrived on), the page is incomplete and no cache keeps it.
		incomplete:
			kind !== "member" &&
			(links === null || Boolean(links.failed?.length) || offers.loading),
	}
}

const countryOf = (
	countries: { code: string; name: string }[],
	code: string,
) => ({ code, name: countries.find((c) => c.code === code)?.name ?? code })

/** /new/:where: a country's page for every service, or the share link of a service. */
export async function loadWherePage(
	request: Request,
	segment: string,
	deps: NewDeps,
): Promise<NewPageData | NewPreviewData | Response> {
	const now = deps.now()
	const countries = await deps.countries()
	const where = readWhere(segment, new Set(countries.map(({ code }) => code)))
	if (where.kind === "notFound") throw notFound()
	if (where.kind === "redirect") return moved(where.to)
	if (where.kind === "share") {
		const viewer = await deps.viewer(request)
		const to = shareTarget(where.brand, viewer.country)
		return isLinkPreview(request)
			? previewOf(sharePath(where.brand), to, shareCopy(where.brand.name))
			: sendTo(to)
	}
	const [arrivals, meta, links, viewer] = await Promise.all([
		deps.country({ country: where.country, now }),
		deps.meta(now),
		deps.links(now, false),
		deps.viewer(request),
	])
	return buildPage({
		kind: "country",
		path: countryPath(where.country),
		country: countryOf(countries, where.country),
		countries,
		brand: null,
		titles: arrivals.all,
		families: BRANDS.map((brand) => brand.ids[0]),
		meta,
		links,
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
	const countries = await deps.countries()
	const where = readWhere(
		countrySegment,
		new Set(countries.map(({ code }) => code)),
	)
	const brand = brandBySlug(slug)
	if (!brand || where.kind === "notFound" || where.kind === "share")
		throw notFound()
	if (where.kind === "redirect") return moved(`${where.to}/${brand.slug}`)
	const [arrivals, meta, links, viewer] = await Promise.all([
		deps.country({ country: where.country, now }),
		deps.meta(now),
		deps.links(now, false),
		deps.viewer(request),
	])
	return buildPage({
		kind: "service",
		path: servicePath(where.country, brand),
		country: countryOf(countries, where.country),
		countries,
		brand,
		titles: arrivals.brands[brand.slug] ?? [],
		families: [brand.ids[0]],
		meta,
		links,
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
): Promise<NewPageData | NewPreviewData | Response> {
	const viewer = await deps.viewer(request)
	if (!viewer.member) {
		const to = countryPath(viewer.country)
		if (!isLinkPreview(request)) return sendTo(to)
		const { heading, title, description } = pageCopy({
			kind: "member",
			brand: null,
			country: viewer.country,
			countryName: viewer.country,
			tally: "",
			count: 0,
		})
		return previewOf("/new", to, { heading, title, description })
	}
	const now = deps.now()
	const { services } = viewer.member
	const country = viewer.member.savedCountry ?? viewer.country
	const [countries, meta, titles] = await Promise.all([
		deps.countries(),
		deps.meta(now),
		services.length
			? deps.memberTitles({ country, services, now })
			: Promise.resolve([]),
	])
	return buildPage({
		kind: "member",
		path: "/new",
		country: countryOf(countries, country),
		countries,
		brand: null,
		titles,
		families: [...new Set(services.map(familyOf))],
		meta,
		links: null,
		viewer,
		now,
		since: windowStart(now, deps.launch()),
		deps,
	})
}

/** Every page with titles, for the sitemap (scripts/sitemap_new.py): the same counts the pages and their links use. */
export async function loadPagesIndex(deps: NewDeps): Promise<{
	pages: { path: string; titles: number; latest: number | null }[]
	/** The countries whose read failed. Any at all: the index is incomplete, and its route answers an error. */
	failed: string[]
}> {
	const links = await deps.links(deps.now(), true)
	return {
		failed: links ? (links.failed ?? []) : ["*"],
		pages: (links?.pages ?? []).map(({ country, brand, titles, latest }) => {
			const known = brand ? brandBySlug(brand) : null
			return {
				path: known ? servicePath(country, known) : countryPath(country),
				titles,
				latest,
			}
		}),
	}
}

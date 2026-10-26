// What the cards of the "New on your services" pages show (NewServicesCard.tsx), from the same reads as the pages
// (server/new-on-services-page.server.ts). Logos are TMDB URLs here; og-image.server.tsx inlines them.
import {
	BRANDS,
	type Brand,
	brandBySlug,
} from "~/domain/new-on-services"
import { flagDataUri } from "~/server/og-image/flags.server"
import type { NewDeps } from "~/server/new-on-services-page.server"
import type {
	OgNewServicesContent,
	OgNewServicesLogo,
} from "~/ui/og-image/NewServicesCard"
import { NEW_SERVICES_CARD_COPY as COPY } from "~/ui/og-image/copy"

type Deps = Pick<NewDeps, "now" | "meta" | "countries" | "country">

const TMDB_LOGO = "https://image.tmdb.org/t/p/w500"
// The member card's wall: three columns of four rows, the brands in order and then again from the first.
const WALL_TILES = 12

/**
 * The canonical card path of a /new page, or null for an address that has none: /new, /new/<country>,
 * /new/<country>/<service>, and the share link /new/<service>. A country code is checked when the card is drawn.
 */
export function canonicalNewPath(segments: readonly string[]): string | null {
	const [, where, slug] = segments
	if (segments.length === 1) return "/new"
	const country = /^[a-z]{2}$/i.test(where) ? where.toLowerCase() : null
	if (segments.length === 2) {
		if (country) return `/new/${country}`
		const brand = brandBySlug(where)
		return brand ? `/new/${brand.slug}` : null
	}
	if (segments.length === 3 && country) {
		const brand = brandBySlug(slug)
		return brand ? `/new/${country}/${brand.slug}` : null
	}
	return null
}

/** The card of a canonical /new path (see canonicalNewPath), or null when the country has no pages. */
export async function newServicesContent(
	path: string,
	deps: Deps,
): Promise<OgNewServicesContent | null> {
	const [, where, slug] = path.split("/").filter(Boolean)
	const now = deps.now()
	const meta = await deps.meta(now)
	const tile = (brand: Brand): OgNewServicesLogo => {
		const logo = meta.logos[brand.slug]
		return { name: brand.name, logo: logo ? `${TMDB_LOGO}${logo}` : null }
	}
	const card: Omit<OgNewServicesContent, "layout" | "headline"> = {
		kind: "new-services",
		tag: null,
		tally: null,
		flag: null,
		flags: [],
		brand: null,
		logos: [],
	}

	if (!where) {
		const picks = new Set<string>(COPY.memberPicks)
		const wall = Array.from(
			{ length: WALL_TILES },
			(_, i) => BRANDS[i % BRANDS.length],
		)
		return {
			...card,
			layout: "member",
			headline: COPY.member,
			logos: wall.map((brand, i) => ({
				...tile(brand),
				picked: i < BRANDS.length && picks.has(brand.slug),
			})),
		}
	}

	const shared = where.length > 2 ? brandBySlug(where) : null
	if (shared) {
		const flags = await Promise.all(COPY.shareFlags.map(flagDataUri))
		return {
			...card,
			layout: "share",
			tag: COPY.shareTag,
			headline: COPY.service(shared.name),
			flags: flags.filter((flag): flag is string => Boolean(flag)),
			brand: tile(shared),
		}
	}

	const code = where.toUpperCase()
	const country = (await deps.countries()).find((c) => c.code === code)
	if (!country) return null
	const brand = slug ? brandBySlug(slug) : null
	if (slug && !brand) return null
	const [arrivals, flag] = await Promise.all([
		deps.country({ country: code, now }),
		flagDataUri(code),
	])
	const count = brand
		? (arrivals.brands[brand.slug]?.length ?? 0)
		: arrivals.all.length
	const tally = count ? COPY.tally(count) : null
	if (brand)
		return {
			...card,
			layout: "service",
			tag: country.name,
			headline: COPY.service(brand.name),
			tally,
			flag,
			brand: tile(brand),
		}
	return {
		...card,
		layout: "country",
		tag: country.name,
		headline: COPY.country,
		tally,
		flag,
		logos: BRANDS.filter((b) => arrivals.brands[b.slug]?.length).map(tile),
	}
}

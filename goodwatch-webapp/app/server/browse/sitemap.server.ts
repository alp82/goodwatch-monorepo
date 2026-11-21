// The Browse sitemap (`/sitemaps/sitemap_browse.xml`): every indexable Browse page for movies and shows, built from
// the loaded title snapshot so it always lists the places that have a page today. The page's own robots rule
// (domain/browse/indexing.ts) decides what goes in, so the sitemap never lists a page that says noindex.
// The hubs and Top live in the static sitemap. docs/implementation/explore-rethink/spec.md, section 4.
import {
	type Address,
	type Ingredient,
	type Kind,
	browsePath,
	familyPage,
	ing,
	place,
} from "~/domain/browse/address"
import { isIndexable } from "~/domain/browse/indexing"
import {
	type BrowseUrl,
	PLACE_FAMILIES,
	capUrls,
	pathPairs,
	sitemapXml,
} from "~/domain/browse/sitemap"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { type Places, openPlaces } from "./places.server"
import { streamingCountries } from "./streaming-stats.server"
import { ensureTropes } from "./tropes.server"

function addPage(out: BrowseUrl[], a: Address, count: number) {
	if (isIndexable(a, count)) out.push({ path: browsePath(a), weight: count })
}

/** The indexable Browse pages of one kind, at the US address (streaming per country). */
export async function browseUrls(
	places: (country: string) => Promise<Places>,
	kind: Kind,
): Promise<BrowseUrl[]> {
	const out: BrowseUrl[] = []
	const us = await places("us")
	for (const family of PLACE_FAMILIES) {
		out.push({ path: browsePath(familyPage(kind, family)), weight: Number.MAX_SAFE_INTEGER })
		for (const ref of us.members(family)) {
			const parts: Ingredient[] = [ing(family, ref.slug)]
			addPage(out, place(kind, parts), us.count(parts))
		}
	}
	for (const [lead, tail] of pathPairs()) {
		const tails = us.members(tail)
		for (const a of us.members(lead))
			for (const b of tails) {
				const parts = [ing(lead, a.slug), ing(tail, b.slug)]
				addPage(out, place(kind, parts), us.count(parts))
			}
	}
	// Streaming: each country's index, then each service with a full page there.
	for (const { code } of await streamingCountries()) {
		const country = code.toLowerCase()
		const atlas = country === "us" ? us : await places(country)
		const services = atlas.members("service", 1)
		if (!services.length) continue
		out.push({
			path: browsePath(familyPage(kind, "service", country)),
			weight: Number.MAX_SAFE_INTEGER - 1,
		})
		for (const ref of services) {
			const parts = [ing("service", ref.slug)]
			addPage(out, place(kind, parts, country), atlas.count(parts))
		}
	}
	return out
}

let built: { version: string; xml: Promise<string> } | null = null

/** The Browse sitemap for the loaded snapshot, built once per snapshot version (a failed build isn't kept). */
export function browseSitemap(request: Request): Promise<string> {
	const version = String(getTitleSnapshot()?.version ?? "none")
	if (built?.version === version) return built.xml
	const xml = (async () => {
		await ensureTropes()
		const urls: BrowseUrl[] = []
		for (const kind of ["movie", "show"] as const) {
			const opened = new Map<string, Promise<Places>>()
			const places = (country: string) => {
				let p = opened.get(country)
				if (!p) {
					p = openPlaces(request, kind, country)
					opened.set(country, p)
				}
				return p
			}
			urls.push(...(await browseUrls(places, kind)))
		}
		return sitemapXml(capUrls(urls))
	})()
	built = { version, xml }
	xml.catch(() => {
		if (built?.xml === xml) built = null
	})
	return xml
}

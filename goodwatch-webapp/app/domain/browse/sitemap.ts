// The pure part of the Browse sitemap: which path blends it lists, how it stays inside one file, and the XML.
// The URL list itself comes from the loaded snapshot (~/server/browse/sitemap.server).
import { type Family, PAIR } from "./address"

/** A sitemap file holds at most 50,000 URLs. */
export const SITEMAP_URL_LIMIT = 50_000

/** The families with a place page and an index of their own (streaming is per country, below). */
export const PLACE_FAMILIES: readonly Family[] = ["mood", "genre", "decade", "country", "trope"]

export interface BrowseUrl {
	path: string
	/** Well-known titles on the page; family indexes rank first, then the biggest places. */
	weight: number
}

/** Two-part path blends: a lead family and the family its path holds next (`/moods/cozy/comedy`). */
export function pathPairs(): [Family, Family][] {
	return PLACE_FAMILIES.flatMap((lead) => {
		const tail = PAIR[lead]
		return tail && PLACE_FAMILIES.includes(tail) ? [[lead, tail] as [Family, Family]] : []
	})
}

/** Keeps the URL list inside one sitemap file: family indexes first, then the pages with the most titles. */
export function capUrls(urls: BrowseUrl[], limit = SITEMAP_URL_LIMIT): string[] {
	const seen = new Set<string>()
	const unique = urls.filter((u) => !seen.has(u.path) && seen.add(u.path))
	if (unique.length <= limit) return unique.map((u) => u.path)
	return [...unique]
		.sort((a, b) => b.weight - a.weight)
		.slice(0, limit)
		.map((u) => u.path)
}

const escape = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function sitemapXml(paths: string[], origin = "https://goodwatch.app"): string {
	const body = paths.map((p) => `<url><loc>${escape(origin + p)}</loc></url>`).join("\n")
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

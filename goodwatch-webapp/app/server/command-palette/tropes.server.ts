import { tropeDiscoverPath } from "~/domain/trope-filter"
import { type Entry, excerpt } from "./matching.server"

type CatalogRow = [name: string, url: string, description: string | null]
const fold = (name: string) =>
	name
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, "")

/** Catalog names include contextual link text, not just page names. */
function properName(name: string): boolean {
	if (
		!fold(name) ||
		name.length > 70 ||
		/[\[\]\r\n]/.test(name) ||
		/(?:\.{3}|…)\s*$/.test(name)
	)
		return false
	const words = name.split(/\s+/)
	// Sentence-case link prose, while retaining title-case names such as "Love Is a Drug".
	return !(
		words.length >= 6 &&
		words.filter((word) => /^[a-z]/.test(word)).length > words.length / 2 &&
		/\b(?:is|are|was|were|will|would|has|have|had|can|could|should)\b/.test(
			name,
		)
	)
}

/** Normalized edit distance: exact slug folds win; punctuation and spacing do not count. */
function distance(name: string, slug: string): number {
	const folded = fold(name)
	if (folded === slug) return 0
	let previous = Array.from({ length: slug.length + 1 }, (_, i) => i)
	for (let i = 0; i < folded.length; i++) {
		const next = [i + 1]
		for (let j = 0; j < slug.length; j++)
			next.push(
				Math.min(
					next[j] + 1,
					previous[j + 1] + 1,
					previous[j] + Number(folded[i] !== slug[j]),
				),
			)
		previous = next
	}
	return previous[slug.length] / Math.max(folded.length, slug.length, 1)
}

export function tropeEntries(
	catalog: CatalogRow[],
	counts: ReadonlyMap<string, number>,
	pages: ReadonlyMap<string, string | null>,
): Entry[] {
	const byUrl = new Map<string, CatalogRow[]>()
	for (const [raw, url, description] of catalog) {
		const name = raw.trim()
		if (!url || !counts.get(url) || !properName(name)) continue
		const candidates = byUrl.get(url) ?? []
		candidates.push([name, url, description])
		byUrl.set(url, candidates)
	}
	return [...byUrl].map(([url, candidates]) => {
		const slug = fold(url.split(/[?#]/)[0].split("/").at(-1) ?? "")
		const ranked = candidates.map((row) => ({
			row,
			distance: distance(row[0], slug),
		}))
		ranked.sort(
			(a, b) =>
				a.distance - b.distance ||
				a.row[0].localeCompare(b.row[0]) ||
				(a.row[2] ?? "").localeCompare(b.row[2] ?? ""),
		)
		const [fallback, , description] = ranked[0].row
		// Same heading preference as profile/trope-uri-pool.ts and trope-recs/candidates.ts.
		const heading = pages.get(url)?.trim()
		const label = heading && properName(heading) ? heading : fallback
		const count = counts.get(url) ?? 0
		return {
			names: [...new Set([label, ...candidates.map(([name]) => name)])].sort(),
			popularity: count,
			item: {
				key: `trope-${url}`,
				label,
				sub: [excerpt(description), `${count.toLocaleString("en-US")} titles`]
					.filter(Boolean)
					.join(" · "),
				href: tropeDiscoverPath(url),
			},
		}
	})
}

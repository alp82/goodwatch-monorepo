// Shared word matching and plain-text excerpts for palette vocabulary snapshots.
import { fold } from "~/server/search-ranking/text-rules.server"
import type {
	PaletteGroup,
	PaletteGroupKey,
	PaletteItem,
} from "~/utils/command-palette"

export interface Entry {
	names: string[]
	/** Additional text may match its opening only, never arbitrary words. */
	textPrefix?: string
	popularity: number
	item: Omit<PaletteItem, "match">
}
export const discover = (params: Record<string, string>) =>
	`/discover?${new URLSearchParams(params)}`
export function strength(name: string, query: string): number {
	if (name === query) return 1
	if (name.startsWith(query)) return 0.9
	const words = name.split(" ")
	if (words.includes(query)) return 0.85
	if (
		query
			.split(" ")
			.every((part) => words.some((word) => word.startsWith(part)))
	)
		return 0.7
	return query.length >= 4 && name.includes(query) ? 0.4 : 0
}
const foldedNames = new WeakMap<Entry, string[]>()
export function matchGroup(
	key: PaletteGroupKey,
	label: string,
	entries: readonly Entry[],
	prefix: string,
	href?: string,
): PaletteGroup | undefined {
	const q = fold(prefix)
	if (!q) return
	const matches = entries
		.flatMap((entry) => {
			let names = foldedNames.get(entry)
			if (!names) {
				names = entry.names.map(fold)
				foldedNames.set(entry, names)
			}
			const best = Math.max(
				...names.map((name) => strength(name, q)),
				entry.textPrefix && fold(entry.textPrefix).startsWith(q) ? 0.6 : 0,
			)
			const match =
				(key === "members" || key === "blog") && best === 0.4 ? 0 : best
			return match
				? [{ ...entry.item, match, popularity: entry.popularity }]
				: []
		})
		.sort(
			(a, b) =>
				b.match - a.match ||
				b.popularity - a.popularity ||
				a.label.localeCompare(b.label),
		)
	if (!matches.length) return
	return {
		key,
		label,
		total: matches.length,
		href,
		items: matches.slice(0, 12).map(({ popularity: _, ...item }) => item),
	}
}

/** Wiki/HTML/Markdown descriptions become a short plain sentence. */
export function excerpt(text: string | null, max = 110): string | undefined {
	if (!text) return
	const plain = text
		.replace(/<\/?[A-Za-z][^>]*>/g, " ")
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/\[\[([^\]]+)\]\]/g, "$1")
		.replace(/(\*{1,2}|_{1,2})(\S(?:.*?\S)?)\1/g, "$2")
		.replace(/'{2,3}(.+?)'{2,3}/g, "$1")
		.replace(/^\s*(?:#{1,6}\s+|>\s+)/gm, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(
			/^\s*(?:(?:For related tropes,? see|See also)\b[^.\n]*(?:\.|\n)\s*)+/i,
			"",
		)
		.replace(/\s+/g, " ")
		.trim()
	if (!plain) return
	if (plain.length <= max) return plain
	const cut = plain.slice(0, max + 1)
	const at = cut.lastIndexOf(" ")
	return `${cut.slice(0, at > max * 0.6 ? at : max).replace(/[\s,;:.–—-]+$/, "")}…`
}

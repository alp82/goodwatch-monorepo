// The command palette's lookups in the browser: the grouped answer for the typed text (/api/command-palette) and what
// the panel shows before anything is typed (/api/command-palette-start). The palette works without either: the Search
// action, the pages, and the moods don't come from the server. So a lookup that fails is never shown. It reads as no
// matches, whether a search role refused it, the proxy answered 502, 503, or 504 because no search role is healthy, the
// request got no answer, or the body isn't the expected JSON.
import {
	MIN_PREFIX_CHARS,
	PALETTE_GROUP_ORDER,
	type PaletteAnswer,
	type PaletteGroup,
	type PaletteGroupKey,
	type PaletteStart,
	type PaletteTitle,
	paletteTitlePath,
} from "~/utils/command-palette"
import { mediaLanguageUrl } from "~/utils/media-presentation"

const GROUP_KEYS = new Set<string>(PALETTE_GROUP_ORDER)

const isGroup = (value: unknown): value is PaletteGroup => {
	const group = value as Partial<PaletteGroup> | null
	return (
		typeof group?.key === "string" &&
		GROUP_KEYS.has(group.key) &&
		typeof group.label === "string" &&
		Array.isArray(group.items) &&
		group.items.length > 0
	)
}

const titleItems = (titles: PaletteTitle[]) =>
	titles.map((title, index) => ({
		key: `title-${title.mediaType}-${title.tmdbId}`,
		label: title.title,
		href: paletteTitlePath(title),
		title,
		match: 1 - index / (titles.length + 1),
	}))

/**
 * Movies and shows from the old title fields, for an answer without groups: a search role still on the code from
 * before groups (deploys are rolling) answers only those. The "more" is shared out by each kind's part of the titles.
 */
function groupsFromTitles(
	titles: PaletteTitle[],
	more: number,
): PaletteGroup[] {
	const kinds: [PaletteGroupKey, string, PaletteTitle["mediaType"]][] = [
		["movies", "Movies", "movie"],
		["shows", "Shows", "show"],
	]
	return kinds.flatMap(([key, label, mediaType]) => {
		const own = titles.filter((title) => title.mediaType === mediaType)
		if (!own.length) return []
		const share = Math.round((more * own.length) / titles.length)
		return [
			{
				key,
				label,
				total: own.length + share,
				estimated: share > 0 || undefined,
				items: titleItems(own),
			},
		]
	})
}

/**
 * The grouped answer for a prefix. It rejects when the answer has no list of titles (every answer of the endpoint has
 * one); the palette's query keeps that to itself. A missing or odd count reads as no more.
 */
export async function fetchPaletteAnswer(
	prefix: string,
	signal: AbortSignal,
	language?: string,
): Promise<PaletteAnswer> {
	const url = `/api/command-palette?q=${encodeURIComponent(prefix)}`
	const response = await fetch(
		language ? mediaLanguageUrl(url, language) : url,
		{ signal },
	)
	if (!response.ok) throw new Error(`Command palette: ${response.status}`)
	const body: unknown = await response.json()
	const { titles, more, groups } = (body ?? {}) as {
		titles?: unknown
		more?: unknown
		groups?: unknown
	}
	if (!Array.isArray(titles))
		throw new Error("Command palette: not a list of titles")
	const count = typeof more === "number" && more > 0 ? Math.floor(more) : 0
	return {
		titles,
		more: count,
		groups: Array.isArray(groups)
			? groups.filter(isGroup)
			: groupsFromTitles(titles, count),
	}
}

/**
 * The lookup for a normalized prefix, for `useQuery`. A failed lookup isn't stored as an empty answer, so the same
 * prefix is looked up again the next time it's typed. Each prefix is its own query, so an answer that arrives late
 * lands in its own entry and never replaces the answer for newer text.
 */
export const paletteAnswerQuery = (prefix: string, language?: string) => ({
	queryKey: ["command-palette", prefix, ...(language ? [language] : [])],
	queryFn: ({ signal }: { signal: AbortSignal }) =>
		fetchPaletteAnswer(prefix, signal, language),
	enabled: prefix.length >= MIN_PREFIX_CHARS,
	staleTime: 5 * 60 * 1000,
	// While the next prefix loads, the last answer stays, so the panel doesn't jump on every keystroke.
	placeholderData: (previous: PaletteAnswer | undefined) => previous,
})

const NONE: PaletteAnswer = { titles: [], more: 0, groups: [] }

/** The answer the palette shows: none for text that's too short, and none while there is no answer. */
export const shownPaletteAnswer = (
	typed: boolean,
	answer: PaletteAnswer | undefined,
): PaletteAnswer => (typed ? (answer ?? NONE) : NONE)

// ---------------------------------------------------------------- before typing

const isStart = (value: unknown): value is PaletteStart => {
	const start = value as Partial<PaletteStart> | null
	return (
		typeof start?.forYou?.state === "string" && Array.isArray(start.trending)
	)
}

export async function fetchPaletteStart(
	signal: AbortSignal,
): Promise<PaletteStart> {
	const response = await fetch("/api/command-palette-start", { signal })
	if (!response.ok) throw new Error(`Palette start: ${response.status}`)
	const body: unknown = await response.json()
	if (!isStart(body)) throw new Error("Palette start: unexpected answer")
	return body
}

/** What the panel shows before typing, per viewer: a member's For you picks are theirs alone. */
export const paletteStartQuery = (viewer: string) => ({
	queryKey: ["command-palette-start", viewer],
	queryFn: ({ signal }: { signal: AbortSignal }) => fetchPaletteStart(signal),
})

import { mediaLanguageUrl } from "~/utils/media-presentation"
// The command palette's title lookup in the browser. The palette works without it: "Search for …", the destinations,
// and the recent searches don't come from the server. So a lookup that fails is never shown. It reads as no matching
// titles, whether a search role refused it, the proxy answered 502, 503, or 504 because no search role is healthy, the
// request got no answer, or the body isn't the expected JSON.
import { MIN_PREFIX_CHARS, type PaletteTitles } from "~/utils/command-palette"

/**
 * The matching titles and about how many more match. It rejects when the answer has no list of titles; the palette's
 * query keeps that to itself. A missing or odd count reads as no more.
 */
export async function fetchPaletteTitles(
	prefix: string,
	signal: AbortSignal,
	language?: string,
): Promise<PaletteTitles> {
	const response = await fetch(
		language ? mediaLanguageUrl(`/api/command-palette?q=${encodeURIComponent(prefix)}`, language) : `/api/command-palette?q=${encodeURIComponent(prefix)}`,
		{ signal },
	)
	if (!response.ok) throw new Error(`Command palette: ${response.status}`)
	const body: unknown = await response.json()
	const { titles, more } = (body ?? {}) as { titles?: unknown; more?: unknown }
	if (!Array.isArray(titles))
		throw new Error("Command palette: not a list of titles")
	return {
		titles,
		more: typeof more === "number" && more > 0 ? Math.floor(more) : 0,
	}
}

/**
 * The lookup for a normalized prefix, for `useQuery`. A failed lookup isn't stored as an empty answer, so the same
 * prefix is looked up again the next time it's typed.
 */
export const paletteTitlesQuery = (prefix: string, language?: string) => ({
	queryKey: ["command-palette", prefix, ...(language ? [language] : [])],
	queryFn: ({ signal }: { signal: AbortSignal }) =>
		fetchPaletteTitles(prefix, signal, language),
	enabled: prefix.length >= MIN_PREFIX_CHARS,
	staleTime: 5 * 60 * 1000,
	// While the next prefix loads, the last titles stay, so the list doesn't jump on every keystroke.
	placeholderData: (previous: PaletteTitles | undefined) => previous,
})

const NONE: PaletteTitles = { titles: [], more: 0 }

/** The title rows the palette shows: none for text that's too short, and none while there is no answer. */
export const shownPaletteTitles = (
	typed: boolean,
	answer: PaletteTitles | undefined,
): PaletteTitles => (typed ? (answer ?? NONE) : NONE)

// The command palette's title lookup in the browser. The palette works without it: "Search for …", the destinations,
// and the recent searches don't come from the server. So a lookup that fails is never shown. It reads as no matching
// titles, whether a search role refused it, the proxy answered 502, 503, or 504 because no search role is healthy, the
// request got no answer, or the body isn't the expected JSON.
import {
	MIN_PREFIX_CHARS,
	type PaletteTitle,
} from "~/utils/command-palette"

/** The matching titles. It rejects when the answer isn't a list of titles; the palette's query keeps that to itself. */
export async function fetchPaletteTitles(
	prefix: string,
	signal: AbortSignal,
): Promise<PaletteTitle[]> {
	const response = await fetch(
		`/api/command-palette?q=${encodeURIComponent(prefix)}`,
		{ signal },
	)
	if (!response.ok) throw new Error(`Command palette: ${response.status}`)
	const body: unknown = await response.json()
	const titles = (body as { titles?: unknown } | null)?.titles
	if (!Array.isArray(titles))
		throw new Error("Command palette: not a list of titles")
	return titles
}

/**
 * The lookup for a normalized prefix, for `useQuery`. A failed lookup isn't stored as an empty answer, so the same
 * prefix is looked up again the next time it's typed.
 */
export const paletteTitlesQuery = (prefix: string) => ({
	queryKey: ["command-palette", prefix],
	queryFn: ({ signal }: { signal: AbortSignal }) =>
		fetchPaletteTitles(prefix, signal),
	enabled: prefix.length >= MIN_PREFIX_CHARS,
	staleTime: 5 * 60 * 1000,
	// While the next prefix loads, the last titles stay, so the list doesn't jump on every keystroke.
	placeholderData: (previous: PaletteTitle[] | undefined) => previous,
})

/** The title rows the palette shows: none for text that's too short, and none while there is no answer. */
export const shownPaletteTitles = (
	typed: boolean,
	titles: PaletteTitle[] | undefined,
): PaletteTitle[] => (typed ? (titles ?? []) : [])

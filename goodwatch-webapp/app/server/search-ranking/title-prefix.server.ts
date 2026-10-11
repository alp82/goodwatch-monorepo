// How typed text matches the start of a title, shared by the command palette's lookup (command-palette.server.ts),
// which also feeds the search's title lookup, and the search's title blend (title-blend.server.ts). Spaces don't count:
// "spiderman" is "Spider-Man" (stored as "spider man"), and "wall e" is "WALL·E". Both sides take text already split
// into words and joined with single spaces (normalized or fold in text-rules.server.ts).

/** A spaced name without its spaces, with the position in it where each word starts. */
export interface Squashed {
	text: string
	starts: number[]
}

export function squash(spaced: string): Squashed {
	const parts = spaced.split(" ").filter(Boolean)
	const starts: number[] = []
	let at = 0
	for (const part of parts) {
		starts.push(at)
		at += part.length
	}
	return { text: parts.join(""), starts }
}

/** Whether two spaced names are the same once their spaces are dropped. */
export const sameName = (a: string, b: string) =>
	Boolean(a) && squash(a).text === squash(b).text

/**
 * Where the squashed query starts the squashed name: 0 at its start, 1 at the start of a later word, -1 nowhere. A
 * match may run across the name's word breaks ("spiderm" starts "spider man").
 */
export function nameTier(name: Squashed, query: string): 0 | 1 | -1 {
	if (!query || !name.text.includes(query)) return -1
	if (name.text.startsWith(query)) return 0
	for (let i = 1; i < name.starts.length; i++)
		if (name.text.startsWith(query, name.starts[i])) return 1
	return -1
}

const LEADING_ARTICLE = /^(?:the|a|an) /

/**
 * Whether a spaced title starts with the spaced query, also after a leading article, spaces aside and the last word
 * possibly cut short: "lord of" starts "lord of war" and "the lord of the rings", "star w" starts "star wars",
 * "spiderm" starts "spider man". A one-word query must run past the title's first word: "dark" alone would lift every
 * title it begins.
 */
export function startsTitle(name: string, query: string): boolean {
	const q = squash(query).text
	if (!name || !q) return false
	return [name, name.replace(LEADING_ARTICLE, "")].some((candidate) => {
		const squashed = squash(candidate)
		return (
			squashed.text.startsWith(q) &&
			(query.includes(" ") ||
				q.length > (squashed.starts[1] ?? Number.POSITIVE_INFINITY))
		)
	})
}

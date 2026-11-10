// While a described search runs, from the first keystroke until its results are painted, the field shows a moving
// line and the old results dim (they stay clickable). The field holds back its words for a typing pause, so it reports
// them here as they are typed: the page shows the search as pending in the same frame, not after the pause.

/** The words the field will send after its typing pause; null when it will send nothing new. */
export interface UnsentWords {
	get: () => string | null
	set: (words: string | null) => void
	subscribe: (listener: () => void) => () => void
}

// A store rather than page state: the page reads only whether the words differ from the URL's, so it doesn't render
// on every keystroke.
export function unsentWords(): UnsentWords {
	let words: string | null = null
	const listeners = new Set<() => void>()
	return {
		get: () => words,
		set(next) {
			if (next === words) return
			words = next
			for (const listener of listeners) listener()
		},
		subscribe(listener) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}
}

export interface SearchPendingInput {
	/** The field has words the URL doesn't have yet. */
	waitingForWords: boolean
	searching: boolean
	failed: boolean
	/** The words are still being read. */
	readingPending: boolean
	/** Every word became a filter: no search runs, only the list. */
	catalogue: boolean
	hasSearchAnswer: boolean
	/** The list on screen isn't the one for these words. */
	stale: boolean
	/** A title-name search's partial list, sent ahead of the ranking. */
	partial: boolean
	/** A list for these words is already on screen (a partial one, while its completed list loads). */
	shownForWords: boolean
}

export interface SearchPending {
	/** The search is still running: the line on the field. */
	pending: boolean
	/** The results on screen are for other words: they dim. */
	staleResults: boolean
}

const IDLE: SearchPending = { pending: false, staleResults: false }
const STALE: SearchPending = { pending: true, staleResults: true }

/** A failed search is not pending, so its Retry shows on a bright grid. */
export function searchPending(p: SearchPendingInput): SearchPending {
	if (p.waitingForWords) return STALE
	if (!p.searching || p.failed) return IDLE
	if (p.readingPending) return STALE
	if (!p.catalogue && !p.hasSearchAnswer) return STALE
	if (p.stale) return { pending: true, staleResults: !p.shownForWords }
	if (p.partial) return { pending: true, staleResults: false }
	return IDLE
}

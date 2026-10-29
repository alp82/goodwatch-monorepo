// When the start page's search field searches: typing searches once it pauses
// SEARCH_PAUSE_MS, Enter and the Search button search at once, and a preset searches its phrase at once. Text shorter
// than Discover's minimum (SEARCH_MIN_CHARS) is never searched; emptying the field clears the search. A text that is
// already the search isn't searched again. Every search is a paid reading and a history row, so a pending pause is
// dropped whenever something else searches first.
//
// Framework-free, so the timing is tested with mocked timers (start-search.test.ts); StartSearchBar holds one per bar.
import { searchText } from "~/domain/discover-search"

/** Typing searches once it pauses this long (Discover's COMMIT_MS). */
export const SEARCH_PAUSE_MS = 800

export interface FieldCommit {
	/** The field changed: (re)start the pause, or clear the search when the field is empty. */
	type(draft: string): void
	/** Enter or the Search button. Returns whether there is a search to show (searched now or already on). */
	submit(draft: string): boolean
	/** A preset: search its exact phrase now. */
	preset(phrase: string): void
	/** Drop a pending pause (the field's Clear, unmount). */
	cancel(): void
}

export function createFieldCommit({
	searched,
	search,
	clear,
	delay = SEARCH_PAUSE_MS,
}: {
	/** The text being searched now ("" for none). */
	searched: () => string
	/** Search this text (the field's text, untrimmed: the query keeps it as the draft). */
	search: (text: string) => void
	/** Clear the search (the field was emptied). */
	clear: () => void
	delay?: number
}): FieldCommit {
	let timer: ReturnType<typeof setTimeout> | null = null
	const cancel = () => {
		if (timer !== null) clearTimeout(timer)
		timer = null
	}
	const run = (draft: string) => {
		const text = searchText(draft)
		if (text === null || text === searched()) return
		search(draft)
	}
	return {
		type(draft) {
			cancel()
			if (!draft.trim()) {
				if (searched()) clear()
				return
			}
			timer = setTimeout(() => {
				timer = null
				run(draft)
			}, delay)
		},
		submit(draft) {
			cancel()
			run(draft)
			return searchText(draft) !== null || searched() !== ""
		},
		preset(phrase) {
			cancel()
			run(phrase)
		},
		cancel,
	}
}

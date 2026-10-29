// The three titles a guest loved on the start page (docs/implementation/start-page-redesign.md, "Loved titles").
//
// - Tapping a poster loves it: it's saved as the guest's score (LOVED_SCORE) in their stored progress, so "Keep my
//   taste" carries it into the account. Tapping it again (or its Loved slot) undoes it: the title's progress is put
//   back as it was before the tap.
// - Fewer than three carry across searches. A fourth is refused, and so is one the progress store refuses (the
//   guest's 20 ratings; the store shows its own prompt then).
// - Once three are loved, any new choice (a pick, a preset, a typed search, Clear, Surprise me, Back, Start over)
//   empties the three slots and starts over. The saved scores stay.
//
// Framework-free, with the progress store passed in, so the rules are tested as they are (loved-three.test.ts);
// useLovedThree.ts holds one per page with the guest's progress store.
import { LOVED_NEEDED } from "../stage/start-query.ts"

/** The score a loved title saves (owner, 2026-10-29). */
export const LOVED_SCORE = 9

export type LovedTitle = {
	/** The title's key (utils/title-key.ts). */
	key: number
	media_type: "movie" | "show"
	tmdb_id: number
}

/** Where loving a title is saved. */
export interface LovedStore<S> {
	/** The title's progress before it's loved, to put back on undo. */
	snapshot(title: LovedTitle): S
	/** Saves the title as loved; false when the store refuses it. */
	love(title: LovedTitle): boolean
	/** Puts the title's progress back as `before`. */
	restore(title: LovedTitle, before: S): void
}

export type ToggleResult = "loved" | "undone" | "full" | "refused"

export interface LovedThree<T extends LovedTitle> {
	/** The loved titles, in the order they were loved. */
	loved(): readonly T[]
	isLoved(title: Pick<LovedTitle, "key">): boolean
	/** Loves the title, or undoes it when it's loved. */
	toggle(title: T): ToggleResult
	/** Empties the slots (the saved scores stay). */
	reset(): void
	/** A new choice of the guest's: starts over once three are loved. */
	choice(): void
}

export function createLovedThree<T extends LovedTitle, S>({
	store,
	onChange,
}: {
	store: LovedStore<S>
	onChange: (loved: readonly T[]) => void
}): LovedThree<T> {
	let loved: readonly T[] = []
	const before = new Map<number, S>()
	const set = (next: readonly T[]) => {
		loved = next
		onChange(next)
	}
	const reset = () => {
		before.clear()
		if (loved.length) set([])
	}
	return {
		loved: () => loved,
		isLoved: (title) => loved.some((t) => t.key === title.key),
		toggle(title) {
			if (loved.some((t) => t.key === title.key)) {
				store.restore(title, before.get(title.key) as S)
				before.delete(title.key)
				set(loved.filter((t) => t.key !== title.key))
				return "undone"
			}
			if (loved.length >= LOVED_NEEDED) return "full"
			const previous = store.snapshot(title)
			if (!store.love(title)) return "refused"
			before.set(title.key, previous)
			set([...loved, title])
			return "loved"
		},
		reset,
		choice() {
			if (loved.length >= LOVED_NEEDED) reset()
		},
	}
}

// The share list being edited: title, titles in rank order, design, color theme, and list prompt. The card is signed
// with the owner's handle, which isn't part of the draft.
import { useRef, useState } from "react"
import {
	type CardTitle,
	LIST_SIZE,
	type ThemeKey,
	TITLE_MAX_LENGTH,
} from "~/ui/share-card/model"

export interface ListDraft {
	title: string
	promptId: string | null
	design: string
	theme: ThemeKey
	items: CardTitle[]
	// The list this one remixes, if any.
	remixedFrom?: string | null
}

// Titles picked from search lack a score and genre; fetch them so the card shows them.
async function fetchCardTitle(key: string): Promise<CardTitle | null> {
	try {
		const response = await fetch(
			`/api/share-lists/titles?keys=${encodeURIComponent(key)}`,
		)
		if (!response.ok) return null
		const { titles } = (await response.json()) as { titles: CardTitle[] }
		return titles[0] ?? null
	} catch {
		return null
	}
}

export function useListState(initial: ListDraft) {
	const [draft, setDraft] = useState(initial)
	// Bumped on every change the person makes, so autosave can tell edits from the first render.
	const version = useRef(0)

	const set = (patch: Partial<ListDraft>) => {
		version.current++
		setDraft((prev) => ({ ...prev, ...patch }))
	}
	const setItems = (items: CardTitle[], added?: CardTitle) => {
		set({ items })
		if (added && added.score == null) {
			fetchCardTitle(added.key).then((full) => {
				if (full)
					setDraft((prev) => ({
						...prev,
						items: prev.items.map((i) => (i.key === full.key ? full : i)),
					}))
			})
		}
	}

	return {
		...draft,
		draft,
		version,
		set,
		setTitle: (title: string) =>
			set({ title: title.slice(0, TITLE_MAX_LENGTH) }),
		has: (key: string) => draft.items.some((i) => i.key === key),
		remove: (key: string) =>
			set({ items: draft.items.filter((i) => i.key !== key) }),
		/** Inserts at a gap in the ranking. A full list keeps its size: the last title drops off. */
		insert: (item: CardTitle, index: number) => {
			const rest = draft.items.filter((i) => i.key !== item.key)
			const next = [...rest.slice(0, index), item, ...rest.slice(index)].slice(
				0,
				LIST_SIZE,
			)
			setItems(
				next,
				draft.items.some((i) => i.key === item.key) ? undefined : item,
			)
		},
		/** Puts a title on a rank. A title already in the list swaps places; a new one replaces. */
		place: (item: CardTitle, index: number) => {
			const next = [...draft.items]
			const from = next.findIndex((i) => i.key === item.key)
			const at = Math.min(index, next.length - (from >= 0 ? 1 : 0))
			if (from >= 0) {
				if (at < next.length) [next[from], next[at]] = [next[at], next[from]]
			} else if (at < next.length) next[at] = item
			else next.push(item)
			setItems(next, from >= 0 ? undefined : item)
		},
		add: (item: CardTitle) => {
			if (
				draft.items.some((i) => i.key === item.key) ||
				draft.items.length >= LIST_SIZE
			)
				return
			setItems([...draft.items, item], item)
		},
	}
}
export type ListState = ReturnType<typeof useListState>

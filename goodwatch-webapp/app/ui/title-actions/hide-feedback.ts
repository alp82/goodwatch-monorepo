// How a surface with poster cards answers Not interested on one of them. By default the card turns into its "Hidden"
// tile with Undo and nothing here is needed. Two kinds of surface say otherwise:
// - one whose list reloads and drops the title while the tile shows (Discover, for a guest) keeps the card in its
//   list with `useKeptCards` and `HiddenTileContext`;
// - one where a tile makes no sense because the whole page rearranges (Watch next) provides `HideFeedbackContext` and
//   shows its own Undo.
import { createContext, useCallback, useMemo, useRef } from "react"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** Called instead of showing the tile; `undo` takes Not interested back. */
export type HideFeedback = (media: ScoredMedia, undo: () => void) => void

export const HideFeedbackContext = createContext<HideFeedback | null>(null)

/** Told while a card shows its "Hidden" tile. */
export interface HiddenTileKeeper {
	keep: (media: ScoredMedia) => void
	release: (media: ScoredMedia) => void
}

export const HiddenTileContext = createContext<HiddenTileKeeper | null>(null)

interface Kept<T> {
	card: T
	/** The card before it when its tile appeared; null for the first card. */
	after: TitleKey | null
	/** After Undo: the list at that moment. The card stays until the list next changes, then the list decides. */
	releasedIn: T[] | null
}

const keyOf = (media: ScoredMedia) => titleKey(media.mediaType, media.details.tmdb_id)

/**
 * For a grid whose list can reload while a card shows its "Hidden" tile: returns the list with those cards kept in
 * their places, and the keeper to provide through `HiddenTileContext`. A kept card goes when the list changes after
 * its Undo, or when the card it followed is gone (the list is a different one).
 */
export function useKeptCards<T extends { key: TitleKey }>(cards: T[]): { cards: T[]; keeper: HiddenTileKeeper } {
	const kept = useRef(new Map<TitleKey, Kept<T>>())
	const latest = useRef<{ list: T[]; shown: T[] }>({ list: cards, shown: cards })

	const present = new Set(cards.map((card) => card.key))
	let shown = cards
	for (const [key, entry] of kept.current) {
		if (entry.releasedIn && entry.releasedIn !== cards) kept.current.delete(key)
	}
	if ([...kept.current.keys()].some((key) => !present.has(key))) {
		shown = [...cards]
		let waiting = [...kept.current].filter(([key]) => !present.has(key))
		// A kept card may follow another kept card, so place them until none fits.
		for (let placed = true; placed && waiting.length; ) {
			placed = false
			waiting = waiting.filter(([, entry]) => {
				const at = entry.after == null ? -1 : shown.findIndex((card) => card.key === entry.after)
				if (entry.after != null && at < 0) return true
				shown.splice(at + 1, 0, entry.card)
				placed = true
				return false
			})
		}
		for (const [key] of waiting) kept.current.delete(key)
	}
	latest.current = { list: cards, shown }

	const keep = useCallback((media: ScoredMedia) => {
		const key = keyOf(media)
		const { shown } = latest.current
		const at = shown.findIndex((card) => card.key === key)
		if (at < 0) return
		kept.current.set(key, { card: shown[at], after: shown[at - 1]?.key ?? null, releasedIn: null })
	}, [])
	const release = useCallback((media: ScoredMedia) => {
		const entry = kept.current.get(keyOf(media))
		if (entry) entry.releasedIn = latest.current.list
	}, [])
	const keeper = useMemo(() => ({ keep, release }), [keep, release])
	return { cards: shown, keeper }
}

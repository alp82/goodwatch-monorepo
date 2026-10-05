// PROTOTYPE - throwaway. The one in-memory store every section of /prototype/title-actions shares.
// Rules (decided): Not interested clears Want to see; scoring or Seen it clears Not interested.
// Assumed here: a score also marks the title seen; Want to see clears Not interested.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Score } from "~/server/scores.server"
import type { TitleCard } from "~/server/title-cards.server"

export type Key = number

export interface Marks {
	scores: Record<Key, Score>
	want: Key[]
	seen: Key[]
	/** Not interested, oldest first. */
	hidden: Key[]
}

export type VariantKey = "quick" | "peek" | "menu" | "footer-bolder"
export type UndoStyle = "toast" | "tile"

interface Toast {
	id: number
	text: string
	/** The marks to return to; absent for a plain message. */
	prev?: Marks
}

export interface Store extends Marks {
	cards: TitleCard[]
	T: (key: Key) => TitleCard | undefined
	variant: VariantKey
	undoStyle: UndoStyle
	setUndoStyle: (style: UndoStyle) => void
	scoreOf: (key: Key) => Score | null
	isWant: (key: Key) => boolean
	isSeen: (key: Key) => boolean
	isHidden: (key: Key) => boolean
	score: (key: Key, score: Score | null) => void
	toggleWant: (key: Key) => void
	toggleSeen: (key: Key) => void
	/** `quiet` skips the toast (the surface shows its own undo tile). */
	notInterested: (key: Key, quiet?: boolean) => void
	unhide: (key: Key) => void
	say: (text: string) => void
	toast: Toast | null
	undo: () => void
	dismiss: () => void
	reset: () => void
}

const EMPTY: Marks = { scores: {}, want: [], seen: [], hidden: [] }
const without = (list: Key[], key: Key) => list.filter((k) => k !== key)
const withKey = (list: Key[], key: Key) => (list.includes(key) ? list : [...list, key])

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
	const store = useContext(Ctx)
	if (!store) throw new Error("useStore outside StoreProvider")
	return store
}

const TOAST_MS = 6000
let toastId = 0

export function StoreProvider({
	cards,
	variant,
	defaultUndo,
	children,
}: {
	cards: TitleCard[]
	variant: VariantKey
	defaultUndo: UndoStyle
	children: React.ReactNode
}) {
	const [marks, setMarks] = useState<Marks>(EMPTY)
	const [toast, setToast] = useState<Toast | null>(null)
	const [undoOverride, setUndoStyle] = useState<UndoStyle | null>(null)
	const undoStyle = undoOverride ?? defaultUndo

	useEffect(() => {
		if (!toast) return
		const id = setTimeout(() => setToast(null), TOAST_MS)
		return () => clearTimeout(id)
	}, [toast])

	const byKey = useMemo(() => new Map(cards.map((card) => [card.key, card])), [cards])
	const T = useCallback((key: Key) => byKey.get(key), [byKey])
	const name = (key: Key) => byKey.get(key)?.title ?? "The title"
	const say = (text: string, prev?: Marks) => setToast({ id: ++toastId, text, prev })

	const store: Store = {
		...marks,
		cards,
		T,
		variant,
		undoStyle,
		setUndoStyle,
		scoreOf: (key) => marks.scores[key] ?? null,
		isWant: (key) => marks.want.includes(key),
		isSeen: (key) => marks.seen.includes(key),
		isHidden: (key) => marks.hidden.includes(key),
		score: (key, score) => {
			const scores = { ...marks.scores }
			if (score == null) {
				delete scores[key]
				setMarks({ ...marks, scores })
				say(`Cleared your score for ${name(key)}`, marks)
				return
			}
			scores[key] = score
			setMarks({ ...marks, scores, seen: withKey(marks.seen, key), hidden: without(marks.hidden, key) })
			say(`Scored ${name(key)} ${score}`, marks)
		},
		toggleWant: (key) => {
			const on = !marks.want.includes(key)
			setMarks({
				...marks,
				want: on ? withKey(marks.want, key) : without(marks.want, key),
				hidden: on ? without(marks.hidden, key) : marks.hidden,
			})
			say(on ? `Added ${name(key)} to Want to see` : `Removed ${name(key)} from Want to see`, marks)
		},
		toggleSeen: (key) => {
			const on = !marks.seen.includes(key)
			setMarks({
				...marks,
				seen: on ? withKey(marks.seen, key) : without(marks.seen, key),
				hidden: on ? without(marks.hidden, key) : marks.hidden,
			})
			say(on ? `Marked ${name(key)} as seen` : `Unmarked ${name(key)} as seen`, marks)
		},
		notInterested: (key, quiet = false) => {
			if (marks.hidden.includes(key)) {
				setMarks({ ...marks, hidden: without(marks.hidden, key) })
				if (!quiet) say(`${name(key)} is back in your recommendations`, marks)
				return
			}
			setMarks({ ...marks, hidden: [...marks.hidden, key], want: without(marks.want, key) })
			if (quiet) setToast(null)
			else say(`${name(key)} hidden from recommendations`, marks)
		},
		unhide: (key) => setMarks({ ...marks, hidden: without(marks.hidden, key) }),
		say: (text) => say(text),
		toast,
		undo: () => {
			if (toast?.prev) setMarks(toast.prev)
			setToast(null)
		},
		dismiss: () => setToast(null),
		reset: () => {
			setMarks(EMPTY)
			setToast(null)
		},
	}
	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

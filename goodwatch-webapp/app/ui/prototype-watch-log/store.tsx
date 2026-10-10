// PROTOTYPE - throwaway. The state of /prototype/watch-log: every film's watches, kept in this browser's localStorage
// under a key that says so. No request leaves the page.
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { type OrderMode, type RemoveMode, type VariantKey, type Watch, type When, makeWatch, seed } from "./model"

const STORAGE_KEY = "PROTOTYPE-watch-log-wipe-me"

export interface ToastMessage {
	id: number
	text: string
	undo?: () => void
	action?: { label: string; run: () => void }
}

interface Store {
	variant: VariantKey
	remove: RemoveMode
	order: OrderMode
	watches: Record<string, Watch[]>
	of: (filmId: string) => Watch[]
	add: (filmId: string, when: When) => Watch
	update: (filmId: string, watchId: string, when: When) => void
	removeOne: (filmId: string, watchId: string) => void
	removeAll: (filmId: string) => void
	/** Puts the watches back as they were before the last change. */
	undoLast: () => void
	reset: () => void
	toast: ToastMessage | null
	say: (text: string, options?: { undo?: boolean; action?: ToastMessage["action"] }) => void
	dismiss: () => void
	lastAction: string
}

const Context = createContext<Store | null>(null)

export function useStore() {
	const store = useContext(Context)
	if (!store) throw new Error("No watch log store")
	return store
}

function load(): Record<string, Watch[]> {
	try {
		const saved = localStorage.getItem(STORAGE_KEY)
		if (saved) return { ...seed(), ...JSON.parse(saved) }
	} catch {}
	return seed()
}

/** Mount in the browser only: the samples are dated from "now". */
export function StoreProvider({ variant, remove, order, children }: { variant: VariantKey; remove: RemoveMode; order: OrderMode; children: ReactNode }) {
	const [watches, setWatches] = useState<Record<string, Watch[]>>(load)
	const [toast, setToast] = useState<ToastMessage | null>(null)
	const [lastAction, setLastAction] = useState("none yet")
	const current = useRef(watches)
	current.current = watches
	const previous = useRef(watches)

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(watches))
		} catch {}
	}, [watches])

	const change = useCallback((action: string, next: (all: Record<string, Watch[]>) => Record<string, Watch[]>) => {
		previous.current = current.current
		current.current = next(current.current)
		setWatches(current.current)
		setLastAction(action)
	}, [])

	const store = useMemo<Store>(() => {
		const of = (filmId: string) => watches[filmId] ?? []
		const whenWords = (when: When) => (when.precision === "moment" ? "now" : when.precision === "day" ? when.day : "date unknown")
		return {
			variant,
			remove,
			order,
			watches,
			of,
			add: (filmId, when) => {
				const watch = makeWatch(when)
				change(`add watch to ${filmId} (${whenWords(when)})`, (all) => ({ ...all, [filmId]: [...(all[filmId] ?? []), watch] }))
				return watch
			},
			update: (filmId, watchId, when) =>
				change(`set a watch of ${filmId} to ${whenWords(when)}`, (all) => ({
					...all,
					[filmId]: (all[filmId] ?? []).map((watch) =>
						watch.id === watchId
							? { ...watch, precision: when.precision, at: when.precision === "moment" ? new Date().toISOString() : when.precision === "day" ? when.day : null }
							: watch,
					),
				})),
			removeOne: (filmId, watchId) =>
				change(`remove one watch of ${filmId}`, (all) => ({ ...all, [filmId]: (all[filmId] ?? []).filter((watch) => watch.id !== watchId) })),
			removeAll: (filmId) => change(`remove all watches of ${filmId}`, (all) => ({ ...all, [filmId]: [] })),
			undoLast: () => {
				current.current = previous.current
				setWatches(previous.current)
				setLastAction("undo")
				setToast(null)
			},
			reset: () => {
				current.current = seed()
				setWatches(current.current)
				setLastAction("reset to the samples")
				setToast(null)
			},
			toast,
			say: (text, options) =>
				setToast({
					id: Date.now(),
					text,
					action: options?.action,
					undo: options?.undo
						? () => {
								current.current = previous.current
								setWatches(previous.current)
								setLastAction("undo")
							}
						: undefined,
				}),
			dismiss: () => setToast(null),
			lastAction,
		}
	}, [variant, remove, order, watches, toast, lastAction, change])

	return <Context.Provider value={store}>{children}</Context.Provider>
}

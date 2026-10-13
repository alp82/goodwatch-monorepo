// Where the focus was on each TV screen in this tab's history, so Back, Forward and a reload give it back.
//
// The TV's focus is not in the URL (`tv-machine.ts`). The hook remembers the focus of the screen it leaves under
// that history entry, and when a location arrives the focus comes from here, else from the link's `focus=`, else
// from where the screen's focus starts. Kept in memory and in `sessionStorage`, the way the router's scroll
// restoration keeps positions. Where storage is blocked or full it still remembers for the life of the page.

export type FocusStorage = Pick<Storage, "getItem" | "setItem">

export const FOCUS_STORAGE_KEY = "living-room:tv-focus"

/** More history entries than a visit to the TV makes. Past it the entry remembered longest ago goes. */
export const MAX_ENTRIES = 100

export type FocusMemory = {
	/** Stores the focus of a history entry. Null forgets it. */
	remember(entry: string, focus: string | null): void
	/** The focus stored for a history entry, else `linked` (the URL's `focus=`), else null. */
	recall(entry: string, linked?: string | null): string | null
}

/**
 * The name of a history entry: the router's `location.key` with the entry's query. The key alone is not enough,
 * because the first entry of every document has the key `default`.
 */
export function focusKey(location: { key: string; search: string }): string {
	return `${location.key}${location.search}`
}

export function createFocusMemory(
	storage: FocusStorage | null = null,
): FocusMemory {
	// In the order the entries were remembered. Read from storage at the first use, not while rendering.
	let entries: Map<string, string> | null = null
	const load = () => {
		if (entries) return entries
		entries = new Map()
		try {
			const stored = JSON.parse(storage?.getItem(FOCUS_STORAGE_KEY) ?? "[]")
			for (const [entry, focus] of stored)
				if (typeof entry === "string" && typeof focus === "string")
					entries.set(entry, focus)
		} catch {
			// Blocked storage or a value this code did not write: start empty.
		}
		return entries
	}
	return {
		remember(entry, focus) {
			const all = load()
			all.delete(entry)
			if (focus) all.set(entry, focus)
			for (const oldest of all.keys()) {
				if (all.size <= MAX_ENTRIES) break
				all.delete(oldest)
			}
			try {
				storage?.setItem(FOCUS_STORAGE_KEY, JSON.stringify([...all]))
			} catch {
				// Blocked or full storage: the memory still holds it.
			}
		},
		recall(entry, linked = null) {
			return load().get(entry) ?? linked
		},
	}
}

let shared: FocusMemory | null = null

/**
 * The tab's focus memory, over `sessionStorage`. On the server every call gets an empty one of its own, so no
 * request sees another's.
 */
export function tabFocusMemory(): FocusMemory {
	if (typeof window === "undefined") return createFocusMemory()
	if (!shared) {
		let storage: FocusStorage | null = null
		try {
			storage = window.sessionStorage
		} catch {
			// Reading the property throws where storage is blocked.
		}
		shared = createFocusMemory(storage)
	}
	return shared
}

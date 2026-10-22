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
	/** Where in `storage` it keeps its entries: the focus's own key by default. */
	key: string = FOCUS_STORAGE_KEY,
): FocusMemory {
	// In the order the entries were remembered. Read from storage at the first use, not while rendering.
	let entries: Map<string, string> | null = null
	const load = () => {
		if (entries) return entries
		entries = new Map()
		try {
			const stored = JSON.parse(storage?.getItem(key) ?? "[]")
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
				storage?.setItem(key, JSON.stringify([...all]))
			} catch {
				// Blocked or full storage: the memory still holds it.
			}
		},
		recall(entry, linked = null) {
			return load().get(entry) ?? linked
		},
	}
}

/**
 * A phone list's place, per history entry (kit.tsx, `useListAnchor`): the list's item that had the focus last, so a
 * paged list comes back on its page when the focus comes back to a key beside it (Back from Details, from a real
 * page the Expand key opened). The same memory as the focus's, under its own key.
 */
export const LIST_STORAGE_KEY = "living-room:tv-list"

let shared: FocusMemory | null = null
let sharedList: FocusMemory | null = null

const tabStorage = (): FocusStorage | null => {
	try {
		return window.sessionStorage
	} catch {
		// Reading the property throws where storage is blocked.
		return null
	}
}

/** The tab's memory of each history entry's list place, over `sessionStorage`. On the server an empty one each call. */
export function tabListMemory(): FocusMemory {
	if (typeof window === "undefined") return createFocusMemory(null, LIST_STORAGE_KEY)
	sharedList ??= createFocusMemory(tabStorage(), LIST_STORAGE_KEY)
	return sharedList
}

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

/**
 * The keys a list's place is remembered under (kit.tsx, `useListAnchor`), each the list's own (`owner`): its
 * history entry, and the list's own address without the filters step and the focus.
 */
export function listKeys(
	owner: string,
	location: { key: string; pathname: string; search: string },
): [string, string] {
	const list = new URLSearchParams(location.search)
	list.delete("filters")
	list.delete("focus")
	return [
		`${owner}@${focusKey(location)}`,
		`${owner}@list:${location.pathname}?${list.toString()}`,
	]
}

/**
 * A filter changed (Filters' `filter:<key>` keys, and Reset filters): the results start again at their first page
 * (CONTEXT.md), even at an address visited before. The key to forget is the destination's results fallback, the
 * list's own address (`listKeys`). The memories of history entries stay, so Back to an older filter still finds its
 * page, and an unchanged Filters step, which changes no filter, keeps the results' place. Null for anything else.
 */
export function filterChangeForgets(
	item: string,
	destination: { pathname: string; search: string },
): string | null {
	if (!item.startsWith("filter:") && item !== "browse:reset") return null
	return listKeys("titles", { key: "", ...destination })[1]
}

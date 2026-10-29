import type { ProfilePart } from "~/domain/profile"

// Profile addresses without the imports page's logos, so metadata can use them independently.
export type ProfileTab =
	| "overview"
	| "seen"
	| "scores"
	| "wishlist"
	| "shows"
	| "lists"
	| "stats"
	| "tropes"

export const profileTabPath = (handle: string, tab: ProfileTab = "overview") =>
	tab === "overview" ? `/u/${handle}` : `/u/${handle}/${tab}`

/** Parts needed by each tab, shared by navigation and guest indexing policy. */
export const PROFILE_TAB_PARTS: Record<ProfileTab, readonly ProfilePart[]> = {
	overview: [],
	seen: ["seen"],
	scores: ["scores"],
	wishlist: ["wishlist"],
	shows: ["shows"],
	lists: ["lists"],
	stats: ["taste"],
	tropes: ["taste", "scores"],
}

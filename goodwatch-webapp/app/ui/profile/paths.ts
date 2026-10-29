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

// PROTOTYPE - throwaway. #192: shared state for the simulated app shell. Everything lives in the URL
// (page, tab, search) or in memory; nothing is written anywhere.
import { createContext, useContext } from "react"
import { TITLES, type NTitle } from "./data"

export type PageKey = "home" | "watch" | "discover" | "taste" | "explorer"
export type Who = "guest" | "member"
export type VariantKey = "tabs" | "search" | "merge" | "hub" | "command"
export type TasteTab = "sides" | "crowd" | "fingerprint"
export type SheetKey =
	| null
	| "wn-moods"
	| "wn-services"
	| "wn-sort"
	| "filters"
	| "disc-sort"
	| "hub"
	| "cmd"
	| "signup"
	| "navpanel"
	| "groups"

export const PAGES: { k: PageKey; label: string; short: string }[] = [
	{ k: "home", label: "Home", short: "Home" },
	{ k: "watch", label: "Watch next", short: "Watch next" },
	{ k: "discover", label: "Discover and Search", short: "Discover" },
	{ k: "taste", label: "Taste", short: "Taste" },
	{ k: "explorer", label: "Explorer", short: "Explorer" },
]
export const PAGE_KEYS = PAGES.map((p) => p.k)
export const pageLabel = (k: PageKey) => PAGES.find((p) => p.k === k)?.short ?? k

export const MOODS = [
	{ k: "funny", name: "Funny", hue: "#facc15" },
	{ k: "feelgood", name: "Feel-good", hue: "#fb923c" },
	{ k: "romance", name: "Romance", hue: "#f472b6" },
	{ k: "action", name: "Action", hue: "#ef4444" },
	{ k: "scary", name: "Scary", hue: "#a3e635" },
	{ k: "crime", name: "Crime & mystery", hue: "#60a5fa" },
	{ k: "mind", name: "Mind-bending", hue: "#c084fc" },
	{ k: "heavy", name: "Heavy", hue: "#94a3b8" },
	{ k: "worlds", name: "Other worlds", hue: "#2dd4bf" },
	{ k: "history", name: "History", hue: "#d4a373" },
	{ k: "coming", name: "Coming of age", hue: "#f5d0fe" },
]

export const SERVICES = [
	{ id: 8, name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" },
	{ id: 9, name: "Prime Video", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png" },
	{ id: 337, name: "Disney Plus", logo: "/5eZ872CghnHFLB1j8grszbrx0dx.png" },
	{ id: 15, name: "Hulu", logo: "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png" },
]
export const MY_SERVICES = [8, 9, 337]

export const WN_SORTS = [
	{ k: "best", name: "Best match", needsTaste: true },
	{ k: "waiting", name: "Waiting longest" },
	{ k: "added", name: "Last added" },
	{ k: "newest", name: "Newest release" },
	{ k: "top", name: "Top rated" },
	{ k: "popular", name: "Popular now" },
] as const
export const DISC_SORTS = [
	{ k: "popular", name: "Popular" },
	{ k: "top", name: "Top rated" },
	{ k: "newest", name: "Newest" },
] as const

export const img = (path: string, size = "w342") => `https://image.tmdb.org/t/p/${size}${path}`
export const logo = (path: string) => `https://image.tmdb.org/t/p/w92${path}`

/** Deterministic pseudo-random numbers so server and client render the same thing. */
export function seeded(seed: number) {
	let s = seed >>> 0
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0
		return s / 4294967296
	}
}
export const matchOf = (t: NTitle) => 62 + ((t.id * 7919) % 36)

export const byTitle = (name: string) => TITLES.find((t) => t.title === name) ?? TITLES[0]
/** The member's Wishlist in Best match order, and the guest's in Last added order. */
export const WISHLIST: Record<Who, NTitle[]> = {
	member: ["Reacher", "Blade Runner 2049", "Project Hail Mary", "Lioness", "Avengers: Infinity War", "The Office", "Zootopia 2", "Supernatural", "Grey's Anatomy", "The Mentalist", "Toy Story 5", "The Love Hypothesis", "Avatar: Fire and Ash", "The Simpsons", "Facing El Chapo", "Avengers: Endgame", "Law & Order: Special Victims Unit", "The Odyssey"].map(byTitle),
	guest: ["Project Hail Mary", "The Office", "Zootopia 2"].map(byTitle),
}
export const TAGLINE: Record<string, string> = {
	Reacher: "Reacher's back.",
	"Project Hail Mary": "One man, one ship, one last chance.",
}

export type WNState = { moods: string[]; everywhere: boolean; sort: string }
export type DiscState = { everywhere: boolean; unseen: boolean; forYou: boolean; sort: string }

export type Shell = {
	variant: VariantKey
	page: PageKey
	who: Who
	tab: TasteTab
	go: (p: PageKey, extra?: Record<string, string | null>) => void
	setTab: (t: TasteTab) => void
	searching: boolean
	q: string
	setQ: (q: string) => void
	openSearch: () => void
	closeSearch: () => void
	sheet: SheetKey
	setSheet: (s: SheetKey) => void
	wn: WNState
	setWn: (w: WNState) => void
	disc: DiscState
	setDisc: (d: DiscState) => void
	lit: number | null
	setLit: (i: number | null) => void
	folded: boolean
	/** The page's own mobile controls are drawn by the nav variant, not the page. */
	tonight: NTitle
}

export const ShellCtx = createContext<Shell | null>(null)
export const useShell = () => {
	const s = useContext(ShellCtx)
	if (!s) throw new Error("useShell outside the shell")
	return s
}

export const hasControls = (p: PageKey) => p !== "home"

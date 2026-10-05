// PROTOTYPE - throwaway. Shapes shared by the server and browser for /prototype/rec-explorer-5 (#180, round 5).
// Round 5 keeps round 4's map (regions per grouping, titles in round 2's compact shape W) and adds each island's
// fractal: a tree of titles where every title's children are its closest titles in that island, half its size.
import type { W } from "~/ui/prototype-rec-explorer-4/wire4"

export type { W }

/** How the children of a poster sit around it. */
export type Arrangement = "orbit" | "corners" | "plus"

/** Children per poster at each depth, after the first posters of an island. */
export const BRANCH: Record<Arrangement, number[]> = {
	orbit: [6, 2, 2],
	corners: [4, 3, 3],
	plus: [4, 3, 3],
}

/** How many full-size posters an island starts with, by how many titles it holds. */
export const firstCount = (count: number) =>
	count < 40 ? 2 : count < 220 ? 3 : count < 800 ? 4 : 5

/**
 * One island's fractal, breadth first: the first posters, then their children, and so on.
 * par[i] is the index of i's parent (-1 for the first posters); gen[i] is 1 for the first posters.
 */
export type TreeRes = {
	id: string
	items: W[]
	par: number[]
	gen: number[]
	/** Titles in the whole island (the tree holds the best-connected few hundred). */
	count: number
	ms?: number
}

/** Where a step toward each neighboring island lands: the closest title on that island's fractal. */
export type DoorRes = {
	doors: { to: string; idx: number; item: W | null }[]
	ms?: number
}

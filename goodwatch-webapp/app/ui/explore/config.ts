import type { DiscoverParams } from "~/server/discover.server"
import { mainHierarchy } from "~/ui/explore/main-nav"

export type NavType = "movies" | "shows"

export const navLabel = {
	movies: "Movies",
	"shows": "TV Shows",
}

export interface PageFAQItem {
	q: string
	a: string
}

export type PageFAQ = PageFAQItem[]

export interface PageData {
	type: "all" | "movies" | "shows"
	path: string
	label: string
	subtitle: string
	description: string
	backdrop_path: string
	discoverParams: Partial<DiscoverParams>
	// TODO extra filters
	faq: PageFAQ
}

export interface MainData {
	path: string
	label: string
	subtitle: string
	description: string
	items: Record<string, PageData>
}

export const validUrlParams = {
	type: ["movies", "shows"],
	category: Object.keys(mainHierarchy),
}

export const defaultDiscoverParams: Partial<DiscoverParams> = {
	minScore: "40",
}

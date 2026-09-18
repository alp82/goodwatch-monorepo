import { Link, type LinkProps } from "@remix-run/react"
import { createContext, useContext } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"

export type ExploreFilters = {
	type: "all" | "movie" | "show"
	genre: string
	order: "queue" | "newest" | "oldest"
}
export const defaultExploreFilters: ExploreFilters = {
	type: "all",
	genre: "",
	order: "queue",
}
export type TasteExploration = {
	carouselIndex?: number
	titles?: ScoringMedia[]
	ratingQueue?: ScoringMedia[]
	selectedMedia?: ScoringMedia | null
	view?: "rate" | "picks"
	scrollY?: number
	filters?: ExploreFilters
}
const storageKey = "taste_exploration"
export function readExploration(): TasteExploration {
	if (typeof window === "undefined") return {}
	try {
		const value = JSON.parse(
			localStorage.getItem(storageKey) ||
				sessionStorage.getItem(storageKey) ||
				"{}",
		)
		return value && typeof value === "object" ? value : {}
	} catch {
		return {}
	}
}
export function rememberExploration(update: Partial<TasteExploration>) {
	try {
		localStorage.setItem(
			storageKey,
			JSON.stringify({ ...readExploration(), ...update }),
		)
	} catch {
		/* Navigation remains available without storage. */
	}
}
export function uniqueTitles(titles: ScoringMedia[]) {
	return Array.from(
		new Map(
			titles.map((title) => [`${title.media_type}:${title.tmdb_id}`, title]),
		).values(),
	)
}
export const detailsHref = (
	media: Pick<ScoringMedia, "media_type" | "tmdb_id">,
) => `/${media.media_type}/${media.tmdb_id}`
export const TasteExplorationContext = createContext<(() => void) | null>(null)

export function TasteTitleLink({
	media,
	onClick,
	...props
}: Omit<LinkProps, "to" | "media"> & { media: ScoringMedia }) {
	const remember = useContext(TasteExplorationContext)
	return (
		<Link
			{...props}
			to={detailsHref(media)}
			draggable={false}
			onClick={(event) => {
				onClick?.(event)
				if (!event.defaultPrevented) remember?.()
			}}
		/>
	)
}

// Pieces the Taste page's three tabs share: title pictures, the person's own score, the poster card, and the On my
// services switch.
import { useState } from "react"
import type {
	PortraitService,
	PortraitTitle,
} from "~/server/taste-portrait/view"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { PosterProps } from "~/ui/Poster"
import { TmdbImage } from "~/ui/TmdbImage"
import { copyMediaPresentation } from "~/utils/media-presentation"
import type { TitleKey } from "~/utils/title-key"

type PosterSize = "w185" | "w342" | "w500"
type BackdropSize = "w780" | "w1280"

const TMDB_IMAGES = "https://image.tmdb.org/t/p"

export const posterUrl = (t: PortraitTitle, size: PosterSize = "w342") =>
	t.poster ? `${TMDB_IMAGES}/${size}${t.poster}` : undefined
export const backdropUrl = (
	t: PortraitTitle | null | undefined,
	size: BackdropSize = "w1280",
) => (t?.backdrop ? `${TMDB_IMAGES}/${size}${t.backdrop}` : undefined)

export type Titles = Record<string, PortraitTitle>

/** The titles of the keys, in order, leaving out any the view doesn't carry. */
export const titlesOf = (titles: Titles, keys: (TitleKey | null)[]) =>
	keys.flatMap((key) => (key !== null && titles[key] ? [titles[key]] : []))

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The app's vibe color for a 1 to 10 score. */
export const vibe = (score10: number) =>
	`var(--color-vibe-${Math.max(0, Math.min(100, Math.round(score10) * 10))})`

/** A portrait title as the site's poster card: the score pill (GoodWatch score, the person's own score) and, for a
 * title they haven't seen, the logos of their services that carry it. */
export function PortraitCard({
	t,
	posterSizes,
	rated = false,
}: {
	t: PortraitTitle
	posterSizes?: PosterProps["sizes"]
	/**
	 * The person's own rated title, not a suggestion: a ring in the panel's amber sets it apart from the suggestion
	 * cards beside it, which have none.
	 */
	rated?: boolean
}) {
	const card = (
		<MovieTvCard
			details={{
				tmdb_id: t.tmdbId,
				title: t.title,
				release_year: t.year,
				poster_path: t.poster,
				goodwatch_overall_score_normalized_percent: t.score,
				streaming_links: t.services,
				...copyMediaPresentation(t),
			}}
			mediaType={t.mediaType}
			posterSizes={posterSizes}
		/>
	)
	return rated ? (
		<div className="rounded-lg ring-2 ring-amber-400/60 ring-offset-2 ring-offset-gray-950">
			{card}
		</div>
	) : (
		card
	)
}

/** On my services, on by default for a person with services; one tap to Everywhere. */
export function useServicesFilter(hasServices: boolean) {
	const [onlyMine, setOnlyMine] = useState(true)
	const active = hasServices && onlyMine
	return {
		hasServices,
		onlyMine: active,
		toggle: () => setOnlyMine((value) => !value),
		/** While availability loads, a title's services are unknown (null) and it stays in. */
		keep: (t: PortraitTitle) => !active || t.onMyServices !== false,
	}
}

export type ServicesFilter = ReturnType<typeof useServicesFilter>

export function ServicesSwitch({
	filter,
	services,
}: { filter: ServicesFilter; services: PortraitService[] }) {
	if (!filter.hasServices) return null
	return (
		<button
			type="button"
			onClick={filter.toggle}
			aria-pressed={filter.onlyMine}
			className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition md:min-h-0 ${filter.onlyMine ? "border-amber-600/70 bg-amber-900/30 text-amber-100" : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500"}`}
		>
			<span className="flex -space-x-1.5">
				{services.slice(0, 4).map((service) => (
					<TmdbImage
						key={service.id}
						kind="logo"
						path={service.logo_path}
						width={20}
						ratio={1}
						className={`h-5 w-5 rounded-md ring-2 ring-gray-950 ${filter.onlyMine ? "" : "opacity-60 grayscale"}`}
					/>
				))}
			</span>
			{filter.onlyMine ? "On my services" : "Everywhere"}
		</button>
	)
}

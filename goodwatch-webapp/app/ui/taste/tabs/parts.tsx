// Pieces the Taste page's three tabs share: title pictures and links, the person's own score, the poster with that
// score, the suggestion card, and the On my services switch.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type {
	PortraitService,
	PortraitTitle,
} from "~/server/taste-portrait/view"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { titleToDashed } from "~/utils/helpers"
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

export const titleHref = (t: PortraitTitle) =>
	`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`

export type Titles = Record<string, PortraitTitle>

/** The titles of the keys, in order, leaving out any the view doesn't carry. */
export const titlesOf = (titles: Titles, keys: (TitleKey | null)[]) =>
	keys.flatMap((key) => (key !== null && titles[key] ? [titles[key]] : []))

/** "an 8", "a 7". */
export const article = (n: number) => (n === 8 ? "an" : "a")

export const percent = (x: number) => `${Math.round(x * 100)}%`
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The app's vibe color for a 1 to 10 score. */
export const vibe = (score10: number) =>
	`var(--color-vibe-${Math.max(0, Math.min(100, Math.round(score10) * 10))})`

/** The person's own score as the app draws a rating: a vibe-colored tile with the number. */
export function YourScore({
	score,
	size = "md",
	label,
}: { score: number; size?: "sm" | "md" | "lg"; label?: string }) {
	const dim =
		size === "lg"
			? "h-12 min-w-12 text-2xl"
			: size === "sm"
				? "h-6 min-w-6 text-xs"
				: "h-9 min-w-9 text-base"
	return (
		<span className="inline-flex items-center gap-2">
			<span
				className={`inline-flex items-center justify-center rounded-md px-1.5 font-extrabold tabular-nums text-white ${dim}`}
				style={{ background: vibe(score) }}
				aria-label={label ? undefined : `Your score: ${score}`}
			>
				{score}
			</span>
			{label && (
				<span className="text-xs leading-tight text-gray-300">{label}</span>
			)}
		</span>
	)
}

/** A plain poster linking to the title, with the person's own score in the corner for a title they rated. */
export function RatedPoster({
	t,
	size = "w342",
	showScore = true,
	className = "",
}: {
	t: PortraitTitle
	size?: PosterSize
	showScore?: boolean
	className?: string
}) {
	return (
		<Link
			to={titleHref(t)}
			prefetch="intent"
			className={`relative block overflow-hidden rounded-md border-2 border-gray-800 bg-gray-900 transition hover:border-amber-700/60 ${className}`}
			title={t.title}
		>
			<img
				src={posterUrl(t, size)}
				alt={`Poster for ${t.title}`}
				className="block aspect-[2/3] w-full object-cover"
				loading="lazy"
				draggable={false}
			/>
			{showScore && t.mine != null && (
				<span className="absolute right-1 top-1">
					<YourScore score={t.mine} size="sm" />
				</span>
			)}
		</Link>
	)
}

/** An unseen title as the site's poster card: GoodWatch score, taste match with its reasons, and services. */
export function SuggestionCard({ t }: { t: PortraitTitle }) {
	const details = {
		tmdb_id: t.tmdbId,
		title: t.title,
		release_year: t.year,
		poster_path: t.poster ?? undefined,
		goodwatch_overall_score_normalized_percent: t.score,
		streaming_links: t.services?.map((service) => ({
			provider_id: service.id,
			provider_name: service.name,
			provider_logo_path: service.logo_path,
		})),
	}
	return (
		<MovieTvCard
			details={
				details as unknown as Parameters<typeof MovieTvCard>[0]["details"]
			}
			mediaType={t.mediaType}
			taste={{ match: t.match, reasons: t.reasons ?? [] }}
		/>
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
					<img
						key={service.id}
						src={`https://www.themoviedb.org/t/p/original/${service.logo_path}`}
						alt=""
						className={`h-5 w-5 rounded-md ring-2 ring-gray-950 ${filter.onlyMine ? "" : "opacity-60 grayscale"}`}
					/>
				))}
			</span>
			{filter.onlyMine ? "On my services" : "Everywhere"}
		</button>
	)
}

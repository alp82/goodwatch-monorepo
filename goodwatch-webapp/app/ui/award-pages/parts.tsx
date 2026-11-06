// Shared pieces of the awards pages: the head, the won mark, the poster card, the year links.
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	TrophyIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, createContext, useContext } from "react"
import type { AwardTitle } from "~/server/award-pages.server"
import type { RowServices } from "~/server/row-services.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { TmdbImage } from "~/ui/TmdbImage"
import { ListHead } from "~/ui/best-lists/ListHead"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import type { SizeRule } from "~/utils/tmdb-image"

export function AwardsHead({
	crumbs,
	heading,
	intro,
	children,
}: { crumbs: Crumb[]; heading: string; intro: string; children?: ReactNode }) {
	return (
		<>
			{crumbs.length > 1 && <Breadcrumbs items={crumbs} />}
			<ListHead heading={heading} intro={intro}>
				{children}
			</ListHead>
			<p className="mb-5 text-xs text-gray-400">
				Reported results from TVDB and Wikidata. Coverage is incomplete.
			</p>
		</>
	)
}

export function WonMark({ className = "" }: { className?: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-400 ${className}`}
		>
			<TrophyIcon className="h-3.5 w-3.5" aria-hidden="true" />
			Won
		</span>
	)
}

/** A member's own services per title (null for a guest), for the logos on the cards. */
export const AwardServices = createContext<RowServices | null>(null)

/** The drawn widths of the cards, so a small card doesn't load a grid-sized poster. */
export const CARD_SIZES = {
	/** A ceremony's winner. */
	winner: {
		sizes: [
			["(min-width: 640px)", "144px"],
			[null, "112px"],
		],
		max: 144,
	},
	/** A ceremony's nominees, a body's latest winners, the hub's latest ceremonies. */
	small: {
		sizes: [
			["(min-width: 640px)", "130px"],
			[null, "100px"],
		],
		max: 140,
	},
	/** The winner of a year on a category page. */
	year: {
		sizes: [
			["(min-width: 640px)", "128px"],
			[null, "96px"],
		],
		max: 128,
	},
} satisfies Record<string, { sizes: SizeRule[]; max: number }>

/** The usual poster card: score pill, title band, the member's services, the title actions. */
export function AwardCard({
	title,
	size,
	priority,
}: {
	title: AwardTitle
	size: keyof typeof CARD_SIZES
	priority?: boolean
}) {
	const services = useContext(AwardServices)
	const own = services?.[`${title.media_type}-${title.tmdb_id}`]
	return (
		<MovieTvCard
			details={{
				...title,
				streaming_links: own?.map((s) => ({
					id: s.id,
					name: s.name,
					logo_path: s.logoPath,
				})),
			}}
			mediaType={title.media_type}
			posterSizes={CARD_SIZES[size].sizes}
			posterMaxWidth={CARD_SIZES[size].max}
			posterPriority={priority ? "eager" : "lazy"}
		/>
	)
}

export function SmallPoster({
	title,
	className,
}: { title: AwardTitle; className: string }) {
	return title.poster_path ? (
		<TmdbImage
			kind="poster"
			path={title.poster_path}
			width={48}
			className={`${className} shrink-0 rounded-sm bg-white/5 object-cover`}
		/>
	) : (
		<span className={`${className} block shrink-0 rounded-sm bg-white/10`} />
	)
}

export const yearText = (t: AwardTitle) =>
	[t.media_type === "show" ? "TV show" : null, t.release_year]
		.filter(Boolean)
		.join(" · ")

export function YearNav({
	base,
	prev,
	next,
}: { base: string; prev: number | null; next: number | null }) {
	const cls =
		"inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-3 py-1.5 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10"
	return (
		<nav aria-label="Other years" className="flex gap-2">
			{prev && (
				<Link to={`${base}/${prev}`} prefetch="intent" className={cls}>
					<ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
					{prev}
				</Link>
			)}
			<Link to={base} prefetch="intent" className={cls}>
				All years
			</Link>
			{next && (
				<Link to={`${base}/${next}`} prefetch="intent" className={cls}>
					{next}
					<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
				</Link>
			)}
		</nav>
	)
}

/** A plain list of titles, comma separated, each a link. */
export function TitleLinks({ titles }: { titles: AwardTitle[] }) {
	return (
		<>
			{titles.map((t, i) => (
				<span key={`${t.media_type}${t.tmdb_id}`}>
					<Link
						to={t.path}
						prefetch="intent"
						className="text-gray-300 hover:text-amber-300"
					>
						{t.title}
					</Link>
					{i < titles.length - 1 && <span className="text-gray-600">, </span>}
				</span>
			))}
		</>
	)
}

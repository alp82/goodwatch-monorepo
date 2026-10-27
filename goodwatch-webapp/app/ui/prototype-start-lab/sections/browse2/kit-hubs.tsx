// PROTOTYPE (start page lab, round 2): browse2's shared parts: the real hub addresses, a snap rail, a section head with "See all", poster collages.
import "~/ui/living-room/living-room.css"
import "~/ui/talked-about-now/start-row/start-row.css"
import { Link } from "@remix-run/react"
import type { CSSProperties, ReactNode } from "react"
import { MOODS, type MoodKey } from "~/domain/moods"
import { brandOfService } from "~/domain/new-on-services"
import { exploreAddressExists } from "~/ui/explore/address"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import type { LabCard, LabData } from "../../lab/types"

/** What a decorative poster needs. */
export type PosterLike = Pick<LabCard, "key" | "poster_path">

export type Kind = "movie" | "show"
export const plural = (kind: Kind) => (kind === "movie" ? "movies" : "shows")

/** The `.lrb` wrapper (the start page section's font, h2 and link styles) without its page-section background. */
export const lrbStyle: CSSProperties = { background: "none", zIndex: "auto" }

// ---- Hub addresses (the site's real pages) ----

export const HUBS = {
	bestMovies: "/movies/best",
	bestShows: "/shows/best",
	newOn: "/new",
	movieMoods: "/movies/moods",
	showMoods: "/shows/moods",
	movieGenres: "/movies/genres",
	showGenres: "/shows/genres",
	movieStreaming: "/movies/streaming",
	showStreaming: "/shows/streaming",
	hot: "/hot-on-socials",
	explorer: "/explorer",
	people: "/people",
	discover: "/discover",
} as const

export const genreSlug = (name: string) =>
	name
		.toLowerCase()
		.replace(/sci-fi/g, "scifi")
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

/** The genre's own page when the site has one for this type, else the type's genre hub. */
export const genreHref = (kind: Kind, name: string) => {
	const page = genreSlug(name)
	return exploreAddressExists({ type: plural(kind), category: "genres", page }) ? `/${plural(kind)}/genres/${page}` : `/${plural(kind)}/genres`
}

/** A service's page: its streaming hub page where the site has one, else its "New on" page, else Discover on it. */
export const serviceHref = (id: number, kind: Kind = "show") => {
	const slug = brandOfService(id)?.slug
	if (!slug) return `/discover?services=${id}`
	if (exploreAddressExists({ type: plural(kind), category: "streaming", page: slug })) return `/${plural(kind)}/streaming/${slug}`
	return `/new/${slug}`
}

/** Discover with the mood on (the Discover moods have no hub page of their own). */
export const moodHref = (key: string, kind?: Kind) => `/discover?${kind ? `type=${kind}&` : ""}moods=${key}`

const MOOD_INFO = new Map<string, { name: string; description: string; hue: string }>(MOODS.map((m) => [m.key, m]))
export const moodInfo = (key: string) => MOOD_INFO.get(key as MoodKey) ?? { name: key, description: "", hue: "#fbbf24" }

export const serviceLogo = (path: string | null) => (path ? `https://image.tmdb.org/t/p/w92${path}` : "")

/** The moods, each with its own titles of one type (or all). */
export function moodsOf(data: LabData, kind?: Kind) {
	return data.guest.moods
		.map((m) => ({ ...m, ...moodInfo(m.key), titles: kind ? m.titles.filter((t) => t.media_type === kind) : m.titles }))
		.filter((m) => m.titles.length >= 3)
}

// ---- Layout parts ----

/** A section's heading row: the heading (h2 or h3) with an optional line, and "See all" to its hub. */
export function SectionHead({
	as: H = "h3",
	id,
	title,
	line,
	href,
	more = "See all",
	aside,
}: {
	as?: "h2" | "h3"
	id?: string
	title: ReactNode
	line?: ReactNode
	href?: string
	more?: string
	/** Optional controls placed just before "See all" (d and e put their phone row arrows here). */
	aside?: ReactNode
}) {
	return (
		<div className="mb-3 flex items-end justify-between gap-4">
			<div className="min-w-0">
				<H id={id} className={H === "h2" ? "!text-2xl md:!text-3xl" : "text-lg font-bold leading-tight text-white md:text-xl"}>
					{title}
				</H>
				{line && <p className="mt-0.5 truncate text-sm text-gray-400">{line}</p>}
			</div>
			{(href || aside) && (
				<div className="flex shrink-0 items-center gap-2">
					{aside}
					{href && (
						<Link
							to={href}
							discover="none"
							className="shrink-0 whitespace-nowrap rounded-full px-1 py-1 text-sm font-semibold text-amber-400 hover:text-amber-300"
						>
							{more} <span aria-hidden>→</span>
						</Link>
					)}
				</div>
			)}
		</div>
	)
}

/**
 * A horizontal rail that snaps on phones. It bleeds to the screen edges inside a px-4 / sm:px-8 container, so the
 * page itself never scrolls sideways.
 */
export function Rail({ children, className = "", gap = "gap-3", label }: { children: ReactNode; className?: string; gap?: string; label?: string }) {
	return (
		<ul
			aria-label={label}
			className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden ${gap} ${className}`}
		>
			{children}
		</ul>
	)
}

export const POSTER_W = "w-[7.25rem] sm:w-[9rem] lg:w-[10.25rem]"

/** The real poster cards in a rail. */
export function PosterRail({ cards, label, width = POSTER_W }: { cards: LabCard[]; label?: string; width?: string }) {
	return (
		<Rail label={label}>
			{cards.map((card) => (
				<li key={card.key} className={`shrink-0 snap-start ${width}`}>
					<TitlePosterCard card={card} actions={false} />
				</li>
			))}
		</Rail>
	)
}

/** A plain poster image (decorative inside a link whose text names the hub). */
export function Poster({ card, className = "", style }: { card: PosterLike | undefined; className?: string; style?: CSSProperties }) {
	if (!card) return <span className={`block rounded-md bg-gray-800 ${className}`} style={style} />
	return (
		<img
			src={tmdbImage(card.poster_path, "w185")}
			alt=""
			loading="lazy"
			decoding="async"
			width={185}
			height={278}
			className={`block aspect-[2/3] rounded-md bg-gray-800 object-cover shadow-lg shadow-black/50 ring-1 ring-white/10 ${className}`}
			style={style}
		/>
	)
}

/** Three posters fanned out from the bottom center; `open` (a parent :hover/:focus class) spreads them a little more. */
export function Fan({ cards, className = "", spread = 1 }: { cards: PosterLike[]; className?: string; spread?: number }) {
	const three = [cards[1], cards[0], cards[2]]
	const at = [
		{ x: -38 * spread, r: -9 * spread, z: 1 },
		{ x: 0, r: 0, z: 3 },
		{ x: 38 * spread, r: 9 * spread, z: 2 },
	]
	return (
		<div aria-hidden className={`relative ${className}`}>
			{three.map((card, i) => (
				<Poster
					key={card?.key ?? i}
					card={card}
					className="bw2-fan absolute bottom-0 left-1/2 w-[46%] origin-bottom"
					style={
						{
							zIndex: at[i].z,
							"--x": `${at[i].x}%`,
							"--r": `${at[i].r}deg`,
							transform: `translateX(calc(-50% + var(--x))) rotate(var(--r))`,
						} as CSSProperties
					}
				/>
			))}
		</div>
	)
}

/** Two to four posters overlapping in a row, like a stack of cases. */
export function Stack({ cards, count = 4, className = "" }: { cards: PosterLike[]; count?: number; className?: string }) {
	return (
		<div aria-hidden className={`flex ${className}`}>
			{cards.slice(0, count).map((card, i) => (
				<Poster key={card.key} card={card} className={`w-[30%] shrink-0 ${i ? "-ml-[9%]" : ""}`} style={{ zIndex: count - i }} />
			))}
		</div>
	)
}

/** Shared motion for the fans (transform only). */
export function FanStyles() {
	return (
		<style>{`
.bw2-fan{transition:transform .35s cubic-bezier(.2,.8,.2,1);will-change:transform}
@media (hover:hover){.bw2-tile:hover .bw2-fan,.bw2-tile:focus-within .bw2-fan{transform:translateX(calc(-50% + var(--x) * 1.35)) rotate(calc(var(--r) * 1.4)) translateY(-4%)}}
@media (prefers-reduced-motion:reduce){.bw2-fan{transition:none}}
`}</style>
	)
}

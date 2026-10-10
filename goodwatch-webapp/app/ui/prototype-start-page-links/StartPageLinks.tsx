// PROTOTYPE (#352), throwaway: three placements for crawlable title and hub links on the start page, switched by
// `/?links=strip|scroll|tv` and rendered on the server. Without the parameter the page is today's page.
// Never merge: see docs/prototypes/start-page-links/README.md.
import { useSearchParams } from "@remix-run/react"
import { titleHref } from "~/ui/watch-next/WatchNextHero"
import { posterUrl } from "~/ui/watch-next/style"
import type { StartLink } from "~/ui/living-room/living-room-data"

export const LINK_VARIANTS = {
	strip: "Strip in the room",
	scroll: "Scroll below the room",
	tv: "On the TV",
} as const
export type LinksVariant = keyof typeof LINK_VARIANTS

export function useLinksVariant(): LinksVariant | null {
	const [params] = useSearchParams()
	const value = params.get("links")
	return value && value in LINK_VARIANTS ? (value as LinksVariant) : null
}

export const HUBS = [
	{ href: "/discover", label: "Discover", short: "Discover" },
	{ href: "/movies", label: "Movies", short: "Movies" },
	{ href: "/shows", label: "TV shows", short: "Shows" },
	{ href: "/explorer", label: "Explorer", short: "Explorer" },
	{ href: "/taste", label: "Taste", short: "Taste" },
	{ href: "/how-it-works", label: "How GoodWatch works", short: "How it works" },
	{ href: "/movies/moods", label: "Movies by mood", short: "Movie moods" },
	{ href: "/shows/moods", label: "Shows by mood", short: "Show moods" },
	{ href: "/movies/genres", label: "Movies by genre", short: "Movie genres" },
	{ href: "/shows/genres", label: "Shows by genre", short: "Show genres" },
	{
		href: "/movies/streaming",
		label: "Movies by streaming service",
		short: "Movie streaming",
	},
	{
		href: "/shows/streaming",
		label: "Shows by streaming service",
		short: "Show streaming",
	},
]

const Dot = () => <span className="text-white/30"> · </span>

// ---------------------------------------------------------------------------------------------------------
// Variant strip: small text links along the bottom edge, inside the fixed room. Wide windows: hubs at the bottom
// left, titles at the bottom right, the Remote between them. Phones: two lines over the Remote's grip, each
// scrolls sideways.

export function StripLinks({ links }: { links: StartLink[] }) {
	const hubs = HUBS.map((hub, i) => (
		<span key={hub.href}>
			{i > 0 && <Dot />}
			<a href={hub.href} className="hover:text-white hover:underline">
				{hub.short}
			</a>
		</span>
	))
	const titles = links.map((link, i) => (
		<span key={titleHref(link)}>
			{i > 0 && <Dot />}
			<a href={titleHref(link)} className="hover:text-white hover:underline">
				{link.title}
			</a>
		</span>
	))
	return (
		<nav aria-label="GoodWatch pages and popular titles" className="lr-strip">
			<p className="lr-strip-hubs">{hubs}</p>
			<p className="lr-strip-titles">
				<span className="font-bold text-white/60">Popular now: </span>
				{titles}
			</p>
		</nav>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Variant scroll: the room is the first screen; this text-only section follows it, then the site footer.

export function ScrollCue() {
	return (
		<a
			href="#popular-now"
			className="lr-scroll-cue absolute bottom-3 right-3 z-20 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-semibold text-white/85 ring-1 ring-white/15 md:bottom-5 md:right-6 md:text-[13px]"
		>
			Popular right now ↓
		</a>
	)
}

export function BelowRoom({ links }: { links: StartLink[] }) {
	return (
		<section
			id="popular-now"
			className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 pb-4 pt-10 text-neutral-300 sm:px-8"
		>
			<h2 className="text-2xl font-extrabold text-white">Popular right now</h2>
			<ol className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
				{links.map((link) => (
					<li key={titleHref(link)} className="truncate">
						<a
							href={titleHref(link)}
							className="font-semibold text-neutral-100 underline decoration-white/20 underline-offset-4 hover:decoration-amber-400"
						>
							{link.title}
						</a>{" "}
						<span className="text-neutral-500">
							{link.media_type === "movie" ? "Movie" : "Show"}
						</span>
					</li>
				))}
			</ol>
			<h2 className="mt-10 text-2xl font-extrabold text-white">Browse</h2>
			<ul className="mt-4 grid grid-cols-2 gap-2 text-[15px] sm:grid-cols-3 lg:grid-cols-4">
				{HUBS.map((hub) => (
					<li key={hub.href}>
						<a
							href={hub.href}
							className="block rounded-lg bg-white/[0.04] px-3 py-2.5 font-semibold text-neutral-100 ring-1 ring-white/10 hover:bg-white/[0.08]"
						>
							{hub.label}
						</a>
					</li>
				))}
			</ul>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Variant tv: the home screen's posters are links, and two slim rows sit under its cards. Sizes are in TV canvas
// pixels, so everything shrinks with the TV.

/** A poster that is a link to its title page, with the title as a caption on it. */
export function PosterLink({
	link,
	width,
	caption = true,
}: { link: StartLink; width: number; caption?: boolean }) {
	return (
		<a
			href={titleHref(link)}
			className="pointer-events-auto relative block overflow-hidden rounded-lg shadow-xl ring-1 ring-white/10 hover:ring-2 hover:ring-amber-300"
			style={{ width, height: width * 1.5 }}
		>
			{link.poster_path ? (
				<img
					src={posterUrl(link.poster_path, "w185")}
					alt={caption ? "" : link.title}
					width={width}
					height={width * 1.5}
					className="h-full w-full object-cover"
				/>
			) : (
				<span className="block h-full w-full bg-white/10" />
			)}
			{caption ? (
				<span
					className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black via-black/85 to-transparent px-1.5 pb-1 pt-4 text-center font-bold leading-tight text-white"
					style={{ fontSize: Math.max(10, width * 0.115) }}
				>
					{link.title}
				</span>
			) : null}
		</a>
	)
}

/** Three poster links fanned out like the home screen's `Fan`. */
export function LinkFan({
	links,
	width,
	caption,
}: { links: StartLink[]; width: number; caption?: boolean }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{links.slice(0, 3).map((link, i) => (
				<div
					key={titleHref(link)}
					className="relative"
					style={{
						margin: `0 ${-width * 0.1}px`,
						marginTop: i === 1 ? 0 : width * 0.24,
						transform: `rotate(${(i - 1) * 6}deg)`,
						zIndex: i === 1 ? 2 : 1,
					}}
				>
					<PosterLink link={link} width={width} caption={caption} />
				</div>
			))}
		</div>
	)
}

/** The slim rows under the home screen's cards: the hubs, then the titles that have no poster on the screen. */
export function TvLinkRows({
	links,
	fontSize,
	className,
}: { links: StartLink[]; fontSize: number; className: string }) {
	return (
		<nav
			aria-label="GoodWatch pages and popular titles"
			className={`absolute z-10 leading-snug text-white/70 ${className}`}
			style={{ fontSize }}
		>
			<p className="overflow-hidden whitespace-nowrap">
				{HUBS.map((hub, i) => (
					<span key={hub.href}>
						{i > 0 && <Dot />}
						<a href={hub.href} className="hover:text-white hover:underline">
							{hub.short}
						</a>
					</span>
				))}
			</p>
			{links.length > 0 && (
				<p className="overflow-hidden whitespace-nowrap">
					<span className="font-bold text-white/50">Popular now: </span>
					{links.map((link, i) => (
						<span key={titleHref(link)}>
							{i > 0 && <Dot />}
							<a
								href={titleHref(link)}
								className="hover:text-white hover:underline"
							>
								{link.title}
							</a>
						</span>
					))}
				</p>
			)}
		</nav>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The switcher: plain links, so each variant is a fresh server render. Top of the window, because the bottom
// edge is what the variants change. No arrow keys: those belong to the Remote. `&bar=0` hides it.

export function LinksSwitcher() {
	const [params] = useSearchParams()
	const current = useLinksVariant()
	if (process.env.NODE_ENV === "production" || params.get("bar") === "0")
		return null
	const keys = [null, ...Object.keys(LINK_VARIANTS)] as (LinksVariant | null)[]
	const at = keys.indexOf(current)
	const href = (step: number) => {
		const next = keys[(at + step + keys.length) % keys.length]
		return next ? `/?links=${next}` : "/"
	}
	return (
		<div className="fixed left-1/2 top-1 z-[2000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-1.5 py-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
			<a href={href(-1)} className="rounded-full px-2 py-0.5 hover:bg-neutral-200">
				←
			</a>
			<span className="min-w-40 text-center">
				{current ? `${current}: ${LINK_VARIANTS[current]}` : "today (no links)"}
			</span>
			<a href={href(1)} className="rounded-full px-2 py-0.5 hover:bg-neutral-200">
				→
			</a>
		</div>
	)
}

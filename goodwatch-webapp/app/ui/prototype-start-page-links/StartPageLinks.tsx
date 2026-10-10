// PROTOTYPE (#352), throwaway: three placements for crawlable title and hub links on the start page, switched by
// `/?links=strip|scroll|tv` and rendered on the server. Without the parameter the page is today's page.
// Never merge: see docs/prototypes/start-page-links/README.md.
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { titleHref } from "~/ui/watch-next/WatchNextHero"
import { posterUrl } from "~/ui/watch-next/style"
import type { StartLink } from "~/ui/living-room/living-room-data"

export const LINK_VARIANTS = {
	strip: "Strip in the room",
	scroll: "Below the room, by its lip",
	scroll2: "Below the room, second look",
	tv: "On the TV",
} as const
export type LinksVariant = keyof typeof LINK_VARIANTS

export const isScrollVariant = (variant: LinksVariant | null) =>
	variant === "scroll" || variant === "scroll2"

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
// Variants scroll and scroll2: the room is the first screen and keeps the wheel, the swipe, and the keys. The
// section below it is ordinary page content right after the room; its lip lies over the room's bottom edge and is
// the one way down. Both variants share this markup; `scroll2` is a second look (living-room.css, `.lrb-2`).
//
// Without JavaScript it works by CSS alone: the lip is a link to `#browse`, the way back a link to `#room`, and
// `#browse:target` lets the page scroll. With JavaScript the same links set `data-lr-below` on <html> and move the
// page themselves, and the URL stays as it is (a fragment change would go through the router, which then restores
// an old scroll position). The script also adds: scrolling up to the very top returns to the room, Escape returns,
// and keyboard focus that lands in the section or the footer counts as being there.

const MAIN_HUBS = [
	{ href: "/discover", label: "Discover", line: "Filter by mood, genre, score, and service." },
	{ href: "/movies", label: "Movies", line: "Films worth your evening." },
	{ href: "/shows", label: "TV shows", line: "A series to start next." },
	{ href: "/explorer", label: "Explorer", line: "A map of titles that belong together." },
	{ href: "/taste", label: "Taste", line: "Rate a few, get picks made for you." },
	{ href: "/how-it-works", label: "How it works", line: "One score, a fingerprint, where it streams." },
]
const BY = [
	{
		label: "Movies",
		links: [
			{ href: "/movies/moods", label: "Movies by mood" },
			{ href: "/movies/genres", label: "Movies by genre" },
			{ href: "/movies/streaming", label: "Movies by streaming service" },
		],
	},
	{
		label: "TV shows",
		links: [
			{ href: "/shows/moods", label: "Shows by mood" },
			{ href: "/shows/genres", label: "Shows by genre" },
			{ href: "/shows/streaming", label: "Shows by streaming service" },
		],
	},
]

const BELOW = "data-lr-below"

/** Whether the visitor is in the section below the room: the keys are the page's then. */
export const isBelowRoom = () =>
	document.documentElement.hasAttribute(BELOW) ||
	document.querySelector("#browse:target") !== null

function useBrowseTravel() {
	useEffect(() => {
		const html = document.documentElement
		const behavior = () =>
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "instant"
				: "smooth"
		const goBelow = () => {
			html.setAttribute(BELOW, "")
			document
				.getElementById("browse")
				?.scrollIntoView({ behavior: behavior(), block: "start" })
		}
		const goRoom = () => {
			html.removeAttribute(BELOW)
			// Arrived on a URL that ends in #browse: only a fragment navigation moves `:target` off the section.
			if (document.querySelector("#browse:target")) location.replace("#room")
			else window.scrollTo({ top: 0, behavior: behavior() })
		}
		const onClick = (e: MouseEvent) => {
			if (e.defaultPrevented || e.button !== 0) return
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
			const link = (e.target as Element).closest?.(
				'a[href="#browse"], a[href="#room"]',
			)
			if (!link) return
			e.preventDefault()
			if (link.getAttribute("href") === "#browse") goBelow()
			else goRoom()
		}
		let last = window.scrollY
		const onScroll = () => {
			const y = window.scrollY
			// Scrolled up to the very top: back in the room.
			if (isBelowRoom() && y <= 0) goRoom()
			// Moved down from outside while the room had the page (find in page, a script): the visitor is below.
			// Moving up is the way back to the room and is left alone.
			else if (!isBelowRoom() && y > last && y > 8) html.setAttribute(BELOW, "")
			last = y
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || !isBelowRoom()) return
			e.preventDefault()
			goRoom()
			document
				.querySelector<HTMLElement>(".lrb-lip")
				?.focus({ preventScroll: true })
		}
		// Keyboard focus that lands in the section or the footer: the browser has brought it into view, so the
		// visitor is below.
		const onFocus = (e: FocusEvent) => {
			const target = e.target as HTMLElement
			if (!target.closest?.("#browse, footer") || target.closest(".lrb-lip"))
				return
			html.setAttribute(BELOW, "")
		}
		document.addEventListener("click", onClick)
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("keydown", onKey)
		document.addEventListener("focusin", onFocus)
		return () => {
			html.removeAttribute(BELOW)
			document.removeEventListener("click", onClick)
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("keydown", onKey)
			document.removeEventListener("focusin", onFocus)
		}
	}, [])
}

export function BelowRoom({
	links,
	take = 1,
}: { links: StartLink[]; take?: 1 | 2 }) {
	useBrowseTravel()
	const back = (
		<a href="#room" className="lrb-back">
			<span aria-hidden>↑</span> Back to the living room
		</a>
	)
	return (
		<section
			id="browse"
			aria-labelledby="browse-title"
			className={take === 2 ? "lrb lrb-2" : "lrb"}
		>
			<a href="#browse" className="lrb-lip">
				<span>
					<b>Popular right now</b>
					<small>
						{links.length} titles<u> and every way to browse</u>
					</small>
				</span>
				<i aria-hidden>
					<svg viewBox="0 0 24 24">
						<path d="M6 9l6 6 6-6" />
					</svg>
				</i>
			</a>
			<div className="lrb-in">
				<header className="lrb-head">
					<div>
						<p className="lrb-eye">On GoodWatch tonight</p>
						<h2 id="browse-title">Popular right now</h2>
					</div>
					{back}
				</header>
				<ol className="lrb-titles">
					{links.map((link) => (
						<li key={titleHref(link)}>
							<a href={titleHref(link)}>{link.title}</a>
							<span>
								{link.media_type === "movie" ? "Movie" : "TV show"}
								{link.release_year ? ` · ${link.release_year}` : ""}
							</span>
						</li>
					))}
				</ol>
				<div className="lrb-hubs">
					<h2>Browse GoodWatch</h2>
					<ul className="lrb-cards">
						{MAIN_HUBS.map((hub) => (
							<li key={hub.href}>
								<a href={hub.href}>
									<b>{hub.label}</b>
									<span>{hub.line}</span>
								</a>
							</li>
						))}
					</ul>
					<div className="lrb-by">
						{BY.map((group) => (
							<div key={group.label}>
								<h3>{group.label}</h3>
								<ul>
									{group.links.map((link) => (
										<li key={link.href}>
											<a href={link.href}>{link.label}</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<p className="lrb-end">{back}</p>
			</div>
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

// The /stats page's shared pieces: the chapter frame and its rise-in on scroll, the sticky chapter index, the fact
// tile, ranked rows, portraits and the linked poster card. Markup follows the profile Stats tab
// (ui/profile/taste/Stats.tsx), which reads the member's taste where these read the snapshot.
import "~/ui/living-room/intro/intro.css"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { StatsTitle } from "~/domain/stats/snapshot"
import { type CardTitle, MovieTvCard } from "~/ui/MovieTvCard"
import { FOLLOW_PHONE_BAR } from "~/ui/layers"
import { PosterImg, posterUrl } from "~/ui/profile/parts"
import { PANEL, SectionHead } from "~/ui/profile/taste/parts"
import { personPath } from "~/utils/helpers"
import { rank, titleHref } from "./format"

export { PANEL }

export const LABEL =
	"text-xs font-bold tracking-[0.16em] text-gray-500 uppercase"

/** Whether the reader asked for less motion. Browser only. */
export const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * The page's own styles: the intro's brand cards on a page grid, and the motions. Transform and opacity only; nothing
 * moves with reduced motion.
 */
export function StatsStyles() {
	return (
		<style
			// biome-ignore lint/security/noDangerouslySetInnerHtml: our own CSS; plain children would escape `>` on the server and not hydrate
			dangerouslySetInnerHTML={{
				__html: `
.stats-brand { container-type: inline-size; }
.stats-brand .intro-brand-card {
	position: relative; transform: none; width: 100%; height: auto; aspect-ratio: 4 / 5;
	gap: 6cqw; border-radius: 7cqw; box-shadow: 0 4cqw 10cqw rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.12);
}
.stats-brand .intro-brand-logo { height: 20cqw; }
.stats-brand .intro-brand-logo-wide { height: 15cqw; }
.stats-brand .intro-brand-logo-wide img { border-radius: 1.6cqw; box-shadow: 0 0 0 .8cqw rgba(0,0,0,.85); }
.stats-brand .intro-brand-disc { width: 22cqw; height: 22cqw; padding: 3.2cqw; }
.stats-brand .intro-brand-n { font-size: 19cqw; }
.stats-brand .intro-brand-who { font-size: max(9px, 5cqw); }
@media (prefers-reduced-motion: no-preference) {
	@keyframes stats-swap { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
	.stats-swap { animation: stats-swap .35s cubic-bezier(.16,1,.3,1); }
	@keyframes stats-grow { from { transform: scaleX(0); } to { transform: none; } }
	.stats-grow { transform-origin: left center; animation: stats-grow .6s cubic-bezier(.16,1,.3,1); }
	.stats-rise { transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
	.stats-rise.stats-wait { opacity: 0; transform: translateY(28px); }
}
`,
			}}
		/>
	)
}

/**
 * Chapters below the fold wait under `stats-wait` and rise in as they scroll into view. Anything on screen at load
 * stays as rendered, so the server's HTML never flashes.
 */
export function useRise() {
	useEffect(() => {
		if (reducedMotion()) return
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue
					e.target.classList.remove("stats-wait")
					io.unobserve(e.target)
				}
			},
			{ rootMargin: "0px 0px -12% 0px" },
		)
		for (const el of document.querySelectorAll<HTMLElement>(".stats-rise")) {
			if (el.getBoundingClientRect().top < window.innerHeight) continue
			el.classList.add("stats-wait")
			io.observe(el)
		}
		return () => io.disconnect()
	}, [])
}

/** One chapter: the numbered kicker and a sentence heading with its number in amber, then the chapter's own layout. */
export function Chapter({
	id,
	n,
	name,
	lead,
	accent,
	tail,
	sub,
	children,
}: {
	id: string
	n: number
	name: string
	lead: string
	accent: string
	tail?: string
	sub?: ReactNode
	children: ReactNode
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-h`}
			className="stats-rise flex scroll-mt-[calc(8rem_+_var(--visitor-bar-h,0px))] flex-col gap-6"
		>
			<SectionHead
				id={`${id}-h`}
				eyebrow={`Chapter ${n} · ${name}`}
				lead={lead}
				accent={accent}
				tail={tail}
				sub={sub}
			/>
			{children}
		</section>
	)
}

/** A block heading inside a chapter, with its line and an optional control on the right. */
export function Block({
	title,
	line,
	children,
	right,
	effect,
}: {
	title: string
	line?: ReactNode
	children: ReactNode
	right?: ReactNode
	/** A pixel effect spot (effects/spots.ts) on the title's text. */
	effect?: string
}) {
	return (
		<div className="flex flex-col gap-4 border-t border-white/10 pt-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-1">
					<h3 className="text-lg font-bold text-white">
						<span data-fx-spot={effect}>{title}</span>
					</h3>
					{line && <p className="text-sm text-gray-400">{line}</p>}
				</div>
				{right}
			</div>
			{children}
		</div>
	)
}

/** The Stats tab's fact tile: small label, bold value. */
export function FactTile({ label, value }: { label: string; value: string }) {
	return (
		<div
			data-fx-tile={label}
			className={`${PANEL} flex min-w-0 flex-col gap-2 p-3`}
		>
			<span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
				{label}
			</span>
			<span className="text-xl font-black text-white tabular-nums">
				{value}
			</span>
		</div>
	)
}

export type RankRow = {
	key: string
	href: string
	poster: string | null
	name: string
	value: string
}

/** The Stats tab's ranked rows: number, small poster, linked name, count. */
export function RankRows({
	heading,
	rows,
}: { heading: string; rows: RankRow[] }) {
	return (
		<div className={`${PANEL} min-w-0 p-4`}>
			<p className={`mb-2 ${LABEL}`}>{heading}</p>
			<ol className="flex flex-col divide-y divide-white/5">
				{rows.map((r, i) => (
					<li key={r.key} className="flex items-center gap-3 py-2">
						<span
							className={`w-6 text-sm font-black tabular-nums ${i === 0 ? "text-amber-300" : "text-gray-600"}`}
						>
							{rank(i + 1)}
						</span>
						<span className="block w-7 shrink-0">
							<PosterImg title={{ poster: r.poster }} className="rounded-sm" />
						</span>
						<Link
							to={r.href}
							prefetch="intent"
							className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-200 hover:text-white"
						>
							{r.name}
						</Link>
						<span className="text-xs text-gray-500 tabular-nums">
							{r.value}
						</span>
					</li>
				))}
			</ol>
		</div>
	)
}

/** Ranked rows for titles, with the value each one shows. */
export const titleRows = <T extends StatsTitle>(
	titles: T[],
	value: (t: T) => string,
): RankRow[] =>
	titles.map((t) => ({
		key: `${t.type}-${t.tmdbId}`,
		href: titleHref(t),
		poster: t.poster,
		name: t.title,
		value: value(t),
	}))

/** The Stats tab's row of round portraits. */
export function Portraits({
	heading,
	people,
	effect,
}: {
	heading: string
	/** A pixel effect spot (effects/spots.ts) on the row. */
	effect?: string
	people: {
		tmdbId: number
		name: string
		profile: string | null
		line: string
	}[]
}) {
	return (
		<div data-fx-spot={effect} className={`${PANEL} min-w-0 p-4 sm:p-5`}>
			<p className="mb-3 text-sm font-bold text-gray-200">{heading}</p>
			<ul className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
				{people.map((p) => (
					<li key={p.tmdbId} className="w-24 shrink-0 text-center">
						<Link
							to={personPath(p.tmdbId, p.name)}
							prefetch="intent"
							className="group block"
						>
							{p.profile ? (
								<img
									src={posterUrl(p.profile, "w185") ?? ""}
									alt=""
									loading="lazy"
									className="mx-auto size-16 rounded-full object-cover ring-2 ring-white/10 transition-transform group-hover:-translate-y-0.5"
								/>
							) : (
								<span className="mx-auto block size-16 rounded-full bg-white/10" />
							)}
							<span className="mt-1.5 block truncate text-xs font-semibold text-gray-200 group-hover:text-white">
								{p.name}
							</span>
							<span className="block text-[11px] text-gray-500">{p.line}</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}

/** Grid poster sizes for a row of five on a phone-to-desktop page. */
const ROW_SIZES: [string | null, string][] = [
	["(min-width: 1024px)", "180px"],
	["(min-width: 640px)", "22vw"],
	[null, "30vw"],
]

const cardOf = (t: StatsTitle, goodwatch?: number): CardTitle => ({
	tmdb_id: t.tmdbId,
	title: t.title,
	release_year: t.year,
	poster_path: t.poster,
	goodwatch_overall_score_normalized_percent: goodwatch ?? null,
})

/** The shared poster card, linked to its title page, with a line under it. */
export function Poster({
	t,
	goodwatch,
	children,
}: {
	t: StatsTitle
	goodwatch?: number
	children?: ReactNode
}) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<MovieTvCard
				details={cardOf(t, goodwatch)}
				mediaType={t.type}
				posterSizes={ROW_SIZES}
				posterMaxWidth={200}
			/>
			{children}
		</div>
	)
}

/** A small poster linked to its title page. */
export function PosterLink({
	t,
	className = "",
	effect,
	title,
}: {
	t: StatsTitle
	className?: string
	effect?: string
	title?: string
}) {
	return (
		<Link
			to={titleHref(t)}
			prefetch="intent"
			data-fx-spot={effect}
			title={title}
			className={`block ${className}`}
		>
			<PosterImg title={{ poster: t.poster }} className="rounded-md" />
		</Link>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The chapter index: a pill row of links, in a bar that sticks under the site header and follows the phone's top bar
// away. The chapter on screen is lit, and on a phone the row scrolls to keep it in view (the row scrolls, never the
// page).

export type ChapterItem = { id: string; label: string }

/** The first chapter in the reading band (between 30% and 40% of the screen from the top). */
function useChapterInView(items: ChapterItem[]) {
	const [here, setHere] = useState(items[0]?.id ?? "")
	useEffect(() => {
		const seen = new Map<string, boolean>()
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) seen.set(e.target.id, e.isIntersecting)
				const first = items.find((it) => seen.get(it.id))
				if (first) setHere(first.id)
			},
			{ rootMargin: "-30% 0px -60% 0px" },
		)
		for (const it of items) {
			const el = document.getElementById(it.id)
			if (el) io.observe(el)
		}
		return () => io.disconnect()
	}, [items])
	return here
}

export function ChapterNav({ items }: { items: ChapterItem[] }) {
	const here = useChapterInView(items)
	const row = useRef<HTMLOListElement>(null)
	// Nothing is lit until the reader reaches the first chapter.
	const [started, setStarted] = useState(false)
	useEffect(() => {
		const first = document.getElementById(items[0]?.id ?? "")
		if (!first) return
		const io = new IntersectionObserver(([e]) =>
			setStarted(e.isIntersecting || e.boundingClientRect.top < 0),
		)
		io.observe(first)
		return () => io.disconnect()
	}, [items])
	useEffect(() => {
		const box = row.current
		const el = box?.querySelector<HTMLElement>(`[data-pill="${here}"]`)
		if (!started || !el || !box || box.scrollWidth <= box.clientWidth) return
		const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2
		box.scrollTo({
			left: Math.max(0, left),
			behavior: reducedMotion() ? "auto" : "smooth",
		})
	}, [here, started])
	return (
		<nav
			aria-label="Chapters"
			className={`sticky top-[calc(4rem_+_var(--visitor-bar-h,0px))] z-20 border-y border-white/[0.07] bg-gray-900/95 backdrop-blur-md ${FOLLOW_PHONE_BAR}`}
		>
			<ol
				ref={row}
				className="mx-auto flex w-full max-w-7xl gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8"
			>
				{items.map((it, i) => {
					const on = started && it.id === here
					return (
						<li key={it.id} className="shrink-0">
							<a
								href={`#${it.id}`}
								data-pill={it.id}
								aria-current={on ? "true" : undefined}
								className={`flex min-h-8 items-center rounded-full px-3 text-xs font-bold tracking-wide whitespace-nowrap uppercase ring-1 transition-colors ${
									on
										? "bg-amber-400/15 text-amber-300 ring-amber-400/60"
										: "text-gray-400 ring-white/10 hover:text-white"
								}`}
							>
								<span className="mr-1.5 tabular-nums opacity-60">{i + 1}</span>
								{it.label}
							</a>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

/** A line that counts the same number another way at each tap; the new way fades in (none with reduced motion). */
export function RecountLine({
	ways,
	effect,
}: {
	ways: ReactNode[]
	/** A pixel effect spot (effects/spots.ts) played on each tap. */
	effect: string
}) {
	const [i, setI] = useState(0)
	const [tapped, setTapped] = useState(false)
	return (
		<>
			<button
				type="button"
				onClick={() => {
					setI((n) => (n + 1) % ways.length)
					setTapped(true)
				}}
				title="Count it another way"
				data-fx-spot={effect}
				className="cursor-pointer text-left underline decoration-white/20 decoration-dotted underline-offset-4 hover:decoration-amber-400/60"
			>
				<span key={i} className="stats-swap inline-block">
					{ways[i]}
				</span>
			</button>
			{/* each tap says the new count here, so the button itself is not a live region */}
			<span className="sr-only" aria-live="polite">
				{tapped ? ways[i] : null}
			</span>
		</>
	)
}

/** A number in bold white, inside a sentence. */
export const B = ({ children }: { children: ReactNode }) => (
	<b className="text-white tabular-nums">{children}</b>
)

/** A number in amber, inside a big sentence. */
export const Amber = ({ children }: { children: ReactNode }) => (
	<span className="font-black text-amber-400 tabular-nums">{children}</span>
)

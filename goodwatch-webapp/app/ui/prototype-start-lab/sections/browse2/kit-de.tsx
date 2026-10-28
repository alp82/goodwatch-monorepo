// PROTOTYPE (start page lab, round 4): browse2 d/e's parts: a's rails (new, moods, services), c's Top 10 with big numbers, and c's genre cloud with one peek that follows hover, focus or a tap. Round 4: every rail gets previous/next arrows (the title page rows' round buttons at the edges on desktop, compact ones in the row header on phones).
import { Link } from "@remix-run/react"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { type CSSProperties, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { LabCard, LabData } from "../../lab/types"
import { Fan, FanStyles, HUBS, type Kind, POSTER_W, Poster, SectionHead, Stack, genreHref, moodHref, moodsOf, serviceHref, serviceLogo } from "./kit-hubs"

/** The motion d and e share (transform and opacity only). */
export function DeStyles() {
	return (
		<>
			<FanStyles />
			<style>{`
@keyframes bw2de-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bw2de-fade{animation:bw2de-fade .25s ease-out}
.bw2de-peek{transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .18s ease;will-change:transform,opacity}
.bw2de-peek-in{transition:opacity .18s ease}
@media (prefers-reduced-motion:reduce){.bw2de-fade{animation:none}.bw2de-peek{transition:opacity .1s}}
`}</style>
		</>
	)
}

// ---- Rails with previous / next (round 4) ----

type RailNav = { ref: (el: HTMLUListElement | null) => void; atStart: boolean; atEnd: boolean; step: (dir: 1 | -1) => void }

/**
 * Tracks a native scroll rail's ends (on scroll, once per frame, and on resize) and steps it by about one view of
 * cards, card-aligned, jumping straight to an end when less than a card would be left. State changes only when an end is reached or left, so scrolling stays cheap.
 */
function useRailNav(): RailNav {
	const [el, setEl] = useState<HTMLUListElement | null>(null)
	const [ends, setEnds] = useState({ atStart: true, atEnd: false })
	useEffect(() => {
		if (!el) return
		let raf = 0
		const read = () => {
			raf = 0
			const max = el.scrollWidth - el.clientWidth
			const atStart = el.scrollLeft <= 4
			const atEnd = el.scrollLeft >= max - 4
			setEnds((e) => (e.atStart === atStart && e.atEnd === atEnd ? e : { atStart, atEnd }))
		}
		const later = () => {
			if (!raf) raf = requestAnimationFrame(read)
		}
		read()
		el.addEventListener("scroll", later, { passive: true })
		const ro = new ResizeObserver(later)
		ro.observe(el)
		return () => {
			el.removeEventListener("scroll", later)
			ro.disconnect()
			cancelAnimationFrame(raf)
		}
	}, [el])
	const step = useCallback(
		(dir: 1 | -1) => {
			if (!el) return
			const cs = getComputedStyle(el)
			const pad = Number.parseFloat(cs.paddingLeft) || 0
			const snapPad = Number.parseFloat(cs.scrollPaddingLeft) || pad
			const gap = Number.parseFloat(cs.columnGap) || 0
			const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
			const max = el.scrollWidth - el.clientWidth
			const now = el.scrollLeft
			const view = el.clientWidth - pad * 2
			// Each card's snap position (its start at the rail's scroll padding), in scroll coordinates.
			const box = el.getBoundingClientRect()
			const cards = Array.from(el.children, (c) => {
				const r = c.getBoundingClientRect()
				return { at: r.left - box.left + now - snapPad, right: r.right - box.left + now, w: r.width }
			})
			const cardW = cards[0]?.w ?? 120
			// Round 6: never a tiny last move. If what would be left after this step is under a card plus a gap (or
			// about a third of the view), go straight to the end; the ends are snap positions too (they clamp there).
			const tail = Math.max(cardW + gap, view * 0.35)
			let target: number
			if (dir === 1) {
				// The first card not wholly in view becomes the first one.
				const edge = now + el.clientWidth - pad + 1
				target = cards.find((c) => c.right > edge && c.at > now + 4)?.at ?? now + view
				if (max - target < tail) target = max
			} else {
				// The card now first becomes about the last one in view.
				const want = now - view
				target = cards.find((c) => c.at >= want - 1)?.at ?? want
				if (target >= now - 4) target = want
				if (target < tail) target = 0
			}
			target = Math.min(max, Math.max(0, target))
			el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" })
		},
		[el],
	)
	return { ref: setEl, ...ends, step }
}

/** The title page rows' arrow (ListSwiper): a round blue button with a chevron. */
const ARROW =
	"z-10 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-50 transition-[opacity,background-color] duration-200 ease-in-out cursor-pointer"

/** Compact arrows for the row header, phones and small tablets only (desktop has the edge arrows). */
function HeadArrows({ nav, name }: { nav: RailNav; name: string }) {
	const cls = `${ARROW} flex h-8 w-8 items-center justify-center disabled:cursor-default disabled:opacity-30 disabled:hover:bg-blue-600`
	return (
		<span className="flex gap-1.5 md:hidden">
			<button type="button" aria-label={`Previous: ${name}`} disabled={nav.atStart} onClick={() => nav.step(-1)} className={cls}>
				<ChevronLeftIcon className="h-5 w-5" aria-hidden />
			</button>
			<button type="button" aria-label={`Next: ${name}`} disabled={nav.atEnd} onClick={() => nav.step(1)} className={cls}>
				<ChevronRightIcon className="h-5 w-5" aria-hidden />
			</button>
		</span>
	)
}

/**
 * a's snap rail (same bleed and padding as kit-hubs' Rail) with the title page rows' arrows overlaying the first and
 * last visible card from md up. At an end the arrow fades out (opacity only); it never takes room in the row.
 */
function NavRail({ nav, name, label, gap = "gap-3", children }: { nav: RailNav; name: string; label?: string; gap?: string; children: ReactNode }) {
	const edge = `${ARROW} absolute top-1/2 hidden -translate-y-1/2 p-2 md:block disabled:pointer-events-none disabled:opacity-0`
	return (
		<div className="relative">
			<ul
				ref={nav.ref}
				aria-label={label}
				className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden ${gap}`}
			>
				{children}
			</ul>
			<button type="button" aria-label={`Previous: ${name}`} disabled={nav.atStart} onClick={() => nav.step(-1)} className={`${edge} -left-2`}>
				<ChevronLeftIcon className="h-6 w-6" aria-hidden />
			</button>
			<button type="button" aria-label={`Next: ${name}`} disabled={nav.atEnd} onClick={() => nav.step(1)} className={`${edge} -right-2`}>
				<ChevronRightIcon className="h-6 w-6" aria-hidden />
			</button>
		</div>
	)
}

// ---- Top 10 (c's, with a heading level to choose) ----

/** The ten best, with big outlined rank numbers; Movies and Shows switch in place (same height). */
export function TopTen({ movies, shows, id }: { movies: LabCard[]; shows: LabCard[]; id: string }) {
	const [kind, setKind] = useState<Kind>(movies.length ? "movie" : "show")
	const nav = useRailNav()
	const cards = (kind === "movie" ? movies : shows).slice(0, 10)
	if (!movies.length && !shows.length) return null
	const tab = (k: Kind, label: string) => (
		<button
			type="button"
			role="tab"
			aria-selected={kind === k}
			onClick={() => setKind(k)}
			className={`rounded-full px-3.5 py-1 text-sm font-semibold transition-colors ${kind === k ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"}`}
		>
			{label}
		</button>
	)
	return (
		<section aria-labelledby={id}>
			<SectionHead
				id={id}
				title="Top 10 on GoodWatch"
				line="The highest scores of all time"
				href={kind === "movie" ? HUBS.bestMovies : HUBS.bestShows}
				aside={<HeadArrows nav={nav} name="Top 10" />}
			/>
			<div role="tablist" aria-label="Top 10" className="mb-3 inline-flex rounded-full bg-gray-800/80 p-1 ring-1 ring-white/10">
				{movies.length > 0 && tab("movie", "Movies")}
				{shows.length > 0 && tab("show", "Shows")}
			</div>
			<div key={kind} className="bw2de-fade">
				<NavRail nav={nav} name="Top 10" label={kind === "movie" ? "Top 10 movies" : "Top 10 shows"} gap="gap-1 sm:gap-2">
					{cards.map((card, i) => (
						<li key={card.key} className="flex shrink-0 snap-start items-end">
							<span
								aria-hidden
								className={`relative z-0 select-none font-black leading-[0.78] tabular-nums text-gray-950 ${i === 9 ? "-mr-6 tracking-[-0.12em]" : "-mr-4"} text-[6.5rem] sm:text-[8.5rem] lg:text-[10rem]`}
								style={{ WebkitTextStroke: "2px rgba(251,191,36,.75)" }}
							>
								{i + 1}
							</span>
							<div className="relative z-10 w-[6.75rem] sm:w-[8.5rem] lg:w-[9.5rem]">
								<TitlePosterCard card={card} actions={false} />
							</div>
						</li>
					))}
				</NavRail>
			</div>
			{/* Both lists stay one link away for a crawler, whichever tab shows. */}
			<p className="mt-1 text-sm text-gray-400">
				All the best{" "}
				<Link to={HUBS.bestMovies} discover="none" className="font-semibold text-amber-400 hover:text-amber-300">
					movies
				</Link>{" "}
				and{" "}
				<Link to={HUBS.bestShows} discover="none" className="font-semibold text-amber-400 hover:text-amber-300">
					shows
				</Link>
			</p>
		</section>
	)
}

// ---- a's rails ----

export function NewOnRail({ data, id }: { data: LabData; id: string }) {
	const cards = data.guest.browse.newOn
	const nav = useRailNav()
	if (!cards.length) return null
	return (
		<section aria-labelledby={id}>
			<SectionHead
				id={id}
				title="New on streaming"
				line="Arrived on the big services this week"
				href={HUBS.newOn}
				aside={<HeadArrows nav={nav} name="New on streaming" />}
			/>
			<NavRail nav={nav} name="New on streaming" label="New on streaming">
				{cards.map((card) => (
					<li key={card.key} className={`shrink-0 snap-start ${POSTER_W}`}>
						<TitlePosterCard card={card} actions={false} />
					</li>
				))}
			</NavRail>
		</section>
	)
}

export function MoodRail({ data, id }: { data: LabData; id: string }) {
	const moods = moodsOf(data)
	const nav = useRailNav()
	if (!moods.length) return null
	return (
		<section aria-labelledby={id}>
			<SectionHead
				id={id}
				title="By mood"
				line="Pick the kind of evening"
				href={HUBS.movieMoods}
				aside={<HeadArrows nav={nav} name="By mood" />}
			/>
			<NavRail nav={nav} name="By mood" label="Moods">
				{moods.map((m) => (
					<li key={m.key} className="w-[11.5rem] shrink-0 snap-start sm:w-[13.5rem]">
						<Link
							to={moodHref(m.key)}
							discover="none"
							className="bw2-tile group relative flex h-full flex-col overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 hover:ring-white/25"
						>
							<span aria-hidden className="absolute inset-x-0 top-0 h-32" style={{ background: `linear-gradient(180deg, ${m.hue}55, transparent)` }} />
							<Fan cards={m.titles} className="mx-auto mt-4 h-[8.5rem] w-[78%] sm:h-[10rem]" />
							<span className="relative mt-3 flex items-center gap-2 px-3 font-bold text-white">
								<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.hue }} />
								{m.name}
							</span>
							<span className="relative line-clamp-2 px-3 pb-3 pt-0.5 text-xs leading-snug text-gray-400">{m.description}</span>
						</Link>
					</li>
				))}
			</NavRail>
		</section>
	)
}

export function ServiceRail({ data, id }: { data: LabData; id: string }) {
	const services = data.guest.browse.services
	const nav = useRailNav()
	if (!services.length) return null
	return (
		<section aria-labelledby={id}>
			<SectionHead
				id={id}
				title="Streaming services"
				line="The top of each service"
				href={HUBS.showStreaming}
				aside={<HeadArrows nav={nav} name="Streaming services" />}
			/>
			<NavRail nav={nav} name="Streaming services" label="Streaming services">
				{services.map((s) => (
					<li key={s.id} className="w-[15rem] shrink-0 snap-start sm:w-[17rem]">
						<Link
							to={serviceHref(s.id)}
							discover="none"
							className="bw2-tile flex h-full flex-col gap-3 rounded-xl bg-gray-900 p-3 ring-1 ring-white/10 hover:ring-white/25"
						>
							<span className="flex items-center gap-2.5">
								{s.logo_path ? (
									<img src={serviceLogo(s.logo_path)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-lg" />
								) : (
									<span className="h-9 w-9 rounded-lg bg-gray-800" />
								)}
								<span className="font-bold text-white">{s.name}</span>
							</span>
							<Stack cards={s.titles} count={4} />
						</Link>
					</li>
				))}
			</NavRail>
		</section>
	)
}

// ---- c's genre cloud, with a peek that works by tap ----

const SIZES = ["text-xl sm:text-2xl", "text-base sm:text-lg", "text-lg sm:text-xl", "text-base", "text-2xl sm:text-3xl", "text-lg", "text-base sm:text-lg", "text-xl"]
const PEEK_W = 168
const PEEK_H = 170

type Peek = { id: string; kind: Kind; name: string; titles: LabCard[]; x: number; y: number; byTap: boolean }

const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches

/**
 * Genre chips in two groups (movies, shows). One peek (three posters fanned) sits above the chip being hovered,
 * focused, or tapped, and glides between chips with transform. On touch the first tap opens the peek and the
 * second tap (on the chip or the peek) opens the genre; a tap elsewhere closes it. Nothing reflows.
 */
export function GenreCloud({ data, id, compact = false }: { data: LabData; id: string; compact?: boolean }) {
	const b = data.guest.browse
	const groups = (["movie", "show"] as const).map((kind) => ({ kind, rows: b.genres[kind].filter((g) => g.titles.length >= 4) }))
	const box = useRef<HTMLDivElement>(null)
	const [peek, setPeek] = useState<Peek | null>(null)

	useEffect(() => {
		if (!peek?.byTap) return
		const close = (e: PointerEvent) => {
			if (!(e.target instanceof Element) || !e.target.closest("[data-genre-chip],[data-genre-peek]")) setPeek(null)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setPeek(null)
		document.addEventListener("pointerdown", close)
		document.addEventListener("keydown", esc)
		return () => {
			document.removeEventListener("pointerdown", close)
			document.removeEventListener("keydown", esc)
		}
	}, [peek?.byTap])

	if (!groups.some((g) => g.rows.length)) return null

	const show = (el: HTMLElement, g: { kind: Kind; name: string; titles: LabCard[] }, byTap: boolean) => {
		const host = box.current
		if (!host) return
		const h = host.getBoundingClientRect()
		const c = el.getBoundingClientRect()
		const x = Math.min(Math.max(c.left - h.left + c.width / 2 - PEEK_W / 2, 0), Math.max(h.width - PEEK_W, 0))
		const y = c.top - h.top - PEEK_H - 6
		setPeek({ id: `${g.kind}-${g.name}`, ...g, x, y, byTap })
	}

	const onClick = (e: MouseEvent<HTMLAnchorElement>, g: { kind: Kind; name: string; titles: LabCard[] }) => {
		if (canHover()) return
		if (peek?.id === `${g.kind}-${g.name}` && peek.byTap) return // second tap: follow the link
		e.preventDefault()
		show(e.currentTarget, g, true)
	}

	return (
		<section aria-labelledby={id}>
			<SectionHead id={id} title="Genres" line={compact ? undefined : "Hover or tap one for a look inside"} />
			<div
				ref={box}
				className={`relative grid ${compact ? "gap-6" : "gap-8"} md:grid-cols-2`}
				onPointerLeave={(e) => e.pointerType === "mouse" && !peek?.byTap && setPeek(null)}
			>
				{groups.map(({ kind, rows }) =>
					rows.length ? (
						<div key={kind}>
							<p className="mb-3 flex items-baseline justify-between text-sm font-semibold uppercase tracking-widest text-gray-400">
								{kind === "movie" ? "Movies" : "Shows"}
								<Link
									to={kind === "movie" ? HUBS.movieGenres : HUBS.showGenres}
									discover="none"
									className="normal-case tracking-normal text-amber-400 hover:text-amber-300"
								>
									All {kind === "movie" ? "movie" : "show"} genres →
								</Link>
							</p>
							<ul className="flex flex-wrap items-center gap-2.5">
								{rows.map((g, i) => {
									const gg = { kind, name: g.name, titles: g.titles }
									const on = peek?.id === `${kind}-${g.name}`
									return (
										<li key={g.name}>
											<Link
												to={genreHref(kind, g.name)}
												discover="none"
												data-genre-chip
												aria-describedby={on ? `${id}-peek` : undefined}
												onPointerEnter={(e) => e.pointerType === "mouse" && show(e.currentTarget, gg, false)}
												onFocus={(e) => canHover() && show(e.currentTarget, gg, false)}
												onClick={(e) => onClick(e, gg)}
												className={`relative flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 font-bold text-white ring-1 transition-colors ${
													on ? "bg-gray-800 ring-amber-400/60" : "bg-gray-900 ring-white/10 hover:bg-gray-800 hover:ring-white/25"
												} ${SIZES[i % SIZES.length]}`}
											>
												<span aria-hidden className="flex">
													{g.titles.slice(0, 2).map((t, j) => (
														<Poster key={t.key} card={t} className={`!aspect-square !w-7 !rounded-full ${j ? "-ml-3" : ""}`} />
													))}
												</span>
												{g.name}
											</Link>
										</li>
									)
								})}
							</ul>
						</div>
					) : null,
				)}

				{/* The one peek: always mounted once hydrated, moved with transform, faded with opacity. */}
				<GenrePeek peek={peek} id={`${id}-peek`} />
			</div>
		</section>
	)
}

function GenrePeek({ peek, id }: { peek: Peek | null; id: string }) {
	const last = useRef<Peek | null>(null)
	// Glide between chips only while showing; appear in place (fade only) after being hidden.
	const [wasOn, setWasOn] = useState(false)
	useEffect(() => {
		const t = requestAnimationFrame(() => setWasOn(!!peek))
		return () => cancelAnimationFrame(t)
	}, [peek])
	if (peek) last.current = peek
	const p = peek ?? last.current
	const motion = wasOn && peek ? "bw2de-peek" : "bw2de-peek-in"
	const style: CSSProperties = {
		width: PEEK_W,
		height: PEEK_H,
		transform: p ? `translate3d(${p.x}px, ${p.y}px, 0)` : undefined,
		opacity: peek ? 1 : 0,
		pointerEvents: peek?.byTap ? "auto" : "none",
	}
	const inner = p && (
		<>
			<Fan key={p.id} cards={p.titles} className="bw2de-fade h-[8.25rem] w-full" spread={1.1} />
			<span className="mt-1.5 block truncate text-center text-xs font-semibold text-gray-200">
				{peek?.byTap ? (
					<>
						Open {p.name} <span aria-hidden>→</span>
					</>
				) : (
					p.titles
						.slice(0, 3)
						.map((t) => t.title)
						.join(" · ")
				)}
			</span>
		</>
	)
	return p?.byTap && peek ? (
		<Link
			id={id}
			data-genre-peek
			to={genreHref(p.kind, p.name)}
			discover="none"
			className={`${motion} absolute left-0 top-0 z-30 block rounded-xl bg-gray-950/95 p-2 shadow-2xl shadow-black/60 ring-1 ring-white/15`}
			style={style}
		>
			{inner}
		</Link>
	) : (
		<div
			id={id}
			role="tooltip"
			aria-hidden={!peek}
			className={`${motion} absolute left-0 top-0 z-30 rounded-xl bg-gray-950/95 p-2 shadow-2xl shadow-black/60 ring-1 ring-white/15`}
			style={{ ...style, visibility: p ? "visible" : "hidden" }}
		>
			{inner}
		</div>
	)
}

/** The section shell: eyebrow, the H2, and the stack of rails. */
export function BrowseShell({ id, title, gap, pad, children }: { id: string; title: string; gap: string; pad: string; children: ReactNode }) {
	return (
		<section aria-labelledby={id} className="lrb" style={{ background: "none", zIndex: "auto" }}>
			<DeStyles />
			<div className={`mx-auto max-w-7xl px-4 sm:px-8 ${pad}`}>
				<p className="lrb-eye">Browse</p>
				<h2 id={id} className="mb-6 mt-1 !text-2xl md:mb-8 md:!text-3xl">
					{title}
				</h2>
				<div className={`flex flex-col ${gap}`}>{children}</div>
			</div>
		</section>
	)
}

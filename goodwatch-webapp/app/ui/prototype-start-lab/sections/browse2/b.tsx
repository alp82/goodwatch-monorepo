// PROTOTYPE (start page lab, round 2): browse2 b · Teaser tiles that open: one rich tile per hub; tapping one opens its titles as a rail right under its row.
import { Link } from "@remix-run/react"
import { Fragment, type ReactNode, useLayoutEffect, useRef, useState } from "react"
import StartRow from "~/ui/talked-about-now/start-row/StartRow"
import type { BlockVariant, LabCard, LabData } from "../../lab/types"
import { useLab } from "../../lab/types"
import {
	Fan,
	FanStyles,
	HUBS,
	type Kind,
	PosterRail,
	type PosterLike,
	Stack,
	genreHref,
	lrbStyle,
	moodHref,
	moodsOf,
	serviceHref,
	serviceLogo,
} from "./kit-hubs"

/** A part of a hub (one mood, genre, service) that the open panel can switch to. */
type Sub = { id: string; label: ReactNode; text: string; href: string; cards: LabCard[]; dot?: string }

type Hub = {
	id: string
	title: string
	line: string
	href: string
	art: ReactNode
	/** The panel's titles, or its parts to switch between. */
	cards?: LabCard[]
	subs?: Sub[]
	/** A panel of its own (Hot on socials). */
	panel?: ReactNode
	/** Two columns wide from md (the last row's pair). */
	wide?: boolean
}

const fanArt = (cards: PosterLike[]) => <Fan cards={cards} className="mx-auto aspect-[1.25/1] h-full" />

function hubsOf(data: LabData): Hub[] {
	const b = data.guest.browse
	const hubs: Hub[] = []
	const best = (kind: Kind, cards: LabCard[]) =>
		cards.length > 0 &&
		hubs.push({
			id: `best-${kind}`,
			title: kind === "movie" ? "Best movies" : "Best shows",
			line: `Top ${cards.length} by score`,
			href: kind === "movie" ? HUBS.bestMovies : HUBS.bestShows,
			art: fanArt(cards),
			cards,
		})
	best("movie", b.best.movie)
	best("show", b.best.show)

	for (const kind of ["movie", "show"] as const) {
		const moods = moodsOf(data, kind)
		if (!moods.length) continue
		hubs.push({
			id: `moods-${kind}`,
			title: kind === "movie" ? "Movies by mood" : "Shows by mood",
			line: `${moods.length} kinds of evening`,
			href: kind === "movie" ? HUBS.movieMoods : HUBS.showMoods,
			art: (
				<div className="flex h-full flex-col items-center justify-end gap-2">
					<Fan cards={moods.slice(0, 3).map((m) => m.titles[0])} className="aspect-[1.25/1] h-[78%]" />
					<span aria-hidden className="flex gap-1">
						{moods.map((m) => (
							<span key={m.key} className="h-1.5 w-3 rounded-full" style={{ background: m.hue }} />
						))}
					</span>
				</div>
			),
			subs: moods.map((m) => ({ id: m.key, label: m.name, text: m.name, href: moodHref(m.key, kind), cards: m.titles, dot: m.hue })),
		})
	}

	for (const kind of ["movie", "show"] as const) {
		const genres = b.genres[kind].filter((g) => g.titles.length >= 4)
		if (!genres.length) continue
		hubs.push({
			id: `genres-${kind}`,
			title: kind === "movie" ? "Movies by genre" : "Shows by genre",
			line: genres.map((g) => g.name).slice(0, 3).join(", ") + "…",
			href: kind === "movie" ? HUBS.movieGenres : HUBS.showGenres,
			art: <Stack cards={genres.map((g) => g.titles[0])} count={4} className="h-full items-end justify-center px-2" />,
			subs: genres.map((g) => ({ id: g.name, label: g.name, text: g.name, href: genreHref(kind, g.name), cards: g.titles })),
		})
	}

	if (b.newOn.length)
		hubs.push({
			id: "new",
			title: "New on streaming",
			line: `${b.newOn.length} arrivals this week`,
			href: HUBS.newOn,
			art: fanArt(b.newOn),
			cards: b.newOn,
		})
	if (b.services.length)
		hubs.push({
			id: "services",
			title: "Streaming services",
			line: b.services.map((s) => s.name).join(", "),
			href: HUBS.showStreaming,
			art: (
				<div className="relative h-full">
					<Stack cards={b.services.map((s) => s.titles[0])} count={4} className="h-full items-end justify-center px-2 opacity-50" />
					<span aria-hidden className="absolute inset-x-0 top-[38%] flex justify-center -space-x-2">
						{b.services.map((s) =>
							s.logo_path ? (
								<img key={s.id} src={serviceLogo(s.logo_path)} alt="" loading="lazy" width={36} height={36} className="h-8 w-8 rounded-lg ring-2 ring-gray-900 sm:h-9 sm:w-9" />
							) : null,
						)}
					</span>
				</div>
			),
			subs: b.services.map((s) => ({
				id: String(s.id),
				label: (
					<span className="flex items-center gap-1.5">
						{s.logo_path && <img src={serviceLogo(s.logo_path)} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded" />}
						{s.name}
					</span>
				),
				text: s.name,
				href: serviceHref(s.id),
				cards: s.titles,
			})),
		})

	const talked = data.talked?.titles ?? []
	if (talked.length)
		hubs.push({
			id: "hot",
			title: "Hot on socials",
			line: "What people talk about today",
			href: HUBS.hot,
			art: fanArt(talked.filter((t) => t.poster).map((t) => ({ key: (t.mediaType === "movie" ? 1e12 : 2e12) + t.tmdbId, poster_path: t.poster }))),
			panel: data.talked ? <StartRow row={data.talked} /> : null,
			wide: true,
		})
	if (data.guest.popular.length)
		hubs.push({
			id: "popular",
			title: "Popular now",
			line: "Filter by mood, genre, score and service",
			href: HUBS.discover,
			art: fanArt(data.guest.popular),
			cards: data.guest.popular,
			wide: true,
		})
	return hubs
}

function Panel({ hub }: { hub: Hub }) {
	const [subId, setSubId] = useState(hub.subs?.[0]?.id)
	const sub = hub.subs?.find((s) => s.id === subId) ?? hub.subs?.[0]
	return (
		<div id={`bw2b-panel-${hub.id}`} className="bw2b-in col-span-full -mt-1 mb-2 overflow-hidden rounded-xl bg-gray-900/70 px-4 pb-1 pt-3 ring-1 ring-white/10 sm:px-8">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="min-w-0 truncate text-sm font-semibold text-white">
					{hub.title}
					{sub && <span className="text-gray-400"> · {sub.text}</span>}
				</p>
				<Link
					to={sub?.href ?? hub.href}
					discover="none"
					className="shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-sm font-bold text-gray-950 hover:bg-amber-300"
				>
					Open page →
				</Link>
			</div>
			{hub.subs && (
				<div role="tablist" aria-label={hub.title} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-8 sm:px-8">
					{hub.subs.map((s) => (
						<button
							key={s.id}
							type="button"
							role="tab"
							aria-selected={s.id === sub?.id}
							onClick={() => setSubId(s.id)}
							className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors ${
								s.id === sub?.id ? "bg-white text-gray-950 ring-white" : "bg-gray-800 text-gray-200 ring-white/10 hover:bg-gray-700"
							}`}
						>
							{s.dot && <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />}
							{s.label}
						</button>
					))}
				</div>
			)}
			{hub.panel ? (
				<div className="pb-3">{hub.panel}</div>
			) : (
				// Keyed by the part, so switching parts crossfades a rail of the same height in place.
				<div key={sub?.id ?? "all"} className="bw2b-fade">
					<PosterRail cards={sub?.cards ?? hub.cards ?? []} label={sub ? `${hub.title}: ${sub.text}` : hub.title} />
				</div>
			)}
			{hub.subs && (
				<p className="pb-3 text-sm">
					<Link to={hub.href} discover="none" className="font-semibold text-amber-400 hover:text-amber-300">
						All {hub.title.toLowerCase()} →
					</Link>
				</p>
			)}
		</div>
	)
}

function Tiles() {
	const { data } = useLab()
	const hubs = hubsOf(data)
	const [open, setOpen] = useState<string | null>(null)
	// The tapped tile stays where it is on screen when a panel above it closes.
	const anchor = useRef<{ el: HTMLElement; top: number } | null>(null)
	useLayoutEffect(() => {
		const a = anchor.current
		anchor.current = null
		if (!a) return
		const delta = a.el.getBoundingClientRect().top - a.top
		if (Math.abs(delta) > 1) window.scrollBy(0, delta)
	}, [open])

	const toggle = (id: string, el: HTMLElement) => {
		anchor.current = { el, top: el.getBoundingClientRect().top }
		setOpen((o) => (o === id ? null : id))
	}

	return (
		<section aria-labelledby="bw2b-h" className="lrb" style={lrbStyle}>
			<FanStyles />
			<style>{`
@keyframes bw2b-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
@keyframes bw2b-fade{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.bw2b-in{animation:bw2b-in .28s cubic-bezier(.2,.8,.2,1)}
.bw2b-fade{animation:bw2b-fade .24s ease-out}
@media (prefers-reduced-motion:reduce){.bw2b-in,.bw2b-fade{animation:none}}
`}</style>
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 md:py-14">
				<p className="lrb-eye">Browse</p>
				<h2 id="bw2b-h" className="mb-6 mt-1 !text-2xl md:!text-3xl">
					Where to start
				</h2>
				{/* Dense flow: an open panel spans the row after its tile, and the rest of the tile's row backfills above it. */}
				<div className="grid grid-cols-2 gap-3 [grid-auto-flow:row_dense] md:grid-cols-4 md:gap-4">
					{hubs.map((hub) => {
						const isOpen = open === hub.id
						return (
							<Fragment key={hub.id}>
								<article
									className={`bw2-tile relative flex flex-col overflow-hidden rounded-xl bg-gray-900 ring-1 ${hub.wide ? "md:col-span-2" : ""} ${
										isOpen ? "ring-2 ring-amber-400" : "ring-white/10 hover:ring-white/25"
									}`}
								>
									<div className="h-32 bg-gradient-to-b from-gray-800/60 to-transparent pt-4 sm:h-40">{hub.art}</div>
									<div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
										<h3 className="text-[15px] font-bold leading-tight text-white sm:text-base">
											<button
												type="button"
												aria-expanded={isOpen}
												aria-controls={`bw2b-panel-${hub.id}`}
												onClick={(e) => toggle(hub.id, e.currentTarget.closest("article") as HTMLElement)}
												className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
											>
												{hub.title}
											</button>
										</h3>
										<p className="mt-0.5 line-clamp-1 text-xs text-gray-400 sm:text-sm">{hub.line}</p>
										<div className="mt-2 flex items-center justify-between text-xs font-semibold sm:text-sm">
											<span aria-hidden className={`text-gray-300 transition-transform ${isOpen ? "rotate-180" : ""}`}>
												▾
											</span>
											<Link to={hub.href} discover="none" className="relative z-10 py-1 pl-2 text-amber-400 hover:text-amber-300">
												See all →
											</Link>
										</div>
									</div>
								</article>
								{isOpen && <Panel hub={hub} />}
							</Fragment>
						)
					})}
				</div>
				<p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
					<Link to={HUBS.explorer} discover="none" className="text-amber-400 hover:text-amber-300">
						Explorer →
					</Link>
					<Link to={HUBS.people} discover="none" className="text-amber-400 hover:text-amber-300">
						People →
					</Link>
					<Link to={HUBS.movieStreaming} discover="none" className="text-amber-400 hover:text-amber-300">
						Movies by service →
					</Link>
				</p>
			</div>
		</section>
	)
}

export const variant: BlockVariant = { key: "b", name: "Teaser tiles that open", C: Tiles }

// PROTOTYPE - throwaway (#659). Variant "lanes" (bolder): no single hero. Tonight's best pick from each side, side by
// side, then the steps with side colors. The lanes come in the order of their picks in the personal order, so the
// first lane holds what the hero would be; inside a lane, the personal order. A side with nothing that fits tonight
// says so and offers its moods.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { ServiceTiles, titleHref } from "~/ui/watch-next/WatchNextHero"
import { runtimeLabel } from "~/ui/watch-next/labels"
import { offersOf } from "~/ui/watch-next/services"
import { DISPLAY, WRAP, backdropUrl, posterUrl } from "~/ui/watch-next/style"
import type { TitleKey } from "~/utils/title-key"
import { AfterThat, MoodButton, SideFaces, Tiers, pct, sideBar, useParam } from "./bits"
import type { SwnTier, SwnView } from "./model"

const NEXT = 2

export function Lanes({ view, strip }: { view: SwnView; strip: ReactNode }) {
	const set = useParam()
	const movies = view.list === "movies"
	const pass = (title: WatchNextTitle) => set({ nt: [...view.passed.filter((k) => k !== title.key), title.key].join(",") })
	const lanes = view.sides
		.map((side) => ({ side, keys: view.fitting.filter((k) => view.sideOf[k] === side.id && view.titles[k]) }))
		.sort((a, b) => (a.keys.length ? view.fitting.indexOf(a.keys[0]) : 1e9) - (b.keys.length ? view.fitting.indexOf(b.keys[0]) : 1e9))
	const shown = new Set<TitleKey>(lanes.flatMap((l) => l.keys.slice(0, 1 + NEXT)))
	// The hero and Then are part of the steps here: the lanes replace the hero.
	const head = [view.data.hero, ...view.data.thenColumn].flatMap((t) => (t ? [t.key] : []))
	// The hero and Then join Up next; what the lanes show leaves every step; the first fitting step left is Up next.
	const fitsHead = view.fitting.length > 0
	// When nothing fits, the hero and Then are the first of what doesn't: they rejoin the first step.
	const merged: SwnTier[] =
		view.tiers[0]?.key === "upNext" || (!fitsHead && view.tiers.length)
			? view.tiers.map((t, i) => (i === 0 ? { ...t, keys: [...head, ...t.keys] } : t))
			: [{ key: "upNext", label: "Up next", note: null, size: "xl", keys: head }, ...view.tiers]
	const left = merged.map((t) => ({ ...t, keys: t.keys.filter((k) => !shown.has(k)) })).filter((t) => t.keys.length)
	const FITS = ["upNext", "soon", "later", "someday"]
	const tiers = left.map((t, i) => (i === 0 && FITS.includes(t.key) && t.key !== "upNext" ? { ...t, label: "Up next" } : t))
	const backdrop = lanes[0]?.keys[0] ? view.titles[lanes[0].keys[0]]?.backdrop_path : null
	if (!view.data.total)
		return (
			<div className={`${WRAP} py-16`}>
				<div className="relative z-20 hidden pb-10 lg:block">{strip}</div>
				<p className="text-sm font-semibold text-amber-300">{movies ? "No movies yet" : "Your Wishlist is empty"}</p>
				<h2 className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-6xl`}>Nothing here yet</h2>
			</div>
		)
	return (
		<>
			<section className="relative isolate overflow-hidden" aria-label="Tonight, one from each side of you">
				{backdrop && <img src={backdropUrl(backdrop, "w1280")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%] opacity-30" />}
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/85 to-gray-900/60" />
				<div className={`${WRAP} relative z-20 hidden pt-6 lg:block`}>{strip}</div>
				<div className={`${WRAP} pb-8 pt-8`}>
					<h2 className={`${DISPLAY} text-3xl text-white md:text-5xl`}>Tonight, one from each side of you</h2>
					<p className="mt-1 text-sm text-gray-300">{view.data.fitting ? "Your best pick from every side, in your order." : "Nothing fits tonight's choices."}</p>
					<ol className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] md:overflow-visible md:px-0">
						{lanes.map(({ side, keys }) => {
							const i = view.sides.indexOf(side)
							const top = keys[0] ? view.titles[keys[0]] : null
							return (
								<li key={side.id} className="flex w-56 shrink-0 snap-start flex-col gap-3 md:w-auto" data-lane={side.id}>
									<div className="flex items-center gap-2 border-b-2 pb-2" style={{ borderColor: side.color }}>
										<SideFaces side={side} view={view} size="xs" />
										<div className="min-w-0">
											<p className="line-clamp-2 text-sm font-bold text-white">{view.names ? side.name : `Side ${i + 1}`}</p>
											<p className="text-[11px] text-gray-400">
												{pct(side.share)} of what you love · {keys.length} fit
											</p>
										</div>
									</div>
									{top ? (
										<>
											<Link to={titleHref(top)} className="group block">
												<img src={posterUrl(top.poster_path, "w342")} alt={top.title} className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-white/40" />
												<p className="mt-2 truncate text-base font-bold text-white">{top.title}</p>
												<p className="truncate text-xs text-gray-400">
													{[top.release_year, runtimeLabel(top, movies ? "Movie" : undefined), top.match ? `${top.match}% taste match` : null].filter(Boolean).join(", ")}
												</p>
											</Link>
											<ServiceTiles offers={offersOf(top, view.data.myServices)} />
											<button type="button" onClick={() => pass(top)} className="-mt-1 self-start cursor-pointer text-xs font-semibold text-gray-400 hover:text-white">
												Not tonight
											</button>
											{keys.slice(1, 1 + NEXT).map((k) => {
												const t = view.titles[k]
												return (
													<Link key={k} to={titleHref(t)} className="flex items-center gap-2 rounded-md bg-black/40 p-1 hover:bg-black/60">
														<img src={posterUrl(t.poster_path, "w92")} alt="" className="aspect-[2/3] w-9 rounded object-cover" />
														<span className="min-w-0 truncate text-xs font-semibold text-gray-200">{t.title}</span>
													</Link>
												)
											})}
										</>
									) : (
										<div className="flex flex-1 flex-col items-start gap-2 rounded-lg bg-white/[0.04] p-3 text-sm text-gray-400">
											Nothing from this side fits tonight.
											<MoodButton side={side} />
										</div>
									)}
								</li>
							)
						})}
					</ol>
				</div>
			</section>
			<div className={`${WRAP} pt-6`}>
				<AfterThat view={view} line="Everything else, by Best match, with each title's side in its color. Each step further down gets smaller." />
				<Tiers view={view} tiers={tiers} mark={sideBar(view)} />
			</div>
		</>
	)
}

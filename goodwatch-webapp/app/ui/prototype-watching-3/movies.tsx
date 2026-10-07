// PROTOTYPE - throwaway. My movies for /prototype/watching-3 (#371): round 2's variant A, hero and tiers, as the owner
// chose it, copied from ui/prototype-watching-2/films.tsx with two changes: every word the member reads says "movie",
// and the control strip has one more choice, "How long have you got?", which round 2 proposed. A movie that runs
// longer than the chosen time moves to "Not tonight's fit" with how far it runs over.
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { type Title, img } from "~/ui/prototype-watching/model"
import { Empty, MoodChips, MoodDots, ServiceLine, ServiceTile, ServicesToggle, SortSelect, WatchOn, moodName } from "~/ui/prototype-watching-2/bits"
import { FILM_DEFAULTS, FILM_SORTS, type Facts, type FilmControls, type FilmSort, filmsOf, hm, plural } from "~/ui/prototype-watching-2/model"
import { DISPLAY, EASE, WRAP } from "~/ui/watch-next/style"
import type { Nav } from "./model"
import { PageHead, headLinks } from "./seen"

const SORT_WORDS: Record<FilmSort, string> = { match: "Best match for you tonight", short: "The shortest on your list", top: "Top rated on your list", added: "Last added", waiting: "Waiting longest" }
const pickLabel = (c: FilmControls) =>
	[c.moods.length ? `${SORT_WORDS[c.sort].replace(" for you tonight", "")} in ${c.moods.map(moodName).join(" or ")}` : SORT_WORDS[c.sort], c.time ? `under ${hm(c.time)}` : null].filter(Boolean).join(", ")

const TIMES: { key: string; label: string; minutes: number | null }[] = [
	{ key: "any", label: "Any length", minutes: null },
	{ key: "90", label: "Up to 1h 30", minutes: 90 },
	{ key: "120", label: "Up to 2h", minutes: 120 },
	{ key: "150", label: "Up to 2h 30", minutes: 150 },
]

/** "How long have you got?" as one more choice in the strip. */
function TimeSelect({ value, onChange }: { value: number | null; onChange: (minutes: number | null) => void }) {
	return (
		<label className={`relative flex h-9 shrink-0 items-center rounded-xl pl-3 text-sm font-bold ring-1 ${value ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "bg-white/[0.06] text-gray-200 ring-white/10"}`} title="How long have you got?">
			<span className="sr-only">How long have you got?</span>
			<select
				value={TIMES.find((t) => t.minutes === value)?.key ?? "any"}
				onChange={(e) => onChange(TIMES.find((t) => t.key === e.target.value)?.minutes ?? null)}
				data-time
				className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold outline-none"
			>
				{TIMES.map((t) => (
					<option key={t.key} value={t.key} className="bg-gray-900 text-gray-100">
						{t.key === "any" ? "How long? Any length" : t.label}
					</option>
				))}
			</select>
			<ChevronRightIcon className="pointer-events-none absolute right-2.5 h-4 w-4 rotate-90 opacity-70" aria-hidden />
		</label>
	)
}

const MovieFacts = ({ title, facts, className = "" }: { title: Title; facts: Record<string, Facts>; className?: string }) => (
	<span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
		<b className="tabular-nums text-white">{hm(title.runtime)}</b>
		<ServiceLine title={title} mine={facts[title.key]?.mine} />
		<span className="font-bold tabular-nums text-amber-300">{title.match}%</span>
	</span>
)

export function MoviesPage({ nav, finish }: { nav: Nav; finish: (key: string) => void }) {
	const { store, facts } = nav
	const [c, setControls] = useState<FilmControls>(FILM_DEFAULTS)
	const [more, setMore] = useState(false)
	const set = (next: Partial<FilmControls>) => setControls({ ...c, ...next })
	const list = filmsOf(store, facts, c)
	const counts: Record<string, number> = {}
	for (const t of list.all) if (!c.mine || facts[t.key]?.mine) for (const m of facts[t.key]?.moods ?? []) counts[m] = (counts[m] ?? 0) + 1
	const toggleMood = (mood: string) => set({ moods: c.moods.includes(mood) ? c.moods.filter((m) => m !== mood) : c.moods.length < 3 ? [...c.moods, mood] : c.moods })
	const mine = list.all.filter((t) => facts[t.key]?.mine).length
	const order = [...list.fits, ...(list.fits.length ? [] : list.rest)]
	const pick = order[0]
	const then = order.slice(1, 4)
	const grid = order.slice(4)
	const f = pick ? facts[pick.key] : undefined
	return (
		<div className="overflow-x-clip pb-40" data-movies>
			<PageHead name="My movies" line={`${plural(list.all.length, "movie")} you want to see · ${mine} on your services`} links={headLinks(nav)} />
			{!list.all.length ? (
				<div className={WRAP}>
					<Empty title="No movies yet">Want to See on a movie puts it here, with how long it runs and where it streams.</Empty>
				</div>
			) : (
				<>
					<section className="relative isolate overflow-hidden" data-hero={pick?.key}>
						<AnimatePresence mode="popLayout" initial={false}>
							{pick?.backdrop && (
								<motion.img
									key={pick.key}
									src={img(pick.backdrop, "w1280")}
									alt=""
									initial={{ opacity: 0, scale: 1.05 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.8, ease: EASE }}
									className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
								/>
							)}
						</AnimatePresence>
						<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-linear-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
						<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-900 to-transparent" />
						<div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-gray-900/90 to-transparent" />
						<div className={`${WRAP} relative z-20 pt-3`}>
							<div className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/45 p-2 ring-1 ring-white/10 backdrop-blur-md lg:flex-nowrap" data-strip>
								<MoodChips picked={c.moods} toggle={toggleMood} counts={counts} className="min-w-0 basis-full lg:flex-1 lg:basis-0" />
								<span className="hidden shrink-0 whitespace-nowrap px-1 text-sm tabular-nums text-gray-400 xl:inline" data-count>
									<b className="text-white">{list.fits.length}</b> {c.moods.length || c.time ? "fit" : c.mine ? "on your services" : "movies"}
								</span>
								<TimeSelect value={c.time} onChange={(time) => set({ time })} />
								<ServicesToggle on={c.mine} onChange={(mine) => set({ mine })} />
								<SortSelect value={c.sort} onChange={(sort) => set({ sort })} options={FILM_SORTS} />
							</div>
						</div>
						<div className={`${WRAP} grid min-h-[28rem] items-end gap-6 pb-8 pt-16 md:min-h-[32rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-6`}>
							{pick && (
								<motion.div key={pick.key} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }} className="min-w-0 max-w-2xl">
									<p className="text-sm font-semibold text-amber-300" data-pick-label>
										Tonight's movie · {list.fits.length ? pickLabel(c) : "nothing fits; closest"}
									</p>
									<h2 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${pick.title.length > 22 ? "text-4xl md:text-6xl" : pick.title.length > 12 ? "text-5xl md:text-7xl" : "text-5xl md:text-7xl lg:text-8xl"}`}>{pick.title}</h2>
									{pick.tagline && <p className="mt-3 text-base text-gray-200 md:text-lg">{pick.tagline}</p>}
									<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300">
										<b className="text-lg text-white">{hm(pick.runtime)}</b>
										<span>{pick.year}</span>
										<span>{pick.match}% taste match</span>
										{pick.score && <span>GoodWatch score {pick.score}</span>}
										{f && <MoodDots moods={f.moods} />}
									</p>
									<div className="mt-5">
										<ServiceTile title={pick} mine={f?.mine} />
									</div>
									<div className="mt-6 flex flex-wrap items-center gap-2">
										<WatchOn title={pick} />
										<button
											type="button"
											data-finish={pick.key}
											onClick={() => finish(pick.key)}
											className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/10 px-4 font-semibold text-white ring-1 ring-white/10 backdrop-blur hover:bg-green-500/25 hover:ring-green-400/60"
										>
											<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />I watched it
										</button>
										<button type="button" data-pass onClick={() => store.pass(pick.key)} className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10">
											Not tonight
										</button>
									</div>
								</motion.div>
							)}
							{then.length > 0 && (
								<div className="min-w-0" data-then>
									<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
									<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[20rem] md:flex-col md:overflow-visible md:px-0">
										{then.map((t, i) => (
											<li key={t.key} className="w-28 shrink-0 md:w-auto">
												<div className="flex w-full flex-col gap-2 rounded-lg bg-black/50 p-1.5 backdrop-blur-md md:flex-row md:items-center md:gap-3">
													<span className="relative block shrink-0">
														<img src={img(t.poster, "w185")} alt="" className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16" />
														<span className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`} aria-hidden>
															{i + 2}
														</span>
													</span>
													<span className="min-w-0 flex-1">
														<span className="block truncate text-sm font-bold text-white">{t.title}</span>
														<span className="block truncate text-xs text-gray-200">{hm(t.runtime)}</span>
														<span className="block truncate text-xs text-gray-400">{t.service ? `On ${t.service.name}` : "Not streaming"}</span>
													</span>
												</div>
											</li>
										))}
									</ol>
								</div>
							)}
						</div>
					</section>
					<div className={`${WRAP} flex flex-col gap-10 pt-8`}>
						{grid.length > 0 && (
							<section data-tier="after">
								<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>After that</h2>
								<p className="mb-5 mt-1 text-sm text-gray-400">The rest of your movies that fit, by {FILM_SORTS[c.sort].toLowerCase()}.</p>
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
									{grid.map((t) => (
										<div key={t.key} className="min-w-0" data-movie={t.key}>
											<img src={img(t.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg bg-white/5 object-cover ring-1 ring-white/5" />
											<div className="mt-1.5 truncate text-sm font-bold text-white">{t.title}</div>
											<MovieFacts title={t} facts={facts} className="text-xs" />
										</div>
									))}
								</div>
							</section>
						)}
						{list.fits.length > 0 && list.rest.length > 0 && (
							<section data-tier="rest">
								<button type="button" data-rest-toggle onClick={() => setMore(!more)} className="flex cursor-pointer items-center gap-2 text-lg font-bold text-gray-400 hover:text-white">
									<ChevronDownIcon className={`h-4 w-4 transition-transform ${more ? "" : "-rotate-90"}`} aria-hidden />
									Not tonight's fit
									<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-gray-300">{list.rest.length}</span>
								</button>
								{more && (
									<div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
										{list.rest.map((t) => (
											<div key={t.key} className="min-w-0">
												<img src={img(t.poster, "w185")} alt={t.title} loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover opacity-60 ring-1 ring-white/5" />
												<div className="mt-1 truncate text-xs text-gray-500">{list.why(t)}</div>
											</div>
										))}
									</div>
								)}
							</section>
						)}
					</div>
				</>
			)}
		</div>
	)
}

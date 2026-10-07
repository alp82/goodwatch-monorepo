// PROTOTYPE - throwaway. My films under each films variant of /prototype/watching-2 (#371): the films a person wants
// to see, laid out for picking one tonight. Films they have seen are not here: "I watched it" takes a film off.
//   A hero:    today's Watch next page for films only: the docked strip, the hero with Then, the stepped grid.
//   B time:    the page asks how long the person has; films are bars as long as they run, against that line.
//   C compare: a table with one column per thing the choice rests on; the column heads are the sort.
// The moods, On my services and the sort work in all three, in the browser. Moods are made up from genres.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { type Store, type Title, img } from "~/ui/prototype-watching/model"
import { DISPLAY, EASE, WRAP } from "~/ui/watch-next/style"
import { Empty, MoodChips, MoodDots, PageHead, Segmented, ServiceLine, ServiceTile, ServicesToggle, SortSelect, Tag, WatchOn, moodName } from "./bits"
import { type Choice, FILM_DEFAULTS, FILM_SORTS, type Facts, type FilmControls, type FilmSort, type Go, filmsOf, hm, plural } from "./model"

type Props = { store: Store; facts: Record<string, Facts>; choice: Choice; go: Go }
type View = Props & { c: FilmControls; set: (next: Partial<FilmControls>) => void; list: ReturnType<typeof filmsOf>; counts: Record<string, number>; toggleMood: (mood: string) => void }

const SORT_WORDS: Record<FilmSort, string> = { match: "Best match for you tonight", short: "The shortest on your list", top: "Top rated on your list", added: "Last added", waiting: "Waiting longest" }
const pickLabel = (c: FilmControls) => (c.moods.length ? `${SORT_WORDS[c.sort].replace(" for you tonight", "")} in ${c.moods.map(moodName).join(" or ")}` : SORT_WORDS[c.sort])

function Watched({ title, store, label = true, className = "" }: { title: Title; store: Store; label?: boolean; className?: string }) {
	return (
		<button
			type="button"
			data-finish={title.key}
			onClick={() => store.finishTitle(title.key)}
			aria-label={`I watched ${title.title}`}
			className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/10 font-semibold text-white ring-1 ring-white/10 hover:bg-green-500/25 hover:ring-green-400/60 ${label ? "h-12 px-4 backdrop-blur" : "h-10 w-10"} ${className}`}
		>
			<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />
			{label && "I watched it"}
		</button>
	)
}

const NoFilms = () => <Empty title="No films yet">Want to See on a film puts it here, with how long it runs and where it streams.</Empty>

// ---------------------------------------------------------------------------------------------------------
// A: the shipped Watch next page, for films.

function Strip({ c, set, list, counts, toggleMood }: View) {
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/45 p-2 ring-1 ring-white/10 backdrop-blur-md md:flex-nowrap" data-strip>
			<MoodChips picked={c.moods} toggle={toggleMood} counts={counts} className="min-w-0 basis-full md:flex-1 md:basis-0" />
			<span className="hidden shrink-0 whitespace-nowrap px-1 text-sm tabular-nums text-gray-400 lg:inline" data-count>
				<b className="text-white">{list.fits.length}</b> {c.moods.length ? "fit" : c.mine ? "on your services" : "films"}
			</span>
			<ServicesToggle on={c.mine} onChange={(mine) => set({ mine })} />
			<SortSelect value={c.sort} onChange={(sort) => set({ sort })} options={FILM_SORTS} />
		</div>
	)
}

function FilmFacts({ title, facts, className = "" }: { title: Title; facts: Record<string, Facts>; className?: string }) {
	const f = facts[title.key]
	return (
		<span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
			<b className="tabular-nums text-white">{hm(title.runtime)}</b>
			<ServiceLine title={title} mine={f?.mine} />
			<span className="font-bold tabular-nums text-amber-300">{title.match}%</span>
		</span>
	)
}

function HeroPage(v: View) {
	const { store, facts, c, list } = v
	const order = [...list.fits, ...(list.fits.length ? [] : list.rest)]
	const pick = order[0]
	const then = order.slice(1, 4)
	const grid = order.slice(4)
	const f = pick ? facts[pick.key] : undefined
	const [more, setMore] = useState(false)
	if (!list.all.length)
		return (
			<div className={WRAP}>
				<NoFilms />
			</div>
		)
	return (
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
					<Strip {...v} />
				</div>
				<div className={`${WRAP} grid min-h-[28rem] items-end gap-6 pb-8 pt-16 md:min-h-[32rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-6`}>
					{pick && (
						<motion.div key={pick.key} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }} className="min-w-0 max-w-2xl">
							<p className="text-sm font-semibold text-amber-300">Tonight's pick · {list.fits.length ? pickLabel(c) : "nothing fits; closest"}</p>
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
								<Watched title={pick} store={store} />
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
						<p className="mb-5 mt-1 text-sm text-gray-400">The rest of your films that fit, by {FILM_SORTS[c.sort].toLowerCase()}.</p>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
							{grid.map((t) => (
								<div key={t.key} className="min-w-0" data-film={t.key}>
									<img src={img(t.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg bg-white/5 object-cover ring-1 ring-white/5" />
									<div className="mt-1.5 truncate text-sm font-bold text-white">{t.title}</div>
									<FilmFacts title={t} facts={facts} className="text-xs" />
								</div>
							))}
						</div>
					</section>
				)}
				{list.fits.length > 0 && list.rest.length > 0 && (
					<section data-tier="rest">
						<button type="button" onClick={() => setMore(!more)} className="flex cursor-pointer items-center gap-2 text-lg font-bold text-gray-400 hover:text-white">
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
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: by the time you have.

const TIMES: { key: string; label: string; minutes: number | null }[] = [
	{ key: "90", label: "1h 30", minutes: 90 },
	{ key: "120", label: "2h", minutes: 120 },
	{ key: "150", label: "2h 30", minutes: 150 },
	{ key: "any", label: "Any", minutes: null },
]

function TimePage(v: View) {
	const { store, facts, c, set, list, counts, toggleMood } = v
	// The clock is the browser's, so it is read after the first paint.
	const [now, setNow] = useState<Date | null>(null)
	useEffect(() => setNow(new Date()), [])
	const max = Math.max(240, ...list.all.map((t) => t.runtime ?? 0))
	const pick = list.fits[0]
	const f = pick ? facts[pick.key] : undefined
	const ends = (minutes: number | null) => (now && minutes ? new Date(now.getTime() + minutes * 60_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null)
	const bar = (t: Title, fits: boolean) => {
		const run = t.runtime ?? 0
		const fit = c.time ? Math.min(run, c.time) : run
		const m = facts[t.key]?.mine
		return (
			<li key={t.key} className="grid grid-cols-[2.5rem_1fr_2.25rem] items-center gap-3 md:grid-cols-[2.5rem_1fr_5.5rem] lg:grid-cols-[2.5rem_1fr_13.25rem]" data-bar={t.key} data-fits={fits}>
				<img src={img(t.poster, "w92")} alt="" loading="lazy" className={`h-[60px] w-10 rounded object-cover ${fits ? "" : "opacity-50"}`} />
				<div className="relative h-[68px]">
					<p className={`truncate pt-2 text-sm font-bold md:text-base ${fits ? "text-white" : "text-gray-500"}`}>{t.title}</p>
					<motion.div layout className="absolute bottom-2.5 left-0 flex h-5 overflow-hidden rounded-md" style={{ width: `${(run / max) * 100}%` }} transition={{ duration: 0.3, ease: EASE }}>
						<span className={`h-full ${fits ? "bg-amber-400" : "bg-white/20"}`} style={{ width: `${(fit / Math.max(1, run)) * 100}%` }} />
						{/* The part of the film that runs past the time the person has. */}
						<span className="h-full flex-1 bg-[repeating-linear-gradient(135deg,rgba(248,113,113,0.55)_0_6px,rgba(248,113,113,0.2)_6px_12px)]" />
					</motion.div>
					<div className="absolute bottom-2.5 flex h-5 items-center gap-2 pl-2 text-xs" style={{ left: `${(run / max) * 100}%` }}>
						<b className={`whitespace-nowrap tabular-nums ${fits ? "text-white" : "text-gray-500"}`}>{hm(run)}</b>
						<span className="hidden whitespace-nowrap text-red-300/80 sm:inline">{fits ? "" : list.why(t)}</span>
					</div>
				</div>
				<div className="flex items-center justify-end gap-3">
					<span className="hidden w-28 text-xs lg:block">
						<ServiceLine title={t} mine={m} />
					</span>
					<span className={`w-9 text-right text-sm font-bold tabular-nums ${fits ? "text-amber-300" : "text-gray-600"}`}>{t.match}%</span>
					<Watched title={t} store={store} label={false} className="hidden md:inline-flex" />
				</div>
			</li>
		)
	}
	if (!list.all.length)
		return (
			<div className={WRAP}>
				<NoFilms />
			</div>
		)
	return (
		<div className={`${WRAP} flex flex-col gap-8`}>
			<section className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-7" data-time>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<h2 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>How long have you got?</h2>
					<Segmented
						label="Time tonight"
						size="lg"
						value={TIMES.find((t) => t.minutes === c.time)?.key ?? "any"}
						onChange={(key) => set({ time: TIMES.find((t) => t.key === key)?.minutes ?? null })}
						options={TIMES.map((t) => ({ key: t.key, label: t.label }))}
					/>
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<MoodChips picked={c.moods} toggle={toggleMood} counts={counts} className="min-w-0 basis-full md:flex-1 md:basis-0" />
					<ServicesToggle on={c.mine} onChange={(mine) => set({ mine })} />
				</div>
				{pick ? (
					<motion.div key={pick.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="relative mt-5 isolate overflow-hidden rounded-2xl ring-1 ring-white/10" data-hero={pick.key}>
						{pick.backdrop && <img src={img(pick.backdrop, "w1280")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_25%]" />}
						<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/10" />
						<div className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:p-7">
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold text-amber-300">
									Tonight's pick · best match{c.time ? ` under ${hm(c.time)}` : ""}
									{c.moods.length ? ` in ${c.moods.map(moodName).join(" or ")}` : ""}
								</p>
								<h3 className={`${DISPLAY} mt-1 text-4xl leading-[0.95] text-white md:text-6xl`}>{pick.title}</h3>
								<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300">
									<b className="text-lg text-white">{hm(pick.runtime)}</b>
									{ends(pick.runtime) && <span>start now, done by {ends(pick.runtime)}</span>}
									<span>{pick.match}% taste match</span>
									{f && <MoodDots moods={f.moods} />}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<WatchOn title={pick} />
								<Watched title={pick} store={store} />
								<button type="button" data-pass onClick={() => store.pass(pick.key)} className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10">
									Not tonight
								</button>
							</div>
						</div>
					</motion.div>
				) : (
					<p className="mt-5 rounded-2xl bg-black/30 p-5 text-gray-300" data-nothing-fits>
						Nothing on your list fits. The closest is below; more time or Everywhere widens it.
					</p>
				)}
			</section>
			<section data-bars>
				<div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2">
					<div>
						<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
							{c.time ? `${plural(list.fits.length, "film")} fit${list.fits.length === 1 ? "s" : ""} in ${hm(c.time)}` : `${plural(list.fits.length, "film")}, as long as they run`}
						</h2>
						<p className="mt-1 text-sm text-gray-400">A bar is as long as its film. By {FILM_SORTS[c.sort].toLowerCase()}.</p>
					</div>
					<span className="grow" />
					<SortSelect value={c.sort} onChange={(sort) => set({ sort })} options={FILM_SORTS} />
				</div>
				<div className="relative">
					{/* The scale and the line of the time the person has, over the bar column only. */}
					<div className="pointer-events-none absolute inset-y-0 left-[3.25rem] right-[3rem] md:right-[6.25rem] lg:right-[14rem]" aria-hidden>
						{[60, 90, 120, 150, 180].map((m) => (
							<span key={m} className={`absolute inset-y-0 border-l border-dashed border-white/10 ${m % 60 ? "hidden sm:block" : ""}`} style={{ left: `${(m / max) * 100}%` }}>
								<span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] tabular-nums text-gray-600">{hm(m)}</span>
							</span>
						))}
						{c.time && <motion.span layout className="absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]" style={{ left: `${(c.time / max) * 100}%` }} data-line />}
					</div>
					<ul className="flex flex-col pt-4">
						{list.fits.map((t) => bar(t, true))}
						{list.rest.map((t) => bar(t, false))}
					</ul>
				</div>
			</section>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: side by side.

function ComparePage(v: View) {
	const { store, facts, c, set, list, counts, toggleMood } = v
	const th = (label: string, sort: FilmSort | null, right = false) => (
		<th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${right ? "text-right" : "text-left"}`} aria-sort={sort && c.sort === sort ? "descending" : undefined}>
			{sort ? (
				<button type="button" data-th={sort} onClick={() => set({ sort })} className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 ${c.sort === sort ? "bg-amber-400 text-black" : "text-gray-400 hover:text-white"}`}>
					{label}
					<ChevronDownIcon className={`h-3 w-3 ${c.sort === sort ? "" : "opacity-40"}`} aria-hidden />
				</button>
			) : (
				<span className="px-1.5 text-gray-500">{label}</span>
			)}
		</th>
	)
	const row = (t: Title, i: number, fits: boolean) => {
		const f = facts[t.key]
		const pick = fits && i === 0
		return (
			<tr key={t.key} className={`border-b border-white/5 ${pick ? "bg-amber-400/[0.07]" : "hover:bg-white/[0.03]"} ${fits ? "" : "opacity-55"}`} data-film={t.key} data-fits={fits}>
				<td className="px-3 py-2">
					<span className="flex items-center gap-3">
						<img src={img(t.poster, "w154")} alt="" loading="lazy" className={`shrink-0 rounded object-cover ${pick ? "h-24 w-16" : "h-[72px] w-12"}`} />
						<span className="min-w-0">
							{pick && <Tag kind="next" className="mb-1">Tonight's pick</Tag>}
							<b className={`block truncate text-white ${pick ? `${DISPLAY} text-2xl` : "text-base"}`}>{t.title}</b>
							<span className="block truncate text-xs text-gray-500">{fits ? t.year : list.why(t)}</span>
						</span>
					</span>
				</td>
				<td className={`${DISPLAY} whitespace-nowrap px-3 text-right text-2xl text-white`}>{hm(t.runtime)}</td>
				<td className="px-3 text-sm">
					<ServiceLine title={t} mine={f?.mine} />
				</td>
				<td className="px-3 text-right">
					<span className="inline-flex items-center gap-2">
						<span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/10 xl:block">
							<span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.max(0, (t.match - 50) * 2)}%` }} />
						</span>
						<b className="text-sm tabular-nums text-amber-300">{t.match}%</b>
					</span>
				</td>
				<td className="px-3 text-xs text-gray-300">{f && <MoodDots moods={f.moods} className="flex-wrap gap-y-0.5" />}</td>
				<td className="px-3 text-right text-sm tabular-nums text-gray-200">{t.score}</td>
				<td className="py-2 pl-3 pr-2 text-right">
					<Watched title={t} store={store} label={false} />
				</td>
			</tr>
		)
	}
	const card = (t: Title, i: number, fits: boolean) => {
		const f = facts[t.key]
		const pick = fits && i === 0
		return (
			<li key={t.key} className={`flex items-center gap-3 rounded-xl p-2 ring-1 ${pick ? "bg-amber-400/[0.08] ring-amber-400/40" : "bg-white/[0.04] ring-white/5"} ${fits ? "" : "opacity-55"}`} data-film={t.key}>
				<img src={img(t.poster, "w154")} alt="" loading="lazy" className="h-[84px] w-14 shrink-0 rounded-md object-cover" />
				<span className="min-w-0 flex-1">
					{pick && <Tag kind="next">Tonight's pick</Tag>}
					<b className="block truncate text-base text-white">{t.title}</b>
					<span className="flex items-center gap-2 text-xs text-gray-300">
						<b className="text-sm tabular-nums text-white">{hm(t.runtime)}</b>
						<b className="tabular-nums text-amber-300">{t.match}%</b>
						<ServiceLine title={t} mine={f?.mine} />
					</span>
					<span className="block truncate text-xs text-gray-500">{fits ? f && <MoodDots moods={f.moods} /> : list.why(t)}</span>
				</span>
				<Watched title={t} store={store} label={false} />
			</li>
		)
	}
	if (!list.all.length)
		return (
			<div className={WRAP}>
				<NoFilms />
			</div>
		)
	return (
		<div className={`${WRAP} flex flex-col gap-4`}>
			<div className="flex flex-wrap items-center gap-2" data-strip>
				<MoodChips picked={c.moods} toggle={toggleMood} counts={counts} className="min-w-0 basis-full md:flex-1 md:basis-0" />
				<ServicesToggle on={c.mine} onChange={(mine) => set({ mine })} />
				<span className="md:hidden">
					<SortSelect value={c.sort} onChange={(sort) => set({ sort })} options={FILM_SORTS} />
				</span>
			</div>
			<table className="hidden w-full border-collapse md:table" data-compare>
				<thead>
					<tr className="border-b border-white/10">
						{th("Film", null)}
						{th("Runs", "short", true)}
						{th("Streams on", null)}
						{th("Taste match", "match", true)}
						{th("Mood", null)}
						{th("Score", "top", true)}
						<th />
					</tr>
				</thead>
				<tbody>
					{list.fits.map((t, i) => row(t, i, true))}
					{list.rest.map((t, i) => row(t, i, false))}
				</tbody>
			</table>
			<ul className="flex flex-col gap-2 md:hidden">
				{list.fits.map((t, i) => card(t, i, true))}
				{list.rest.map((t, i) => card(t, i, false))}
			</ul>
		</div>
	)
}

export function FilmsPage(props: Props) {
	const { store, facts, choice, go } = props
	const [controls, setControls] = useState<FilmControls>(FILM_DEFAULTS)
	// Only the time variant asks for a time.
	const c = { ...controls, time: choice.films === "time" ? controls.time : null }
	const set = (next: Partial<FilmControls>) => setControls({ ...controls, ...next })
	const list = filmsOf(store, facts, c)
	const counts: Record<string, number> = {}
	for (const t of list.all) if (!c.mine || facts[t.key]?.mine) for (const m of facts[t.key]?.moods ?? []) counts[m] = (counts[m] ?? 0) + 1
	const toggleMood = (mood: string) => set({ moods: c.moods.includes(mood) ? c.moods.filter((m) => m !== mood) : c.moods.length < 3 ? [...c.moods, mood] : c.moods })
	const view: View = { ...props, c, set, list, counts, toggleMood }
	const mine = list.all.filter((t) => facts[t.key]?.mine).length
	const line = `${plural(list.all.length, "film")} you want to see · ${mine} on your services`
	const Page = choice.films === "hero" ? HeroPage : choice.films === "time" ? TimePage : ComparePage
	const head: ReactNode = <PageHead name="My films" line={line} whole={`${line} · every film you want to see is here`} store={store} choice={choice} go={go} />
	return (
		<div className="overflow-x-clip pb-40" data-films={choice.films}>
			{head}
			<Page {...view} />
		</div>
	)
}

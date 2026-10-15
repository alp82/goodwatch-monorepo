// PROTOTYPE - throwaway (#659). How Sides of you appear on Watch next, on one member's real list (My movies, or the
// whole Wishlist), ordered by their personal order. A data bar switches the member, the list, and the side names (the
// words wait on the "whose Taste is this" test, #656, so every variant also works with colors and posters alone).
//
// - today:   production, for reference (personal order, no sides).
// - marked:  production's layout; the hero, Then, and every poster carry their side's color, and a legend names them.
// - grouped: the hero and Then as today; after that, the list in one section per side, each with its own tiers.
// - picker:  "Which side of you tonight?" above the hero; a side becomes one more condition, like a mood, and the
//            titles of the other sides that fit get their own step.
// - lanes (bolder): no single hero: one column per side with its best pick tonight, then the steps with side colors.
import { useEffect, useState } from "react"
import { type MoodKey, toggleMood } from "~/domain/moods"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { MOVIES_PAGE } from "~/ui/my-movies/parts"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { DockedStrip } from "~/ui/watch-next/DockedStrip"
import type { MoodControl } from "~/ui/watch-next/MoodPicker"
import { PhoneControls } from "~/ui/watch-next/PhoneControls"
import { MoviesPageContext, TitleAsideContext, WatchNextHero } from "~/ui/watch-next/WatchNextHero"
import { WRAP } from "~/ui/watch-next/style"
import { AfterThat, SideChip, Tiers, sideBar, sideById, useParam } from "./bits"
import { Grouped } from "./Grouped"
import { Lanes } from "./Lanes"
import { Legend } from "./Legend"
import { EmptySide, Picker } from "./Picker"
import { VARIANTS, type SwnView } from "./model"

function DataBar({ view }: { view: SwnView }) {
	const set = useParam()
	const pill = (on: boolean) =>
		`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${on ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`
	return (
		<div className="border-b border-fuchsia-500/30 bg-fuchsia-950/20">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs md:px-8">
				<span className="font-semibold text-fuchsia-300">Prototype data:</span>
				{view.members.map((m) => (
					<button key={m.slot} type="button" onClick={() => set({ as: m.slot, side: null, nt: null })} aria-pressed={m.slot === view.member.slot} className={pill(m.slot === view.member.slot)}>
						{m.label}
						{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings.toLocaleString("en-US")}</span>}
					</button>
				))}
				<span className="mx-1 text-gray-500">|</span>
				<button type="button" onClick={() => set({ list: null, time: null })} aria-pressed={view.list === "movies"} className={pill(view.list === "movies")}>
					My movies
				</button>
				<button type="button" onClick={() => set({ list: "all", time: null })} aria-pressed={view.list === "all"} className={pill(view.list === "all")}>
					Whole Wishlist
				</button>
				<span className="mx-1 text-gray-500">|</span>
				<button type="button" onClick={() => set({ names: view.names ? null : "1" })} aria-pressed={view.names} className={pill(view.names)}>
					Side names {view.names ? "on" : "off"}
				</button>
				<span className="text-gray-400">
					· {view.member.listed} listed, {view.sides.length} sides · personal order {view.personalOrder.on ? "ranks the list" : `not loaded (${view.personalOrder.note ?? "none"})`} · {view.computedMs} ms
				</span>
				{view.notes.length > 0 && (
					<details className="w-full text-gray-400">
						<summary className="cursor-pointer">How the sides were found</summary>
						<ul className="mt-1 list-disc pl-5">
							{view.notes.map((n) => (
								<li key={n}>{n}</li>
							))}
						</ul>
					</details>
				)}
			</div>
		</div>
	)
}

/** Production's strip (desktop) and slab (phones), with every choice in the URL. */
function useControls(view: SwnView) {
	const set = useParam()
	const [open, setOpen] = useState(false)
	// The strip's sort menu renders differently on the server; production shows a placeholder until its data loads.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const { data } = view
	const setMoods = (moods: MoodKey[]) => set({ moods: moods.join(",") || null })
	const moods: MoodControl = {
		moods: data.moods,
		counts: data.moodCounts,
		pictures: data.moodPictures,
		countScope: data.onMyServices ? "on your services" : view.list === "movies" ? "of your movies" : "on your Wishlist",
		open,
		setOpen,
		toggle: (mood) => {
			const r = toggleMood(data.moods, mood)
			if (!r.refused) setMoods(r.moods)
		},
		clear: () => setMoods([]),
		refused: null,
	}
	const setOnMyServices = (on: boolean) => set({ services: on ? null : "all" })
	const time = data.time ?? null
	const setTime = (t: number | null) => set({ time: t ? String(t) : null })
	const movies = view.list === "movies"
	const strip = !mounted ? (
		<div className="h-14 animate-pulse rounded-2xl bg-black/45 ring-1 ring-white/10" aria-hidden />
	) : (
		<DockedStrip data={data} moods={moods} setOnMyServices={setOnMyServices} setSort={() => {}} extra={movies ? MOVIES_PAGE.timeControl(time, setTime) : undefined} />
	)
	const phone = mounted && (
		<PhoneControls
			data={data}
			moods={moods}
			setOnMyServices={setOnMyServices}
			setSort={() => {}}
			extra={
				movies
					? {
							key: "time",
							title: "How long?",
							label: MOVIES_PAGE.phoneTime.label(time),
							icon: MOVIES_PAGE.phoneTime.icon(time),
							on: time !== null,
							body: MOVIES_PAGE.phoneTime.drawer(time, setTime),
						}
					: undefined
			}
		/>
	)
	return { strip, phone }
}

export function SidesWatchNextPage({ view }: { view: SwnView | null }) {
	if (!view) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	return <Page key={`${view.member.slot}:${view.list}`} view={view} />
}

function Page({ view }: { view: SwnView }) {
	const set = useParam()
	const { strip, phone } = useControls(view)
	const movies = view.list === "movies"
	const pass = (title: WatchNextTitle) => set({ nt: [...view.passed.filter((k) => k !== title.key), title.key].join(",") })
	const noop = () => {}
	const hero = <WatchNextHero data={view.data} strip={strip} onFinish={noop} onPass={pass} onWant={noop} />
	const mark = sideBar(view)
	// The side under the hero's eyebrow and each Then title (marked and picker).
	const aside = (title: WatchNextTitle, where: "hero" | "then") => {
		const side = sideById(view, view.sideOf[title.key])
		if (!side) return null
		return where === "hero" ? (
			<div className="mt-2">
				<SideChip side={side} view={view} className="rounded-full bg-black/50 py-1 pl-2 pr-3 ring-1 ring-white/10" />
			</div>
		) : (
			<span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
				<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: side.color }} aria-hidden />
				<span className="truncate">{view.names ? side.name : `Side ${view.sides.indexOf(side) + 1}`}</span>
			</span>
		)
	}

	let body: React.ReactNode
	if (view.variant === "today")
		body = (
			<>
				{hero}
				<div className={`${WRAP} pt-8`}>
					<AfterThat view={view} />
					<Tiers view={view} />
				</div>
			</>
		)
	else if (view.variant === "marked")
		body = (
			<TitleAsideContext.Provider value={aside}>
				{hero}
				<div className={`${WRAP} pt-6`}>
					<Legend view={view} />
					<AfterThat view={view} />
					<Tiers view={view} mark={mark} />
				</div>
			</TitleAsideContext.Provider>
		)
	else if (view.variant === "grouped")
		body = (
			<TitleAsideContext.Provider value={aside}>
				{hero}
				<Grouped view={view} />
			</TitleAsideContext.Provider>
		)
	else if (view.variant === "picker")
		body = (
			<TitleAsideContext.Provider value={aside}>
				<Picker view={view} />
				{view.side && !view.fitting.length ? <EmptySide view={view} strip={strip} /> : hero}
				<div className={`${WRAP} pt-8`}>
					<AfterThat
						view={view}
						line={
							view.side
								? `What fits tonight from this side first, by Best match; titles that fit but belong to another side follow, smaller.`
								: undefined
						}
					/>
					<Tiers view={view} mark={mark} />
				</div>
			</TitleAsideContext.Provider>
		)
	else body = <Lanes view={view} strip={strip} />

	const page = (
		<div className="overflow-x-clip pb-40 text-white" data-watch-next data-my-movies={movies ? "" : undefined}>
			<DataBar view={view} />
			{movies ? MOVIES_PAGE.head(view.data) : <h1 className="sr-only">Watch next</h1>}
			{body}
			{phone}
			<PrototypeSwitcher
				position="bottom-28 left-1/2 -translate-x-1/2 lg:bottom-6"
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
			/>
		</div>
	)
	return movies ? <MoviesPageContext.Provider value>{page}</MoviesPageContext.Provider> : page
}

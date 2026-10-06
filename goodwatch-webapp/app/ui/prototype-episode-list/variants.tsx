// PROTOTYPE - throwaway (#369). Three takes on where the episode list lives and how it is driven.
//   A: the list is a section of the page, seasons as an accordion; On hold and Dropped are buttons.
//   B: a next-episode card in the hero, season tabs below, the grid as the list's second tab; the status is a menu.
//   C: the page carries a progress strip, the list opens in a sheet with every season in one scroll; the status
//      is a three-way switch.
import { ChevronDownIcon, ChevronRightIcon, ListBulletIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { type Season, seasonOf, seasonProgress } from "./model"
import {
	EpisodeRows,
	GridSection,
	Hero,
	HideButton,
	NextEpisode,
	RatePrompt,
	SURFACE,
	SeasonMeta,
	SeenButton,
	ShowProgress,
	StatePill,
	StatusButton,
	StatusMenu,
	StatusSegments,
	WantButton,
	seasonTitle,
	useHasStatus,
} from "./parts"
import { useStore } from "./store"

/** Regular seasons first, specials last. */
const useSeasons = () => {
	const { show } = useStore()
	return [...show.seasons.filter((s) => s.number > 0), ...show.seasons.filter((s) => s.number === 0)]
}
/** The season the person is in: the next episode's, or the first. */
const useCurrentSeason = () => {
	const { show, d } = useStore()
	return d.next ? seasonOf(show, d.next) : (show.seasons.find((s) => s.number > 0)?.number ?? 0)
}

// ---- A -----------------------------------------------------------------------------------

export function VariantA() {
	const s = useStore()
	const hasStatus = useHasStatus()
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const [open, setOpen] = useState(() => new Set([current]))
	const toggle = (n: number) => {
		const next = new Set(open)
		next.has(n) ? next.delete(n) : next.add(n)
		setOpen(next)
	}
	const toList = () => {
		setOpen(new Set([...open, current]))
		document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth" })
	}
	return (
		<div className="flex flex-col gap-10">
			<Hero>
				<div className="@container">
					<div className={`grid grid-cols-2 gap-2 ${hasStatus ? "@lg:grid-cols-4" : "@lg:grid-cols-3"}`}>
						<WantButton />
						<SeenButton />
						{hasStatus ? (
							<>
								<StatusButton status="on_hold" />
								<StatusButton status="dropped" />
							</>
						) : (
							<HideButton className="col-span-2 @lg:col-span-1" />
						)}
					</div>
				</div>
				<RatePrompt className="mt-4" />
				{s.d.started || s.st.seenMarked ? (
					<div className="mt-4 rounded-xl bg-white/[0.06] p-3">
						<ShowProgress />
						<NextEpisode className="mt-3" onOpen={toList} />
					</div>
				) : (
					<button type="button" onClick={toList} className="mt-4 inline-flex cursor-pointer items-center gap-1.5 self-start text-sm font-semibold text-gray-300 underline decoration-white/20 underline-offset-4 hover:text-white">
						<ListBulletIcon className="h-4 w-4" />
						Track the episodes you've watched
					</button>
				)}
			</Hero>

			<section id="episodes" className="scroll-mt-24">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="text-2xl font-bold">Episodes</h2>
					<a href="#episode-ratings" className="text-sm text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white">
						Episode ratings ↓
					</a>
				</div>
				<ShowProgress className="mt-3 max-w-md" />
				<div className="mt-4 flex flex-col gap-2">
					{seasons.map((season) => (
						<div key={season.number} className={`rounded-2xl border border-white/[0.06] ${SURFACE}`}>
							<div className="flex items-center">
								<button type="button" onClick={() => toggle(season.number)} aria-expanded={open.has(season.number)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-3.5 text-left">
									<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open.has(season.number) ? "" : "-rotate-90"}`} />
									<span className="truncate font-semibold text-white">{seasonTitle(season)}</span>
								</button>
								<span className="pr-3">
									<SeasonMeta season={season} />
								</span>
							</div>
							{open.has(season.number) && <EpisodeRows season={season} />}
						</div>
					))}
				</div>
			</section>

			<GridSection
				action={
					<a href="#episodes" className="text-gray-300 underline decoration-white/20 underline-offset-4 hover:text-white">
						Mark episodes ↑
					</a>
				}
			/>
		</div>
	)
}

// ---- B -----------------------------------------------------------------------------------

function SeasonTab({ season, on, pick }: { season: Season; on: boolean; pick: () => void }) {
	const { st, today } = useStore()
	const p = seasonProgress(season, st, today)
	const done = season.number > 0 && p.aired > 0 && p.watched === p.aired
	return (
		<button
			type="button"
			role="tab"
			aria-selected={on}
			onClick={pick}
			className={`flex h-12 min-w-[3.25rem] shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl px-2.5 ${on ? "bg-white text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
		>
			<span className="text-sm font-bold">{season.number === 0 ? "Specials" : `S${season.number}`}</span>
			<span className={`text-[10px] tabular-nums ${done ? (on ? "font-bold text-green-700" : "font-bold text-green-300") : on ? "text-gray-600" : "text-gray-400"}`}>
				{season.number === 0 ? (p.watched ? `${p.watched} seen` : "extra") : done ? "✓ all" : `${p.watched}/${p.aired}`}
			</span>
		</button>
	)
}

export function VariantB() {
	const s = useStore()
	const hasStatus = useHasStatus()
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const [picked, setPicked] = useState(current)
	const [tab, setTab] = useState<"list" | "ratings">("list")
	const season = seasons.find((x) => x.number === picked) ?? seasons[0]
	const toList = () => {
		setTab("list")
		setPicked(current)
		document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth" })
	}
	const tabLook = (on: boolean) => `cursor-pointer border-b-2 pb-2 text-lg font-bold ${on ? "border-white text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`
	return (
		<div className="flex flex-col gap-10">
			<Hero>
				<div className={`rounded-xl p-3 ${s.d.started || s.st.seenMarked ? "bg-white/[0.08] ring-1 ring-white/10" : "bg-white/[0.04]"}`}>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						{hasStatus && <StatusMenu />}
						<ShowProgress className="min-w-48 flex-1" />
					</div>
					<RatePrompt className="mt-3" />
					<NextEpisode className="mt-3" onOpen={toList} />
				</div>
				<div className="@container mt-4">
					<div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
						<WantButton />
						<SeenButton />
						{/* Once an episode is watched, Dropped takes the place of Not interested. */}
						{hasStatus ? <StatusButton status="dropped" className="col-span-2 @lg:col-span-1" /> : <HideButton className="col-span-2 @lg:col-span-1" />}
					</div>
				</div>
			</Hero>

			<section id="episodes" className="scroll-mt-24">
				<div role="tablist" className="flex gap-6 border-b border-white/10">
					<button type="button" role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")} className={tabLook(tab === "list")}>
						Your episodes
					</button>
					<button type="button" role="tab" aria-selected={tab === "ratings"} onClick={() => setTab("ratings")} className={tabLook(tab === "ratings")}>
						Episode ratings
					</button>
				</div>
				{tab === "ratings" ? (
					<div className="mt-5">
						<GridSection />
					</div>
				) : (
					<>
						<div role="tablist" aria-label="Seasons" className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
							{seasons.map((x) => (
								<SeasonTab key={x.number} season={x} on={x.number === season.number} pick={() => setPicked(x.number)} />
							))}
						</div>
						<div className={`mt-2 rounded-2xl border border-white/[0.06] ${SURFACE}`}>
							<div className="flex items-center justify-between gap-3 px-3 py-3">
								<h3 className="truncate font-semibold text-white">{seasonTitle(season)}</h3>
								<SeasonMeta season={season} />
							</div>
							<EpisodeRows season={season} thumb />
						</div>
					</>
				)}
			</section>
		</div>
	)
}

// ---- C -----------------------------------------------------------------------------------

function EpisodeSheet() {
	const s = useStore()
	const hasStatus = useHasStatus()
	const seasons = useSeasons()
	const body = useRef<HTMLDivElement>(null)
	// Opens at the next episode.
	useEffect(() => {
		const id = s.d.next?.id
		if (id) body.current?.querySelector(`[data-ep="${id}"]`)?.scrollIntoView({ block: "center" })
	}, [])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && !s.dialog && s.setSheet(false)
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	const jump = (n: number) => body.current?.querySelector(`[data-season="${n}"]`)?.scrollIntoView({ block: "start" })
	return (
		<div className="fixed inset-0 z-[70]">
			<button type="button" aria-label="Close the episode list" onClick={() => s.setSheet(false)} className="absolute inset-0 cursor-default bg-black/70" />
			{/* biome-ignore lint/a11y/useSemanticElements: prototype sheet */}
			<div role="dialog" aria-modal="true" aria-label={`Episodes of ${s.show.name}`} className="absolute inset-x-0 bottom-0 top-[4.5rem] flex flex-col rounded-t-2xl border border-white/10 bg-gray-900 text-white md:left-auto md:right-0 md:top-16 md:w-[34rem] md:rounded-none">
				<div className="border-b border-white/10 p-4">
					<div className="flex items-center justify-between gap-3">
						<h2 className="min-w-0 truncate text-lg font-bold">{s.show.name}</h2>
						<span className="flex items-center gap-2">
							<StatePill />
							<button type="button" onClick={() => s.setSheet(false)} aria-label="Close" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-white/10">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</span>
					</div>
					<ShowProgress className="mt-2" />
					{hasStatus && <StatusSegments className="mt-3" />}
					<RatePrompt className="mt-3" />
					<div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
						{seasons.map((season) => (
							<button key={season.number} type="button" onClick={() => jump(season.number)} className="h-8 shrink-0 cursor-pointer rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-gray-100 hover:bg-white/20">
								{season.number === 0 ? "Specials" : `S${season.number}`}
							</button>
						))}
					</div>
				</div>
				<div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
					{seasons.map((season) => (
						<section key={season.number} data-season={season.number}>
							<div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-gray-800 px-3 py-2">
								<h3 className="truncate text-sm font-bold text-white">{seasonTitle(season)}</h3>
								<SeasonMeta season={season} />
							</div>
							<EpisodeRows season={season} />
						</section>
					))}
				</div>
			</div>
		</div>
	)
}

export function VariantC() {
	const s = useStore()
	const hasStatus = useHasStatus()
	const open = () => s.setSheet(true)
	return (
		<div className="flex flex-col gap-10">
			<Hero>
				<div className="grid grid-cols-2 gap-2">
					<WantButton />
					<SeenButton />
				</div>
				<div className="mt-2">{hasStatus ? <StatusSegments /> : <HideButton />}</div>
				<RatePrompt className="mt-4" />
				<div className="mt-4 rounded-xl bg-white/[0.06] p-3">
					{(s.d.started || s.st.seenMarked) && (
						<>
							<ShowProgress />
							<NextEpisode className="my-3" onOpen={open} />
						</>
					)}
					<button type="button" onClick={open} className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
						<span className="flex items-center gap-2">
							<ListBulletIcon className="h-4 w-4 text-green-300" />
							{s.d.started || s.st.seenMarked ? "All episodes" : "Track the episodes you've watched"}
						</span>
						<ChevronRightIcon className="h-4 w-4 text-gray-400" />
					</button>
				</div>
			</Hero>

			<GridSection
				action={
					<button type="button" onClick={open} className="cursor-pointer text-gray-300 underline decoration-white/20 underline-offset-4 hover:text-white">
						Mark episodes
					</button>
				}
			/>
			{s.sheet && <EpisodeSheet />}
		</div>
	)
}

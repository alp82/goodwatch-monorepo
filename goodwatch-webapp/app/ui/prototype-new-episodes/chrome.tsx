// PROTOTYPE - throwaway. Two kinds of chrome for /prototype/new-episodes.
// 1. Part of the design: the site header, the phone dock and the hub (ui/navigation, copied and laid over the real
//    ones), because the signal sits on them. My shows is a tile inside the hub, one step away, so the signal is also
//    on what opens the hub: the Browse button on a desktop, the round key of the dock on a phone.
// 2. Not part of any design (white, fuchsia ring): the surfaces, the sample member, the choices that are open, "Next
//    day", the state panel, and the pill that switches the variant on screen.
import {
	BookmarkIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	FilmIcon,
	FingerPrintIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	MapIcon,
	Squares2X2Icon,
	TvIcon,
} from "@heroicons/react/24/solid"
import { type ComponentType, type SVGProps, useEffect, useState } from "react"
import { episodeCode } from "~/domain/my-shows"
import { GoodWatchMark } from "~/ui/navigation/bits"
import {
	type Clears,
	type Look,
	MEMBERS,
	type MemberKey,
	type Planned,
	type Show,
	type Signal,
	type SignalWords,
	anyNewOf,
	countsOf,
	dateWords,
	factsOf,
	upcomingOf,
	weekdayDate,
} from "./model"
import { ROWS, type RowKey } from "./shows"

export type Surface = "home" | "shows"

export const LOOKS: Record<Look, string> = {
	dot: "A · a dot",
	shows: "B · the number of shows",
	episodes: "C · the number of episodes",
}
export const CLEARS: Record<Clears, string> = {
	open: "Clears when My shows is opened",
	watched: "Stays until watched (7 days at most)",
}

export interface Nav {
	surface: Surface
	go: (surface: Surface) => void
	look: Look
	clears: Clears
	row: RowKey
	member: MemberKey
	shows: Show[]
	plan: Planned
	today: string
	lastOpened: string
	signal: Signal
	words: SignalWords | null
	watch: (key: string) => void
	nextDay: () => void
}

const image = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

/** The signal on a navigation entry: a dot, or a number. */
export function Mark({
	words,
	className = "",
}: { words: SignalWords | null; className?: string }) {
	if (!words) return null
	return words.badge === null ? (
		<span
			data-signal="dot"
			className={`block h-3 w-3 rounded-full bg-sky-400 ring-2 ring-gray-950 ${className}`}
		>
			<span className="sr-only">{words.long}</span>
		</span>
	) : (
		<span
			data-signal="count"
			className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1.5 text-[11.5px] font-black tabular-nums leading-none text-black ring-2 ring-gray-950 ${className}`}
		>
			{words.badge}
			<span className="sr-only">: {words.long}</span>
		</span>
	)
}

/** Tonight's pick: the first Watching show of Continue. */
const pickOf = (plan: Planned) =>
	plan.continue[0]?.row.kind === "next" ? plan.continue[0] : null

function Thumb({ nav }: { nav: Nav }) {
	const pick = pickOf(nav.plan)
	const here = nav.surface === "shows"
	const ring = here
		? "ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
		: "ring-[1.5px] ring-amber-400/85"
	return (
		<button
			type="button"
			onClick={() => nav.go("shows")}
			className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl p-[3px] text-left"
		>
			{pick ? (
				<img
					src={image(pick.show.poster, "w92")}
					alt=""
					className={`h-11 w-[30px] shrink-0 rounded-md object-cover ${ring}`}
				/>
			) : (
				<span
					className={`flex h-11 w-[30px] shrink-0 items-center justify-center rounded-md bg-gray-800 text-amber-400 ${ring}`}
				>
					<BookmarkIcon className="h-4 w-4" aria-hidden />
				</span>
			)}
			<span className="flex min-w-0 flex-col leading-[1.15]">
				<small className="text-[11px] font-bold text-amber-400">
					Tonight
					{pick?.facts.next && ` · ${episodeCode(pick.facts.next)}`}
				</small>
				<b className="max-w-[118px] truncate text-[13.5px] text-gray-100">
					{pick?.show.title ?? "Dune: Part Two"}
				</b>
			</span>
		</button>
	)
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>
interface TileWords {
	key: string
	label: string
	subtitle: string
	icon: Icon
	wash: string
	tint: string
}

const TILES: TileWords[] = [
	{
		key: "myMovies",
		label: "My movies",
		subtitle: "Movies you want to see",
		icon: FilmIcon,
		wash: "from-amber-200/25 to-amber-200/[0.06]",
		tint: "text-amber-300",
	},
	{
		key: "discover",
		label: "Discover",
		subtitle: "Browse and search",
		icon: MagnifyingGlassIcon,
		wash: "from-sky-200/25 to-sky-200/[0.06]",
		tint: "text-sky-300",
	},
	{
		key: "taste",
		label: "Taste",
		subtitle: "Sides of you",
		icon: FingerPrintIcon,
		wash: "from-violet-200/25 to-violet-200/[0.06]",
		tint: "text-violet-300",
	},
	{
		key: "explorer",
		label: "Explorer",
		subtitle: "Islands map",
		icon: MapIcon,
		wash: "from-emerald-200/25 to-emerald-200/[0.06]",
		tint: "text-emerald-300",
	},
	{
		key: "myLibrary",
		label: "My library",
		subtitle: "23 to see, and what you have seen",
		icon: BookmarkIcon,
		wash: "from-teal-200/25 to-teal-200/[0.06]",
		tint: "text-teal-300",
	},
]

const TILE =
	"relative flex min-h-[108px] flex-col items-start justify-end gap-0.5 overflow-hidden rounded-[20px] bg-linear-160 px-3.5 py-3 text-left"
const TILE_EDGE =
	"shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08)]"

/** The My shows tile of the hub: the navigation's entry for My shows, with the signal. */
function MyShowsTile({ nav, close }: { nav: Nav; close: () => void }) {
	const pick = pickOf(nav.plan)
	const here = nav.surface === "shows"
	const { words } = nav
	return (
		<button
			type="button"
			data-tile="myShows"
			onClick={() => {
				nav.go("shows")
				close()
			}}
			className={`${TILE} cursor-pointer from-rose-200/25 to-rose-200/[0.06] hover:brightness-125 ${here ? "shadow-[inset_0_0_0_2px_#fbbf24]" : TILE_EDGE}`}
		>
			{pick && (
				<>
					<img
						src={image(pick.show.backdrop, "w300")}
						alt=""
						className="absolute inset-0 h-full w-full object-cover opacity-55"
					/>
					<span className="absolute inset-0 bg-linear-0 from-gray-950/92 to-gray-950/10" />
				</>
			)}
			<TvIcon
				className="absolute top-3 left-3.5 z-10 h-6 w-6 text-rose-300"
				aria-hidden
			/>
			<Mark words={words} className="absolute top-3 right-3 z-10" />
			<b className="brand-header relative z-10 text-[19px] leading-tight text-gray-100">
				My shows
			</b>
			<small
				data-tile-line
				className={`relative z-10 max-w-full truncate text-[12.5px] ${words ? "font-bold text-sky-200" : "text-slate-300"}`}
			>
				{words
					? words.tile
					: pick?.facts.next
						? `${pick.show.title} ${episodeCode(pick.facts.next)} tonight`
						: "Continue, or start one"}
			</small>
		</button>
	)
}

/** The hub sheet (phone) and the Browse panel (desktop), after ui/navigation/Hub.tsx. */
function Hub({ nav, close }: { nav: Nav; close: () => void }) {
	return (
		<>
			<button
				type="button"
				aria-label="Close"
				onClick={close}
				className="fixed inset-0 z-[1100] cursor-default bg-black/55 lg:bg-black/35"
			/>
			<div
				data-hub
				className="fixed inset-x-0 bottom-0 z-[1101] max-h-[86%] overflow-y-auto rounded-t-3xl bg-[#0b1120] px-4 pt-2.5 pb-[22px] text-gray-100 shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] lg:inset-x-auto lg:bottom-auto lg:left-[max(2rem,calc(50%-38rem))] lg:top-[70px] lg:w-[580px] lg:rounded-[20px] lg:p-4"
			>
				<span
					aria-hidden
					className="mx-auto mb-3 block h-[5px] w-10 rounded-full bg-white/25 lg:hidden"
				/>
				<div className="grid gap-3">
					<span className="flex h-[50px] w-full items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 text-[15px] text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]">
						<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
						Search titles, people, moods
					</span>
					<div className="grid grid-cols-2 gap-2.5">
						<MyShowsTile nav={nav} close={close} />
						{TILES.map((tile) => (
							<div
								key={tile.key}
								className={`${TILE} ${TILE_EDGE} ${tile.wash}`}
							>
								<tile.icon
									className={`absolute top-3 left-3.5 z-10 h-6 w-6 ${tile.tint}`}
									aria-hidden
								/>
								<b className="brand-header relative z-10 text-[19px] leading-tight text-gray-100">
									{tile.label}
								</b>
								<small className="relative z-10 text-[12.5px] text-slate-300">
									{tile.subtitle}
								</small>
							</div>
						))}
					</div>
					<div className="grid grid-cols-2 gap-2.5">
						{(
							[
								["Movies", FilmIcon],
								["Shows", TvIcon],
							] as [string, Icon][]
						).map(([name, KeyIcon]) => (
							<span
								key={name}
								className="flex h-12 items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 font-bold text-gray-100"
							>
								<KeyIcon className="h-5 w-5 text-amber-400" aria-hidden />
								{name}
							</span>
						))}
					</div>
					<button
						type="button"
						onClick={() => {
							nav.go("home")
							close()
						}}
						className={`flex h-[54px] cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.04] px-2.5 text-left font-bold text-gray-100 hover:bg-white/[0.08] ${nav.surface === "home" ? "shadow-[inset_0_0_0_1.5px_#fbbf24]" : ""}`}
					>
						<span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827)]">
							<GoodWatchMark size={18} />
						</span>
						Living room
					</button>
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 p-1 font-bold text-gray-100">
						<Avatar />
						<span className="min-w-0 truncate">Alex</span>
						<span className="grow" />
						<span className="flex gap-2 text-[13px] font-medium text-gray-400">
							<span>Wishlist</span>
							<span>Lists</span>
							<span>Settings</span>
						</span>
					</div>
				</div>
			</div>
		</>
	)
}

const Avatar = () => (
	<span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-linear-135 from-amber-400 to-amber-700 text-[15px] font-extrabold text-amber-950">
		A
	</span>
)

const Wordmark = ({ className }: { className: string }) => (
	<span className={`brand-header shrink-0 leading-none ${className}`}>
		Good<span className="text-amber-400">Watch</span>
	</span>
)

export function SiteChrome({
	nav,
	hub,
	setHub,
}: { nav: Nav; hub: boolean; setHub: (open: boolean) => void }) {
	const { surface, words } = nav
	const name = surface === "shows" ? "My shows" : null
	const PageIcon = surface === "shows" ? TvIcon : HomeIcon
	return (
		<>
			<div
				className="fixed inset-x-0 top-0 z-[1001] text-gray-100"
				data-proto-header
			>
				<div className="flex h-16 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950 px-3.5 lg:hidden">
					<Wordmark className="text-[20px]" />
					<span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
						<MagnifyingGlassIcon className="h-4 w-4 shrink-0" aria-hidden />
						<span className="truncate">Search</span>
					</span>
					<Avatar />
				</div>
				<header className="hidden border-b border-white/[0.09] bg-gray-950 lg:block">
					<div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-8">
						<div className="flex items-center gap-[18px]">
							<Wordmark className="text-[30px]" />
							<button
								type="button"
								data-browse
								onClick={() => setHub(!hub)}
								aria-expanded={hub}
								className={`relative flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3.5 font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] ${hub ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.07] text-gray-100 hover:bg-white/[0.1]"}`}
							>
								<Squares2X2Icon className="h-[18px] w-[18px]" aria-hidden />
								{name ?? "Browse"}
								<ChevronDownIcon className="h-4 w-4" aria-hidden />
								<Mark words={words} className="absolute -right-1.5 -top-1.5" />
							</button>
						</div>
						<span
							className="flex h-10 w-[360px] items-center gap-2.5 whitespace-nowrap rounded-xl bg-white/[0.05] px-3 text-sm text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
							aria-hidden
						>
							<MagnifyingGlassIcon className="h-4 w-4" />
							Search titles, people, moods
							<span className="grow" />
							<kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-gray-300">
								Ctrl K
							</kbd>
						</span>
						<div className="flex items-center justify-end gap-[18px]">
							<Thumb nav={nav} />
							<Avatar />
						</div>
					</div>
				</header>
			</div>
			<nav
				aria-label="Site"
				data-proto-dock
				className="fixed inset-x-0 bottom-0 z-[1001] rounded-t-3xl bg-gray-950 text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden"
			>
				<button
					type="button"
					data-hub-key
					onClick={() => setHub(!hub)}
					aria-expanded={hub}
					className="grid h-[72px] w-full cursor-pointer grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 text-left"
				>
					<span className="flex min-w-0 items-center gap-2 justify-self-start">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-amber-400">
							<PageIcon className="h-5 w-5" />
						</span>
						<b className="truncate text-[14px] text-gray-100">
							{name ?? "Living room"}
						</b>
					</span>
					<span
						className={`relative -mt-[26px] flex h-16 w-16 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] ${hub ? "shadow-[0_0_0_2px_#fbbf24,0_0_0_6px_rgba(3,7,18,0.94),0_0_30px_rgba(245,158,11,0.4)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_0_6px_rgba(3,7,18,0.94),0_12px_30px_-6px_rgba(0,0,0,0.9)]"}`}
					>
						<GoodWatchMark size={30} />
						<Mark words={words} className="absolute right-0 top-0" />
					</span>
					<span
						className={`flex h-11 items-center gap-1.5 justify-self-end rounded-full pr-3 pl-4 text-[13.5px] font-bold ${hub ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.08] text-gray-100"}`}
					>
						Go to…
						<ChevronUpIcon className="h-4 w-4" />
					</span>
				</button>
			</nav>
			{hub && <Hub nav={nav} close={() => setHub(false)} />}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The prototype's own controls.

const white =
	"h-9 max-w-[46vw] cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-black"

export function Controls({
	nav,
	set,
	reset,
	hidden,
}: {
	nav: Nav
	set: (next: Record<string, string>) => void
	reset: () => void
	hidden: boolean
}) {
	const { surface, look, row, clears, member } = nav
	const [state, setState] = useState(false)
	// The pill switches the piece that is open on the surface on screen: the signal at home, the waiting rows on My shows.
	const onShows = surface === "shows"
	const keys = Object.keys(onShows ? ROWS : LOOKS)
	const current = onShows ? row : look
	const cycle = (step: number) =>
		set({
			[onShows ? "row" : "signal"]:
				keys[(keys.indexOf(current) + step + keys.length) % keys.length],
		})
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				(e.target as HTMLElement).closest(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			if (e.key === "ArrowLeft") cycle(-1)
			if (e.key === "ArrowRight") cycle(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	if (hidden)
		return (
			<button
				type="button"
				onClick={() => set({ chrome: "" })}
				aria-label="Show the prototype controls"
				data-chrome
				className="fixed bottom-[84px] left-2 z-[1050] h-6 w-6 cursor-pointer rounded-full bg-white text-[10px] font-black text-fuchsia-600 opacity-60 ring-2 ring-fuchsia-500 lg:bottom-3"
			>
				P
			</button>
		)
	return (
		<div
			className="fixed inset-x-2 bottom-[84px] z-[1050] flex flex-col items-start gap-1.5 lg:inset-x-4 lg:bottom-4 lg:flex-row lg:items-end"
			data-chrome
		>
			{state && (
				<div className="absolute bottom-full left-0 mb-2">
					<StatePanel nav={nav} />
				</div>
			)}
			<div className="flex items-center gap-1.5 rounded-xl bg-white/95 p-1 shadow-2xl ring-2 ring-fuchsia-500">
				{(["home", "shows"] as Surface[]).map((s) => (
					<button
						key={s}
						type="button"
						data-surface={s}
						onClick={() => nav.go(s)}
						className={`h-8 cursor-pointer rounded-lg px-2.5 text-xs font-bold ${s === surface ? "bg-fuchsia-600 text-white" : "text-black hover:bg-neutral-200"}`}
					>
						{s === "home" ? "Home" : "My shows"}
					</button>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<select
					aria-label="Sample member"
					value={member}
					onChange={(e) => set({ member: e.target.value })}
					className={white}
				>
					{Object.entries(MEMBERS).map(([key, m]) => (
						<option key={key} value={key}>
							{m.label}
						</option>
					))}
				</select>
				<select
					aria-label="What the signal shows"
					value={look}
					onChange={(e) => set({ signal: e.target.value })}
					className={white}
				>
					{Object.entries(LOOKS).map(([key, name]) => (
						<option key={key} value={key}>
							Signal {name}
						</option>
					))}
				</select>
				<select
					aria-label="When the signal clears"
					value={clears}
					onChange={(e) => set({ clears: e.target.value })}
					className={white}
				>
					{Object.entries(CLEARS).map(([key, name]) => (
						<option key={key} value={key}>
							{name}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={nav.nextDay}
					className={white}
					data-next-day
				>
					Next day ›
				</button>
				<button
					type="button"
					onClick={() => setState((s) => !s)}
					className={`${white} ${state ? "!bg-fuchsia-200" : ""}`}
					data-state-toggle
				>
					State
				</button>
				<button type="button" onClick={reset} className={white}>
					Reset
				</button>
				<button
					type="button"
					onClick={() => set({ chrome: "off" })}
					className={white}
					title="Hide these controls"
				>
					Hide
				</button>
			</div>
			<span className="hidden grow lg:block" />
			<div
				className="flex items-center gap-1 self-center rounded-full bg-white px-1.5 py-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:self-auto lg:text-sm"
				data-switcher
			>
				<button
					type="button"
					onClick={() => cycle(-1)}
					className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200"
					aria-label="Previous variant"
				>
					←
				</button>
				<span className="min-w-48 text-center lg:min-w-64">
					{onShows ? `Waiting row ${ROWS[row]}` : `Signal ${LOOKS[look]}`}
				</span>
				<button
					type="button"
					onClick={() => cycle(1)}
					className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200"
					aria-label="Next variant"
				>
					→
				</button>
			</div>
		</div>
	)
}

const STATUS = {
	watching: "Watching",
	seen: "Seen",
	on_hold: "On hold",
	dropped: "Dropped",
}

/** The full state after every action. */
function StatePanel({ nav }: { nav: Nav }) {
	const { shows, today, lastOpened, signal, clears, look, row, words } = nav
	const any = anyNewOf(shows, today, signal.since)
	return (
		<div
			className="max-h-[62vh] w-[min(94vw,46rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500"
			data-state
		>
			<p>
				<b>Today:</b> {weekdayDate(today, today)} · <b>My shows last opened:</b>{" "}
				{weekdayDate(lastOpened, today)}
			</p>
			<p className="mt-1">
				<b>Signal:</b> {LOOKS[look]} · <b>rule:</b> {CLEARS[clears]} ·{" "}
				<b>waiting row:</b> {ROWS[row]}
			</p>
			<p className="mt-1">
				<b>New since {dateWords(signal.since, today)}:</b> {signal.shows.length}{" "}
				shows, {signal.episodes} episodes · <b>on the navigation:</b>{" "}
				{words ? `${words.badge ?? "a dot"}, "${words.long}"` : "nothing"}
			</p>
			<p className="mt-1">
				<b>By the wider rule</b> (any new episode, also of a show you are behind
				on): {any.length} shows
				{any.length > signal.shows.length &&
					` (adds ${any
						.filter((s) => !signal.shows.some((n) => n.show.id === s.id))
						.map((s) => s.title)
						.join(", ")})`}
			</p>
			<table className="mt-2 w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-black/20">
						<th className="py-1 pr-2">Show</th>
						<th className="pr-2">Status</th>
						<th className="pr-2">Left</th>
						<th className="pr-2">Counts?</th>
						<th className="pr-2">Upcoming</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{shows.map((show) => {
						const facts = factsOf(show, today)
						const counted = countsOf(show, today, signal.since)
						return (
							<tr
								key={show.key}
								className="border-b border-black/10 align-top"
								data-state-row={show.key}
							>
								<td className="py-1 pr-2 font-semibold">{show.title}</td>
								<td className="pr-2">{STATUS[show.status]}</td>
								<td className="pr-2">{facts.left}</td>
								<td className={`pr-2 ${counted.counts ? "font-bold" : ""}`}>
									{counted.counts ? "Yes" : "No"} · {counted.why}
								</td>
								<td className="pr-2">{upcomingOf(facts, today).sentence}</td>
								<td>
									{facts.next && (
										<button
											type="button"
											onClick={() => nav.watch(show.key)}
											className="cursor-pointer whitespace-nowrap rounded bg-fuchsia-100 px-1.5 py-0.5 font-semibold hover:bg-fuchsia-200"
										>
											Watch {episodeCode(facts.next)}
										</button>
									)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

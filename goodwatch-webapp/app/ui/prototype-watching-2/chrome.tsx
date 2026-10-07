// PROTOTYPE - throwaway. Two kinds of chrome for /prototype/watching-2 (#371).
// 1. Part of the design: the site header, the phone dock and the Browse panel, drawn after ui/navigation (SiteHeader,
//    MobileDock, Hub) and laid over the real ones, because the paths to My shows and My films are in them. Tonight's
//    pick is one thumb, or under the home variant "nav" a pair: the Next episode and the film.
// 2. Not part of any design (white, fuchsia ring): the surface, variant and sample member controls and the state panel.
import { ChevronDownIcon, FilmIcon, FingerPrintIcon, HomeIcon, MagnifyingGlassIcon, MapIcon, Squares2X2Icon, TvIcon } from "@heroicons/react/24/solid"
import { BookmarkIcon } from "@heroicons/react/24/solid"
import { type ComponentType, type SVGProps, useEffect, useState } from "react"
import logo from "~/img/goodwatch-logo-white.svg"
import { type Store, ago, code, img, isNew, waitLine } from "~/ui/prototype-watching/model"
import { type Choice, type Facts, type Go, type Pick, SURFACES, type Surface, VARIANTS, hm, pickLine, picksOf, surfaceOf } from "./model"

type Nav = { store: Store; facts: Record<string, Facts>; choice: Choice; surface: Surface; go: Go }

const small = (p: Pick, pair: boolean) => (p.kind === "episode" && p.entry?.next ? (pair ? `Show · ${code(p.entry.next)}` : `Tonight · ${code(p.entry.next)}`) : p.kind === "film" ? (pair ? `Film · ${hm(p.title.runtime)}` : "Tonight") : pair ? "Show · start" : "Tonight")

/** Tonight's pick as a tiny poster, after ui/navigation/bits.tsx. */
function Thumb({ pick, here, onClick, pair, label = true }: { pick: Pick | null; here: boolean; onClick: () => void; pair: boolean; label?: boolean }) {
	const ring = here ? "ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]" : "ring-[1.5px] ring-amber-400/85"
	return (
		<button type="button" onClick={onClick} data-thumb={pick?.kind ?? "none"} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl p-[3px] text-left">
			{pick?.title.poster ? (
				<img src={img(pick.title.poster, "w92")} alt="" className={`h-11 w-[30px] shrink-0 rounded-md object-cover ${ring}`} />
			) : (
				<span className={`flex h-11 w-[30px] shrink-0 items-center justify-center rounded-md bg-gray-800 text-amber-400 ${ring}`}>
					<BookmarkIcon className="h-4 w-4" aria-hidden />
				</span>
			)}
			{label && (
				<span className="flex min-w-0 flex-col leading-[1.15]">
					<small className="whitespace-nowrap text-[11px] font-bold text-amber-400">{pick ? small(pick, pair) : "Tonight"}</small>
					<b className="max-w-[118px] truncate text-[13.5px] text-gray-100">{pick?.title.title ?? "Nothing yet"}</b>
				</span>
			)}
		</button>
	)
}

/** One thumb, or the pair under the home variant that puts the paths in the navigation. */
function Thumbs({ store, facts, choice, surface, go, compact }: Nav & { compact?: boolean }) {
	const p = picksOf(store, facts)
	if (choice.home !== "nav") return <Thumb pick={p.tonight} here={surface === surfaceOf(p.tonight)} pair={false} onClick={() => go(surfaceOf(p.tonight))} />
	const show = p.episode ?? p.start
	return (
		<span className={`flex min-w-0 items-center ${compact ? "gap-0.5" : "gap-2"}`} data-pair>
			<Thumb pick={show} here={surface === "shows"} pair onClick={() => go("shows")} label={!compact} />
			<Thumb pick={p.film} here={surface === "films"} pair onClick={() => go("films")} label={!compact} />
			{compact && (
				<span className="flex min-w-0 flex-col pl-1 leading-[1.15]">
					<small className="whitespace-nowrap text-[11px] font-bold text-amber-400">Tonight</small>
					<b className="whitespace-nowrap text-[12.5px] text-gray-100">Show · Film</b>
				</span>
			)}
		</span>
	)
}

type Tile = { key: string; label: string; line: string; icon: ComponentType<SVGProps<SVGSVGElement>>; to?: Surface; tint: string }

function tilesOf({ store, facts, choice }: Nav): Tile[] {
	const p = picksOf(store, facts)
	const tiles: Tile[] = [
		{ key: "shows", label: "My shows", line: p.episode?.entry?.next ? `${p.episode.title.title} ${code(p.episode.entry.next)} tonight` : "Shows to start", icon: TvIcon, to: "shows", tint: "#38bdf8" },
		{ key: "films", label: "My films", line: p.film ? `${p.film.title.title} tonight` : "Films you want to see", icon: FilmIcon, to: "films", tint: "#f0abfc" },
		{ key: "discover", label: "Discover", line: "Browse and search", icon: MagnifyingGlassIcon, tint: "#34d399" },
		{ key: "taste", label: "Taste", line: "Sides of you", icon: FingerPrintIcon, tint: "#f472b6" },
		{ key: "explorer", label: "Explorer", line: "Islands map", icon: MapIcon, tint: "#a78bfa" },
	]
	if (choice.wishlist === "behind") tiles.push({ key: "wishlist", label: "Wishlist", line: `${store.wishlist.length} you want to see`, icon: BookmarkIcon, to: "wishlist", tint: "#fbbf24" })
	return tiles
}

/** The Browse panel (desktop) and the hub sheet (phone): where Watch next was, My shows and My films are. */
function Hub(nav: Nav & { close: () => void }) {
	const { surface, go, close } = nav
	return (
		<>
			<button type="button" aria-label="Close" onClick={close} className="fixed inset-x-0 bottom-[72px] top-0 z-[1001] cursor-default bg-black/50 lg:bottom-0" />
			<div
				data-hub
				className="fixed inset-x-0 bottom-[72px] z-[1002] rounded-t-3xl bg-gray-950 p-4 text-gray-100 shadow-2xl ring-1 ring-white/10 lg:inset-x-auto lg:bottom-auto lg:left-[max(2rem,calc(50%-36rem))] lg:top-[72px] lg:w-[580px] lg:rounded-3xl"
			>
				<div className="grid grid-cols-2 gap-2 rounded-[26px] bg-black/40 p-2">
					{tilesOf(nav).map((t) => (
						<button
							key={t.key}
							type="button"
							data-hub-tile={t.key}
							onClick={() => {
								if (t.to) go(t.to)
								close()
							}}
							className={`flex cursor-pointer items-center gap-3 rounded-[18px] p-3 text-left ring-1 transition-colors hover:bg-white/10 ${t.to === surface ? "bg-amber-400/10 ring-amber-400/60" : "bg-white/[0.05] ring-white/10"}`}
						>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40" style={{ color: t.tint }}>
								<t.icon className="h-5 w-5" aria-hidden />
							</span>
							<span className="min-w-0">
								<b className="block text-[15px]">{t.label}</b>
								<span className="block truncate text-xs text-gray-400">{t.line}</span>
							</span>
						</button>
					))}
				</div>
				<div className="mt-3 flex items-center gap-2 px-1 text-sm">
					<button
						type="button"
						onClick={() => {
							go("home")
							close()
						}}
						className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-white/[0.06] px-3 font-bold ring-1 ring-white/10 hover:bg-white/10"
					>
						<HomeIcon className="h-4 w-4" aria-hidden />
						Living room
					</button>
					<span className="grow" />
					<span className="whitespace-nowrap text-xs text-gray-500">Catalog:</span>
					<span className="rounded-lg px-2 py-1 font-semibold text-gray-300">Movies</span>
					<span className="rounded-lg px-2 py-1 font-semibold text-gray-300">Shows</span>
				</div>
			</div>
		</>
	)
}

const Avatar = () => <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-rose-500 text-sm font-black text-black">A</span>

export function SiteChrome(nav: Nav) {
	const { surface, go } = nav
	const [hub, setHub] = useState(false)
	const name = surface === "home" ? null : SURFACES[surface]
	return (
		<>
			<div className="fixed inset-x-0 top-0 z-[1001] text-gray-100" data-proto-header>
				<div className="flex h-16 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950 pl-3.5 pr-2.5 lg:hidden">
					<button type="button" onClick={() => go("home")} aria-label="GoodWatch home" className="cursor-pointer">
						<img className="h-[25px] w-auto" src={logo} alt="" />
					</button>
					<span className="brand-header truncate text-[19px]">{name ?? "GoodWatch"}</span>
					<span className="grow" />
					<Avatar />
				</div>
				<header className="hidden border-b border-white/[0.09] bg-gray-950 lg:block">
					<div className="mx-auto flex h-16 max-w-7xl items-center gap-[18px] px-8">
						<button type="button" onClick={() => go("home")} className="flex shrink-0 cursor-pointer items-baseline" aria-label="GoodWatch home">
							<img className="h-7 w-auto" src={logo} alt="" />
							<span aria-hidden className="brand-header ml-0.5 text-4xl text-gray-100">
								oodWatch
							</span>
						</button>
						<button
							type="button"
							data-browse
							onClick={() => setHub(!hub)}
							aria-expanded={hub}
							className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3.5 font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] ${hub ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.07] text-gray-100 hover:bg-white/[0.1]"}`}
						>
							<Squares2X2Icon className="h-[18px] w-[18px]" aria-hidden />
							{name ?? "Browse"}
							<ChevronDownIcon className="h-4 w-4" aria-hidden />
						</button>
						<span className="grow" />
						<span className="flex h-10 w-[300px] items-center gap-2.5 whitespace-nowrap rounded-xl bg-white/[0.05] px-3 text-sm text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" aria-hidden>
							<MagnifyingGlassIcon className="h-4 w-4" />
							Search titles, people, moods
							<span className="grow" />
							<kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-gray-300">Ctrl K</kbd>
						</span>
						<Thumbs {...nav} />
						<Avatar />
					</div>
				</header>
			</div>
			<nav
				aria-label="Site"
				data-proto-dock
				className="fixed inset-x-0 bottom-0 z-[51] grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-t-3xl bg-gray-950 px-3 text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden"
			>
				<span className="min-w-0 justify-self-start">
					<Thumbs {...nav} compact />
				</span>
				<button
					type="button"
					data-hub-key
					onClick={() => setHub(!hub)}
					aria-expanded={hub}
					className={`-mt-[26px] flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] ${hub ? "shadow-[0_0_0_2px_#fbbf24,0_0_0_6px_rgba(3,7,18,0.94)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_0_6px_rgba(3,7,18,0.94),0_12px_30px_-6px_rgba(0,0,0,0.9)]"}`}
				>
					<img src={logo} alt="" className="h-6 w-6" />
					<small className="max-w-[58px] truncate text-[9px] font-bold text-amber-400">{name ?? "Browse"}</small>
				</button>
				<span className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-white/[0.07] ring-1 ring-white/10" aria-hidden>
					<MagnifyingGlassIcon className="h-5 w-5" />
				</span>
			</nav>
			{hub && <Hub {...nav} close={() => setHub(false)} />}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The prototype's own controls.

const white = "h-9 cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-black"

export function Controls({
	nav,
	member,
	members,
	set,
	reset,
	hidden,
}: { nav: Nav; member: string; members: { key: string; label: string }[]; set: (next: Record<string, string>) => void; reset: () => void; hidden: boolean }) {
	const { surface, choice } = nav
	const [state, setState] = useState(false)
	const variants = VARIANTS[surface] as Record<string, string>
	const keys = Object.keys(variants)
	const current = choice[surface] as string
	const cycle = (step: number) => set({ [surface]: keys[(keys.indexOf(current) + step + keys.length) % keys.length] })
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (e.key === "ArrowLeft") cycle(-1)
			if (e.key === "ArrowRight") cycle(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	if (hidden)
		return (
			<button type="button" onClick={() => set({ chrome: "on" })} aria-label="Show the prototype controls" data-chrome className="fixed bottom-[84px] left-2 z-[60] h-6 w-6 cursor-pointer rounded-full bg-white text-[10px] font-black text-fuchsia-600 opacity-60 ring-2 ring-fuchsia-500 lg:bottom-3">
				P
			</button>
		)
	return (
		<div className="fixed inset-x-2 bottom-[84px] z-[60] flex flex-col items-start gap-1.5 lg:inset-x-4 lg:bottom-4 lg:flex-row lg:items-end" data-chrome>
			{state && (
				<div className="absolute bottom-full left-0 mb-2">
					<StatePanel {...nav} />
				</div>
			)}
			<div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/95 p-1 shadow-2xl ring-2 ring-fuchsia-500">
				{(Object.keys(SURFACES) as Surface[]).map((s) => (
					<button key={s} type="button" data-surface={s} onClick={() => set({ surface: s })} className={`h-8 cursor-pointer rounded-lg px-2.5 text-xs font-bold ${s === surface ? "bg-fuchsia-600 text-white" : "text-black hover:bg-neutral-200"}`}>
						{SURFACES[s]}
					</button>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<select aria-label="Sample member" value={member} onChange={(e) => set({ member: e.target.value })} className={white}>
					{members.map((m) => (
						<option key={m.key} value={m.key}>
							{m.label}
						</option>
					))}
				</select>
				<button type="button" onClick={() => setState((s) => !s)} className={`${white} ${state ? "!bg-fuchsia-200" : ""}`} data-state-toggle>
					State
				</button>
				<button type="button" onClick={reset} className={white}>
					Reset
				</button>
				<button type="button" onClick={() => set({ chrome: "off" })} className={white} title="Hide these controls">
					Hide
				</button>
			</div>
			<span className="hidden grow lg:block" />
			<div className="flex items-center gap-1 self-center rounded-full bg-white px-1.5 py-1 text-xs lg:mr-16 font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:self-auto lg:text-sm" data-switcher>
				<button type="button" onClick={() => cycle(-1)} className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200" aria-label="Previous variant">
					←
				</button>
				<span className="min-w-40 text-center lg:min-w-64">
					{SURFACES[surface]} · {variants[current]}
				</span>
				<button type="button" onClick={() => cycle(1)} className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200" aria-label="Next variant">
					→
				</button>
			</div>
		</div>
	)
}

/** The full state after every action. */
function StatePanel({ store, facts, choice }: Nav) {
	const p = picksOf(store, facts)
	const films = store.wishlist.filter((t) => t.type === "movie")
	const shows = store.wishlist.filter((t) => t.type === "show")
	return (
		<div className="max-h-[60vh] w-[min(92vw,32rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500" data-state>
			<p>
				<b>Variants:</b> home {choice.home}, shows {choice.shows}, films {choice.films}, wishlist {choice.wishlist}
			</p>
			<p className="mt-1">
				<b>Tonight's pick:</b> {pickLine(p.tonight)} ({p.tonight?.kind ?? "none"})
			</p>
			<p>
				<b>Continue:</b> {pickLine(p.episode)} · <b>Start:</b> {pickLine(p.start)} · <b>Film:</b> {pickLine(p.film)}
			</p>
			<p className="mt-1">
				<b>Want to See films ({films.length}):</b> {films.map((t) => t.title).join(", ")}
			</p>
			<p className="mt-1">
				<b>Want to See shows ({shows.length}):</b> {shows.map((t) => t.title).join(", ")}
			</p>
			<p className="mt-1">
				<b>Not tonight:</b> {store.passed.map((k) => store.titles[k]?.title).join(", ") || "none"}
			</p>
			<table className="mt-2 w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-black/20">
						<th className="py-1 pr-2">Show</th>
						<th className="pr-2">Stored</th>
						<th className="pr-2">Today</th>
						<th className="pr-2">Next episode</th>
						<th>Last watch</th>
					</tr>
				</thead>
				<tbody>
					{store.entries.map((e) => (
						<tr key={e.show.key} className="border-b border-black/10 align-top">
							<td className="py-1 pr-2 font-semibold">{e.show.title}</td>
							<td className="pr-2">{e.track.status}</td>
							<td className="pr-2">{e.kind}</td>
							<td className="pr-2">{e.next ? `${code(e.next)}${isNew(store.today, e.next) ? " (new)" : ""}` : e.upcoming ? waitLine(e) : "none"}</td>
							<td>{ago(e.track.lastWatch)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

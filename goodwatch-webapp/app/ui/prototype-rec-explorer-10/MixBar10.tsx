// PROTOTYPE - throwaway. Round 10 of the Explorer: the selection (the picked islands, what their combination holds,
// the way to it and back, and letting go), in three forms; and the words for what a combination holds.
import { useEffect, useRef, useState } from "react"
import { Press } from "~/ui/explorer/Tutorial"
import type { MixKind } from "./engine10"

export interface MixSide {
	id: string
	name: string
	color: string
	/** Its group's name ("Mood"). */
	group: string
	/** How many titles the island holds. */
	total: number
	/** TMDB paths of its first posters. */
	posters: string[]
	/** How many titles the other picked islands hold without it; null until known, or alone. */
	without?: number | null
}

export interface MixBarState {
	list: MixSide[]
	/** What the combination holds, or what to do next. */
	status: string
	/** How many titles the combination holds, once known. */
	count: number | null
	/** The combination is up (or rising). */
	up: boolean
	/** Every place is taken: nothing more can join. */
	full: boolean
	/** How many islands combine at most. */
	max: number
	/** Where the view is: on the middle ("hub"), out at the whole world ("all"), or elsewhere (""). */
	at: "hub" | "all" | ""
}

const titles = (count: number) =>
	`${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"}`

/** Two islands of one group, today's bridge: "130 titles in both" or "130 titles between them". */
export const sharedLine10 = (count: number, kind: MixKind) =>
	kind === "both"
		? `${titles(count)} in both`
		: `${titles(count)} between them`

/** Groupings where a title sits on one island only: two of their islands in a combination mean either. */
const ONE_ISLAND = new Set(["decade", "country", "taste"])
const ORDER = ["mood", "style", "taste", "theme", "occasion", "decade", "country"]
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)
const OCCASIONS: Record<string, string> = {
	Party: "for a party",
	Family: "for the family",
	Binge: "for a binge",
	Background: "for the background",
	"Easy watch": "an easy watch",
	"Drop-in": "for dropping in",
}
/** An island as it reads after "titles that are": Funny, about crime, for a party, from the 1990s. */
const phrase = (grouping: string, name: string) =>
	grouping === "theme"
		? `about ${lower(name)}`
		: grouping === "occasion"
			? (OCCASIONS[name] ?? `for ${lower(name)}`)
			: grouping === "decade" || (grouping === "country" && /^United /.test(name))
				? `the ${name}`
				: name

/**
 * A combination of islands from different groups, as a sentence: "15 titles that are Funny, Talky, about crime, from
 * the 1990s, from the United States". Two decades or two countries read "from the 1980s or the 1990s", as the
 * combination holds either.
 */
export function mixSentence10(count: number, sides: readonly MixSide[]) {
	const groups = new Map<string, string[]>()
	for (const s of sides) {
		const grouping = s.id.slice(0, s.id.indexOf(":"))
		const list = groups.get(grouping) ?? []
		list.push(phrase(grouping, s.name))
		groups.set(grouping, list)
	}
	const parts = [...groups]
		.sort((x, y) => ORDER.indexOf(x[0]) - ORDER.indexOf(y[0]))
		.map(([grouping, list]) => {
			const joined = list.join(ONE_ISLAND.has(grouping) ? " or " : " and ")
			return grouping === "decade" || grouping === "country"
				? `from ${joined}`
				: joined
		})
	return `${titles(count)} that are ${parts.join(", ")}`
}

/**
 * What an island would leave of the combination, under its name: every island added narrows it. A second island of
 * the first one's group makes today's bridge instead, and keeps its words.
 */
export const sharedNote10 = (count: number, kind: MixKind, bridge: boolean) =>
	bridge
		? `${count.toLocaleString("en")} ${kind === "both" ? "in both" : "between"}`
		: `${count.toLocaleString("en")} left`

const Cross = ({ className = "h-3 w-3" }: { className?: string }) => (
	<svg viewBox="0 0 12 12" aria-hidden="true" className={className}>
		<path
			d="M2.5 2.5l7 7M9.5 2.5l-7 7"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		/>
	</svg>
)
const Caret = ({ up }: { up: boolean }) => (
	<svg
		viewBox="0 0 12 8"
		aria-hidden="true"
		className={`h-2 w-3 shrink-0 transition-transform ${up ? "rotate-180" : ""}`}
	>
		<path
			d="M1 1.5l5 5 5-5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

const FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
const SURFACE =
	"bg-[#0e1322]/85 ring-1 ring-inset ring-white/15 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,.45)]"

interface MixBarProps {
	state: MixBarState
	phone: boolean
	onDrop: (id: string) => void
	onClear: () => void
	/** Goes to the middle, where the combination is. */
	onGo: () => void
	/** Goes back out to the whole world. */
	onAll: () => void
	/** The tutorial points at a button: on a touch screen with a finger, else with a cursor. */
	nudge?: { at: "combined" | "all" | "separate"; touch: boolean } | null
}

/** The picked islands' colors, overlapping. */
const Dots = ({ list }: { list: MixSide[] }) => (
	<span aria-hidden className="flex shrink-0 items-center">
		{list.map((s, k) => (
			<span
				key={s.id}
				className="h-4 w-4 rounded-full ring-2 ring-[#0e1322]"
				style={{
					background: s.color,
					marginLeft: k ? -6 : 0,
					boxShadow: `0 0 10px ${s.color}`,
				}}
			/>
		))}
	</span>
)

/**
 * One island of the combination, as a row: its first posters, its name and group, and what it does (the others hold
 * 30 titles, with it 15 are left; the bar is how much it keeps).
 */
function Row({
	s,
	count,
	onDrop,
}: {
	s: MixSide
	/** How many titles the combination holds, once known. */
	count: number | null
	onDrop: (id: string) => void
}) {
	// What the island does: of what the others hold, how much it keeps.
	const from = s.without ?? null
	const share = count != null && from ? Math.min(1, count / from) : null
	return (
		<li className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.07]">
			<span
				aria-hidden
				className="flex shrink-0 items-center rounded-lg p-1"
				style={{
					background: `color-mix(in srgb, ${s.color} 22%, transparent)`,
					boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${s.color} 55%, transparent)`,
				}}
			>
				{s.posters.slice(0, 3).map((poster, k) => (
					<img
						key={poster}
						src={`https://image.tmdb.org/t/p/w92${poster}`}
						alt=""
						className="h-11 w-[30px] rounded-[4px] object-cover shadow-[0_2px_8px_rgba(0,0,0,.6)]"
						style={{ marginLeft: k ? -10 : 0, zIndex: 3 - k }}
					/>
				))}
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="flex items-baseline gap-2">
					<span className="truncate text-[15px] font-bold text-white">
						{s.name}
					</span>
					<span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
						{s.group}
					</span>
				</span>
				{/* How much of what the others hold the island keeps. */}
				<span
					aria-hidden
					className="h-1.5 overflow-hidden rounded-full bg-white/10"
				>
					<span
						className="block h-full rounded-full transition-[width] duration-300"
						style={{
							width: `${share == null ? 100 : Math.max(2, Math.min(100, share * 100))}%`,
							background: s.color,
							opacity: share == null ? 0.35 : 1,
						}}
					/>
				</span>
				<span className="text-xs text-indigo-100/60 tabular-nums">
					{s.total.toLocaleString("en")} titles
					{share != null && count != null && from != null && (
						<>
							{" · narrows "}
							<b className="font-bold text-indigo-100/90">
								{from.toLocaleString("en")}
							</b>
							{" to "}
							<b className="font-bold text-[#fff4d6]">
								{count.toLocaleString("en")}
							</b>
						</>
					)}
				</span>
			</span>
			<button
				type="button"
				aria-label={`Let ${s.name} go`}
				onClick={() => onDrop(s.id)}
				className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white ${FOCUS}`}
			>
				<Cross />
			</button>
		</li>
	)
}

/**
 * The selection, in the top bar (on phones in a row of its own under it): a button with the islands' colors and the
 * count, the two views (the combination, the whole world), and Separate. The button opens one row per island.
 */
export function MixBar({
	state,
	phone,
	onDrop,
	onClear,
	onGo,
	onAll,
	nudge,
}: MixBarProps) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const [top, setTop] = useState(0)
	useEffect(() => {
		if (!open) return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [open])
	const view = (at: "hub" | "all", label: string, go: () => void) => {
		const glow = nudge?.at === (at === "hub" ? "combined" : "all")
		return (
			<button
				type="button"
				aria-pressed={state.at === at}
				onClick={go}
				className={`relative flex h-10 items-center rounded-xl ${phone ? "px-2" : "px-3"} text-sm font-bold whitespace-nowrap transition-colors ${FOCUS} ${state.at === at ? "bg-white/[0.18] text-white" : "text-indigo-100/70 hover:text-white"} ${glow ? "ex10-glow" : ""}`}
			>
				{label}
				{glow && nudge && <Press touch={nudge.touch} />}
			</button>
		)
	}
	const many = state.list.length > 1
	return (
		<div
			ref={root}
			// On phones the row spans the screen: the count left, the two views in the middle, Separate right.
			className={`relative flex min-w-0 items-center gap-2 ${phone ? "w-full justify-between" : ""}`}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-label={`Your combination: ${state.list.map((s) => s.name).join(", ")}`}
				onClick={(event) => {
					setTop(event.currentTarget.getBoundingClientRect().bottom + 8)
					setOpen(!open)
				}}
				className={`flex h-12 shrink-0 items-center gap-2 rounded-2xl ${phone ? "px-2.5" : "px-3"} text-[15px] font-bold whitespace-nowrap text-white ${SURFACE} hover:ring-white/30 ${FOCUS}`}
			>
				<Dots list={state.list} />
				<span className={state.count != null ? "text-[#fff4d6]" : ""}>
					{state.count != null
						? phone
							? state.count.toLocaleString("en")
							: titles(state.count)
						: state.up
							? "…"
							: `${state.list.length} of ${state.max}`}
				</span>
				{!phone && <Caret up={open} />}
			</button>
			<fieldset
				aria-label="View"
				className={`flex h-12 shrink-0 items-center gap-0.5 rounded-2xl p-1 ${SURFACE}`}
			>
				{view("hub", "Combined", onGo)}
				{view("all", "Show all", onAll)}
			</fieldset>
			<button
				type="button"
				onClick={onClear}
				className={`relative flex h-12 shrink-0 items-center gap-1.5 rounded-2xl ${phone ? "px-2.5" : "px-3"} text-sm font-bold whitespace-nowrap text-white ${SURFACE} hover:ring-white/30 ${FOCUS} ${nudge?.at === "separate" ? "ex10-glow" : ""}`}
			>
				<Cross />
				{many ? "Separate" : "Let go"}
				{nudge?.at === "separate" && <Press touch={nudge.touch} />}
			</button>
			{open && (
				<div
					className={`z-40 flex flex-col gap-2 rounded-2xl p-3 ${SURFACE} !bg-[#0e1322]/95 ${phone ? "fixed right-3 left-3" : "absolute top-full left-0 mt-2 w-96"}`}
					style={phone ? { top } : undefined}
				>
					<div className="flex items-baseline justify-between gap-3 px-1">
						<h2 className="text-base font-bold text-white">Your combination</h2>
						<span
							className={`text-sm font-bold tabular-nums ${state.count != null ? "text-[#fff4d6]" : "text-indigo-100/60"}`}
						>
							{state.count != null
								? titles(state.count)
								: state.up
									? "Finding titles…"
									: "Pick another island"}
						</span>
					</div>
					<ul className="flex flex-col gap-1.5">
						{state.list.map((s) => (
							<Row key={s.id} s={s} count={state.count} onDrop={onDrop} />
						))}
					</ul>
					{!state.full && (
						<p className="px-1 text-xs text-indigo-100/60">
							{state.max - state.list.length} more can join, from any group.
						</p>
					)}
				</div>
			)}
		</div>
	)
}

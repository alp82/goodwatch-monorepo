// PROTOTYPE - throwaway. Round 10 of the Explorer: the selection (the picked islands, what their combination holds,
// the way to it and back, and letting go), in three forms; and the words for what a combination holds.
import { useEffect, useRef, useState } from "react"
import { Press } from "~/ui/explorer/Tutorial"
import type { MixKind } from "./engine10"

export interface MixSide {
	id: string
	name: string
	color: string
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
const SOFT = "bg-white/[0.08] hover:bg-white/[0.16] text-white"

export type MixForm = keyof typeof MIX_FORMS
/** The selection bar's variants (?variant=<key>). */
export const MIX_FORMS = {
	strip: "One line, names on demand",
	chips: "One line of names",
	inline: "In the top bar",
} as const

interface MixBarProps {
	form: MixForm
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

/** How much the combination holds, short: "77 titles", or how many are picked while there's none. */
const short = (state: MixBarState) =>
	state.count != null
		? titles(state.count)
		: state.up
			? "Finding…"
			: `${state.list.length} of ${state.max}`

/** One button between the two views: it names where it goes. */
function ViewButton({
	state,
	onGo,
	onAll,
	nudge,
	className = "",
}: Pick<MixBarProps, "state" | "onGo" | "onAll" | "nudge"> & {
	className?: string
}) {
	const there = state.at === "hub"
	const glow = nudge && (nudge.at === "all") === there && nudge.at !== "separate"
	return (
		<button
			type="button"
			onClick={there ? onAll : onGo}
			className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap ${SOFT} ${FOCUS} ${glow ? "ex10-glow" : ""} ${className}`}
		>
			<svg viewBox="0 0 14 14" aria-hidden="true" className="h-3 w-3">
				<path
					d={
						there
							? "M2 5.5V2h3.5M2 2l4 4M12 8.5V12H8.5M12 12L8 8"
							: "M8.5 2H12v3.5M12 2L8 6M5.5 12H2V8.5M2 12l4-4"
					}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.7"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			{there ? "Show all" : "Combined"}
			{glow && <Press touch={nudge.touch} />}
		</button>
	)
}

function ClearButton({
	state,
	onClear,
	nudge,
	icon = false,
}: Pick<MixBarProps, "state" | "onClear" | "nudge"> & {
	/** The cross alone. */
	icon?: boolean
}) {
	const glow = nudge?.at === "separate"
	const label = state.list.length > 1 ? "Separate" : "Let go"
	return (
		<button
			type="button"
			onClick={onClear}
			aria-label={icon ? label : undefined}
			title={icon ? label : undefined}
			className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold whitespace-nowrap ${icon ? "w-9" : "px-3"} ${SOFT} ${FOCUS} ${glow ? "ex10-glow" : ""}`}
		>
			<Cross />
			{!icon && label}
			{glow && <Press touch={nudge.touch} />}
		</button>
	)
}

/** A picked island as a chip that lets it go. */
const Chip = ({ s, onDrop }: { s: MixSide; onDrop: (id: string) => void }) => (
	<span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] pl-2.5 pr-1 text-sm font-bold whitespace-nowrap text-white ring-1 ring-inset ring-white/15">
		<span
			aria-hidden
			className="h-2.5 w-2.5 rounded-full"
			style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
		/>
		{s.name}
		<button
			type="button"
			aria-label={`Let ${s.name} go`}
			onClick={() => onDrop(s.id)}
			className={`grid h-6 w-6 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white ${FOCUS}`}
		>
			<Cross className="h-2.5 w-2.5" />
		</button>
	</span>
)

/** The names and what the combination holds, in full: what the short forms open. */
const Details = ({ state, onDrop }: Pick<MixBarProps, "state" | "onDrop">) => (
	<div className="flex flex-col gap-2">
		<div className="flex flex-wrap gap-1.5">
			{state.list.map((s) => (
				<Chip key={s.id} s={s} onDrop={onDrop} />
			))}
		</div>
		<p
			className={`text-sm leading-snug ${state.up ? "font-bold text-[#fff4d6]" : "text-indigo-100/60"}`}
		>
			{state.status}
			{!state.full && (
				<span className="font-normal text-indigo-100/60">
					{" "}
					· {state.max - state.list.length} more can join
				</span>
			)}
		</p>
	</div>
)

/**
 * The selection: what's picked, what it holds, the way to the combination and back, and letting go. Three forms.
 * - strip: one short line under the top bar (colors, the count, the two buttons); the count opens the names.
 * - chips: one line of names, each lets its island go; the count is the button to the combination.
 * - inline: no bar. A small button in the top bar (colors and the count) that opens everything else.
 */
export function MixBar(props: MixBarProps) {
	const { form, state, phone, onDrop, nudge } = props
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const [top, setTop] = useState(0)
	useEffect(() => {
		if (!open || form !== "inline") return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [open, form])

	if (form === "inline") {
		// Closed, the tutorial points at the button that opens the rest.
		const glow = !!nudge && !open
		return (
			<div ref={root} className="relative shrink-0">
				<button
					type="button"
					aria-expanded={open}
					aria-label={`Your combination: ${state.list.map((s) => s.name).join(", ")}`}
					onClick={(event) => {
						setTop(event.currentTarget.getBoundingClientRect().bottom + 8)
						setOpen(!open)
					}}
					className={`relative flex h-12 items-center gap-2 rounded-2xl px-3 text-[15px] font-bold whitespace-nowrap text-white ${SURFACE} hover:ring-white/30 ${FOCUS} ${glow ? "ex10-glow" : ""}`}
				>
					<Dots list={state.list} />
					<span className={state.count != null ? "text-[#fff4d6]" : ""}>
						{phone && state.count != null
							? state.count.toLocaleString("en")
							: short(state)}
					</span>
					{!phone && <Caret up={open} />}
					{glow && <Press touch={nudge.touch} />}
				</button>
				{open && (
					<div
						className={`z-40 flex flex-col gap-3 rounded-2xl p-3 ${SURFACE} ${phone ? "fixed right-3 left-3" : "absolute left-0 mt-2 w-80"}`}
						style={phone ? { top } : undefined}
					>
						<Details state={state} onDrop={onDrop} />
						<div className="flex items-center justify-between gap-2">
							<ViewButton {...props} />
							<ClearButton {...props} />
						</div>
					</div>
				)}
			</div>
		)
	}

	if (form === "chips")
		return (
			<div
				className={`pointer-events-auto mx-auto flex h-12 w-fit max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full px-1.5 ${SURFACE}`}
			>
				<div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
					{state.list.map((s) => (
						<Chip key={s.id} s={s} onDrop={onDrop} />
					))}
				</div>
				{state.up ? (
					<ViewButton
						{...props}
						className={state.count != null ? "!text-[#fff4d6]" : ""}
					/>
				) : (
					<span className="shrink-0 px-2 text-sm whitespace-nowrap text-indigo-100/60">
						{phone ? "+ another" : "pick another island"}
					</span>
				)}
				{state.count != null && (
					<span className="shrink-0 pr-1 text-sm font-bold whitespace-nowrap text-[#fff4d6] tabular-nums">
						{phone ? state.count.toLocaleString("en") : titles(state.count)}
					</span>
				)}
				<ClearButton {...props} icon />
			</div>
		)

	return (
		<div
			className={`pointer-events-auto mx-auto flex w-fit max-w-[calc(100%-24px)] flex-col gap-2 p-1.5 ${open ? "rounded-3xl" : "rounded-full"} ${SURFACE}`}
		>
			<div className="flex h-9 items-center gap-1.5">
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className={`flex h-9 min-w-0 items-center gap-2 rounded-full pr-2.5 pl-2 text-sm font-bold whitespace-nowrap text-white hover:bg-white/[0.08] ${FOCUS}`}
				>
					<Dots list={state.list} />
					<span className={state.count != null ? "text-[#fff4d6]" : ""}>
						{short(state)}
					</span>
					<Caret up={open} />
				</button>
				{state.up && <ViewButton {...props} />}
				<ClearButton {...props} icon={phone} />
			</div>
			{open && (
				<div className="max-w-md px-2 pb-1.5">
					<Details state={state} onDrop={onDrop} />
				</div>
			)}
		</div>
	)
}

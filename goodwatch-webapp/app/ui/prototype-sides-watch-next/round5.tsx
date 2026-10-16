// PROTOTYPE - throwaway (#659, round 5). Six ways to structure the picker for the filters' moods, themes, and styles
// with the member's taste groups, each keeping what is in view small (about 6 to 10 at a time). Every word keeps its
// own color, as the filters show it; a taste group blends the colors of the mood and the theme or style that most set
// it apart. Color says which choice it is, never where a title stands to your taste: a pick shows by its white ring
// and tick, and titles say "Fits your taste" or "Close to your taste".
// - tabs:   Your taste, Moods, Themes, Styles as tabs; one kind in view at a time.
// - steps:  your taste groups and the three kinds first; a group opens the words it carries, a kind opens its words.
// - shelf:  eight for you (your groups, then the words your taste carries), then the three kinds, one open at a time.
// - row:    one row in the strip: your picks, then what narrows them best; All opens every choice by kind.
// - search: a search field over every choice, also by everyday words (dark, space), with eight suggestions.
// - shades: the eleven moods as today; a picked mood opens its shades: your taste in it, then themes and styles.
// Picks combine by Discover's rule: any within a kind, every kind picked (words.server.ts).
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import {
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { MAX_MOODS } from "~/domain/moods"
import type { WatchNextTierSize } from "~/domain/watch-next"
import type { WatchNextTitle } from "~/server/watch-next.server"
import type { MoodControl, MoodGroups } from "~/ui/watch-next/MoodPicker"
import { backdropUrl } from "~/ui/watch-next/style"
import { useParam } from "./bits"
import { TASTE } from "./label"
import type { SwnView, SwnWord, SwnWords } from "./model"
import { KINDS_NAME, WORD_BY_ID, type WordKind, sameGround } from "./words"

/** Round 5's part of the view: always there in the round 5 variants, which are the only callers. */
const wordsOf = (view: SwnView) => view.words as SwnWords
const isGroupId = (id: string) => /^g\d+$/.test(id)
const groupName = (view: SwnView, id: string) =>
	view.groups.find((g) => g.id === id)?.name ?? ""
/** A pick's name: a group's trait name, or the word's. */
export const pickName = (view: SwnView, id: string) =>
	isGroupId(id) ? groupName(view, id) : (WORD_BY_ID[id]?.name ?? id)
const wordOf = (w: SwnWords, id: string) => w.words.find((x) => x.id === id)
const KINDS: WordKind[] = ["mood", "theme", "style"]
type Kind = WordKind | "taste"
const kindOf = (id: string): Kind =>
	isGroupId(id) ? "taste" : WORD_BY_ID[id].kind
const KIND_LINE: Record<Kind, string> = {
	taste: "What you love most",
	mood: "Kinds of evening",
	theme: "What it's about",
	style: "How it's told",
}
const KIND_TITLE: Record<Kind, string> = { taste: TASTE.heading, ...KINDS_NAME }
/** A group without words that set it apart has no colors of its own. */
const NO_HUE = "#6b7280"

/** A choice's colors: a word's own, or a group's two. */
const huesOf = (view: SwnView, id: string) =>
	isGroupId(id)
		? wordsOf(view).blend[id]?.length
			? wordsOf(view).blend[id]
			: [NO_HUE]
		: [WORD_BY_ID[id].hue]
const artOf = (view: SwnView, id: string) =>
	isGroupId(id)
		? (view.groups.find((g) => g.id === id)?.backdrop ?? null)
		: (wordOf(wordsOf(view), id)?.backdrop ?? null)
/** The titles a choice holds on the list. */
const countOf = (view: SwnView, id: string) =>
	isGroupId(id)
		? (view.groups.find((g) => g.id === id)?.count ?? 0)
		: (wordOf(wordsOf(view), id)?.count ?? 0)
/** The titles left with the picks so far and this one. */
const leavesOf = (view: SwnView, id: string) =>
	isGroupId(id)
		? (wordsOf(view).groupLeaves[id] ?? 0)
		: (wordOf(wordsOf(view), id)?.leaves ?? 0)
/**
 * Picking it would narrow the list: something is picked, and none of its kind (a pick of the same kind adds titles,
 * so it shows its own count, as today's moods do).
 */
const narrowsNow = (view: SwnView, id: string) => {
	const picks = wordsOf(view).picks
	return (
		picks.length > 0 &&
		!picks.includes(id) &&
		!picks.some((p) => kindOf(p) === kindOf(id))
	)
}
/** Styles in most of what anyone loves: as a shade or a suggestion they say nothing. */
const NEVER_APART = ["s:music", "s:talky"]

/** What a group is made of: the words it carries most, one per ground ("Crime & mystery", not also "Mystery"). */
function madeOf(view: SwnView, id: string, size = 3) {
	const out: string[] = []
	for (const x of wordsOf(view).carries[id] ?? [])
		if (!out.some((y) => sameGround(x, y))) out.push(x)
	return out.slice(0, size)
}
const madeOfLine = (view: SwnView, id: string) =>
	madeOf(view, id)
		.map((x) => WORD_BY_ID[x].name)
		.join(" · ")

/**
 * What a tap on a choice does, in words: with nothing picked, how many titles it holds; next to a pick of its kind,
 * how many it adds; next to picks of other kinds only, how many are left with it.
 */
function tapLine(view: SwnView, id: string, scope: string) {
	const w = wordsOf(view)
	if (narrowsNow(view, id)) {
		const left = leavesOf(view, id)
		return { text: left ? `${left} with this` : "None with this", none: !left }
	}
	if (w.picks.length && !w.picks.includes(id))
		return {
			text: `Adds ${Math.max(0, leavesOf(view, id) - w.fitting)}`,
			none: false,
		}
	return { text: `${countOf(view, id)} ${scope}`, none: false }
}

/** The words of a kind the list holds: moods in their usual order, themes and styles most titles first. */
const kindIds = (view: SwnView, kind: Kind) => {
	if (kind === "taste") return view.groups.map((g) => g.id)
	const list = wordsOf(view).words.filter((x) => WORD_BY_ID[x.id].kind === kind)
	return (
		kind === "mood" ? list : [...list].sort((a, b) => b.count - a.count)
	).map((x) => x.id)
}

/** Picks and unpicks, in the URL; a fourth pick is refused with the hint. */
export function usePicks(view: SwnView, refuse: (name: string) => void) {
	const set = useParam()
	const toggle = (id: string) => {
		const picks = wordsOf(view).picks
		if (picks.includes(id))
			return set({ pick: picks.filter((p) => p !== id).join(",") || null })
		if (picks.length >= MAX_MOODS) return refuse(pickName(view, id))
		set({ pick: [...picks, id].join(",") })
	}
	const clear = () => set({ pick: null })
	return { toggle, clear }
}
type Picks = ReturnType<typeof usePicks>

/** A starting place from the URL (?tab=, ?step=, ?open=, ?find=), so a link or a screenshot opens there. */
function useStart(name: string) {
	const [params] = useSearchParams()
	return params.get(name)
}

// ---------- the look: colored as the mood tiles are ----------

/**
 * A choice's picture: a title's backdrop washed in its color, as production's mood tiles are. A taste group's wash
 * is split on a diagonal into its two colors (or its one color and a lighter half), so a group reads as a mix of
 * words without taking a third color of its own.
 */
function HueArt({
	hues,
	path,
	split = false,
	className = "",
}: {
	hues: string[]
	path: string | null
	split?: boolean
	className?: string
}) {
	const [a, b = a] = hues
	return (
		<span
			className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
			aria-hidden
		>
			<span className="absolute inset-0" style={{ background: a }} />
			{path && (
				<img
					src={backdropUrl(path, "w300")}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover opacity-85"
				/>
			)}
			<span
				className="absolute inset-0"
				style={{
					background: split
						? `linear-gradient(115deg, ${a}f0 0%, ${a}cc 48%, ${b}${a === b ? "70" : "cc"} 48%, ${b}50 100%)`
						: `linear-gradient(90deg, ${a}f0 0%, ${a}a6 40%, ${a}1f 100%)`,
				}}
			/>
			{/* Scrims behind the name and the count, so white text holds on yellow and on bright pictures. */}
			<span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-black/35 to-transparent" />
			<span className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
		</span>
	)
}

/** A row of small color dots: a kind's colors, or a group's two. */
function Dots({ hues, size = "h-3 w-3" }: { hues: string[]; size?: string }) {
	return (
		<span className="flex shrink-0 -space-x-1" aria-hidden>
			{hues.map((hue, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: two colors can be the same
					key={i}
					className={`${size} rounded-full ring-2 ring-gray-900`}
					style={{ background: hue }}
				/>
			))}
		</span>
	)
}
const kindHues = (view: SwnView, kind: Kind) =>
	kindIds(view, kind)
		.slice(0, 5)
		.map((id) => huesOf(view, id)[0])

function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

const Foot = ({ children }: { children: ReactNode }) => (
	<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">
		{children}
	</span>
)

/**
 * One choice as a mood tile: production's size, picture, tick, and lines, in the choice's own color. With picks
 * made, the count says what picking it would leave.
 */
function ChoiceTile({
	view,
	control,
	picks,
	id,
	dense,
	sub,
	onOpen,
	order,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	id: string
	dense: boolean
	/** The line under the name; a mood's description by default, a group's words. */
	sub?: string | null
	/** Opens the choice instead of picking it ("steps": a group opens what it carries). */
	onOpen?: () => void
	/** Its place in the grid ("shades"). */
	order?: number
}) {
	const w = wordsOf(view)
	const group = isGroupId(id)
	if (!group && !wordOf(w, id)) return null
	const name = pickName(view, id)
	const on = w.picks.includes(id)
	const full = !on && w.picks.length >= MAX_MOODS
	const { text: what, none } = tapLine(view, id, control.countScope)
	const hues = huesOf(view, id)
	const line =
		sub !== undefined
			? sub
			: group
				? madeOfLine(view, id)
				: (WORD_BY_ID[id].description ?? null)
	return (
		<motion.button
			type="button"
			role={onOpen ? "button" : "checkbox"}
			aria-checked={onOpen ? undefined : on}
			aria-pressed={onOpen ? on : undefined}
			aria-disabled={(!onOpen && full) || undefined}
			aria-label={`${name}${group ? `, ${TASTE.inline}` : ""}. ${what}.`}
			data-mood={id}
			onClick={onOpen ?? (() => picks.toggle(id))}
			whileTap={{ scale: full && !onOpen ? 1 : 0.97 }}
			className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "min-h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${(full && !onOpen) || none ? "opacity-40" : ""}`}
			style={{
				boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined,
				order,
			}}
		>
			<HueArt
				hues={hues}
				path={artOf(view, id)}
				split={group}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span
					className={`font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)] ${dense && name.length > 18 ? "line-clamp-3 text-[13px]" : "line-clamp-2 text-[15px]"}`}
				>
					{name}
				</span>
				{onOpen ? (
					<ChevronDownIcon
						className="h-5 w-5 shrink-0 -rotate-90 opacity-80"
						aria-hidden
					/>
				) : none ? null : (
					<Tick on={on} />
				)}
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{line && !dense && (
					<span className="line-clamp-1 text-xs leading-snug text-white/90">
						{line}
					</span>
				)}
				<Foot>{what}</Foot>
			</span>
		</motion.button>
	)
}

/** A choice as a small chip: the strip's picked-mood chip, as a toggle. */
function ChoiceChip({
	view,
	picks,
	id,
	plus = false,
}: {
	view: SwnView
	picks: Picks
	id: string
	/** Shows a plus: a suggestion to add. */
	plus?: boolean
}) {
	const w = wordsOf(view)
	const name = pickName(view, id)
	const on = w.picks.includes(id)
	const full = !on && w.picks.length >= MAX_MOODS
	const narrowing = narrowsNow(view, id)
	const n = narrowing ? leavesOf(view, id) : countOf(view, id)
	const hues = huesOf(view, id)
	const adds = !narrowing && w.picks.length > 0 && !on
	return (
		<motion.button
			layout
			type="button"
			aria-pressed={on}
			aria-disabled={full || undefined}
			aria-label={`${name}${isGroupId(id) ? `, ${TASTE.inline}` : ""}. ${n} ${narrowing ? "with this" : "titles"}.`}
			data-mood={id}
			onClick={() => picks.toggle(id)}
			className={`relative isolate inline-flex h-9 max-w-[20rem] shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl pl-2 pr-2.5 text-sm font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${on ? "ring-2 ring-white" : "ring-1 ring-white/20"} ${full || (narrowing && n === 0) ? "opacity-40" : ""}`}
		>
			<HueArt hues={hues} path={artOf(view, id)} split={isGroupId(id)} />
			{on ? (
				<CheckIcon className="h-4 w-4 shrink-0" aria-hidden />
			) : plus ? (
				<PlusIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
			) : null}
			<span className="truncate">{name}</span>
			<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
				{adds ? `+${Math.max(0, leavesOf(view, id) - w.fitting)}` : n}
			</span>
		</motion.button>
	)
}

/** A pick in the strip, as the picked-mood chips are: picture, name, count, remove. */
function PickChip({
	view,
	control,
	picks,
	id,
	strong = false,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	id: string
	/** A white ring and a tick, as a picked tile has: "row", where suggestions sit next to the picks. */
	strong?: boolean
}) {
	const name = pickName(view, id)
	const hues = huesOf(view, id)
	return (
		<motion.span
			layout
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`relative isolate inline-flex h-9 max-w-[22rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${strong ? "ring-2 ring-white" : "ring-1 ring-white/25"}`}
			style={{ boxShadow: `0 4px 18px -6px ${hues[0]}` }}
			data-pick={id}
		>
			<HueArt hues={hues} path={artOf(view, id)} split={isGroupId(id)} />
			<button
				type="button"
				data-moodbutton
				aria-haspopup="dialog"
				aria-expanded={control.open}
				onClick={() => control.setOpen(!control.open)}
				className={`inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pr-1 ${strong ? "pl-2" : "pl-2.5"}`}
			>
				{strong && <CheckIcon className="-mr-1 h-4 w-4 shrink-0" aria-hidden />}
				<span className="truncate">{name}</span>
				<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
					{countOf(view, id)}
				</span>
			</button>
			<button
				type="button"
				aria-label={`Remove ${name}`}
				onClick={() => picks.toggle(id)}
				className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

/** A heading across the grid. */
function Heading({
	children,
	note,
	action,
}: { children: ReactNode; note?: ReactNode; action?: ReactNode }) {
	return (
		<div className="col-span-full flex min-h-7 items-center gap-2 pt-1 first:pt-0">
			{action}
			<h3 className="text-sm font-bold text-white">{children}</h3>
			{note && <span className="truncate text-sm text-gray-400">{note}</span>}
		</div>
	)
}

function BackButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-ml-1 inline-flex h-8 shrink-0 cursor-pointer items-center gap-0.5 rounded-full pl-1 pr-2.5 text-sm font-semibold text-gray-200 ring-1 ring-white/15 hover:bg-white/10"
		>
			<ChevronLeftIcon className="h-4 w-4" aria-hidden />
			Back
		</button>
	)
}

/** How many picks a kind holds, as a small count. */
function PickedIn({ view, kind }: { view: SwnView; kind: Kind }) {
	const k = wordsOf(view).picks.filter((id) => kindOf(id) === kind).length
	if (!k) return null
	return (
		<span className="rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-black">
			{k}
		</span>
	)
}

/** Your taste first: the groups (up to four), then the words they carry, most of your taste first; then moods. */
function forYou(view: SwnView, size: number) {
	const w = wordsOf(view)
	const groups = view.groups
		.filter((g) => g.count > 0)
		.slice(0, 4)
		.map((g) => g.id)
	const carried = w.words
		.filter((x) => x.groups.length && x.inTaste > 0)
		.sort((a, b) => b.inTaste - a.inTaste)
		.map((x) => x.id)
	const moods = kindIds(view, "mood").sort(
		(a, b) => countOf(view, b) - countOf(view, a),
	)
	return [...new Set([...groups, ...carried, ...moods])].slice(0, size)
}

const FOR_YOU_LINE = "Your taste groups, then the words your taste carries most"
/** In a row that mixes groups and words, a group says it is your taste; a theme or style has no line. */
const mixedSub = (view: SwnView, id: string) =>
	isGroupId(id)
		? `${TASTE.heading} · ${madeOfLine(view, id)}`
		: kindOf(id) === "mood"
			? undefined
			: null

type PickerProps = {
	view: SwnView
	control: MoodControl
	picks: Picks
	dense: boolean
}

// ---------- tabs ----------

function TabsPicker({ view, control, picks, dense }: PickerProps) {
	// "For you" is the taste tab: your groups, then the words your taste carries (so a sparse taste still fills it).
	const tabs: Kind[] = [
		...(view.groups.length ? ["taste" as const] : []),
		...KINDS,
	]
	const start = useStart("tab") as Kind | null
	const [tab, setTab] = useState<Kind>(
		start && tabs.includes(start) ? start : tabs[0],
	)
	return (
		<>
			<div
				role="tablist"
				aria-label="Kinds of choice"
				className="col-span-full flex gap-1 overflow-x-auto rounded-xl bg-black/30 p-1 ring-1 ring-white/10 [scrollbar-width:none]"
			>
				{tabs.map((t) => {
					const on = t === tab
					return (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => setTab(t)}
							className={`flex h-9 flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors ${dense ? "px-1.5 text-[13px]" : "px-3 text-sm"} ${on ? "bg-white/15 text-white ring-1 ring-white/30" : "text-gray-300 hover:bg-white/10"}`}
						>
							{t === "taste" ? "For you" : KIND_TITLE[t]}
							<PickedIn view={view} kind={t} />
						</button>
					)
				})}
			</div>
			{!dense && (
				<p className="col-span-full -mt-1 text-sm text-gray-400">
					{tab === "taste" ? FOR_YOU_LINE : KIND_LINE[tab]}
				</p>
			)}
			{(tab === "taste" ? forYou(view, 8) : kindIds(view, tab)).map((id) => (
				<ChoiceTile
					key={id}
					view={view}
					control={control}
					picks={picks}
					id={id}
					dense={dense}
					sub={mixedSub(view, id)}
				/>
			))}
		</>
	)
}

// ---------- steps ----------

/** A kind as a tile: its colors side by side, what it holds, and how many of it are picked. */
function KindTile({
	view,
	kind,
	dense,
	onClick,
}: { view: SwnView; kind: WordKind; dense: boolean; onClick: () => void }) {
	const hues = kindIds(view, kind).map((id) => huesOf(view, id)[0])
	const n = kindIds(view, kind).length
	return (
		<button
			type="button"
			data-mood={kind}
			onClick={onClick}
			aria-label={`${KINDS_NAME[kind]}: ${KIND_LINE[kind]}, ${n}`}
			className={`relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white ring-1 ring-white/12 hover:ring-white/30 ${dense ? "min-h-[4.75rem]" : "h-[6.5rem] md:h-28"}`}
		>
			{/* Its colors as even bands, darkened: every color it holds, none taking over. */}
			<span
				className="absolute inset-0 -z-10"
				style={{
					background: `linear-gradient(90deg, ${hues.map((h, i) => `${h} ${(i * 100) / hues.length}% ${((i + 1) * 100) / hues.length}%`).join(", ")})`,
				}}
				aria-hidden
			/>
			<span
				className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950/95 via-gray-950/75 to-gray-950/45"
				aria-hidden
			/>
			<span className="flex items-start justify-between gap-2">
				<span className="text-[15px] font-bold leading-tight">
					{KINDS_NAME[kind]}
				</span>
				<span className="flex items-center gap-1">
					<PickedIn view={view} kind={kind} />
					<ChevronDownIcon
						className="h-5 w-5 -rotate-90 opacity-80"
						aria-hidden
					/>
				</span>
			</span>
			<span className="block">
				{!dense && (
					<span className="line-clamp-1 text-xs text-white/90">
						{kindIds(view, kind)
							.slice(0, 3)
							.map((id) => pickName(view, id))
							.join(", ")}
						, and more
					</span>
				)}
				<Foot>{n} to pick from</Foot>
			</span>
		</button>
	)
}

function StepsPicker({ view, control, picks, dense }: PickerProps) {
	const w = wordsOf(view)
	const [step, setStep] = useState<string | null>(useStart("step"))
	const tile = (id: string, sub?: string | null) => (
		<ChoiceTile
			key={id}
			view={view}
			control={control}
			picks={picks}
			id={id}
			dense={dense}
			sub={sub}
		/>
	)
	if (step && isGroupId(step) && view.groups.some((g) => g.id === step)) {
		const carried = madeOf(view, step, 7).filter((id) => wordOf(w, id))
		return (
			<>
				<Heading
					action={<BackButton onClick={() => setStep(null)} />}
					note={dense ? null : "All of it, or narrow it by what it's made of"}
				>
					{groupName(view, step)}
				</Heading>
				{tile(step, "All of it")}
				{carried.map((id) => tile(id, null))}
			</>
		)
	}
	if (step && KINDS.includes(step as WordKind))
		return (
			<>
				<Heading
					action={<BackButton onClick={() => setStep(null)} />}
					note={dense ? null : KIND_LINE[step as WordKind]}
				>
					{KINDS_NAME[step as WordKind]}
				</Heading>
				{kindIds(view, step as WordKind).map((id) =>
					tile(id, step === "mood" ? undefined : null),
				)}
			</>
		)
	return (
		<>
			{view.groups.length > 0 && (
				<Heading note={dense ? null : "Open one to narrow it"}>
					{TASTE.heading}
				</Heading>
			)}
			{view.groups.map((g) => (
				<ChoiceTile
					key={g.id}
					view={view}
					control={control}
					picks={picks}
					id={g.id}
					dense={dense}
					onOpen={() => {
						if (!w.picks.includes(g.id)) picks.toggle(g.id)
						setStep(g.id)
					}}
				/>
			))}
			<Heading>Or pick by kind</Heading>
			{KINDS.map((k) => (
				<KindTile
					key={k}
					view={view}
					kind={k}
					dense={dense}
					onClick={() => setStep(k)}
				/>
			))}
		</>
	)
}

// ---------- shelf ----------

function ShelfPicker({ view, control, picks, dense }: PickerProps) {
	const start = useStart("open") as WordKind | null
	const [open, setOpen] = useState<WordKind | null>(
		start && KINDS.includes(start) ? start : null,
	)
	return (
		<>
			<Heading note={dense ? null : FOR_YOU_LINE}>For you</Heading>
			{forYou(view, 8).map((id) => (
				<ChoiceTile
					key={id}
					view={view}
					control={control}
					picks={picks}
					id={id}
					dense={dense}
					sub={mixedSub(view, id)}
				/>
			))}
			<Heading>Everything else</Heading>
			{KINDS.map((k) => {
				const on = open === k
				const ids = kindIds(view, k)
				return (
					<div key={k} className="col-span-full">
						<button
							type="button"
							aria-expanded={on}
							onClick={() => setOpen(on ? null : k)}
							className={`flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 transition-colors ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
						>
							<Dots hues={kindHues(view, k)} />
							<span>{KINDS_NAME[k]}</span>
							<span className="font-normal text-gray-400">
								{ids.length}
								<span className="hidden sm:inline">
									{" "}
									· {KIND_LINE[k].toLowerCase()}
								</span>
							</span>
							<span className="ml-auto flex items-center gap-2">
								<PickedIn view={view} kind={k} />
								<ChevronDownIcon
									className={`h-4 w-4 opacity-70 transition-transform ${on ? "rotate-180" : ""}`}
									aria-hidden
								/>
							</span>
						</button>
						{on && (
							<div
								className={`mt-2 grid gap-2 ${dense ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}
							>
								{ids.map((id) => (
									<ChoiceTile
										key={id}
										view={view}
										control={control}
										picks={picks}
										id={id}
										dense={dense}
										sub={k === "mood" ? undefined : null}
									/>
								))}
							</div>
						)}
					</div>
				)
			})}
		</>
	)
}

// ---------- row ----------

/**
 * What the row suggests: with nothing picked, your groups and then the moods with most titles; with picks, what
 * narrows them best (another kind, leaving some), your groups first.
 */
function rowSuggestions(view: SwnView, size: number) {
	const w = wordsOf(view)
	if (w.picks.length >= MAX_MOODS) return []
	if (!w.picks.length)
		return forYou(view, size).filter(
			(id) => kindOf(id) === "taste" || kindOf(id) === "mood",
		)
	const picked = new Set(w.picks.map(kindOf))
	const now = view.data.fitting
	const candidates = [
		...view.groups.map((g) => g.id),
		...w.words.map((x) => x.id),
	].filter((id) => {
		if (w.picks.includes(id) || picked.has(kindOf(id))) return false
		if (NEVER_APART.includes(id)) return false
		if (
			w.picks.some((p) => !isGroupId(p) && !isGroupId(id) && sameGround(p, id))
		)
			return false
		const left = leavesOf(view, id)
		return left > 0 && left < now
	})
	return candidates
		.sort(
			(a, b) =>
				Number(isGroupId(b)) - Number(isGroupId(a)) ||
				leavesOf(view, b) - leavesOf(view, a),
		)
		.slice(0, size)
}

/** The row: picks, then suggestions, then All (desktop) or nothing more (phones use the Moods button). */
export function Row({
	view,
	control,
	picks,
	buttonRef,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	buttonRef?: RefObject<HTMLButtonElement>
}) {
	const w = wordsOf(view)
	const all = view.groups.length + w.words.length
	// In the strip (with its All button) the row wraps; on phones it scrolls sideways, the last chip cut off.
	return (
		<div
			className={`flex min-w-0 flex-1 items-center gap-1.5 ${buttonRef ? "flex-wrap" : "-my-1 overflow-x-auto py-1 [scrollbar-width:none]"}`}
			// biome-ignore lint/a11y/useSemanticElements: a fieldset can't scroll sideways as a flex row
			role="group"
			aria-label="Picks and suggestions"
		>
			{w.picks.map((id) => (
				<PickChip
					key={id}
					view={view}
					control={control}
					picks={picks}
					id={id}
					strong
				/>
			))}
			{w.picks.length > 0 && rowSuggestions(view, 6).length > 0 && (
				<span className="shrink-0 pl-1 text-xs font-semibold text-gray-400">
					Narrow
				</span>
			)}
			{rowSuggestions(view, w.picks.length ? 6 : 8).map((id) => (
				<ChoiceChip key={id} view={view} picks={picks} id={id} plus />
			))}
			{
				<button
					ref={buttonRef}
					type="button"
					data-moodbutton={buttonRef ? true : undefined}
					aria-haspopup="dialog"
					aria-expanded={buttonRef ? control.open : undefined}
					onClick={() =>
						buttonRef
							? control.setOpen(!control.open)
							: // Phones: every choice is in the Moods drawer, which the slab's button owns.
								document
									.querySelector<HTMLButtonElement>(
										'button[aria-label^="Moods"]',
									)
									?.click()
					}
					className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20 ${control.open ? "bg-white/15" : "bg-white/10"}`}
				>
					All {all}
					<ChevronDownIcon
						className={`h-4 w-4 opacity-70 transition-transform ${buttonRef && control.open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
			}
		</div>
	)
}

/** Every choice, by kind, as chips: the row's All, and the phone's drawer. */
function AllByKind({ view, picks, dense }: PickerProps) {
	const kinds: Kind[] = [
		...(view.groups.length ? ["taste" as const] : []),
		...KINDS,
	]
	return (
		<>
			{kinds.map((k) => (
				<div key={k} className="col-span-full">
					<Heading note={dense ? null : KIND_LINE[k]}>{KIND_TITLE[k]}</Heading>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{kindIds(view, k).map((id) => (
							<ChoiceChip key={id} view={view} picks={picks} id={id} />
						))}
					</div>
				</div>
			))}
		</>
	)
}

// ---------- search ----------

/** Everyday words a choice is found by, besides its name. Lower case. */
const ALSO: Record<string, string> = {
	"m:funny": "comedy laugh humor humour silly slapstick absurd witty",
	"m:feelgood": "uplifting hopeful warm cozy happy wholesome heartwarming",
	"m:romance": "love romantic date",
	"m:action": "fight explosions adrenaline chase thrill",
	"m:scary": "horror creepy frightening terror spooky",
	"m:crime": "thriller detective whodunit heist murder police noir",
	"m:mind": "twist trippy surreal psychological puzzle weird psychedelic",
	"m:heavy": "dark sad bleak intense tragic serious drama",
	"m:worlds": "fantasy sci-fi science fiction space magic alien",
	"m:history": "period historical biopic past",
	"m:growing": "teen youth school growing",
	"t:crime": "gangster mafia heist criminal",
	"t:mystery": "whodunit detective puzzle",
	"t:war": "battle soldier military",
	"t:politics": "power government election",
	"t:true": "biopic real based",
	"t:history": "historical period costume past",
	"t:family": "kids parents siblings",
	"t:mind": "mental madness mind",
	"t:showbiz": "hollywood fame actors",
	"t:sports": "sport football boxing game",
	"t:money": "wealth business rich greed",
	"t:future": "sci-fi science fiction dystopia space robots",
	"t:fantasy": "magic dragons myth fairy",
	"s:animated": "animation cartoon anime",
	"s:documentary": "doc docs real",
	"s:spectacle": "epic visual blockbuster",
	"s:stylized": "artsy arthouse stylish visual",
	"s:music": "musical songs soundtrack",
	"s:slow": "quiet contemplative meditative calm",
	"s:fast": "pacey quick rapid",
	"s:talky": "dialogue conversation chatty",
	"s:nonlinear": "twist flashbacks puzzle time",
	"s:graphic": "violent gore gory brutal explicit",
}

/** The choices a search finds: every word typed starts a word in the name (first) or the everyday words. */
function find(view: SwnView, q: string) {
	const typed = q
		.toLowerCase()
		.split(/[\s,]+/)
		.filter(Boolean)
	if (!typed.length) return []
	const starts = (text: string) => {
		const words = text.toLowerCase().split(/[^a-z0-9-]+/)
		return typed.every((t) => words.some((x) => x.startsWith(t)))
	}
	const ids = [
		...view.groups.map((g) => g.id),
		...wordsOf(view).words.map((x) => x.id),
	]
	const byName = ids.filter((id) => starts(pickName(view, id)))
	const byAlso = ids.filter(
		(id) =>
			!byName.includes(id) && starts(`${pickName(view, id)} ${ALSO[id] ?? ""}`),
	)
	return [...byName, ...byAlso]
}

function SearchPicker({ view, control, picks, dense }: PickerProps) {
	const [q, setQ] = useState(useStart("find") ?? "")
	const [browse, setBrowse] = useState<WordKind | null>(null)
	const tile = (id: string) => (
		<ChoiceTile
			key={id}
			view={view}
			control={control}
			picks={picks}
			id={id}
			dense={dense}
			sub={mixedSub(view, id)}
		/>
	)
	const found = find(view, q)
	const kinds: Kind[] = ["taste", ...KINDS]
	return (
		<>
			<label className="relative col-span-full block">
				<span className="sr-only">
					Search moods, themes, styles, and your taste
				</span>
				<MagnifyingGlassIcon
					className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
					aria-hidden
				/>
				<input
					type="search"
					value={q}
					data-mood={dense ? undefined : "search"}
					onChange={(e) => {
						setQ(e.target.value)
						setBrowse(null)
					}}
					placeholder="Try dark, space, slow, or funny"
					className="h-11 w-full rounded-xl bg-black/40 pl-10 pr-3 text-base text-white ring-1 ring-white/15 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/60"
				/>
			</label>
			{q.trim() ? (
				found.length ? (
					kinds.map((k) => {
						const ids = found.filter((id) => kindOf(id) === k)
						if (!ids.length) return null
						return [
							<Heading key={`h-${k}`}>{KIND_TITLE[k]}</Heading>,
							...ids.map(tile),
						]
					})
				) : (
					<p className="col-span-full py-2 text-sm text-gray-300">
						Nothing goes by “{q.trim()}”. Try dark, space, or funny.
					</p>
				)
			) : browse ? (
				<>
					<Heading
						action={<BackButton onClick={() => setBrowse(null)} />}
						note={dense ? null : KIND_LINE[browse]}
					>
						{KINDS_NAME[browse]}
					</Heading>
					{kindIds(view, browse).map(tile)}
				</>
			) : (
				<>
					<Heading note={dense ? null : FOR_YOU_LINE}>
						Suggested for you
					</Heading>
					{forYou(view, 8).map(tile)}
					<div className="col-span-full flex flex-wrap items-center gap-1.5 pt-1">
						<span className="mr-1 text-sm text-gray-400">Or browse</span>
						{KINDS.map((k) => (
							<button
								key={k}
								type="button"
								onClick={() => setBrowse(k)}
								className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/5 px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/10"
							>
								<Dots hues={kindHues(view, k).slice(0, 3)} size="h-2.5 w-2.5" />
								{KINDS_NAME[k]}
								<span className="font-normal text-gray-400">
									{kindIds(view, k).length}
								</span>
								<PickedIn view={view} kind={k} />
							</button>
						))}
					</div>
				</>
			)}
		</>
	)
}

// ---------- shades ----------

/** A picked mood's shades: your groups in it, then the themes and styles that narrow it, most titles first. */
function shadesOf(view: SwnView) {
	const w = wordsOf(view)
	const moods = w.picks.filter((id) => kindOf(id) === "mood")
	const now = view.data.fitting
	const narrows = (id: string) => {
		if (w.picks.includes(id)) return true
		const left = leavesOf(view, id)
		return left > 0 && left < now
	}
	const taste = view.groups
		.map((g) => g.id)
		.filter(
			(id) =>
				w.picks.includes(id) ||
				(moods.some((m) => (w.carries[id] ?? []).includes(m)) && narrows(id)),
		)
	const words = w.words
		.map((x) => x.id)
		.filter(
			(id) =>
				kindOf(id) !== "mood" &&
				!NEVER_APART.includes(id) &&
				!moods.some((m) => sameGround(m, id)) &&
				narrows(id),
		)
		.sort(
			(a, b) =>
				Number(w.picks.includes(b)) - Number(w.picks.includes(a)) ||
				leavesOf(view, b) - leavesOf(view, a),
		)
		.slice(0, 6)
	return { moods, taste, words }
}

function ShadesPicker({ view, control, picks, dense }: PickerProps) {
	const { moods, taste, words } = shadesOf(view)
	const ids = kindIds(view, "mood")
	// The box goes right under the row that holds the last mood picked: read the grid's columns, then order.
	const ref = useRef<HTMLDivElement>(null)
	const [cols, setCols] = useState(4)
	useLayoutEffect(() => {
		const grid = ref.current?.parentElement
		if (!grid) return
		const read = () =>
			setCols(getComputedStyle(grid).gridTemplateColumns.split(" ").length)
		read()
		const observer = new ResizeObserver(read)
		observer.observe(grid)
		return () => observer.disconnect()
	}, [moods.length > 0])
	const last = ids.indexOf(moods[moods.length - 1] ?? "")
	const rowEnd = (Math.floor(Math.max(0, last) / cols) + 1) * cols - 1
	return (
		<>
			{ids.map((id, i) => (
				<ChoiceTile
					key={id}
					view={view}
					control={control}
					picks={picks}
					id={id}
					dense={dense}
					order={2 * i}
				/>
			))}
			{moods.length ? (
				<div
					ref={ref}
					className="col-span-full rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10"
					// On phones the shades come first, so a pick shows what it opened without scrolling.
					style={{ order: dense ? -1 : 2 * rowEnd + 1 }}
				>
					<p className="mb-2 text-sm text-gray-300">
						<span className="font-semibold text-white">
							Shades of {moods.map((m) => pickName(view, m)).join(" or ")}
						</span>
						<span className="hidden sm:inline">. Each narrows it.</span>
					</p>
					{taste.length > 0 && (
						<div
							className={`mb-2.5 grid gap-2 ${dense ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}
						>
							{taste.map((id) => (
								<ChoiceTile
									key={id}
									view={view}
									control={control}
									picks={picks}
									id={id}
									dense
								/>
							))}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="w-full text-xs font-semibold text-gray-400 sm:w-auto sm:pr-1">
							Themes and styles
						</span>
						{words.map((id) => (
							<ChoiceChip key={id} view={view} picks={picks} id={id} />
						))}
					</div>
				</div>
			) : (
				<p
					className="col-span-full text-sm text-gray-400"
					style={{ order: 99 }}
				>
					Pick a mood to see its shades, your taste among them.
				</p>
			)}
		</>
	)
}

/** The dropdown's line after its title: what another pick would do, by kind. */
function pickHint(view: SwnView) {
	const w = wordsOf(view)
	if (!w.picks.length) return ". Mix moods, themes, styles, and your taste."
	const one: Record<Kind, string> = {
		taste: "taste group",
		mood: "mood",
		theme: "theme",
		style: "style",
	}
	const picked = [...new Set(w.picks.map(kindOf))]
	const others = (["taste", ...KINDS] as Kind[]).filter(
		(k) => !picked.includes(k),
	)
	const list = (names: string[], join: string) =>
		names.length > 1
			? `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} ${join} ${names[names.length - 1]}`
			: names[0]
	return `. Another ${list(
		picked.map((k) => one[k]),
		"or",
	)} adds titles; a ${list(
		others.map((k) => one[k]),
		"or",
	)} narrows them.`
}

// ---------- the control ----------

/** The mood control's round 5 parts: the picks as colored chips, the variant's picker, and the row. */
export function round5Control(
	view: SwnView,
	base: MoodControl,
	picks: Picks,
): MoodControl {
	const w = wordsOf(view)
	const control: MoodControl = { ...base, moods: [], clear: picks.clear }
	const props = (dense: boolean) => ({ view, control, picks, dense })
	const Picker = {
		tabs: TabsPicker,
		steps: StepsPicker,
		shelf: ShelfPicker,
		row: AllByKind,
		search: SearchPicker,
		shades: ShadesPicker,
	}[view.variant as "tabs"]
	const groups: MoodGroups = {
		picked: w.picks.length,
		narrowing: w.picks.length > 0,
		chips: (
			<>
				{w.picks.map((id) => (
					<PickChip
						key={id}
						view={view}
						control={control}
						picks={picks}
						id={id}
					/>
				))}
			</>
		),
		head: "Pick up to three",
		sub: pickHint(view),
		short: w.picks.length
			? `${pickName(view, w.picks[0])}${w.picks.length > 1 ? ` +${w.picks.length - 1}` : ""}`
			: null,
		grid: (dense) => <Picker {...props(dense)} />,
	}
	if (view.variant === "row")
		groups.row = (buttonRef) => (
			<Row view={view} control={control} picks={picks} buttonRef={buttonRef} />
		)
	control.groups = groups
	return control
}

// ---------- what the page says ----------

/** The line above the hero: "Best match for Funny or Feel-good and Slow burn tonight". */
export function round5Phrase(view: SwnView): string | null {
	const w = view.words
	if (!w?.picks.length) return null
	const kinds: Kind[] = ["taste", ...KINDS]
	return kinds
		.map((k) =>
			w.picks
				.filter((id) => kindOf(id) === k)
				.map((id) => pickName(view, id))
				.join(" or "),
		)
		.filter(Boolean)
		.join(" and ")
}

/** Under a poster: "Fits your taste" or "Close to your taste", where a taste group is picked. */
export function badgeMark(view: SwnView) {
	const w = view.words
	if (!w) return undefined
	return (title: WatchNextTitle, size: WatchNextTierSize) => {
		const badge = w.badges[title.key]
		if (!badge) return null
		// The smaller posters' own line says why a title misses; a badge only goes where it says something more.
		if ((size === "md" || size === "sm") && view.misfits[title.key]) return null
		// With a group picked, every title that fits is in it: saying so on each adds nothing.
		if (badge === "fits") return null
		return (
			<span
				className={`mt-1 flex items-start gap-1 px-1 text-xs leading-tight text-gray-400 ${size === "md" || size === "sm" ? "" : "truncate"}`}
			>
				{TASTE.close}
			</span>
		)
	}
}

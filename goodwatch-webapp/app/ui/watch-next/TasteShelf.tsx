// The taste picker's shelf (#677, decided in #659): what the mood dropdown and the phone's drawer hold. "For you"
// first (the member's taste groups, then the words their taste carries most), after a pick a "Narrow it" row of
// choices from other kinds that would leave fewer titles, then Moods, Themes, and Styles folded, one open at a time.
//
// Every word keeps its own color, as the filters show it; a taste group is split on a diagonal into the two colors
// that most set it apart. Color says which choice it is, never where a title stands to your taste: a pick shows by
// its white ring and tick. Each tile says what a tap does: how many titles it holds, how many it adds next to a pick
// of its kind, or how many are left with it next to picks of other kinds.
import {
	CheckIcon,
	ChevronDownIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { MOOD_KEYS } from "~/domain/moods"
import {
	type ChoiceKind,
	MAX_PICKS,
	WORD_BY_ID,
	WORD_KINDS,
	type WordKind,
	groupNumber,
	kindOf,
} from "~/domain/taste-picker"
import type { WatchNext } from "~/server/watch-next.server"
import type { MoodControl } from "./MoodPicker"
import { pickName } from "./labels"
import { backdropUrl } from "./style"

type Picker = WatchNext["picker"]

const KIND_TITLE: Record<WordKind, string> = {
	mood: "Moods",
	theme: "Themes",
	style: "Styles",
}
const KIND_LINE: Record<WordKind, string> = {
	mood: "kinds of evening",
	theme: "what it's about",
	style: "how it's told",
}
/** A taste group with no words that set it apart has no colors of its own. */
const NO_HUE = "#6b7280"

const choiceOf = (picker: Picker, id: string) =>
	picker.choices.find((c) => c.id === id)
const groupOf = (picker: Picker, id: string) =>
	picker.groups.find((g) => g.id === id)

/** A choice's colors: a word's own, or a taste group's one or two. */
export function choiceHues(picker: Picker, id: string): string[] {
	if (groupNumber(id) === null) return [WORD_BY_ID[id]?.hue ?? NO_HUE]
	const hues = groupOf(picker, id)?.hues ?? []
	return hues.length ? hues : [NO_HUE]
}

/** The choices of a kind the list holds: moods in their usual order, themes and styles most titles first. */
function kindIds(picker: Picker, kind: WordKind): string[] {
	const ids = picker.choices
		.filter((c) => kindOf(c.id) === kind)
		.map((c) => c.id)
	if (kind === "mood")
		return MOOD_KEYS.map((m) => `m:${m}`).filter((id) => ids.includes(id))
	return ids.sort(
		(a, b) =>
			(choiceOf(picker, b)?.count ?? 0) - (choiceOf(picker, a)?.count ?? 0),
	)
}

/** Picking it would narrow the list: something is picked, and nothing of its kind. */
function narrows(picker: Picker, id: string) {
	return (
		picker.picks.length > 0 &&
		!picker.picks.includes(id) &&
		!picker.picks.some((p) => kindOf(p) === kindOf(id))
	)
}

/** What a tap on a choice does, in words; `none` when it would leave nothing. */
function tapLine(control: MoodControl, id: string) {
	const { picker } = control
	const choice = choiceOf(picker, id)
	const count = choice?.count ?? 0
	const leaves = choice?.leaves ?? 0
	if (narrows(picker, id))
		return {
			text: leaves ? `${leaves} with this` : "None with this",
			short: leaves,
			none: !leaves,
		}
	if (picker.picks.length && !picker.picks.includes(id)) {
		const adds = Math.max(0, leaves - picker.fitting)
		return { text: `Adds ${adds}`, short: `+${adds}`, none: false }
	}
	return { text: `${count} ${control.countScope}`, short: count, none: false }
}

/** The line under a tile's name: a mood's description, a taste group's words (with "Your taste" where kinds mix). */
function tileLine(picker: Picker, id: string, mixed: boolean): string | null {
	const group = groupOf(picker, id)
	if (group) {
		const words = group.madeOf.map((w) => WORD_BY_ID[w]?.name).join(" · ")
		return mixed ? `Your taste${words ? ` · ${words}` : ""}` : words || null
	}
	return WORD_BY_ID[id]?.description ?? null
}

/**
 * A choice's picture: one of its titles' backdrops washed in its color, as the mood tiles have always been. A taste
 * group's wash is split on a diagonal into its two colors (or its one color and a lighter half).
 */
export function ChoiceArt({
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

/** One choice as a poster tile, a checkbox. A fourth pick stays focusable and is refused with the hint. */
function ChoiceTile({
	control,
	id,
	dense,
	mixed = false,
}: {
	control: MoodControl
	id: string
	dense: boolean
	/** In a row that mixes kinds ("For you"): a taste group says it is your taste. */
	mixed?: boolean
}) {
	const { picker } = control
	const name = pickName(picker, id)
	const on = picker.picks.includes(id)
	const full = !on && picker.picks.length >= MAX_PICKS
	const tap = tapLine(control, id)
	const hues = choiceHues(picker, id)
	const line = tileLine(picker, id, mixed)
	const group = groupNumber(id) !== null
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, with the tile's picture and lines inside
			role="checkbox"
			aria-checked={on}
			aria-disabled={full || undefined}
			aria-label={`${name}${group ? ", your taste" : ""}. ${line && !group ? `${line} ` : ""}${tap.text}.`}
			data-choice={id}
			onClick={() => control.toggle(id)}
			whileTap={{ scale: full ? 1 : 0.97 }}
			className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "min-h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full || tap.none ? "opacity-40" : ""}`}
			style={{ boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined }}
		>
			<ChoiceArt
				hues={hues}
				path={choiceOf(picker, id)?.picture ?? null}
				split={group}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span
					className={`font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)] ${dense && name.length > 18 ? "line-clamp-3 text-[13px]" : "line-clamp-2 text-[15px]"}`}
				>
					{name}
				</span>
				{!tap.none && <Tick on={on} />}
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{line && !dense && (
					<span className="line-clamp-1 text-xs leading-snug text-white/90">
						{line}
					</span>
				)}
				<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">
					{tap.text}
				</span>
			</span>
		</motion.button>
	)
}

/** A choice as a small chip with a plus: a "Narrow it" suggestion. */
function SuggestionChip({ control, id }: { control: MoodControl; id: string }) {
	const { picker } = control
	const name = pickName(picker, id)
	const tap = tapLine(control, id)
	const group = groupNumber(id) !== null
	return (
		<button
			type="button"
			aria-label={`Add ${name}${group ? ", your taste" : ""}. ${tap.text}.`}
			data-choice={id}
			onClick={() => control.toggle(id)}
			className="relative isolate inline-flex h-9 max-w-[20rem] shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl pl-2 pr-2.5 text-sm font-bold text-white ring-1 ring-white/20 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] hover:ring-white/50"
		>
			<ChoiceArt
				hues={choiceHues(picker, id)}
				path={choiceOf(picker, id)?.picture ?? null}
				split={group}
			/>
			<PlusIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
			<span className="truncate">{name}</span>
			<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
				{tap.short}
			</span>
		</button>
	)
}

/** A pick in the strip: picture, name, count, and a button that removes it. The name opens the dropdown. */
export function PickChip({
	control,
	id,
	pinned,
}: {
	control: MoodControl
	id: string
	pinned: boolean
}) {
	const { picker } = control
	const name = pickName(picker, id)
	const hues = choiceHues(picker, id)
	return (
		<motion.span
			layout
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`relative isolate inline-flex max-w-[22rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${pinned ? "h-8" : "h-9"}`}
			style={{ boxShadow: `0 4px 18px -6px ${hues[0]}` }}
		>
			<ChoiceArt
				hues={hues}
				path={choiceOf(picker, id)?.picture ?? null}
				split={groupNumber(id) !== null}
			/>
			<button
				type="button"
				data-moodbutton
				aria-haspopup="dialog"
				aria-expanded={control.open}
				onClick={() => control.setOpen(!control.open)}
				className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-2.5 pr-1"
			>
				<span className="truncate">{name}</span>
				<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
					{choiceOf(picker, id)?.count ?? 0}
				</span>
			</button>
			<button
				type="button"
				aria-label={`Remove ${name}`}
				onClick={() => control.toggle(id)}
				className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

function Heading({ children, note }: { children: ReactNode; note?: string }) {
	return (
		<div className="col-span-full flex min-h-7 items-center gap-2 pt-1 first:pt-0">
			<h3 className="text-sm font-bold text-white">{children}</h3>
			{note && (
				<span className="hidden truncate text-sm text-gray-400 sm:inline">
					{note}
				</span>
			)}
		</div>
	)
}

/** A row of small color dots: a kind's first colors. */
function Dots({ hues }: { hues: string[] }) {
	return (
		<span className="flex shrink-0 -space-x-1" aria-hidden>
			{hues.map((hue, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: two colors can be the same
					key={i}
					className="h-3 w-3 rounded-full ring-2 ring-gray-900"
					style={{ background: hue }}
				/>
			))}
		</span>
	)
}

/** The dropdown's line after its title: what another pick would do, by kind. */
export function pickHint(picker: Picker): string {
	if (!picker.picks.length)
		return picker.groups.length
			? "Mix moods, themes, styles, and your taste."
			: "Mix moods, themes, and styles."
	const one: Record<ChoiceKind, string> = {
		taste: "taste group",
		mood: "mood",
		theme: "theme",
		style: "style",
	}
	const kinds: ChoiceKind[] = [
		...(picker.groups.length ? (["taste"] as const) : []),
		...WORD_KINDS,
	]
	const picked = kinds.filter((k) => picker.picks.some((p) => kindOf(p) === k))
	const others = kinds.filter((k) => !picked.includes(k))
	const list = (names: string[]) =>
		names.length > 1
			? `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} or ${names[names.length - 1]}`
			: names[0]
	return `Another ${list(picked.map((k) => one[k]))} adds titles; a ${list(others.map((k) => one[k]))} narrows them.`
}

/**
 * The shelf, inside the dropdown's grid (2, 3, or 4 columns) or the phone's (`dense`, 2 columns of shorter tiles
 * without the line under the name).
 */
export function TasteShelf({
	control,
	dense,
}: {
	control: MoodControl
	dense: boolean
}) {
	const { picker } = control
	const [open, setOpen] = useState<WordKind | null>(null)
	const room = picker.picks.length < MAX_PICKS
	return (
		<>
			<Heading
				note={
					picker.groups.length
						? "Your taste groups, then the words your taste carries most"
						: "The moods with most titles"
				}
			>
				For you
			</Heading>
			{picker.forYou.map((id) => (
				<ChoiceTile key={id} control={control} id={id} dense={dense} mixed />
			))}
			{room && picker.narrow.length > 0 && (
				<div className="col-span-full rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10">
					<p className="mb-2 text-sm font-semibold text-white">
						Narrow it
						<span className="hidden font-normal text-gray-400 sm:inline">
							. Each leaves fewer titles; the number says how many.
						</span>
					</p>
					<div className="flex flex-wrap gap-1.5">
						{picker.narrow.map((id) => (
							<SuggestionChip key={id} control={control} id={id} />
						))}
					</div>
				</div>
			)}
			<Heading>Everything else</Heading>
			{WORD_KINDS.map((kind) => {
				const on = open === kind
				const ids = kindIds(picker, kind)
				const picked = picker.picks.filter((p) => kindOf(p) === kind).length
				// A kind the list holds none of (themes on an empty Wishlist) has nothing to open.
				if (!ids.length) return null
				return (
					<div key={kind} className="col-span-full">
						<button
							type="button"
							aria-expanded={on}
							onClick={() => setOpen(on ? null : kind)}
							className={`flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 transition-colors ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
						>
							<Dots
								hues={ids.slice(0, 5).map((id) => choiceHues(picker, id)[0])}
							/>
							<span>{KIND_TITLE[kind]}</span>
							<span className="font-normal text-gray-400">
								{ids.length}
								<span className="hidden sm:inline"> · {KIND_LINE[kind]}</span>
							</span>
							<span className="ml-auto flex items-center gap-2">
								{picked > 0 && (
									<span className="rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-black">
										{picked}
										<span className="sr-only"> picked</span>
									</span>
								)}
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
										control={control}
										id={id}
										dense={dense}
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

// The taste picker's shelf (#677, decided in #659): what the mood dropdown and the phone's drawer hold. "For you"
// first (the member's taste groups, then the words their taste carries most), after a pick a "Narrow it" row of
// choices from other kinds that would leave fewer titles, then Moods, Themes, and Styles folded, one open at a time.
//
// Every word keeps its own color, as the filters show it; a taste group is split on a diagonal into the two colors
// that most set it apart. Color says which choice it is, never where a title stands to your taste: a pick shows by
// its white ring and tick. Each tile says what a tap does: how many titles it holds, how many it adds next to a pick
// of its kind, or how many are left with it next to picks of other kinds.
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { MOOD_KEYS } from "~/domain/moods"
import {
	MAX_PICKS,
	WORD_BY_ID,
	WORD_KINDS,
	type WordKind,
	groupNumber,
	kindOf,
} from "~/domain/taste-picker"
import type { WatchNext } from "~/server/watch-next.server"
import type { MoodControl } from "./MoodPicker"
import { ChoiceArt, PickChip, choiceHues, choiceOf, groupOf } from "./PickChip"
import { pickName } from "./pick-name"

export { ChoiceArt, PickChip, choiceHues }

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

/**
 * A tile's lines and state when the page says them itself (the start page's guest, whose mixes stand where taste
 * groups do): whether it is on, whether a tap is refused (dimmed), the line under the name, and the count line (null
 * for none).
 */
export interface ChoiceLines {
	on: boolean
	full: boolean
	line: string | null
	tap: string | null
}

/** What a shelf says in its own words: the first row's heading, and every tile's lines. */
export interface ShelfLines {
	first: { title: string; note: string }
	lines: (id: string) => ChoiceLines
}

/** One choice as a poster tile, a checkbox. A fourth pick stays focusable and is refused with the hint. */
export function ChoiceTile({
	control,
	id,
	dense,
	mixed = false,
	lines,
}: {
	control: MoodControl
	id: string
	dense: boolean
	/** In a row that mixes kinds ("For you"): a taste group says it is your taste. */
	mixed?: boolean
	/** The tile's lines and state from the page, in place of the taste picker's. */
	lines?: ChoiceLines
}) {
	const { picker } = control
	const name = pickName(picker, id)
	const on = lines ? lines.on : picker.picks.includes(id)
	const full = lines ? lines.full : !on && picker.picks.length >= MAX_PICKS
	const tap = lines ? { text: lines.tap, none: false } : tapLine(control, id)
	const hues = choiceHues(picker, id)
	const line = lines ? lines.line : tileLine(picker, id, mixed)
	const group = groupNumber(id) !== null
	const yours = group && !lines
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, with the tile's picture and lines inside
			role="checkbox"
			aria-checked={on}
			aria-disabled={full || undefined}
			aria-label={
				lines
					? [name, line, tap.text]
							.filter(Boolean)
							.map((part) => (part?.endsWith(".") ? part : `${part}.`))
							.join(" ")
					: `${name}${yours ? ", your taste" : ""}. ${line && !group ? `${line} ` : ""}${tap.text}.`
			}
			data-choice={id}
			onClick={() => control.toggle(id)}
			whileTap={{ scale: full ? 1 : 0.97 }}
			className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "min-h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full || tap.none ? "opacity-40" : ""}`}
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
				{tap.text && (
					<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">
						{tap.text}
					</span>
				)}
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
			onClick={(event) => {
				// The suggestion leaves once picked: keep the keyboard in the shelf, on the pick's tile when it shows.
				const shelf = event.currentTarget.closest("[data-shelf]")
				const tile =
					shelf?.querySelector<HTMLElement>(
						`[role="checkbox"][data-choice="${id}"]`,
					) ??
					shelf?.querySelector<HTMLElement>('[role="checkbox"][data-choice]')
				tile?.focus()
				control.toggle(id)
			}}
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

export function Heading({
	children,
	note,
}: { children: ReactNode; note?: string }) {
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

/**
 * The shelf, inside the dropdown's grid (2, 3, or 4 columns) or the phone's (`dense`, 2 columns of shorter tiles
 * without the line under the name).
 */
export function TasteShelf({
	control,
	dense,
	shelf,
}: {
	control: MoodControl
	dense: boolean
	/** The page's own first heading and tile lines (the start page's guest); the taste picker's otherwise. */
	shelf?: ShelfLines
}) {
	const { picker } = control
	const [open, setOpen] = useState<WordKind | null>(null)
	const room = picker.picks.length < MAX_PICKS
	return (
		<>
			<Heading
				note={
					shelf
						? shelf.first.note
						: picker.groups.length
							? "Your taste groups, then the words your taste carries most"
							: "The moods with most titles"
				}
			>
				{shelf ? shelf.first.title : "For you"}
			</Heading>
			{picker.forYou.map((id) => (
				<ChoiceTile
					key={id}
					control={control}
					id={id}
					dense={dense}
					mixed
					lines={shelf?.lines(id)}
				/>
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
							className={`flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
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
										lines={shelf?.lines(id)}
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

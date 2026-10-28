// PROTOTYPE (start page lab, round 15): the guest's mood picker for stages l and m: My movies' taste picker
// (watch-next/MoodPicker + TasteShelf) with curated mixes in place of "For you". Its own pieces render as they are
// (MoodButton, PickChip, ChoiceArt, choiceHues, the refusal hint); ChoiceTile, the shelf and the panel's head aren't
// exported, so GuestTile, GuestShelf and GuestPanel repeat their markup with the guest's lines ("Your taste" dropped,
// counts as titles). The panel is solid gray-900, not My movies' blur: the room's light effects move behind it.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MAX_PICKS, WORD_BY_ID, WORD_KINDS, type WordKind, WORDS } from "~/domain/taste-picker"
import { MoodButton, type MoodControl, useRefusalHint } from "~/ui/watch-next/MoodPicker"
import { ChoiceArt, choiceHues, PickChip } from "~/ui/watch-next/TasteShelf"
import { pickName } from "~/ui/watch-next/labels"
import { inertProps } from "./ab-shared"
import { useDismiss } from "./hi-picker"
import { JK_REVEAL } from "../searchbar/bars"
import { guestPicker, isMix, MIXES, mixLine, pickLabel, STAGE_MIXES, togglePick } from "./jl-mixes"
import type { JkFlow, Reg } from "./jk-shared"

/** The picks on show: the picker's (a mix source), the dice's mood, or none (a search, the empty state). */
const picksOf = (f: JkFlow): string[] =>
	f.source.kind === "mix" ? f.source.ids : f.source.kind === "mood" ? [`m:${f.source.key}`] : []

/** My movies' MoodControl over the stage flow: picks become a "mix" source, a fourth is refused with the hint. */
export function useGuestControl(f: JkFlow): MoodControl {
	const picks = picksOf(f)
	const sig = picks.join()
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the picks
	const picker = useMemo(() => guestPicker(f.data, picks), [f.data, sig])
	const [open, setOpen] = useState(false)
	const [refused, setRefused] = useState<{ name: string; at: number } | null>(null)
	const toggle = useCallback(
		(id: string) => {
			const r = togglePick(picks, id)
			if (r.refused) setRefused({ name: pickLabel(id), at: Date.now() })
			else f.mix(r.picks)
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the picks
		[f.mix, sig],
	)
	return { picker, countScope: "titles", open, setOpen, toggle, clear: () => f.mix([]), refused }
}

const KIND_TITLE: Record<WordKind, string> = { mood: "Moods", theme: "Themes", style: "Styles" }
const KIND_LINE: Record<WordKind, string> = { mood: "kinds of evening", theme: "what it's about", style: "how it's told" }

const countOf = (control: MoodControl, id: string) => control.picker.choices.find((c) => c.id === id)?.count ?? 0
const pictureOf = (control: MoodControl, id: string) => control.picker.choices.find((c) => c.id === id)?.picture ?? null
/** LAB STAND-IN: the fixture list's size (the site would count the catalog). */
const countText = (n: number) => `${n} titles`

/** TasteShelf's Tick. */
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
 * TasteShelf's ChoiceTile for a guest: a mix's line is its parts ("Crime & mystery · Scary · Graphic"), a mood's its
 * description; the count is in titles. `size` sets the box (the shelf's, or the stage row's fixed one).
 */
export function GuestTile({
	control,
	id,
	size = "h-[6.5rem] md:h-28",
	lineClass = "",
}: {
	control: MoodControl
	id: string
	size?: string
	/** Classes for the line under the name (the stage row hides it on phones). */
	lineClass?: string
}) {
	const { picker } = control
	const name = pickName(picker, id)
	const on = picker.picks.includes(id)
	const full = !on && picker.picks.length >= MAX_PICKS
	const hues = choiceHues(picker, id)
	const mix = isMix(id)
	const line = mix ? mixLine(id) : (WORD_BY_ID[id]?.description ?? null)
	const tap = countText(countOf(control, id))
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, as on My movies
			role="checkbox"
			aria-checked={on}
			aria-disabled={full || undefined}
			aria-label={`${name}. ${line ? `${line}. ` : ""}${tap}.`}
			data-choice={id}
			onClick={() => control.toggle(id)}
			whileTap={{ scale: full ? 1 : 0.97 }}
			className={`group relative isolate flex shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${size} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full ? "opacity-40" : ""}`}
			style={{ boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined }}
		>
			<ChoiceArt
				hues={hues}
				path={pictureOf(control, id)}
				split={mix}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span className="line-clamp-2 text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{name}</span>
				<Tick on={on} />
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{line && <span className={`line-clamp-1 text-xs leading-snug text-white/90 ${lineClass}`}>{line}</span>}
				<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">{tap}</span>
			</span>
		</motion.button>
	)
}

/** TasteShelf's Heading. */
function Heading({ children, note }: { children: ReactNode; note?: string }) {
	return (
		<div className="col-span-full flex min-h-7 items-center gap-2 pt-1 first:pt-0">
			<h3 className="text-sm font-bold text-white">{children}</h3>
			{note && <span className="hidden truncate text-sm text-gray-400 sm:inline">{note}</span>}
		</div>
	)
}

/** TasteShelf's Dots. */
function Dots({ hues }: { hues: string[] }) {
	return (
		<span className="flex shrink-0 -space-x-1" aria-hidden>
			{hues.map((hue, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: two colors can be the same
				<span key={i} className="h-3 w-3 rounded-full ring-2 ring-gray-900" style={{ background: hue }} />
			))}
		</span>
	)
}

/** TasteShelf for a guest: "Start with a mix" (the mixes), then Moods, Themes and Styles folded, one open at a time. */
function GuestShelf({ control }: { control: MoodControl }) {
	const { picker } = control
	const [open, setOpen] = useState<WordKind | null>(null)
	return (
		<>
			<Heading note="Moods, themes, and styles that go well together">Start with a mix</Heading>
			{MIXES.map((m) => (
				<GuestTile key={m.id} control={control} id={m.id} />
			))}
			<Heading>Everything else</Heading>
			{WORD_KINDS.map((kind) => {
				const on = open === kind
				const ids = WORDS.filter((w) => w.kind === kind).map((w) => w.id)
				const picked = picker.picks.filter((p) => WORD_BY_ID[p]?.kind === kind).length
				return (
					<div key={kind} className="col-span-full">
						<button
							type="button"
							aria-expanded={on}
							onClick={() => setOpen(on ? null : kind)}
							className={`flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 transition-colors ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
						>
							<Dots hues={ids.slice(0, 5).map((id) => choiceHues(picker, id)[0])} />
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
								<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
							</span>
						</button>
						{on && (
							<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
								{ids.map((id) => (
									<GuestTile key={id} control={control} id={id} />
								))}
							</div>
						)}
					</div>
				)
			})}
		</>
	)
}

/** MoodPicker's PanelHead with the guest's line: the title or the refusal hint, "k of 3", Clear, and Done. */
function PanelHead({ control, onDone }: { control: MoodControl; onDone: () => void }) {
	const k = control.picker.picks.length
	const hint = useRefusalHint(control)
	return (
		<div className="flex min-h-9 shrink-0 items-center gap-3 border-b border-white/8 px-3 py-2">
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p
						key="hint"
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.35 }}
						className="min-w-0 flex-1 text-sm font-semibold text-amber-300"
					>
						{hint}
					</motion.p>
				) : (
					<motion.p
						key="title"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.08 } }}
						className="min-w-0 flex-1 text-sm text-gray-300"
					>
						<span className="font-semibold text-white">Pick up to three</span>
						<span className="hidden sm:inline">. Mix moods, themes, and styles.</span>
					</motion.p>
				)}
			</AnimatePresence>
			<span className={`shrink-0 text-sm tabular-nums ${k === MAX_PICKS ? "font-semibold text-amber-300" : "text-gray-400"}`}>
				{k} of {MAX_PICKS}
			</span>
			{k > 0 && (
				<button
					type="button"
					onClick={control.clear}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
			<button
				type="button"
				onClick={onDone}
				className="shrink-0 cursor-pointer rounded-full bg-white px-3 py-1 text-sm font-bold text-black hover:bg-gray-200"
			>
				Done
			</button>
		</div>
	)
}

/**
 * MoodPanel's dropdown in the stage: under the picker row, as wide as the column (980 px at most), solid. Closes on a
 * tap outside the row and panel, Escape, or Done (which brings the results into view). Picks keep it open, as on My
 * movies; while it's open the results don't scroll into view (`data-jk-picker-open`, read by useJkBringIntoView).
 */
function GuestPanel({ control, returnFocus }: { control: MoodControl; returnFocus: RefObject<HTMLElement | null> }) {
	const panel = useRef<HTMLDivElement>(null)
	const { open, setOpen } = control
	const close = useCallback(() => setOpen(false), [setOpen])
	useDismiss(open, close, panel)
	useEffect(() => {
		if (!open) return
		const r1 = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[data-choice]")?.focus({ preventScroll: true }))
		const t = setTimeout(() => {
			const r = panel.current?.getBoundingClientRect()
			const room = window.innerHeight - 76
			if (r && r.bottom > room) window.scrollBy({ top: Math.min(r.top - 72, r.bottom - room), behavior: "smooth" })
		}, 30)
		return () => {
			cancelAnimationFrame(r1)
			clearTimeout(t)
		}
	}, [open])
	return (
		<div
			ref={panel}
			role="dialog"
			aria-label="Picks"
			{...(open ? { "data-jk-picker-open": "" } : {})}
			{...inertProps(!open)}
			className="absolute inset-x-0 top-full z-40 mx-auto mt-2 flex w-full max-w-[980px] origin-top flex-col overflow-hidden rounded-2xl bg-gray-900 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 transition-[opacity,transform] duration-200 ease-out"
			style={{ opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-8px) scale(.985)", pointerEvents: open ? "auto" : "none" }}
		>
			<PanelHead
				control={control}
				onDone={() => {
					close()
					returnFocus.current?.focus({ preventScroll: true })
					if (control.picker.picks.length) window.dispatchEvent(new Event(JK_REVEAL))
				}}
			/>
			<div className="grid max-h-[min(62svh,560px)] min-h-0 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-3 lg:grid-cols-4">
				{open ? <GuestShelf control={control} /> : null}
			</div>
		</div>
	)
}

/** MoodButton on a dark backing (it sits over the room, not My movies' gray-900 strip). */
function Trigger({ control, buttonRef, big = false }: { control: MoodControl; buttonRef: RefObject<HTMLButtonElement>; big?: boolean }) {
	return (
		<span
			className={`inline-flex shrink-0 rounded-full bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)] ${big ? "[&>button]:h-10 [&>button]:text-[15px] lg:[&>button]:h-11" : ""}`}
		>
			<MoodButton control={control} buttonRef={buttonRef} />
		</span>
	)
}

/** Says a refused fourth pick out loud when the panel is closed (the row's tiles show it as dimmed). */
function RefusalLive({ control }: { control: MoodControl }) {
	const hint = useRefusalHint(control)
	return (
		<span className="sr-only" aria-live="polite">
			{control.open ? "" : (hint ?? "")}
		</span>
	)
}

/**
 * Stage l: the trigger, then the first six mixes as tiles right on the stage, one row (sideways scroll on phones and
 * narrow desktops). Every row element has a fixed size, so picking never moves anything. The trigger opens the
 * whole picker (all eight mixes, Moods, Themes, Styles); picks made there show on the trigger ("Add", "Change") and in
 * the results' heading.
 */
export function MixRowPicker({ f, reg }: { f: JkFlow; reg: Reg }) {
	const control = useGuestControl(f)
	const button = useRef<HTMLButtonElement>(null)
	return (
		<>
			<div ref={reg("moods")} data-jk-moods="" data-hi-more="" className="pointer-events-auto mx-auto w-fit max-w-full">
				<div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-1">
					<div className="flex w-max items-center gap-2">
						{/* A fixed-width cell (as wide as "Any mood" with its color fan), the button at its end, so turning
						    into "Add" or "Change" doesn't move the tiles under the finger. */}
						<span className="flex w-[186px] shrink-0 justify-end">
							<Trigger control={control} buttonRef={button} />
						</span>
						{MIXES.slice(0, STAGE_MIXES).map((m) => (
							<GuestTile
								key={m.id}
								control={control}
								id={m.id}
								lineClass="max-sm:hidden"
								size="h-[84px] w-[150px] sm:h-[92px] sm:w-[160px] xl:w-[164px] 2xl:w-[176px] shadow-[0_10px_28px_rgb(0_0_0/.45)]"
							/>
						))}
					</div>
				</div>
			</div>
			<GuestPanel control={control} returnFocus={button} />
			<RefusalLive control={control} />
		</>
	)
}

/**
 * Stage m: My movies' strip on the stage: the trigger ("Any mood" with its color fan), the picks as poster chips, and
 * how many titles they hold. Everything else waits in the panel, so the stage stays as calm as it can be.
 */
export function MoodButtonPicker({ f, reg }: { f: JkFlow; reg: Reg }) {
	const control = useGuestControl(f)
	const button = useRef<HTMLButtonElement>(null)
	const { picks, fitting } = control.picker
	return (
		<>
			<div ref={reg("moods")} data-jk-moods="" data-hi-more="" className="pointer-events-auto mx-auto w-fit max-w-full">
				<div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-1">
					<div className="flex h-11 w-max items-center gap-2 lg:h-12">
						<Trigger control={control} buttonRef={button} big />
						{picks.map((id) => (
							<span key={id} className="inline-flex rounded-xl bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)]">
								<PickChip control={control} id={id} pinned={false} />
							</span>
						))}
						<span className="shrink-0 whitespace-nowrap pl-1 text-sm text-gray-300 tabular-nums [text-shadow:0_1px_8px_rgb(0_0_0/.9)]">
							{picks.length ? countText(fitting) : "Pick up to three"}
						</span>
					</div>
				</div>
			</div>
			<GuestPanel control={control} returnFocus={button} />
			<RefusalLive control={control} />
		</>
	)
}

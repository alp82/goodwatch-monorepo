// The age and content filter's controls. The desktop row's button says what is set ("FSK 12 · no disturbing scenes")
// and opens a popover with two columns: the age limit (a switch over the country's ladder) and what is OK to show (a
// checklist of the kinds of content). The Filters sheet draws the same two parts one under the other.
//
// The age limit sets which kinds are hidden; the person's changes against that are marked with an amber dot. The
// rules are in ~/domain/age-content.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState } from "react"
import {
	CONTENT_KINDS,
	type ViewerLadder,
	changedContent,
	hiddenKinds,
	ladderStepFor,
	withContentChoice,
} from "~/domain/age-content"
import { type FilterState, dropFilter } from "~/domain/filter-state"
import { RatingMark } from "~/ui/title-card/RatingMark"
import { radioKeys } from "./controls"
import { CONTENT_LABELS, ageContentSummary, compactCount } from "./labels"
import { Knob, MENU, SHELL, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

interface AgeContentProps {
	state: FilterState
	ladder: ViewerLadder
	counts: FilterBarCounts | null
	onChange: (state: FilterState) => void
	/** The Filters sheet's sizes: rows a thumb can hit and counts in full. The popover's are compact. */
	roomy?: boolean
}

const HEADING = "text-xs font-bold tracking-wide text-gray-400 uppercase"
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

// The step the switch comes back to. Kept for the tab, so the row's control and the sheet agree; written only when a
// person switches the limit off.
let lastStep: number | null = null

/** The age limit: a switch, and the ladder's steps as radios. Picking a step turns the limit on. */
export function AgeLimit({
	state,
	ladder,
	counts,
	onChange,
	roomy = false,
}: AgeContentProps) {
	const { steps } = ladder
	const selected =
		state.ageLimit === undefined ? null : ladderStepFor(steps, state.ageLimit)
	const on = selected !== null
	const resume =
		lastStep === null
			? steps[Math.floor(steps.length / 2)]
			: ladderStepFor(steps, lastStep)
	// The person's content choices stay as they are, also the ones the new limit sets anyway.
	const pick = (ageLimit: number) => onChange({ ...state, ageLimit })
	const count = (age: number) => counts?.optionCounts.ageLimit?.[age] ?? null
	return (
		<div>
			<button
				type="button"
				role="switch"
				aria-checked={on}
				onClick={() => {
					if (!selected) return pick(resume.age)
					lastStep = selected.age
					onChange(dropFilter(state, "ageLimit"))
				}}
				className={`flex w-full items-center rounded-md cursor-pointer ${roomy ? "h-9" : ""} ${FOCUS}`}
			>
				<span className={`flex-1 text-left ${HEADING}`}>Age limit</span>
				<Knob on={on} />
			</button>
			<div
				role="radiogroup"
				aria-label="Age limit"
				onKeyDown={(event) =>
					radioKeys(event, (index) => pick(steps[index].age))
				}
				className={`mt-2 flex transition-opacity ${roomy ? "flex-wrap gap-2" : "flex-col gap-0.5"} ${on ? "" : "opacity-45"}`}
			>
				{steps.map((step) => {
					const checked = step === selected
					const n = count(step.age)
					return (
						<motion.button
							key={step.age}
							// biome-ignore lint/a11y/useSemanticElements: a list of steps; the buttons carry the radio role and arrow keys
							type="button"
							role="radio"
							aria-checked={checked}
							aria-label={`${step.label}${step.show ? ` or ${step.show}` : ""}${n === null ? "" : `, ${n.toLocaleString("en")} titles`}`}
							tabIndex={checked || (!selected && step === resume) ? 0 : -1}
							whileTap={TAP}
							onClick={() => pick(step.age)}
							className={`flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer ${FOCUS} ${roomy ? "h-9 rounded-full pr-2.5 pl-3" : "h-8 rounded-lg px-2.5"} ${
								checked
									? "bg-white font-bold text-gray-950"
									: roomy
										? "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
										: "text-gray-200 hover:bg-white/10"
							}`}
						>
							{!roomy && (
								<span
									className={`h-2 w-2 shrink-0 rounded-full ${checked ? "bg-gray-950" : "ring-1 ring-white/30"}`}
								/>
							)}
							{step.label}
							{step.show && (
								<span className="text-xs font-normal text-gray-500">
									{step.show}
								</span>
							)}
							{n !== null && (
								<span
									className={`text-xs font-normal tabular-nums text-gray-500 ${roomy ? "" : "ml-auto pl-1"}`}
								>
									{roomy ? n.toLocaleString("en") : compactCount(n)}
								</span>
							)}
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

/**
 * OK to show: a checkbox per kind of content. Ticked shows; unticked is struck through with how many titles that
 * hides. The amber dot marks a kind the person changed from what the age limit sets, and Reset takes the changes back.
 */
export function ContentChecklist({
	state,
	counts,
	onChange,
	roomy = false,
}: Omit<AgeContentProps, "ladder">) {
	const headingId = useId()
	const hidden = hiddenKinds(state.ageLimit, state.content)
	// Only a choice that differs from what the limit sets shows as changed; Reset takes every choice back.
	const changed = changedContent(state.ageLimit, state.content) ?? {}
	return (
		// biome-ignore lint/a11y/useSemanticElements: a fieldset can't lay out its legend beside Reset
		<div role="group" aria-labelledby={headingId}>
			<div className={`flex items-center ${roomy ? "h-9" : ""}`}>
				<p id={headingId} className={HEADING}>
					OK to show
				</p>
				{Object.keys(changed).length > 0 && (
					<button
						type="button"
						onClick={() => onChange({ ...state, content: undefined })}
						className={`ml-auto rounded-md text-xs font-bold text-amber-400 cursor-pointer hover:underline ${FOCUS}`}
					>
						Reset
					</button>
				)}
			</div>
			<div className="mt-2 flex flex-col gap-0.5">
				{CONTENT_KINDS.map((kind) => {
					const hides = hidden.includes(kind)
					const mine = Boolean(changed[kind])
					const n = counts?.optionCounts.content?.[kind] ?? null
					const { full } = CONTENT_LABELS[kind]
					return (
						<motion.button
							key={kind}
							// biome-ignore lint/a11y/useSemanticElements: a row with a count; the button carries the checkbox role
							type="button"
							role="checkbox"
							aria-checked={!hides}
							aria-label={`${full}${mine ? ", changed" : ""}${n === null ? "" : `, ${n.toLocaleString("en")} titles${hides ? " hidden" : ""}`}`}
							whileTap={TAP}
							onClick={() =>
								onChange({
									...state,
									content: withContentChoice(
										state.ageLimit,
										state.content,
										kind,
										hides ? "show" : "hide",
									),
								})
							}
							className={`flex items-center gap-2.5 rounded-lg px-1.5 text-sm cursor-pointer hover:bg-white/10 ${roomy ? "h-10" : "h-8"} ${FOCUS}`}
						>
							<span
								className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${hides ? "ring-1 ring-white/25" : "bg-emerald-500 text-white"}`}
							>
								{!hides && <CheckIcon className="h-4 w-4" />}
							</span>
							<span
								className={`truncate ${hides ? "text-gray-500 line-through" : "text-gray-100"}`}
							>
								{full}
							</span>
							{mine && (
								<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
							)}
							{n !== null && (
								<span className="ml-auto shrink-0 text-xs tabular-nums text-gray-500">
									{roomy ? n.toLocaleString("en") : compactCount(n)}
									{hides && " hidden"}
								</span>
							)}
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

/**
 * The desktop row's Age & content button and its popover. Closed it reads "Age & content", or the limit's badge and
 * what the person changed from it ("FSK 12 · violence OK", "FSK 12 · 2 changes"), or with the limit off what is hidden
 * ("no violence +1"); the tooltip lists every hidden kind. It sits at the row's right end, so its width moves nothing.
 */
export function AgeContentControl(props: Omit<AgeContentProps, "roomy">) {
	const { state, ladder } = props
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const panelId = useId()
	// A panel of controls, so Tab moves inside it (a menu closes on Tab): focus goes to the switch when it opens,
	// Escape closes it and returns focus to the button, and a press outside or focus moving on closes it.
	useEffect(() => {
		if (!open) return
		const frame = requestAnimationFrame(() =>
			root.current
				?.querySelector<HTMLElement>('[role="switch"]')
				?.focus({ preventScroll: true }),
		)
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.stopPropagation()
			setOpen(false)
			trigger.current?.focus()
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key, true)
		return () => {
			cancelAnimationFrame(frame)
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key, true)
		}
	}, [open])

	const summary = ageContentSummary(state, ladder.steps)
	const active = summary.badge !== null || summary.hiding !== null
	const twoLabels = ladder.steps.some((step) => step.show)
	return (
		<div
			ref={root}
			className="relative shrink-0"
			onBlur={(event) => {
				const next = event.relatedTarget as Node | null
				if (next && !event.currentTarget.contains(next)) setOpen(false)
			}}
		>
			<motion.button
				ref={trigger}
				type="button"
				whileTap={TAP}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				aria-label={[
					"Age & content",
					summary.badge && `up to ${summary.badge}`,
					summary.hiding?.toLowerCase(),
				]
					.filter(Boolean)
					.join(", ")}
				title={summary.hiding ?? undefined}
				onClick={() => setOpen(!open)}
				className={`flex h-12 max-w-72 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer ${FOCUS} ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"} ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{summary.badge && (
					<RatingMark rating={{ label: summary.badge, estimated: false }} />
				)}
				{summary.text ? (
					<span className="flex min-w-0 items-center font-normal text-gray-300">
						{summary.badge && <span className="mr-2 text-gray-600">·</span>}
						<span className="truncate">{summary.text}</span>
						{summary.more > 0 && (
							<span className="ml-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-bold text-gray-200">
								+{summary.more}
							</span>
						)}
					</span>
				) : (
					!summary.badge && "Age & content"
				)}
				<ChevronDownIcon
					className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</motion.button>
			<AnimatePresence>
				{open && (
					<motion.div
						// biome-ignore lint/a11y/useSemanticElements: an animated popover that isn't modal; <dialog> can't animate out
						id={panelId}
						role="dialog"
						aria-label="Age and content"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute right-0 z-40 mt-2 max-w-[calc(100vw-1.5rem)] origin-top-right p-4 ${twoLabels ? "w-[33rem]" : "w-[30rem]"} ${MENU}`}
					>
						<div className="flex gap-4">
							<div className={`shrink-0 ${twoLabels ? "w-48" : "w-36"}`}>
								<AgeLimit {...props} />
							</div>
							<div className="min-w-0 flex-1 border-l border-white/10 pl-4">
								<ContentChecklist {...props} />
							</div>
						</div>
						<div className="mt-4 flex justify-end border-t border-white/10 pt-3">
							<motion.button
								type="button"
								whileTap={TAP}
								onClick={() => {
									setOpen(false)
									trigger.current?.focus()
								}}
								className="h-9 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white cursor-pointer outline-none hover:bg-amber-500 focus-visible:ring-2 focus-visible:ring-white"
							>
								Done
							</motion.button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

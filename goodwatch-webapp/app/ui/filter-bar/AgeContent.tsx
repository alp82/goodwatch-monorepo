// The age and content filter's controls, drawn by the Filters sheet one under the other: the age limit (a switch over
// the country's ladder) and what is OK to show (a checklist of the kinds of content).
//
// The age limit sets which kinds are hidden; the person's changes against that are marked with an amber dot. The
// rules are in ~/domain/age-content.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useId } from "react"
import {
	CONTENT_KINDS,
	type ViewerLadder,
	changedContent,
	hiddenKinds,
	ladderStepFor,
	withContentChoice,
} from "~/domain/age-content"
import { type FilterState, dropFilter } from "~/domain/filter-state"
import { radioKeys } from "./controls"
import { CONTENT_LABELS, compactCount } from "./labels"
import { Knob, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

interface AgeContentProps {
	state: FilterState
	ladder: ViewerLadder
	counts: FilterBarCounts | null
	onChange: (state: FilterState) => void
	/** The Filters sheet's sizes: rows a thumb can hit and counts in full. Without it the parts are compact. */
	roomy?: boolean
}

const HEADING = "text-xs font-bold tracking-wide text-gray-400 uppercase"
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

// The step the switch comes back to. Kept for the tab; written only when a person switches the limit off.
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

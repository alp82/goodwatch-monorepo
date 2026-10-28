// PROTOTYPE (Discover lab): the age and content filter as the real AgeContent controls write it (~/domain/age-content):
// the age limit is a step of the viewer's ladder, content choices are overrides kept as given.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { CONTENT_KINDS, type ContentKind, type LadderStep, changedContent, hiddenKinds, ladderStepFor, withContentChoice } from "~/domain/age-content"
import { dropFilter } from "~/domain/filter-state"
import { CONTENT_LABELS, compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../../../kit"
import type { Pieces } from "../../types"

export function useAge(d: ProtoDiscover, pieces: Pieces) {
	const s = d.filters.state
	const ladder = pieces.groups.ladder ?? null
	const steps: readonly LadderStep[] = ladder?.steps ?? []
	const selected = s.ageLimit === undefined || !steps.length ? null : ladderStepFor(steps, s.ageLimit)
	const hidden = hiddenKinds(s.ageLimit, s.content)
	const changed = changedContent(s.ageLimit, s.content) ?? {}
	return {
		ladder,
		steps,
		selected,
		hidden,
		changed,
		stepCount: (age: number) => d.counts?.optionCounts.ageLimit?.[String(age)] ?? null,
		offCount: d.counts?.optionCounts.ageLimit?.off ?? null,
		kindCount: (k: ContentKind) => d.counts?.optionCounts.content?.[k] ?? null,
		/** Content choices stay as they are, also the ones the new limit sets anyway (like the real control). */
		pick: (age: number) => d.filters.set({ ageLimit: age }),
		off: () => d.filters.update((st) => dropFilter(st, "ageLimit")),
		setKind: (k: ContentKind, show: boolean) =>
			d.filters.update((st) => ({ ...st, content: withContentChoice(st.ageLimit, st.content, k, show ? "show" : "hide") })),
		resetContent: () => d.filters.set({ content: undefined }),
	}
}
export type Age = ReturnType<typeof useAge>

export const KINDS = CONTENT_KINDS
export const kindLabel = (k: ContentKind) => CONTENT_LABELS[k].full

/** One kind of content as a checklist row: ticked shows, unticked is struck through with how many it hides. */
export function KindRow({ age, k, roomy }: { age: Age; k: ContentKind; roomy?: boolean }) {
	const hides = age.hidden.includes(k)
	const mine = Boolean(age.changed[k])
	const n = age.kindCount(k)
	return (
		<motion.button
			type="button"
			role="checkbox"
			aria-checked={!hides}
			whileTap={TAP}
			onClick={() => age.setKind(k, hides)}
			className={`flex w-full items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400 ${roomy ? "h-12" : "h-10"}`}
		>
			<span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${hides ? "ring-1 ring-white/25" : "bg-emerald-500 text-white"}`}>
				{!hides && <CheckIcon className="h-4 w-4" />}
			</span>
			<span className={`truncate text-[14px] ${hides ? "text-gray-500 line-through" : "text-gray-100"}`}>{kindLabel(k)}</span>
			{mine && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
			{n !== null && (
				<span className="ml-auto shrink-0 text-[12px] tabular-nums text-gray-500">
					{compactCount(n)}
					{hides && " hidden"}
				</span>
			)}
		</motion.button>
	)
}

export function NoLadder() {
	return <div className="px-7 py-6 text-[14px] text-gray-500">No age ratings for this country</div>
}

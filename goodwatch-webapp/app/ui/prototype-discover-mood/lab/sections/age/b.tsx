// PROTOTYPE (Discover lab) Age b: who's watching. Four audience cards map to steps of the viewer's ladder (the card
// names the rating it sets), the exact ratings stay as a small row under them, and each kind of content is its own
// switch tile with how many titles it hides.
import { motion } from "framer-motion"
import { type ContentKind, ladderStepFor } from "~/domain/age-content"
import { compactCount } from "~/ui/filter-bar/labels"
import { Knob, TAP } from "~/ui/filter-bar/motion"
import { Chip } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, pad } from "../released/parts"
import { type Age, KINDS, NoLadder, kindLabel, useAge } from "./parts"

const AUDIENCES: { id: string; label: string; age: number | null }[] = [
	{ id: "little", label: "Little kids", age: 0 },
	{ id: "kids", label: "Kids", age: 8 },
	{ id: "teens", label: "Teens", age: 14 },
	{ id: "grown", label: "Grown-ups", age: null },
]

function KindSwitch({ age, k, phone }: { age: Age; k: ContentKind; phone: boolean }) {
	const hides = age.hidden.includes(k)
	const n = age.kindCount(k)
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={!hides}
			whileTap={TAP}
			onClick={() => age.setKind(k, hides)}
			className={`flex flex-col justify-between gap-2 rounded-2xl p-3.5 text-left outline-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-[84px]" : "h-[104px]"} ${
				hides ? "bg-white/[0.03] ring-1 ring-white/10" : "bg-white/[0.07] hover:bg-white/[0.11]"
			}`}
		>
			<span className="flex w-full items-start gap-2">
				<span className={`text-[14px] font-medium leading-tight ${hides ? "text-gray-500" : "text-gray-100"}`}>{kindLabel(k)}</span>
				{age.changed[k] && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
				<span className="ml-auto">
					<Knob on={!hides} onClass="bg-emerald-500" />
				</span>
			</span>
			<span className="text-[12px] tabular-nums text-gray-500">
				{hides ? (n === null ? "Hidden" : `${compactCount(n)} hidden`) : n === null ? "Shown" : `Shown · ${compactCount(n)}`}
			</span>
		</motion.button>
	)
}

export function AgeB({ d, pieces, phone }: SectionProps) {
	const age = useAge(d, pieces)
	if (!age.ladder) return <NoLadder />
	const steps = age.steps
	// Each audience's step on this ladder; audiences that land on the same step as an earlier one are left out.
	const seen = new Set<number>()
	const cards = AUDIENCES.flatMap((a) => {
		const step = a.age === null ? null : ladderStepFor(steps, a.age)
		const k = step?.age ?? -1
		if (seen.has(k)) return []
		seen.add(k)
		return [{ ...a, step }]
	})
	const anyChanged = Object.keys(age.changed).length > 0
	return (
		<div className={`${pad(phone)} flex flex-col ${phone ? "gap-5" : "gap-4"}`}>
			<div>
				<GroupLabel>Who's watching</GroupLabel>
				<div className={`grid gap-2.5 ${phone ? "grid-cols-2" : "grid-cols-4"}`}>
					{cards.map((c) => {
						const on = c.step ? age.selected === c.step : !age.selected
						const n = c.step ? age.stepCount(c.step.age) : age.offCount
						return (
							<motion.button
								key={c.id}
								type="button"
								aria-pressed={on}
								whileTap={TAP}
								onClick={() => (c.step ? age.pick(c.step.age) : age.off())}
								className={`flex items-center gap-3 rounded-2xl px-4 text-left outline-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-16" : "h-[76px]"} ${
									on ? "bg-white text-gray-950" : "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
								}`}
							>
								<span className="flex min-w-0 flex-col">
									<span className="text-[16px] font-semibold">{c.label}</span>
									<span className={`truncate text-[12px] ${on ? "text-gray-600" : "text-gray-500"}`}>
										{c.step ? `Up to ${c.step.label}${c.step.show ? ` · ${c.step.show}` : ""}` : "Every rating"}
									</span>
								</span>
								{n !== null && <span className={`ml-auto text-[12px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}>{compactCount(n)}</span>}
							</motion.button>
						)
					})}
				</div>
				<div className={`mt-2.5 flex gap-1.5 ${phone ? "overflow-x-auto [scrollbar-width:none]" : "flex-wrap"}`}>
					{steps.map((step) => (
						<Chip
							key={step.age}
							o={{
								id: String(step.age),
								label: step.show ? `${step.label} · ${step.show}` : step.label,
								active: age.selected === step,
								count: age.stepCount(step.age),
								toggle: () => (age.selected === step ? age.off() : age.pick(step.age)),
							}}
						/>
					))}
				</div>
			</div>
			<div>
				<GroupLabel right={<ResetLink show={anyChanged} onClick={age.resetContent}>Reset</ResetLink>}>OK to show</GroupLabel>
				<div className={`grid gap-2.5 ${phone ? "grid-cols-2" : "grid-cols-5"}`}>
					{KINDS.map((k) => (
						<KindSwitch key={k} age={age} k={k} phone={phone} />
					))}
				</div>
			</div>
		</div>
	)
}

// PROTOTYPE (Discover lab) Age a: the country's rating ladder as one row of big steps (Off first, each step with its
// show rating and count), and OK to show as a roomy checklist beside it. Round 7: a country switcher for whose ratings
// decide, and a free age ("Watching with a 12 year old") that lands on the right step of that country's ladder.
import { motion } from "framer-motion"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, pad } from "../released/parts"
import { CountrySwitch, FreeAge, KINDS, KindRow, NoLadder, useAge } from "./parts"

export function AgeA({ d, pieces, phone }: SectionProps) {
	const age = useAge(d, pieces)
	if (!age.ladder) return <NoLadder />
	const anyChanged = Object.keys(age.changed).length > 0
	const tile = (active: boolean) =>
		`flex flex-col items-center justify-center gap-0.5 rounded-2xl outline-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-20" : "h-[104px]"} ${
			active ? "bg-white text-gray-950" : "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
		}`
	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-[1.35fr_1fr] gap-10"}`}>
			<div>
				<div className={`mb-2 flex gap-2 ${phone ? "flex-col" : "h-7 items-center"}`}>
					<span className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">Age limit</span>
					{!age.ladder.local && <span className="text-[12px] text-gray-500">Plain ages</span>}
					<span className={phone ? "" : "ml-auto"}>
						<CountrySwitch d={d} age={age} phone={phone} />
					</span>
				</div>
				<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${phone ? 3 : age.steps.length + 1}, minmax(0, 1fr))` }}>
					<motion.button type="button" aria-pressed={!age.selected} whileTap={TAP} onClick={age.off} className={tile(!age.selected)}>
						<span className="text-[20px] font-semibold">Off</span>
						<span className={`text-[11px] ${age.selected ? "text-gray-500" : "text-gray-600"}`}>Every rating</span>
					</motion.button>
					{age.steps.map((step) => {
						const on = age.selected === step
						const n = age.stepCount(step.age)
						return (
							<motion.button key={step.age} type="button" aria-pressed={on} whileTap={TAP} onClick={() => age.pick(step.age)} className={tile(on)}>
								<span className={`text-[11px] ${on ? "text-gray-600" : "text-gray-500"}`}>Up to</span>
								<span className="text-[20px] font-semibold">{step.label}</span>
								{step.show && <span className={`text-[12px] ${on ? "text-gray-600" : "text-gray-400"}`}>{step.show}</span>}
								<span className={`text-[11px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}>{n === null ? " " : compactCount(n)}</span>
							</motion.button>
						)
					})}
				</div>
				<div className={phone ? "mt-5" : "mt-6"}>
					<FreeAge age={age} phone={phone} />
				</div>
			</div>
			<div>
				<GroupLabel right={<ResetLink show={anyChanged} onClick={age.resetContent}>Reset</ResetLink>}>OK to show</GroupLabel>
				<div className="flex flex-col">
					{KINDS.map((k) => (
						<KindRow key={k} age={age} k={k} roomy={!phone} />
					))}
				</div>
			</div>
		</div>
	)
}

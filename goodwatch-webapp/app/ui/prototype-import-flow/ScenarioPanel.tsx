// PROTOTYPE - throwaway. The scenario picker for /prototype/import-flow: which case the simulated import plays, and
// a restart. Sits top-right, folds to a pill, and is clearly not part of the design.
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { SCENARIOS, type Sim } from "./model"

export function ScenarioPanel({ sim }: { sim: Sim }) {
	const [params, setParams] = useSearchParams()
	const [open, setOpen] = useState(true)
	const pick = (key: string) => {
		const p = new URLSearchParams(params)
		p.set("scenario", key)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const groups = [...new Set(SCENARIOS.map((s) => s.group))]
	if (!open)
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed right-3 bottom-20 z-50 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500"
			>
				Case: {sim.scenario.label} · {sim.phase.at}
			</button>
		)
	return (
		<aside className="fixed right-3 bottom-20 z-50 max-h-[70vh] w-72 overflow-y-auto rounded-2xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500">
			<div className="mb-2 flex items-center justify-between">
				<strong className="text-sm">Case</strong>
				<span className="flex gap-2">
					<button type="button" className="rounded-full bg-neutral-200 px-2 py-0.5 font-semibold" onClick={sim.reset}>
						Restart
					</button>
					<button type="button" className="rounded-full bg-neutral-200 px-2 py-0.5 font-semibold" onClick={() => setOpen(false)}>
						Hide
					</button>
				</span>
			</div>
			<p className="mb-2 rounded-lg bg-fuchsia-50 p-2">
				<span className="font-semibold">{sim.scenario.label}:</span> {sim.scenario.note}
				<br />
				<span className="text-neutral-500">Phase: {sim.phase.at}</span>
			</p>
			{groups.map((g) => (
				<div key={g} className="mb-2">
					<div className="mb-1 font-semibold text-neutral-500 uppercase">{g}</div>
					<div className="flex flex-col">
						{SCENARIOS.filter((s) => s.group === g).map((s) => (
							<button
								key={s.key}
								type="button"
								onClick={() => pick(s.key)}
								className={`rounded-md px-2 py-1 text-left hover:bg-neutral-100 ${s.key === sim.scenario.key ? "bg-fuchsia-100 font-semibold" : ""}`}
							>
								{s.label}
							</button>
						))}
					</div>
				</div>
			))}
		</aside>
	)
}

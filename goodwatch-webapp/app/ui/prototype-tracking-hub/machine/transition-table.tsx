// PROTOTYPE - throwaway (issue #368, map #365). The transition table of /prototype/tracking-machine as a table a
// person reads. It prints `TABLE` of the machine module and adds nothing: this is the specification under review.
import { EVENT_LABEL, GUARDS, type Row, STATES, STATE_LABEL, type Settings, TABLE, rowIsActive } from "~/domain/prototype-tracking-machine/machine"

const fromText = (row: Row) => (row.from.length === STATES.length ? "Any state" : row.from.map((state) => STATE_LABEL[state]).join(", "))
const toText = (row: Row) => (row.to === "same" ? "stays" : STATE_LABEL[row.to])
const optionText = (row: Row) => (row.only ? `${row.only.decision.toUpperCase()} option` : "")

function Marks({ row, used, possible, active }: { row: Row; used: boolean; possible: boolean; active: boolean }) {
	return (
		<>
			{used && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">Just used</span>}
			{!used && possible && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-100">Possible now</span>}
			{row.only && (
				<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-sky-400/25 text-sky-200" : "bg-white/5 text-gray-400"}`}>
					{optionText(row)}
					{active ? ", on" : ", off"}
				</span>
			)}
		</>
	)
}

export function TransitionTable({ settings, usedRow, possibleRows }: { settings: Settings; usedRow: string | null; possibleRows: Set<string> }) {
	return (
		<div data-testid="table">
			{/* Wide screens: a table. */}
			<table className="hidden w-full border-separate border-spacing-0 text-left text-sm md:table">
				<thead>
					<tr className="text-xs uppercase tracking-wide text-gray-400">
						<th className="border-b border-white/15 px-2 py-2 font-semibold">Row</th>
						<th className="border-b border-white/15 px-2 py-2 font-semibold">From</th>
						<th className="border-b border-white/15 px-2 py-2 font-semibold">The member does</th>
						<th className="border-b border-white/15 px-2 py-2 font-semibold">When</th>
						<th className="border-b border-white/15 px-2 py-2 font-semibold">To</th>
						<th className="border-b border-white/15 px-2 py-2 font-semibold">In words</th>
					</tr>
				</thead>
				<tbody>
					{TABLE.map((row) => {
						const active = rowIsActive(row, settings)
						const used = usedRow === row.id
						const possible = possibleRows.has(row.id)
						const cell = `border-b border-white/[0.07] px-2 py-2 align-top ${used ? "bg-amber-400/15" : ""}`
						return (
							<tr key={row.id} data-row={row.id} data-used={used} data-active={active} className={active ? "" : "opacity-45"}>
								<td className={`${cell} whitespace-nowrap font-mono text-xs font-bold ${used ? "border-l-4 border-l-amber-400 text-amber-300" : "border-l-4 border-l-transparent text-gray-300"}`}>{row.id}</td>
								<td className={`${cell} text-gray-200`}>{fromText(row)}</td>
								<td className={`${cell} whitespace-nowrap font-semibold text-white`}>{row.event === "catalog" ? <i className="font-normal text-gray-300">nobody: {EVENT_LABEL.catalog}</i> : EVENT_LABEL[row.event]}</td>
								<td className={`${cell} text-gray-300`}>{row.guard ? GUARDS[row.guard].says : "always"}</td>
								<td className={`${cell} whitespace-nowrap font-semibold ${row.to === "same" ? "text-gray-400" : "text-green-300"}`}>{toText(row)}</td>
								<td className={`${cell} text-gray-300`}>
									{row.says}{" "}
									<span className="inline-flex flex-wrap gap-1 align-middle">
										<Marks row={row} used={used} possible={possible} active={active} />
									</span>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>

			{/* Phones: one block per row. */}
			<ol className="space-y-2 md:hidden">
				{TABLE.map((row) => {
					const active = rowIsActive(row, settings)
					const used = usedRow === row.id
					return (
						<li key={row.id} data-row-card={row.id} data-used={used} className={`rounded-lg border p-2.5 text-sm ${used ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-white/[0.03]"} ${active ? "" : "opacity-45"}`}>
							<p className="flex flex-wrap items-center gap-1.5">
								<span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-200">{row.id}</span>
								<Marks row={row} used={used} possible={possibleRows.has(row.id)} active={active} />
							</p>
							<p className="mt-1.5 text-gray-200">
								<span className="text-gray-400">{fromText(row)}</span> · <b className="text-white">{EVENT_LABEL[row.event]}</b>
								{row.guard && <span className="text-gray-300"> when {GUARDS[row.guard].says}</span>} → <b className={row.to === "same" ? "text-gray-300" : "text-green-300"}>{toText(row)}</b>
							</p>
							<p className="mt-1 text-gray-400">{row.says}</p>
						</li>
					)
				})}
			</ol>
		</div>
	)
}

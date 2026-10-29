// Mood, Everything: four columns (Feel, About, Style, Genre), each with its "all of" / "any of" switch and its rows
// counted under that mode. Desktop: side by side, each column scrolls inside the panel. Phones: stacked, rows two across.
import type { SubTabView } from "../DiscoverControls"
import { ColumnHead, ColumnRows } from "./Columns"
import { CAPS, COLUMNS, atCap, barScale, pickCount } from "./mood-model"
import { useMoodTab } from "./useMoodData"

export function EverythingTab({ view }: { view: SubTabView }) {
	const tab = useMoodTab(view)
	const { state } = view.filters
	const total = tab.inputs.total
	const columns = COLUMNS.map(({ group, label }) => {
		const rows = tab.rows[group]
		const mode = tab.modes[group]
		return (
			<section
				key={group}
				aria-label={label}
				className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${view.phone ? "" : "flex-1"}`}
			>
				<ColumnHead
					group={group}
					label={label}
					picked={pickCount(state, group)}
					cap={CAPS[group]}
					refusedAt={tab.refusedAt[group] ?? 0}
					mode={mode}
					onMode={(next) => tab.setMode(group, next)}
				/>
				<ColumnRows
					rows={rows}
					of={barScale(rows, total, mode)}
					phone={view.phone}
					// A row that leaves nothing is inert; at the cap a tap is refused (the count nudges).
					onToggle={(row) => {
						if (!row.dead || atCap(state, group)) tab.toggle(row)
					}}
				/>
			</section>
		)
	})
	if (view.phone) return <div className="flex flex-col gap-5">{columns}</div>
	return <div className="flex h-full min-h-0 gap-5 px-5 py-3">{columns}</div>
}

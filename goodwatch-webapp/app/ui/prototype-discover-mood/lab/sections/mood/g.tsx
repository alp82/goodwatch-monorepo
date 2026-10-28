// PROTOTYPE (Discover lab, mood g): d's mixer in four columns. The recipe line stays on top; each column (Feel, About,
// Style, Genre) sits under the filter sheet's quiet group heading, and its rows sort by what fits your mix: picks
// first, then the choice that leaves the most. Bars are each choice's share of the current list, scaled with transform
// only, and rows glide to their new place when a pick changes the order. Round 8: the picture headers became headings.
import type { SectionProps } from "../../types"
import { ColumnHead, ColumnRows } from "./columns"
import { type FitKind, RecipeLine, byFit, fitRows } from "./fit"
import { TypeSwitch, useMoods } from "./parts"

export const COLUMNS: { kind: FitKind; label: string }[] = [
	{ kind: "moods", label: "Feel" },
	{ kind: "themes", label: "About" },
	{ kind: "styles", label: "Style" },
	{ kind: "genres", label: "Genre" },
]

export function MoodG({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const all = fitRows(d, m)
	const columns = COLUMNS.map((c) => {
		const rows = byFit(all.filter((r) => r.kind === c.kind))
		const picked = rows.filter((r) => r.on).length
		// Bars are a share of the current list; a group's "any of" count can pass it, so the column max caps the scale.
		const of = Math.max(d.total ?? 0, ...rows.map((r) => r.n ?? 0), 1)
		return (
			<div key={c.kind} className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${phone ? "" : "flex-1"}`}>
				<ColumnHead kind={c.kind} label={c.label} picked={picked} note={picked > 1 ? "any of" : undefined} />
				<ColumnRows rows={rows} of={of} phone={phone} />
			</div>
		)
	})
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeLine d={d} m={m} size="text-[17px]" />
				<div className="flex">
					<TypeSwitch d={d} />
				</div>
				{columns}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<RecipeLine d={d} m={m} />
				</div>
				<TypeSwitch d={d} />
			</div>
			<div className="flex min-h-0 flex-1 gap-5">{columns}</div>
		</div>
	)
}

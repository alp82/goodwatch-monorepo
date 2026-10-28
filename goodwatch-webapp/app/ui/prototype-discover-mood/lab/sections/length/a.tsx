// PROTOTYPE (Discover lab) Length a: two groups of big picks, Movies and Episodes, each with its real count, and the
// minutes slider under them for anything in between.
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, Tile, pad, useRangeCounts } from "../released/parts"
import { LEN_MAX, asRange, fmtLen, isAnyLength, lengthRange, setLength, toggleLength } from "./parts"

interface Pick {
	label: string
	sub: string
	range: [number, number]
}

export const MOVIE_PICKS: Pick[] = [
	{ label: "Under 90 min", sub: "Quick watch", range: [0, 90] },
	{ label: "Under 2 h", sub: "A regular evening", range: [0, 120] },
	{ label: "Over 2 h", sub: "Settle in", range: [120, LEN_MAX] },
	{ label: "3 h or more", sub: "Epics", range: [180, LEN_MAX] },
]

export const EPISODE_PICKS: Pick[] = [
	{ label: "Under 25 min", sub: "Sitcom length", range: [0, 25] },
	{ label: "Under 35 min", sub: "Short episodes", range: [0, 35] },
	{ label: "About 45 min", sub: "35 to 55 min", range: [35, 55] },
	{ label: "An hour or more", sub: "Long episodes", range: [60, LEN_MAX] },
]

export function LengthA({ d, phone }: SectionProps) {
	const range = lengthRange(d.filters.state)
	const type = d.filters.state.type
	const groups = [
		{ id: "movies", label: "Movies", picks: MOVIE_PICKS, dim: type === "show" },
		{ id: "episodes", label: "Episodes", picks: EPISODE_PICKS, dim: type === "movie" },
	]
	const counts = useRangeCounts(
		d,
		"runtime",
		groups.flatMap((g) => g.picks.map((p) => asRange(p.range))),
	)
	let i = 0
	return (
		<div className={`${pad(phone)} flex flex-col ${phone ? "gap-5" : "gap-5"}`}>
			<div className={phone ? "flex flex-col gap-5" : "grid grid-cols-2 gap-8"}>
				{groups.map((g) => (
					<div key={g.id} className={g.dim ? "opacity-60" : ""}>
						<GroupLabel right={g.id === "episodes" && <ResetLink show={!isAnyLength(range)} onClick={() => setLength(d, [0, LEN_MAX])} />}>
							{g.label}
						</GroupLabel>
						<div className="grid grid-cols-2 gap-2">
							{g.picks.map((p) => {
								const n = counts[i++]
								return (
									<Tile
										key={p.label}
										label={p.label}
										sub={p.sub}
										count={n}
										active={range[0] === p.range[0] && range[1] === p.range[1]}
										onClick={() => toggleLength(d, p.range)}
									/>
								)
							})}
						</div>
					</div>
				))}
			</div>
			<div>
				<GroupLabel>Minutes</GroupLabel>
				<RangeSlider label="Length" min={0} max={LEN_MAX} step={5} value={range} format={fmtLen} onCommit={(r) => setLength(d, r)} />
			</div>
		</div>
	)
}

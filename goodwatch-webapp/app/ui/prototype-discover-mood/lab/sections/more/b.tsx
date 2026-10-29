// PROTOTYPE (Discover lab, round 16) More b: a's sub-tabs, each choice as a histogram over its slider (the span in
// the heading, bars amber inside it), presets as chips under it. Lab-only, simulated counts (store.ts).
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { pad } from "../released/parts"
import { Block, RoiTiles, StatusChips, offFor } from "./a"
import { CountChip, GroupHead, Histogram, StopSlider, shownSpan, toggleRange, useSim } from "./parts"
import { type MoreKey, type MoreState, PRESETS, isAny, sameIdx, setMore, useMore } from "./store"

const NAME: Record<MoreKey, string> = {
	votes: "Ratings",
	rank: "Popularity rank",
	budget: "Budget",
	revenue: "Box office",
	seasons: "Seasons",
	finish: "Time to finish",
}

function HistBlock({ k, d, x, height }: { k: MoreKey; d: ProtoDiscover; x: MoreState; height: number }) {
	const sim = useSim(d, x)
	const set = !isAny(k, x[k])
	return (
		<>
			<GroupHead
				title={NAME[k]}
				note={<span className={set ? "font-semibold text-amber-300" : ""}>{shownSpan(k, x[k])}</span>}
				set={set}
				onAny={() => setMore({ [k]: null })}
			/>
			<div>
				<Histogram k={k} value={x[k]} d={d} x={x} height={height} />
				<StopSlider k={k} value={x[k]} label={NAME[k]} />
			</div>
			<div className="flex flex-wrap gap-1.5">
				{PRESETS[k].map((p) => (
					<CountChip key={p.label} label={p.label} count={sim.range(k, p.range)} active={sameIdx(x[k], p.range)} onClick={() => toggleRange(x, k, p.range)} />
				))}
			</div>
		</>
	)
}

export function MoreB({ d, phone, morePart: part = "reach" }: SectionProps) {
	const x = useMore()
	const page = `${pad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`
	if (part === "reach")
		return (
			<div className={page}>
				<Block>
					<HistBlock k="votes" d={d} x={x} height={phone ? 56 : 72} />
				</Block>
				<Block>
					<HistBlock k="rank" d={d} x={x} height={phone ? 56 : 72} />
				</Block>
			</div>
		)
	if (part === "money") {
		const off = offFor(d, "movie")
		return (
			<div className={page}>
				<Block off={off}>
					<HistBlock k="budget" d={d} x={x} height={phone ? 56 : 72} />
				</Block>
				<Block off={off}>
					<HistBlock k="revenue" d={d} x={x} height={phone ? 56 : 44} />
					<RoiTiles d={d} x={x} />
				</Block>
			</div>
		)
	}
	const off = offFor(d, "show")
	return (
		<div className={page}>
			<Block off={off}>
				<HistBlock k="seasons" d={d} x={x} height={phone ? 56 : 72} />
			</Block>
			<Block off={off}>
				<GroupHead title="Status" set={x.status !== null} onAny={() => setMore({ status: null })} />
				<StatusChips d={d} x={x} />
				<div className="mt-1 flex flex-col gap-3">
					<HistBlock k="finish" d={d} x={x} height={phone ? 56 : 40} />
				</div>
			</Block>
		</div>
	)
}

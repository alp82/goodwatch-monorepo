// PROTOTYPE (Discover lab, round 16) More a: own Watch sub-tabs, Popularity · Budget · Shows, each choice as preset
// tiles with counts and a stepped slider as the fine control (length d's look). Budget shows with movies, Shows with
// shows. Lab-only: the grid doesn't follow (store.ts).
import type { ReactNode } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { pad } from "../released/parts"
import { CountChip, GroupHead, PresetTiles, StopSlider, useSim } from "./parts"
import { type MoreKey, type MoreState, ROI_LABEL, type Roi, STATUS_LABEL, type ShowStatus, isAny, setMore, useMore } from "./store"
import { Tile } from "../released/parts"

const NAME: Record<MoreKey, string> = {
	votes: "How many ratings",
	rank: "Popularity",
	budget: "Budget",
	revenue: "Box office",
	seasons: "Seasons",
	finish: "Time to finish",
}

/** Dims a block whose kind is out of the list (Movies only hides shows' facts), as Length d does. */
export function offFor(d: ProtoDiscover, kind: "movie" | "show" | "all") {
	const t = d.filters.state.type
	return kind !== "all" && t !== "all" && t !== kind
}

export function Block({ off, children }: { off?: boolean; children: ReactNode }) {
	return <div className={`flex min-w-0 flex-col gap-3 transition-opacity ${off ? "opacity-45" : ""}`}>{children}</div>
}

function RangeBlock({ k, d, x, phone, cols }: { k: MoreKey; d: ProtoDiscover; x: MoreState; phone: boolean; cols: [string, string] }) {
	const base = useSim(d, x).base(k)
	return (
		<>
			<GroupHead title={NAME[k]} note={base != null ? compactCount(base) : ""} set={!isAny(k, x[k])} onAny={() => setMore({ [k]: null })} />
			<PresetTiles k={k} x={x} d={d} cols={phone ? cols[0] : cols[1]} />
			<StopSlider k={k} value={x[k]} label={NAME[k]} />
		</>
	)
}

export function RoiTiles({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="grid grid-cols-2 gap-2">
			{(["hit", "flop"] as Roi[]).map((r) => (
				<Tile key={r} label={ROI_LABEL[r].label} sub={ROI_LABEL[r].sub} count={sim.roi(r)} active={x.roi === r} onClick={() => setMore({ roi: x.roi === r ? null : r })} />
			))}
		</div>
	)
}

export function StatusChips({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="flex flex-wrap gap-1.5">
			{(["running", "ended", "canceled"] as ShowStatus[]).map((v) => (
				<CountChip key={v} label={STATUS_LABEL[v]} count={sim.status(v)} active={x.status === v} onClick={() => setMore({ status: x.status === v ? null : v })} />
			))}
		</div>
	)
}

function Page({ phone, children }: { phone: boolean; children: ReactNode }) {
	return <div className={`${pad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`}>{children}</div>
}

export function MoreA({ d, phone, morePart: part = "reach" }: SectionProps) {
	const x = useMore()
	const two: [string, string] = ["grid-cols-2", "grid-cols-2"]
	if (part === "reach")
		return (
			<Page phone={phone}>
				<Block>
					<RangeBlock k="votes" d={d} x={x} phone={phone} cols={two} />
				</Block>
				<Block>
					<RangeBlock k="rank" d={d} x={x} phone={phone} cols={["grid-cols-2", "grid-cols-3"]} />
				</Block>
			</Page>
		)
	if (part === "money") {
		const off = offFor(d, "movie")
		return (
			<Page phone={phone}>
				<Block off={off}>
					<RangeBlock k="budget" d={d} x={x} phone={phone} cols={two} />
				</Block>
				<Block off={off}>
					<RangeBlock k="revenue" d={d} x={x} phone={phone} cols={["grid-cols-2", "grid-cols-3"]} />
					<RoiTiles d={d} x={x} />
				</Block>
			</Page>
		)
	}
	const off = offFor(d, "show")
	return (
		<Page phone={phone}>
			<Block off={off}>
				<RangeBlock k="seasons" d={d} x={x} phone={phone} cols={two} />
			</Block>
			<Block off={off}>
				<GroupHead title="Status" set={x.status !== null} onAny={() => setMore({ status: null })} />
				<StatusChips d={d} x={x} />
				<div className="mt-2 flex flex-col gap-3">
					<RangeBlock k="finish" d={d} x={x} phone={phone} cols={two} />
				</div>
			</Block>
		</Page>
	)
}

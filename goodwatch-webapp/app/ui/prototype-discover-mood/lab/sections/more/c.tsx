// PROTOTYPE (Discover lab, round 16) More c: one "More" sub-tab at the end of Watch with every choice as chips in
// three columns, Popularity | Movies | Shows (phones: stacked). No sliders: quick picks only. Lab-only (store.ts).
import { compactCount } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, pad } from "../released/parts"
import { offFor } from "./a"
import { CountChip, kindBase, toggleRange, useSim } from "./parts"
import { type MoreKey, type MoreState, PRESETS, type Roi, STATUS_LABEL, type ShowStatus, isAny, sameIdx, setMore, useMore } from "./store"

/** Chips read best as numbers for some, as names for others. */
const BY_SUB: Partial<Record<MoreKey, true>> = { votes: true, budget: true, finish: true }
const NAME: Record<MoreKey, string> = {
	votes: "How many ratings",
	rank: "Popularity",
	budget: "Budget",
	revenue: "Box office",
	seasons: "Seasons",
	finish: "Time to finish",
}

function Group({ k, d, x }: { k: MoreKey; d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div>
			<GroupLabel right={<ResetLink show={!isAny(k, x[k])} onClick={() => setMore({ [k]: null })} />}>{NAME[k]}</GroupLabel>
			<div className="flex flex-wrap gap-1.5">
				{PRESETS[k].map((p) => (
					<CountChip
						key={p.label}
						label={BY_SUB[k] ? p.sub.replace(/ ratings$/, "") : p.label}
						count={sim.range(k, p.range)}
						active={sameIdx(x[k], p.range)}
						onClick={() => toggleRange(x, k, p.range)}
					/>
				))}
			</div>
		</div>
	)
}

function Column({ title, count, off, children }: { title: string; count: number | null; off?: boolean; children: React.ReactNode }) {
	return (
		<div className={`flex min-w-0 flex-col gap-5 transition-opacity ${off ? "opacity-45" : ""}`}>
			<div className="flex h-7 items-center gap-2.5">
				<h4 className="text-[15px] font-semibold text-gray-100">{title}</h4>
				<span className="text-[13px] tabular-nums text-gray-500">{count != null ? compactCount(count) : ""}</span>
			</div>
			{children}
		</div>
	)
}

export function MoreC({ d, phone }: SectionProps) {
	const x = useMore()
	const sim = useSim(d, x)
	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-8" : "grid grid-cols-3 gap-9"}`}>
			<Column title="How known" count={kindBase(d, "all")}>
				<Group k="votes" d={d} x={x} />
				<Group k="rank" d={d} x={x} />
			</Column>
			<Column title="Movies" count={kindBase(d, "movie")} off={offFor(d, "movie")}>
				<Group k="budget" d={d} x={x} />
				<div>
					<GroupLabel right={<ResetLink show={!isAny("revenue", x.revenue) || x.roi !== null} onClick={() => setMore({ revenue: null, roi: null })} />}>Box office</GroupLabel>
					<div className="flex flex-wrap gap-1.5">
						{PRESETS.revenue.map((p) => (
							<CountChip key={p.label} label={p.label} count={sim.range("revenue", p.range)} active={sameIdx(x.revenue, p.range)} onClick={() => toggleRange(x, "revenue", p.range)} />
						))}
						{(["hit", "flop"] as Roi[]).map((r) => (
							<CountChip key={r} label={r === "hit" ? "Made 3x its budget" : "Lost money"} count={sim.roi(r)} active={x.roi === r} onClick={() => setMore({ roi: x.roi === r ? null : r })} />
						))}
					</div>
				</div>
			</Column>
			<Column title="Shows" count={kindBase(d, "show")} off={offFor(d, "show")}>
				<Group k="seasons" d={d} x={x} />
				<div>
					<GroupLabel right={<ResetLink show={x.status !== null} onClick={() => setMore({ status: null })} />}>Status</GroupLabel>
					<div className="flex flex-wrap gap-1.5">
						{(["running", "ended", "canceled"] as ShowStatus[]).map((v) => (
							<CountChip key={v} label={STATUS_LABEL[v]} count={sim.status(v)} active={x.status === v} onClick={() => setMore({ status: x.status === v ? null : v })} />
						))}
					</div>
				</div>
				<Group k="finish" d={d} x={x} />
			</Column>
		</div>
	)
}

// PROTOTYPE (Discover lab, round 17) More d: a's layout, quiet tiles with a drawn glyph that grows along the row
// (a crowd, signal bars, $ to $$$$, coin stacks, a filling clock). Gray at rest, amber when picked. Hit and Flop
// carry a trend line, the Status chips a state mark. Round 18: Seasons draws a small episode grid that grows.
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { type PresetsProps, MoreView, type Skin } from "./a"
import { PresetGlyph, RoiGlyph, StatusMark } from "./glyphs"
import { toggleRange, useSim } from "./parts"
import { type MoreState, PRESETS, ROI_LABEL, type Roi, STATUS_LABEL, type ShowStatus, sameIdx, setMore } from "./store"
import { MarkChip, RichTile } from "./tiles"

export function GlyphPresets({ k, x, d, cols }: PresetsProps) {
	const sim = useSim(d, x)
	return (
		<div className={`grid gap-2 ${cols}`}>
			{PRESETS[k].map((p, i) => (
				<RichTile
					key={p.label}
					label={p.label}
					sub={p.sub}
					count={sim.range(k, p.range)}
					active={sameIdx(x[k], p.range)}
					onClick={() => toggleRange(x, k, p.range)}
					art={<PresetGlyph k={k} i={i} />}
					artH={k === "seasons" ? "h-6" : undefined}
				/>
			))}
		</div>
	)
}

export function GlyphRoi({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="grid grid-cols-2 gap-2">
			{(["hit", "flop"] as Roi[]).map((r) => (
				<RichTile
					key={r}
					label={ROI_LABEL[r].label}
					sub={ROI_LABEL[r].sub}
					count={sim.roi(r)}
					active={x.roi === r}
					onClick={() => setMore({ roi: x.roi === r ? null : r })}
					art={<RoiGlyph r={r} />}
				/>
			))}
		</div>
	)
}

export function MarkedStatus({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="flex flex-wrap gap-1.5">
			{(["running", "ended", "canceled"] as ShowStatus[]).map((v) => (
				<MarkChip
					key={v}
					label={STATUS_LABEL[v]}
					mark={<StatusMark s={v} />}
					count={sim.status(v)}
					active={x.status === v}
					onClick={() => setMore({ status: x.status === v ? null : v })}
				/>
			))}
		</div>
	)
}

const SKIN: Skin = { Presets: GlyphPresets, Roi: GlyphRoi, Status: MarkedStatus }

export function MoreD(props: SectionProps) {
	return <MoreView {...props} skin={SKIN} />
}

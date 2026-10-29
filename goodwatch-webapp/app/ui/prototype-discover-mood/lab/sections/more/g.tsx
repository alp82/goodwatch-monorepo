// PROTOTYPE (Discover lab, round 18) More g: d's glyphs in e's muted color. Every group keeps d's glyph (Seasons the
// small episode grid) drawn in the group's soft hue; behind it only a quiet glow from the glyph's corner, stronger for
// the bigger presets, and a faint hue edge. The glyph is the hero, the wash supports it. Picked tiles fade in a light
// fill of their hue and the glyph turns a deep shade of it. Status and Time to finish stay gray at rest; picked, they
// keep a's white fill and only the mark or clock takes a light hue, so the page keeps its contrast.
import { motion } from "framer-motion"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { type PresetsProps, MoreView, type Skin } from "./a"
import { HUES, type Hue, hsla } from "./e"
import { PresetGlyph, RoiGlyph, StatusMark } from "./glyphs"
import { toggleRange, useSim } from "./parts"
import { type MoreKey, type MoreState, PRESETS, ROI_LABEL, type Roi, STATUS_LABEL, type ShowStatus, sameIdx, setMore } from "./store"
import { MarkChip, RichTile, type TileState } from "./tiles"

/** The quiet groups' hues: only a picked glyph shows them. */
const FINISH = { h: 186, s: 34 }
const STATUS_HUE: Record<ShowStatus, { h: number; s: number }> = {
	running: { h: 148, s: 38 },
	ended: { h: 214, s: 30 },
	canceled: { h: 2, s: 40 },
}

/** The glyph's color: the hue at rest, a deep shade on the picked fill, gray when dead (the tile's artTone). */
const glyphColor = (c: Hue, { active, dead }: TileState) =>
	active ? `hsl(${c.h}, ${Math.min(c.s + 6, 48)}%, 30%)` : dead ? undefined : `hsl(${c.h}, ${c.s + 12}%, 68%)`

/** Seasons' grid shades, best to weakest episode. */
function gridTones(c: Hue, { active }: TileState): [string, string, string] {
	const s = Math.min(c.s + 10, 48)
	return active
		? [`hsl(${c.h}, ${s}%, 28%)`, `hsl(${c.h}, ${s - 4}%, 42%)`, `hsl(${c.h}, ${s - 8}%, 58%)`]
		: [`hsl(${c.h}, ${s}%, 76%)`, `hsl(${c.h}, ${s - 4}%, 61%)`, `hsl(${c.h}, ${s - 8}%, 47%)`]
}

/** The glow behind the glyph and the picked fill. `t` is the preset's strength, 0 to 1. */
function Glow({ c, t, active, dead }: { c: Hue; t: number; active: boolean; dead: boolean }) {
	// Softer than e: about two thirds of its strongest wash, and one shape for every group.
	const a = c.max * 0.68 * (0.25 + 0.75 * t)
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
			<span className="absolute inset-0" style={{ opacity: dead ? 0.2 : 1 }}>
				<span className="absolute inset-0" style={{ background: `radial-gradient(120% 150% at 0% 0%, ${hsla(c, a)} 0%, ${hsla(c, 0)} 70%)` }} />
				<span className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${hsla(c, 0.06 + 0.12 * t, 70)}` }} />
			</span>
			<motion.span
				initial={false}
				animate={{ opacity: active ? 1 : 0 }}
				transition={{ duration: 0.18 }}
				className="absolute inset-0"
				style={{ background: `hsl(${c.h}, ${Math.min(c.s + 8, 52)}%, 78%)` }}
			/>
		</span>
	)
}

const soft = (c: Hue) => ({ color: `hsl(${c.h}, ${c.s}%, 64%)` })

/** Time to finish: a's gray tile with d's clock; picked, white with a teal clock. */
function FinishPresets({ k, x, d, cols }: PresetsProps) {
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
					art={({ active }) => (
						<span style={active ? { color: `hsl(${FINISH.h}, ${FINISH.s}%, 36%)` } : undefined}>
							<PresetGlyph k={k} i={i} />
						</span>
					)}
				/>
			))}
		</div>
	)
}

function HuePresets(props: PresetsProps) {
	const { k, x, d, cols } = props
	const sim = useSim(d, x)
	const c = HUES[k as MoreKey]
	if (!c) return <FinishPresets {...props} />
	const list = PRESETS[k]
	const n = list.length
	return (
		<div className={`grid gap-2 ${cols}`}>
			{list.map((p, i) => {
				// Popular now is the biggest preset of its row.
				const t = (k === "rank" ? n - i : i + 1) / n
				const count = sim.range(k, p.range)
				const active = sameIdx(x[k], p.range)
				return (
					<RichTile
						key={p.label}
						label={p.label}
						sub={p.sub}
						count={count}
						active={active}
						onClick={() => toggleRange(x, k, p.range)}
						tinted
						art={(s) => (
							<span style={{ color: glyphColor(c, s) }}>
								<PresetGlyph k={k} i={i} tones={k === "seasons" && !s.dead ? gridTones(c, s) : undefined} />
							</span>
						)}
						layer={<Glow c={c} t={t} active={active} dead={!active && count === 0} />}
						subStyle={soft(c)}
						countStyle={soft(c)}
					/>
				)
			})}
		</div>
	)
}

function HueRoi({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="grid grid-cols-2 gap-2">
			{(["hit", "flop"] as Roi[]).map((r) => {
				const c = HUES[r] as Hue
				const count = sim.roi(r)
				const active = x.roi === r
				return (
					<RichTile
						key={r}
						label={ROI_LABEL[r].label}
						sub={ROI_LABEL[r].sub}
						count={count}
						active={active}
						onClick={() => setMore({ roi: active ? null : r })}
						tinted
						art={(s) => (
							<span style={{ color: glyphColor(c, s) }}>
								<RoiGlyph r={r} />
							</span>
						)}
						layer={<Glow c={c} t={0.8} active={active} dead={!active && count === 0} />}
						subStyle={soft(c)}
						countStyle={soft(c)}
					/>
				)
			})}
		</div>
	)
}

/** d's marked chips, gray; a picked chip's mark takes its state's hue. */
function HueStatus({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	return (
		<div className="flex flex-wrap gap-1.5">
			{(["running", "ended", "canceled"] as ShowStatus[]).map((v) => {
				const active = x.status === v
				const c = STATUS_HUE[v]
				return (
					<MarkChip
						key={v}
						label={STATUS_LABEL[v]}
						mark={
							<span className="flex" style={active ? { color: `hsl(${c.h}, ${c.s}%, 36%)` } : undefined}>
								<StatusMark s={v} />
							</span>
						}
						count={sim.status(v)}
						active={active}
						onClick={() => setMore({ status: active ? null : v })}
					/>
				)
			})}
		</div>
	)
}

const SKIN: Skin = { Presets: HuePresets, Roi: HueRoi, Status: HueStatus }

export function MoreG(props: SectionProps) {
	return <MoreView {...props} skin={SKIN} />
}

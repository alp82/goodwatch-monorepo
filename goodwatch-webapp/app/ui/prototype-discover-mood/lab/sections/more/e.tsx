// PROTOTYPE (Discover lab, round 17) More e: a's layout in muted color. Each group has its own soft hue and its own
// way of washing it in, stronger for the bigger presets: ratings a diagonal wash, popularity a glow from the corner
// (Popular now strongest), budget and box office a fill rising from the bottom, seasons a faint wash. Picked tiles
// take the hue as a light fill. Hit is warm, Flop cool. Status and Time to finish stay plain on purpose.
import { motion } from "framer-motion"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { type PresetsProps, MoreView, type Skin, StatusChips } from "./a"
import { RoiGlyph } from "./glyphs"
import { PresetTiles, toggleRange, useSim } from "./parts"
import { type MoreKey, type MoreState, PRESETS, ROI_LABEL, type Roi, sameIdx, setMore } from "./store"
import { RichTile } from "./tiles"

export type Wash = "diagonal" | "corner" | "rise" | "flat"
export interface Hue {
	h: number
	/** Saturation of the wash, kept low. */
	s: number
	wash: Wash
	/** The strongest alpha a wash reaches; quieter groups get less. */
	max: number
}

export const HUES: Partial<Record<MoreKey | Roi, Hue>> = {
	votes: { h: 205, s: 42, wash: "diagonal", max: 0.3 },
	rank: { h: 338, s: 38, wash: "corner", max: 0.34 },
	budget: { h: 152, s: 32, wash: "rise", max: 0.3 },
	revenue: { h: 40, s: 44, wash: "rise", max: 0.3 },
	seasons: { h: 262, s: 30, wash: "flat", max: 0.2 },
	hit: { h: 22, s: 50, wash: "diagonal", max: 0.26 },
	flop: { h: 214, s: 30, wash: "diagonal", max: 0.26 },
}

export const hsla = (c: Hue, a: number, l = 62) => `hsla(${c.h}, ${c.s}%, ${l}%, ${a.toFixed(3)})`

/** The wash and the picked fill behind a tile. `t` is the preset's strength, 0 to 1. */
function Layer({ c, t, active, dead }: { c: Hue; t: number; active: boolean; dead: boolean }) {
	const a = c.max * (0.3 + 0.7 * t)
	const bg =
		c.wash === "diagonal"
			? `linear-gradient(135deg, ${hsla(c, a)} 0%, ${hsla(c, a * 0.25)} 100%)`
			: c.wash === "corner"
				? `radial-gradient(130% 150% at 100% 0%, ${hsla(c, a * 1.15)} 0%, ${hsla(c, 0)} 72%)`
				: c.wash === "flat"
					? hsla(c, a * 0.75)
					: undefined
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
			<span className="absolute inset-0 transition-opacity duration-200" style={{ opacity: dead ? 0.25 : 1 }}>
				{bg && <span className="absolute inset-0" style={{ background: bg }} />}
				{c.wash === "rise" && (
					<span
						className="absolute inset-x-0 bottom-0"
						style={{ height: `${Math.round(30 + 70 * t)}%`, background: `linear-gradient(to top, ${hsla(c, a * 1.1)}, ${hsla(c, a * 0.15)})` }}
					/>
				)}
				<span className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${hsla(c, 0.08 + 0.14 * t, 70)}` }} />
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

const soft = (c: Hue) => ({ color: `hsl(${c.h}, ${c.s}%, 66%)` })

function HuePresets(props: PresetsProps) {
	const { k, x, d, cols } = props
	const sim = useSim(d, x)
	const c = HUES[k]
	if (!c) return <PresetTiles {...props} />
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
						layer={<Layer c={c} t={t} active={active} dead={!active && count === 0} />}
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
						art={({ active: on, dead }) => (
							<span style={{ color: on ? `hsl(${c.h}, 45%, 32%)` : dead ? undefined : `hsl(${c.h}, ${c.s + 10}%, 68%)` }}>
								<RoiGlyph r={r} />
							</span>
						)}
						layer={<Layer c={c} t={0.8} active={active} dead={!active && count === 0} />}
						subStyle={soft(c)}
						countStyle={soft(c)}
					/>
				)
			})}
		</div>
	)
}

/** Time to finish keeps a's plain tiles and Status a's chips: the quiet part of the page. */
const SKIN: Skin = {
	Presets: (p) => (p.k === "finish" ? <PresetTiles {...p} /> : <HuePresets {...p} />),
	Roi: HueRoi,
	Status: StatusChips,
}

export function MoreE(props: SectionProps) {
	return <MoreView {...props} skin={SKIN} />
}

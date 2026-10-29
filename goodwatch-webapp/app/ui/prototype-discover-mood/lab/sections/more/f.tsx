// PROTOTYPE (Discover lab, round 17) More f: a's layout, with example posters where an example says it best (ratings,
// popularity, budget, box office, Hit and Flop, seasons): three well-known titles per preset (examples.ts), fanned,
// opening out a little when picked. Time to finish keeps d's clock glyphs and Status d's marked chips.
import { motion } from "framer-motion"
import { useState } from "react"
import type { TitleKey } from "~/utils/title-key"
import type { ProtoDiscover } from "../../../kit"
import { POSTER_SM } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { type PresetsProps, MoreView, type Skin } from "./a"
import { GlyphPresets, MarkedStatus } from "./d"
import { EXAMPLES, ROI_EXAMPLES, useExamplePosters } from "./examples"
import { toggleRange, useSim } from "./parts"
import { type MoreState, PRESETS, ROI_LABEL, type Roi, sameIdx, setMore } from "./store"
import { RichTile, type TileState } from "./tiles"

/** One small poster: its box is there before the picture, which fades in once loaded. */
function Mini({ path }: { path: string | null | undefined }) {
	const [loaded, setLoaded] = useState(false)
	return (
		<span className="block h-[45px] w-[30px] overflow-hidden rounded-[4px] bg-white/[0.08] shadow-[0_2px_6px_rgba(0,0,0,.45)] ring-1 ring-black/30">
			{path && (
				<img
					src={`${POSTER_SM}${path}`}
					alt=""
					loading="lazy"
					ref={(el) => {
						if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true)
					}}
					onLoad={() => setLoaded(true)}
					className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
				/>
			)}
		</span>
	)
}

// At rest the posters overlap in a slight fan; picked, they open out. Transform only.
const REST = [
	{ x: 0, rotate: -5 },
	{ x: -7, rotate: 0 },
	{ x: -14, rotate: 5 },
]
const OPEN = [
	{ x: -2, rotate: -8 },
	{ x: -5, rotate: 0, y: -1 },
	{ x: -8, rotate: 8 },
]
const REST2 = [
	{ x: 0, rotate: -5 },
	{ x: -7, rotate: 5 },
]
const OPEN2 = [
	{ x: -2, rotate: -8 },
	{ x: -4, rotate: 8 },
]

function Fan({ keys, posters, s }: { keys: TitleKey[]; posters: Map<TitleKey, string | null>; s: TileState }) {
	const two = keys.length < 3
	return (
		<span className={`flex items-center pl-0.5 transition-opacity ${s.dead ? "opacity-30 grayscale" : ""}`} style={{ width: two ? 58 : 82 }}>
			{keys.map((k, i) => {
				const pose = s.active ? (two ? OPEN2 : OPEN)[i] : (two ? REST2 : REST)[i]
				return (
					<motion.span
						key={k}
						initial={false}
						animate={pose}
						transition={{ type: "spring", stiffness: 420, damping: 30 }}
						className="block shrink-0"
						style={{ zIndex: !two && i === 1 ? 2 : 1 }}
					>
						<Mini path={posters.get(k)} />
					</motion.span>
				)
			})}
		</span>
	)
}

function PosterPresets(props: PresetsProps) {
	const { k, x, d, cols } = props
	const sim = useSim(d, x)
	const posters = useExamplePosters()
	const ex = EXAMPLES[k]
	if (!ex) return <GlyphPresets {...props} />
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
					artH="h-[46px]"
					art={(s) => <Fan keys={ex[i] ?? []} posters={posters} s={s} />}
				/>
			))}
		</div>
	)
}

function PosterRoi({ d, x }: { d: ProtoDiscover; x: MoreState }) {
	const sim = useSim(d, x)
	const posters = useExamplePosters()
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
					artH="h-[46px]"
					art={(s) => <Fan keys={ROI_EXAMPLES[r]} posters={posters} s={s} />}
				/>
			))}
		</div>
	)
}

/** Time to finish has no telling example: d's clocks. */
const SKIN: Skin = {
	Presets: (p) => (p.k === "finish" ? <GlyphPresets {...p} /> : <PosterPresets {...p} />),
	Roi: PosterRoi,
	Status: MarkedStatus,
}

export function MoreF(props: SectionProps) {
	return <MoreView {...props} skin={SKIN} />
}

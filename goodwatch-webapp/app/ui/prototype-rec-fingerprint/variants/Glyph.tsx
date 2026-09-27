// PROTOTYPE - throwaway. The glyph (bolder): your fingerprint drawn as a mark of its own. 74 spokes around a
// circle that stands for most people, in the fingerprint's five families. Spokes reach out where you seek more
// than most people and fold in where you seek less. Tap a spoke for its meaning and titles.
import { useMemo, useState } from "react"
import { AVOID, SEEK } from "../model"
import {
	AttrDetail,
	DISPLAY,
	DISPLAY_FONT,
	type ViewProps,
	attrOf,
	colorOf,
	firstName,
	maxEdge,
} from "../parts"

const C = 300
const R0 = 150
const REACH = 118
const GAP = 2.5 // empty slots between families

export default function Glyph({ data }: ViewProps) {
	const max = maxEdge(data)
	const [sel, setSel] = useState(data.headline.seek[0])
	const [hover, setHover] = useState<string | null>(null)
	const layout = useMemo(() => {
		const slots = data.attrs.length + GAP * data.families.length
		const step = (Math.PI * 2) / slots
		let pos = GAP / 2
		const spokes: { key: string; angle: number }[] = []
		const arcs: { id: string; name: string; from: number; to: number }[] = []
		for (const f of data.families) {
			const from = pos
			for (const k of f.keys) {
				spokes.push({ key: k, angle: (pos + 0.5) * step - Math.PI / 2 })
				pos += 1
			}
			arcs.push({ id: f.id, name: f.name, from: from * step - Math.PI / 2, to: pos * step - Math.PI / 2 })
			pos += GAP
		}
		return { spokes, arcs, step }
	}, [data])
	// Rounded so server and browser print the same path (their trig can differ in the last digits).
	const pt = (r: number, a: number) => [
		Math.round((C + r * Math.cos(a)) * 100) / 100,
		Math.round((C + r * Math.sin(a)) * 100) / 100,
	]
	const focus = attrOf(data, hover ?? sel)

	return (
		<div className="min-h-screen bg-[#07080b] pb-40 text-white">
			<link rel="stylesheet" href={DISPLAY_FONT} />
			<div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:pt-14">
				<div>
					<p className="text-sm text-gray-400">
						{firstName(data)}'s fingerprint, from {data.who.rated.toLocaleString("en")} rated titles
					</p>
					<svg
						viewBox="-45 -15 690 630"
						className="mx-auto mt-2 block w-full max-w-[640px]"
						role="group"
						aria-label="Your fingerprint as a glyph"
					>
						<circle cx={C} cy={C} r={R0} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
						{layout.arcs.map((arc) => {
							const r = R0 + REACH + 30
							const mid = (arc.from + arc.to) / 2
							const [x1, y1] = pt(R0 + REACH + 10, arc.from + 0.02)
							const [x2, y2] = pt(R0 + REACH + 10, arc.to - 0.02)
							const [lx, ly] = pt(r, mid)
							const large = arc.to - arc.from > Math.PI ? 1 : 0
							return (
								<g key={arc.id}>
									<path
										d={`M ${x1} ${y1} A ${R0 + REACH + 10} ${R0 + REACH + 10} 0 ${large} 1 ${x2} ${y2}`}
										fill="none"
										stroke="rgba(255,255,255,0.22)"
										strokeWidth={1}
									/>
									<text
										x={lx}
										y={ly}
										textAnchor="middle"
										dominantBaseline="middle"
										fill="rgba(229,231,235,0.85)"
										fontSize={24}
										fontWeight={700}
										style={{ fontFamily: DISPLAY, letterSpacing: "0.04em" }}
									>
										{arc.name}
									</text>
								</g>
							)
						})}
						{layout.spokes.map((s) => {
							const a = attrOf(data, s.key)
							const len = Math.max(3, (Math.abs(a.edge) / max) * REACH)
							const [x1, y1] = pt(R0, s.angle)
							const [x2, y2] = pt(a.edge >= 0 ? R0 + len : R0 - len, s.angle)
							const on = s.key === (hover ?? sel)
							const [h1x, h1y] = pt(R0 - REACH - 4, s.angle - layout.step / 2)
							const [h2x, h2y] = pt(R0 + REACH + 6, s.angle - layout.step / 2)
							const [h3x, h3y] = pt(R0 + REACH + 6, s.angle + layout.step / 2)
							const [h4x, h4y] = pt(R0 - REACH - 4, s.angle + layout.step / 2)
							return (
								<g key={s.key}>
									<line
										x1={x1}
										y1={y1}
										x2={x2}
										y2={y2}
										stroke={colorOf(a.edge)}
										strokeWidth={on ? 7 : 5}
										strokeLinecap="round"
										opacity={on ? 1 : a.tier === 0 ? 0.35 : 0.85}
									/>
									<path
										d={`M ${h1x} ${h1y} L ${h2x} ${h2y} L ${h3x} ${h3y} L ${h4x} ${h4y} Z`}
										fill="transparent"
										className="cursor-pointer"
										onMouseEnter={() => setHover(s.key)}
										onMouseLeave={() => setHover(null)}
										onClick={() => setSel(s.key)}
									>
										<title>{a.label}</title>
									</path>
								</g>
							)
						})}
					</svg>
					<div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-400">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-1.5 w-4 rounded-full" style={{ background: SEEK }} />
							Reaches out: more than most people
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-1.5 w-4 rounded-full" style={{ background: AVOID }} />
							Folds in: less than most
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-px w-4 bg-white/40" />
							The circle: most people
						</span>
					</div>
				</div>

				<div className="lg:sticky lg:top-20">
					<h1
						className="text-5xl font-black leading-[0.9] md:text-7xl"
						style={{ fontFamily: DISPLAY }}
					>
						{data.archetype.name}
					</h1>
					<p className="mt-3 text-gray-300">{data.archetype.line}</p>
					<div className="mt-5 flex flex-wrap gap-2">
						{[...data.headline.seek.slice(0, 3), ...data.headline.avoid.slice(0, 2)].map((k) => {
							const a = attrOf(data, k)
							const on = sel === k
							return (
								<button
									key={k}
									type="button"
									onClick={() => setSel(k)}
									aria-pressed={on}
									className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${on ? "border-white bg-white text-black" : "border-white/20 text-gray-200 hover:border-white/50"}`}
								>
									<span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(a.edge) }} />
									{a.label}
								</button>
							)
						})}
					</div>
					<div className="mt-8 border-t border-white/10 pt-6">
						<AttrDetail data={data} a={focus} compact />
					</div>
				</div>
			</div>
		</div>
	)
}

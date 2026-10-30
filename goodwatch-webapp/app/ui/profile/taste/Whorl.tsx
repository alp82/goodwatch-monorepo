// The taste fingerprint drawn as a real fingerprint: one whorl of ridges spiralling out from a
// core, cut into the five family sectors (Feel, Humor, World, Story, Craft). The 74 attributes sit round the rim in
// fingerprint order; where an attribute's edge is strong the ridges swell outward and glow, where it's avoided they pull
// in and fade. Ridge endings and the off-centre core come from a fixed seed, so every visit draws the same print.
// Animation: each turn fades and grows in (transform/opacity only); reduced motion shows it at once.
import { memo, useMemo } from "react"
import { FAMILY_NAMES } from "~/domain/taste-attributes"
import { FAMILY_COLOR, FAMILY_ORDER, type FamilyId } from "./model"

/** What the print needs of an attribute. */
export interface WhorlAttribute {
	key: string
	label: string
	family: FamilyId
	edge: number
}

const GAP = 0.05 // radians between family sectors
const TAU = Math.PI * 2
// Server and browser Math can differ in the last digit; round so hydration matches.
const r1 = (n: number) => Math.round(n * 10) / 10

interface Slot {
	a: WhorlAttribute
	angle: number
	from: number
	to: number
}

function layout(attributes: WhorlAttribute[]) {
	const total = attributes.length
	const free = TAU - GAP * FAMILY_ORDER.length
	const slots: Slot[] = []
	const sectors: { id: FamilyId; from: number; to: number }[] = []
	let angle = -Math.PI / 2 + GAP / 2 // Feel's sector starts at the top
	for (const id of FAMILY_ORDER) {
		const keys = attributes.filter((a) => a.family === id)
		const from = angle
		for (const a of keys) {
			const w = free / total
			slots.push({ a, angle: angle + w / 2, from: angle, to: angle + w })
			angle += w
		}
		sectors.push({ id, from, to: angle })
		angle += GAP
	}
	const max = Math.max(...attributes.map((a) => Math.abs(a.edge)), 0.01)
	return { slots, sectors, max }
}

const angDist = (a: number, b: number) => {
	const d = Math.abs(((a - b) % TAU) + TAU) % TAU
	return Math.min(d, TAU - d)
}

/** A smooth edge field round the circle, -1..1: each attribute's edge spread over its neighbours. */
function field(slots: Slot[], max: number) {
	const n = 360
	const values = new Float64Array(n)
	for (let i = 0; i < n; i++) {
		const theta = (i / n) * TAU - Math.PI
		let sum = 0
		let weight = 0
		for (const s of slots) {
			const w = Math.exp(-((angDist(theta, s.angle) / 0.075) ** 2))
			sum += w * (s.a.edge / max)
			weight += w
		}
		values[i] = weight ? sum / weight : 0
	}
	return (theta: number) => {
		const t = ((((theta + Math.PI) % TAU) + TAU) % TAU) / TAU
		return values[Math.floor(t * n) % n]
	}
}

// A tiny fixed-seed hash for the ridge endings.
const hash = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
	return x - Math.floor(x)
}

interface Geometry {
	turns: {
		paths: { d: string; family: FamilyId; key: string; opacity: number }[]
	}[]
	markers: {
		a: WhorlAttribute
		x: number
		y: number
		r: number
		lx: number
		ly: number
	}[]
	labels: { id: FamilyId; x: number; y: number }[]
	sectors: { id: FamilyId; d: string }[]
	box: number
}

/** The print's geometry, also drawn by the profile link-preview cards (og-image/ProfileCard.tsx). */
export function build(
	attributes: WhorlAttribute[],
	turnsCount: number,
	rim: boolean,
): Geometry {
	const { slots, sectors, max } = layout(attributes)
	const E = field(slots, max)
	const r0 = 8
	const rMax = 150
	const spacing = (rMax - r0) / turnsCount
	// Off-centre core, slightly upright oval: what makes it read as a fingertip and not a target.
	const pos = (r: number, theta: number) => {
		const swell = 1 + 0.2 * E(theta)
		const rr = r * swell * (1 + 0.05 * Math.cos(2 * theta + 0.6))
		const coreShift = -18 * (1 - r / rMax) ** 2
		return [
			rr * Math.cos(theta) * 0.86,
			rr * Math.sin(theta) + coreShift,
		] as const
	}
	const turns: Geometry["turns"] = []
	for (let turn = 0; turn < turnsCount; turn++) {
		const paths: Geometry["turns"][number]["paths"] = []
		for (const [si, s] of slots.entries()) {
			// Ridge endings: some slots break, the more so further out.
			const h = hash(turn * 97 + si)
			if (turn > 1 && h < 0.045 + turn * 0.004) continue
			const from = s.from + (h > 0.93 ? 0.03 : 0)
			const to = s.to + 0.004 // overlap the next slot so the ridge reads as one line
			const steps = 5
			let d = ""
			for (let k = 0; k <= steps; k++) {
				const theta = from + ((to - from) * k) / steps
				// One continuous spiral: radius grows with the total angle.
				const phi = turn * TAU + (theta + Math.PI / 2)
				const r =
					r0 + (spacing * phi) / TAU + 0.35 * Math.sin(phi * 1.3 + turn * 0.7)
				const [x, y] = pos(r, theta)
				d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
			}
			const local = s.a.edge / max
			paths.push({
				d,
				family: s.a.family,
				key: s.a.key,
				opacity: r1(
					0.22 + 0.78 * Math.max(0, Math.min(1, (local + 0.6) / 1.6)),
				),
			})
		}
		turns.push({ paths })
	}
	const outer = r0 + spacing * (turnsCount + 1)
	const markers = slots.map((s) => {
		const [x, y] = pos(outer + 8, s.angle)
		const [lx, ly] = pos(outer + 8, s.angle)
		return {
			a: s.a,
			x: r1(x),
			y: r1(y),
			r: r1(1.6 + 3.4 * Math.min(1, Math.abs(s.a.edge) / max)),
			lx: r1(lx),
			ly: r1(ly),
		}
	})
	const labels = sectors.map((sec) => {
		const mid = (sec.from + sec.to) / 2
		const [x, y] = pos(outer + 34, mid)
		return { id: sec.id, x: r1(x), y: r1(y) }
	})
	// Wedges for pointer picks of a whole family.
	const wedges = sectors.map((sec) => {
		const steps = 16
		let d = "M0 0"
		for (let k = 0; k <= steps; k++) {
			const theta = sec.from + ((sec.to - sec.from) * k) / steps
			const [x, y] = pos(outer + 20, theta)
			d += `L${x.toFixed(1)} ${y.toFixed(1)}`
		}
		return { id: sec.id, d: `${d}Z` }
	})
	return {
		turns,
		markers: rim ? markers : [],
		labels: rim ? labels : [],
		sectors: wedges,
		box: rim ? 236 : 186,
	}
}

const STYLE = `
@keyframes gw-ridge-in { from { opacity: 0; transform: scale(.82) rotate(-8deg); } to { opacity: 1; transform: none; } }
.gw-whorl .gw-turn { transform-origin: 0 0; animation: gw-ridge-in .9s cubic-bezier(.2,.7,.2,1) both; }
.gw-whorl path[data-f] { transition: opacity .25s ease; }
.gw-whorl[data-sel] path[data-f] { opacity: .14; }
.gw-whorl[data-sel="feel"] path[data-f="feel"], .gw-whorl[data-sel="humor"] path[data-f="humor"],
.gw-whorl[data-sel="world"] path[data-f="world"], .gw-whorl[data-sel="story"] path[data-f="story"],
.gw-whorl[data-sel="craft"] path[data-f="craft"] { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .gw-whorl .gw-turn { animation: none; } }
`

export const Whorl = memo(function Whorl({
	attributes,
	turns = 18,
	rim = true,
	family,
	selected,
	onFamily,
	onAttribute,
	className = "",
	label,
	animate = true,
	markers = true,
	labels = true,
}: {
	attributes: WhorlAttribute[]
	turns?: number
	rim?: boolean
	family?: FamilyId | null
	selected?: string | null
	onFamily?: (id: FamilyId) => void
	onAttribute?: (key: string) => void
	className?: string
	label: string
	animate?: boolean
	/** The rim dots; Vs me hides them while its tracks take their place. */
	markers?: boolean
	/** The family names round the rim; the profile header leaves them out. */
	labels?: boolean
}) {
	const g = useMemo(
		() => build(attributes, turns, rim),
		[attributes, turns, rim],
	)
	const b = g.box
	return (
		<svg
			viewBox={`${-b} ${-b - 10} ${b * 2} ${b * 2}`}
			className={`gw-whorl ${className}`}
			data-sel={family ?? undefined}
			role="img"
			aria-label={label}
		>
			<style>{STYLE}</style>
			{onFamily &&
				g.sectors.map((s) => (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the family buttons beside the print are the keyboard way
					<path
						key={s.id}
						d={s.d}
						fill="transparent"
						className="cursor-pointer"
						onClick={() => onFamily(s.id)}
					/>
				))}
			{g.turns.map((turn, i) => (
				<g
					// biome-ignore lint/suspicious/noArrayIndexKey: turns are fixed
					key={i}
					className={animate ? "gw-turn" : undefined}
					style={animate ? { animationDelay: `${i * 45}ms` } : undefined}
					pointerEvents="none"
				>
					{turn.paths.map((p, j) => (
						<path
							// biome-ignore lint/suspicious/noArrayIndexKey: geometry is fixed
							key={j}
							d={p.d}
							data-f={p.family}
							fill="none"
							stroke={FAMILY_COLOR[p.family]}
							strokeOpacity={selected && p.key === selected ? 1 : p.opacity}
							strokeWidth={
								selected && p.key === selected ? 3.6 : rim ? 2.5 : 3.4
							}
							strokeLinecap="round"
						/>
					))}
				</g>
			))}
			{(markers ? g.markers : []).map((m) => {
				const on = m.a.key === selected
				const sought = m.a.edge > 0
				return (
					<g key={m.a.key} data-f={m.a.family}>
						<circle
							cx={m.x}
							cy={m.y}
							r={on ? m.r + 2.5 : m.r}
							fill={sought ? FAMILY_COLOR[m.a.family] : "transparent"}
							stroke={FAMILY_COLOR[m.a.family]}
							strokeWidth={sought ? 0 : 1.2}
							opacity={family && family !== m.a.family ? 0.25 : 1}
						/>
						{on && (
							<circle
								cx={m.x}
								cy={m.y}
								r={m.r + 6}
								fill="none"
								stroke="white"
								strokeWidth={1.5}
							/>
						)}
						{onAttribute && (
							// biome-ignore lint/a11y/useKeyWithClickEvents: the attribute rows beside the print are the keyboard way
							<circle
								cx={m.x}
								cy={m.y}
								r={9}
								fill="transparent"
								className="cursor-pointer"
								onClick={() => onAttribute(m.a.key)}
							>
								<title>{m.a.label}</title>
							</circle>
						)}
					</g>
				)
			})}
			{(labels ? g.labels : []).map((l) => (
				<text
					key={l.id}
					x={l.x}
					y={l.y}
					textAnchor="middle"
					dominantBaseline="middle"
					fill={
						family && family !== l.id
							? "rgba(255,255,255,.35)"
							: FAMILY_COLOR[l.id]
					}
					className="text-[13px] font-bold tracking-wider uppercase"
					pointerEvents="none"
				>
					{FAMILY_NAMES[l.id].name}
				</text>
			))}
		</svg>
	)
})

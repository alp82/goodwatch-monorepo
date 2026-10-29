// PROTOTYPE (Discover lab, round 17): small drawn glyphs for the more section's tiles (variants d, e, f). Each preset
// glyph draws the whole scale and fills it up to the preset's step, so the row reads as a ramp at the same size.
// Everything is currentColor: the tile sets gray, amber or a hue.
import type { MoreKey, Roi, ShowStatus } from "./store"

const FAINT = 0.22

/** A crowd of four figures, filled up to `on`. */
function Crowd({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 31 16" className="h-4 w-[31px]" aria-hidden>
			{[0, 1, 2, 3].map((j) => {
				const x = j * 8
				return (
					<g key={j} fill="currentColor" opacity={j < on ? 1 : FAINT}>
						<circle cx={x + 3.5} cy={4.2} r={2.3} />
						<path d={`M${x} 15.5v-2.3a3.5 3.5 0 0 1 7 0v2.3z`} />
					</g>
				)
			})}
		</svg>
	)
}

/** Signal bars, rising. */
function Bars({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 19 16" className="h-4 w-[19px]" aria-hidden>
			{[5, 8, 11.5, 15].map((h, j) => (
				<rect key={j} x={j * 5} y={16 - h} width={3.2} height={h} rx={1} fill="currentColor" opacity={j < on ? 1 : FAINT} />
			))}
		</svg>
	)
}

/** $ to $$$$, as type. */
function Dollars({ on }: { on: number }) {
	return (
		<span className="flex h-4 items-center text-[13px] leading-none font-bold tracking-[-0.04em]" aria-hidden>
			{[0, 1, 2, 3].map((j) => (
				<span key={j} style={{ opacity: j < on ? 1 : FAINT }}>
					$
				</span>
			))}
		</span>
	)
}

/** Three coin stacks of 2, 3 and 4 coins, filled up to `on` stacks. */
function Coins({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 27 16" className="h-4 w-[27px]" aria-hidden>
			{[2, 3, 4].map((n, j) => (
				<g key={j} fill="currentColor" opacity={j < on ? 1 : FAINT}>
					{Array.from({ length: n }, (_, c) => (
						<ellipse key={c} cx={j * 9.5 + 4} cy={14.2 - c * 3.6} rx={3.7} ry={1.55} />
					))}
				</g>
			))}
		</svg>
	)
}

/** A tower of four season slabs, filled from the bottom. */
function Slabs({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 22 16" className="h-4 w-[22px]" aria-hidden>
			{[0, 1, 2, 3].map((j) => (
				<rect key={j} x={j * 1.4} y={13 - j * 4} width={22 - j * 2.8} height={3} rx={1} fill="currentColor" opacity={j < on ? 1 : FAINT} />
			))}
		</svg>
	)
}

/** A clock face filling up, a quarter per step. */
function Clock({ fill }: { fill: number }) {
	const r = 5.4
	const a = fill * Math.PI * 2
	const ex = 8 + r * Math.sin(a)
	const ey = 8 - r * Math.cos(a)
	return (
		<svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
			<circle cx={8} cy={8} r={7} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.55} />
			{fill >= 1 ? (
				<circle cx={8} cy={8} r={r} fill="currentColor" />
			) : (
				<path d={`M8 8L8 ${8 - r}A${r} ${r} 0 ${fill > 0.5 ? 1 : 0} 1 ${ex} ${ey}Z`} fill="currentColor" />
			)}
		</svg>
	)
}

/** A preset's glyph: its step `i` of the key's presets. */
export function PresetGlyph({ k, i }: { k: MoreKey; i: number }) {
	switch (k) {
		case "votes":
			return <Crowd on={i + 1} />
		// Popular now is the strongest signal.
		case "rank":
			return <Bars on={[4, 2, 1][i] ?? 1} />
		case "budget":
			return <Dollars on={i + 1} />
		case "revenue":
			return <Coins on={i + 1} />
		case "seasons":
			return <Slabs on={i + 1} />
		case "finish":
			return <Clock fill={(i + 1) / 4} />
	}
}

/** Hit: a line going up; Flop: going down. */
export function RoiGlyph({ r }: { r: Roi }) {
	const up = r === "hit"
	return (
		<svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
			<path
				d={up ? "M1.5 13.5L8 8l4 3.2 8-8.2" : "M1.5 3L8 8.5l4-3.2 8 8.2"}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.8}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d={up ? "M15.5 2.6h5v5" : "M15.5 13.9h5v-5"} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

/** A show's state: a live dot, a closed (stop) square, a cut circle. Static, no pulse. */
export function StatusMark({ s }: { s: ShowStatus }) {
	return (
		<svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden>
			{s === "running" && (
				<>
					<circle cx={6} cy={6} r={5.2} fill="currentColor" opacity={0.25} />
					<circle cx={6} cy={6} r={2.6} fill="currentColor" />
				</>
			)}
			{s === "ended" && <rect x={2} y={2} width={8} height={8} rx={1.6} fill="currentColor" />}
			{s === "canceled" && (
				<>
					<circle cx={6} cy={6} r={4.6} fill="none" stroke="currentColor" strokeWidth={1.5} />
					<path d="M2.8 9.2L9.2 2.8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
				</>
			)}
		</svg>
	)
}

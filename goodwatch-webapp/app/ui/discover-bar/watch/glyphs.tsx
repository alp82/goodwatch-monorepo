// Small drawn glyphs for the Popularity, Shows and Budget tiles. Each preset glyph draws its whole scale filled up to
// the preset's step, so a row reads as a ramp at one size (16 px high). Everything draws in currentColor; Seasons'
// episode grid can take three shade tones.
import type { SteppedField } from "./stepped-choices"

const FAINT = 0.22

/** A crowd of four figures, filled up to `on`. */
function Crowd({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 31 16" className="h-4 w-[31px]" aria-hidden="true">
			{[0, 1, 2, 3].map((j) => (
				<g key={j} fill="currentColor" opacity={j < on ? 1 : FAINT}>
					<circle cx={j * 8 + 3.5} cy={4.2} r={2.3} />
					<path d={`M${j * 8} 15.5v-2.3a3.5 3.5 0 0 1 7 0v2.3z`} />
				</g>
			))}
		</svg>
	)
}

/** Signal bars, rising, filled up to `on`. */
function Bars({ on }: { on: number }) {
	return (
		<svg viewBox="0 0 19 16" className="h-4 w-[19px]" aria-hidden="true">
			{[5, 8, 11.5, 15].map((h, j) => (
				<rect
					key={h}
					x={j * 5}
					y={16 - h}
					width={3.2}
					height={h}
					rx={1}
					fill="currentColor"
					opacity={j < on ? 1 : FAINT}
				/>
			))}
		</svg>
	)
}

/** $ to $$$$, as type. */
function Dollars({ on }: { on: number }) {
	return (
		<span
			className="flex h-4 items-center text-[13px] leading-none font-bold tracking-[-0.04em]"
			aria-hidden
		>
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
		<svg viewBox="0 0 27 16" className="h-4 w-[27px]" aria-hidden="true">
			{[2, 3, 4].map((n, j) => (
				<g key={n} fill="currentColor" opacity={j < on ? 1 : FAINT}>
					{Array.from({ length: n }, (_, c) => (
						<ellipse
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed coins
							key={c}
							cx={j * 9.5 + 4}
							cy={14.2 - c * 3.6}
							rx={3.7}
							ry={1.55}
						/>
					))}
				</g>
			))}
		</svg>
	)
}

/** Shade per cell, like a ratings grid: mostly good episodes, some weaker ones. Fixed, so it never changes. */
const SHADE = [0, 0, 1, 0, 2, 0, 1, 1, 0, 0, 2, 1, 0, 1, 0, 0, 1, 2, 0, 0, 1]
const OPACITY = [1, 0.64, 0.38]

/** The four season grids grow in steps: 1 to 4 rows of 2 to 5 cells (2, 6, 12, 20), bottom-left aligned. */
const GRIDS = [
	{ rows: 1, cols: 2 },
	{ rows: 2, cols: 3 },
	{ rows: 3, cols: 4 },
	{ rows: 4, cols: 5 },
]
const CELL = 3
const PITCH = 4

/** Shades for the episode grid, best to weakest episode. */
export type GridTones = [string, string, string]

/** A small season by episode ratings grid that grows with the preset. It shows growth, not a real season count. */
function EpisodeGrid({ step, tones }: { step: number; tones?: GridTones }) {
	const grid = GRIDS[Math.max(0, Math.min(3, step))]
	const top = 16 - grid.rows * PITCH + 1
	return (
		<svg viewBox="0 0 19 16" className="h-4 w-[19px]" aria-hidden="true">
			{Array.from({ length: grid.rows * grid.cols }, (_, cell) => {
				const r = Math.floor(cell / grid.cols)
				const c = cell % grid.cols
				const shade = SHADE[(r * 7 + c * 3 + step) % SHADE.length]
				return (
					<rect
						key={`${r}-${c}`}
						x={c * PITCH}
						y={top + r * PITCH}
						width={CELL}
						height={CELL}
						rx={0.8}
						fill={tones ? tones[shade] : "currentColor"}
						opacity={tones ? 1 : OPACITY[shade]}
					/>
				)
			})}
		</svg>
	)
}

/** A clock face filling up, a quarter per step. */
function Clock({ fill }: { fill: number }) {
	const r = 5.4
	const angle = fill * Math.PI * 2
	const x = 8 + r * Math.sin(angle)
	const y = 8 - r * Math.cos(angle)
	return (
		<svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
			<circle
				cx={8}
				cy={8}
				r={7}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.4}
				opacity={0.55}
			/>
			{fill >= 1 ? (
				<circle cx={8} cy={8} r={r} fill="currentColor" />
			) : (
				<path
					d={`M8 8L8 ${8 - r}A${r} ${r} 0 ${fill > 0.5 ? 1 : 0} 1 ${x} ${y}Z`}
					fill="currentColor"
				/>
			)}
		</svg>
	)
}

/** A preset's glyph: step `i` of the field's presets. `tones` shades Seasons' grid. */
export function PresetGlyph({
	field,
	i,
	tones,
}: {
	field: SteppedField
	i: number
	tones?: GridTones
}) {
	switch (field) {
		case "votes":
			return <Crowd on={i + 1} />
		// Popular now is the strongest signal.
		case "popularityRank":
			return <Bars on={[4, 2, 1][i] ?? 1} />
		case "budget":
			return <Dollars on={i + 1} />
		case "boxOffice":
			return <Coins on={i + 1} />
		case "seasons":
			return <EpisodeGrid step={i} tones={tones} />
		case "hours":
			return <Clock fill={(i + 1) / 4} />
	}
}

/** Hit: a line going up; Flop: going down. */
export function ReturnsGlyph({ returns }: { returns: "hit" | "flop" }) {
	const up = returns === "hit"
	const line = {
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8,
		strokeLinecap: "round",
		strokeLinejoin: "round",
	} as const
	return (
		<svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
			<path
				d={up ? "M1.5 13.5L8 8l4 3.2 8-8.2" : "M1.5 3L8 8.5l4-3.2 8 8.2"}
				{...line}
			/>
			<path d={up ? "M15.5 2.6h5v5" : "M15.5 13.9h5v-5"} {...line} />
		</svg>
	)
}

/** A show's state: a live dot, a stop square, a cut circle. Static, no pulse. */
export function StatusMark({
	status,
}: {
	status: "running" | "ended" | "canceled"
}) {
	return (
		<svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
			{status === "running" && (
				<>
					<circle cx={6} cy={6} r={5.2} fill="currentColor" opacity={0.25} />
					<circle cx={6} cy={6} r={2.6} fill="currentColor" />
				</>
			)}
			{status === "ended" && (
				<rect x={2} y={2} width={8} height={8} rx={1.6} fill="currentColor" />
			)}
			{status === "canceled" && (
				<>
					<circle
						cx={6}
						cy={6}
						r={4.6}
						fill="none"
						stroke="currentColor"
						strokeWidth={1.5}
					/>
					<path
						d="M2.8 9.2L9.2 2.8"
						stroke="currentColor"
						strokeWidth={1.5}
						strokeLinecap="round"
					/>
				</>
			)}
		</svg>
	)
}

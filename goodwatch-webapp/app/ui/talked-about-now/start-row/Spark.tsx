// A title's last 14 days of Wikipedia reading as one line, on the title's own scale: the shape is the point, and
// "×9.7" beside it says how big. The day of the reason is marked, the usual (the 28 days' mean before the last
// day) is a faint dashed line. With `hover`, each day answers its value.
import { useState } from "react"
import { type TalkedTitle, compact, liftLabel } from "~/domain/talked-about-now"

const dayOf = (last: string, back: number) =>
	new Date(Date.parse(`${last}T00:00:00Z`) - back * 86_400_000)

const DATE = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
})

/** "13 Oct": a day of the row, as the row says it. */
export const dateLabel = (iso: string) =>
	DATE.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

/** The index of the reason's day in the curve, or null when it is outside. */
export function reasonIndex(title: TalkedTitle, day: string): number | null {
	if (!title.reason) return null
	const back = Math.round(
		(Date.parse(`${day}T00:00:00Z`) -
			Date.parse(`${title.reason.day}T00:00:00Z`)) /
			86_400_000,
	)
	const at = title.curve.length - 1 - back
	return at >= 0 && at < title.curve.length ? at : null
}

export function Spark({
	title,
	day,
	width,
	height,
	hover = false,
	mark = true,
}: {
	title: TalkedTitle
	/** The row's day: the curve's last. */
	day: string
	width: number
	height: number
	hover?: boolean
	mark?: boolean
}) {
	const [at, setAt] = useState<number | null>(null)
	const { curve, usual } = title
	const max = Math.max(...curve, usual, 1)
	const pad = 3
	const x = (i: number) => pad + (i / (curve.length - 1)) * (width - pad * 2)
	const y = (v: number) => height - pad - (v / max) * (height - pad * 2)
	const line = curve
		.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
		.join("")
	const area = `${line}L${x(curve.length - 1)},${height}L${x(0)},${height}Z`
	const id = `tn-sg-${title.mediaType}-${title.tmdbId}-${width}`
	const marked = mark ? reasonIndex(title, day) : null
	const back = (i: number) => curve.length - 1 - i
	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			className="tn-spark"
			role="img"
			aria-label={`Wikipedia reading over ${curve.length} days, ${liftLabel(title.lift)} its usual on ${dateLabel(day)}`}
			onMouseLeave={() => setAt(null)}
		>
			<defs>
				<linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor="#fcd34d" stopOpacity="0.32" />
					<stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${id})`} />
			<line
				x1={pad}
				x2={width - pad}
				y1={y(usual)}
				y2={y(usual)}
				stroke="rgba(255,255,255,0.22)"
				strokeDasharray="1 3"
			/>
			{marked !== null && (
				<line
					x1={x(marked)}
					x2={x(marked)}
					y1={0}
					y2={height}
					stroke="rgba(255,255,255,0.28)"
					strokeDasharray="2 3"
				/>
			)}
			<path
				d={line}
				fill="none"
				stroke="#fcd34d"
				strokeWidth="2"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<circle
				cx={x(curve.length - 1)}
				cy={y(curve[curve.length - 1])}
				r="3.5"
				fill="#fcd34d"
				stroke="#111827"
				strokeWidth="2"
			/>
			{hover &&
				curve.map((_, i) => (
					<rect
						// biome-ignore lint/suspicious/noArrayIndexKey: the days of a fixed series
						key={i}
						x={x(i) - width / curve.length / 2}
						y={0}
						width={width / curve.length}
						height={height}
						fill="transparent"
						onMouseEnter={() => setAt(i)}
					/>
				))}
			{hover && at !== null && (
				<g pointerEvents="none">
					<line
						x1={x(at)}
						x2={x(at)}
						y1={0}
						y2={height}
						stroke="rgba(255,255,255,0.5)"
					/>
					<circle
						cx={x(at)}
						cy={y(curve[at])}
						r="4"
						fill="#fcd34d"
						stroke="#111827"
						strokeWidth="2"
					/>
					<foreignObject
						x={Math.min(Math.max(x(at) - 90, 0), width - 180)}
						y={-36}
						width={180}
						height={32}
					>
						<div className="tn-tip">
							{DATE.format(dayOf(day, back(at)))} · {compact(curve[at])} reads ·{" "}
							<b>{liftLabel(curve[at] / Math.max(usual, 1))}</b>
						</div>
					</foreignObject>
				</g>
			)}
		</svg>
	)
}

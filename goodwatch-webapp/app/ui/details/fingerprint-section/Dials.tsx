// The 12 dials at the top of the fingerprint section: each scale as a small arc in its print family color (track, fill
// from its start or its middle, a dot where the title sits), its name and its word. Hovering a dial (mouse) lights what
// it's read from on the drawing; a click or tap pins it, which dims the other dials.
import type { ScaleReading } from "./reading"

const BG = "#0c0a09"

function ArcGlyph({ s }: { s: ScaleReading }) {
	const R = 20
	const half = 0.72
	const pt = (p: number) => {
		const a = -Math.PI / 2 - half + 2 * half * p
		return [18 + R * Math.cos(a), 24 + R * Math.sin(a)] as const
	}
	const arc = (p0: number, p1: number) => {
		const [x0, y0] = pt(p0)
		const [x1, y1] = pt(p1)
		return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 ${p1 >= p0 ? 1 : 0} ${x1.toFixed(1)} ${y1.toFixed(1)}`
	}
	const from = s.sc.fromMiddle ? 0.5 : 0
	const [dx, dy] = pt(s.position)
	return (
		<svg
			viewBox="0 0 36 14"
			className="h-3.5 w-9 shrink-0 overflow-visible"
			aria-hidden="true"
		>
			<path
				d={arc(0, 1)}
				fill="none"
				stroke={s.color}
				strokeOpacity={0.22}
				strokeWidth={3.2}
				strokeLinecap="round"
			/>
			{s.sc.fromMiddle && (
				<line
					x1={18}
					y1={1.5}
					x2={18}
					y2={6.5}
					stroke="white"
					strokeOpacity={0.3}
					strokeWidth={1}
				/>
			)}
			{Math.abs(s.position - from) > 0.01 && (
				<path
					d={arc(from, s.position)}
					fill="none"
					stroke={s.color}
					strokeOpacity={0.85}
					strokeWidth={3.2}
					strokeLinecap="round"
				/>
			)}
			<circle
				cx={dx.toFixed(1)}
				cy={dy.toFixed(1)}
				r={3.4}
				fill={s.color}
				stroke={BG}
				strokeWidth={1.5}
			/>
		</svg>
	)
}

export function Dials({
	scales,
	active,
	pinned,
	onHover,
	onPin,
}: {
	scales: ScaleReading[]
	/** The dial lighting the drawing (hovered or pinned). */
	active: string | null
	pinned: string | null
	onHover: (name: string | null) => void
	onPin: (name: string) => void
}) {
	return (
		<div className="mb-6 border-b border-white/[0.06] pb-4">
			<ul
				className="grid grid-cols-2 gap-x-4 gap-y-1 @min-[560px]/fp:grid-cols-4 @min-[860px]/fp:grid-cols-6"
				aria-label="The 12 scales"
			>
				{scales.map((s) => {
					const on = active === s.sc.name
					// Only a pinned dial dims the others; hover lights the drawing alone.
					const dim = pinned !== null && pinned !== s.sc.name
					return (
						<li key={s.sc.name} className="min-w-0">
							<button
								type="button"
								aria-pressed={pinned === s.sc.name}
								aria-description={`Between ${s.sc.left.toLowerCase()} and ${s.sc.right.toLowerCase()}. Show what it's read from on the drawing.`}
								onPointerEnter={(e) =>
									e.pointerType === "mouse" && onHover(s.sc.name)
								}
								onPointerLeave={(e) =>
									e.pointerType === "mouse" && onHover(null)
								}
								// Keyboard focus previews like hover; a tap's focus doesn't, so a second tap really unpins.
								onFocus={(e) =>
									e.currentTarget.matches(":focus-visible") &&
									onHover(s.sc.name)
								}
								onBlur={() => onHover(null)}
								onClick={(e) => {
									if (!e.currentTarget.matches(":focus-visible")) onHover(null)
									onPin(s.sc.name)
								}}
								className="-mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-amber-300"
								style={{
									background:
										pinned === s.sc.name
											? `color-mix(in srgb, ${s.color} 12%, transparent)`
											: undefined,
								}}
							>
								<span className="fp-fade" style={{ opacity: dim ? 0.45 : 1 }}>
									<ArcGlyph s={s} />
								</span>
								<span
									className="fp-fade min-w-0 leading-tight"
									style={{ opacity: dim ? 0.45 : 1 }}
								>
									<span className="block truncate text-[11px] text-gray-500">
										{s.sc.name}
									</span>
									<span
										className="block truncate text-[13px] font-semibold"
										style={{ color: on ? s.color : "#e5e7eb" }}
									>
										{s.word}
									</span>
								</span>
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

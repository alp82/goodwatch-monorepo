// PROTOTYPE - throwaway. Round 6 "r6map" pieces: the Explorer tutorial's pointer for a film (it travels from click to
// click, presses, and a ripple answers), and an island with any number of colours (a combination of two or three).
// The rest (sea, headline, timing helper, blob shape, logos) comes from round 5's kit unchanged.
import { type CSSProperties, useId } from "react"
import { GLIDE, blobPath, play } from "../r5map/kit"

/** cqw on both axes (as the 16:9 stage measures) to a position: x in cqw, y in cqh. */
export const pos = (p: { x: number; y: number }) => ({ left: `${p.x}cqw`, top: `${(p.y * 16) / 9}cqh` })

/**
 * The pointer: one hand per click. Each glides from the previous click (or in from the bottom right) to its target,
 * arriving at `at`, presses, and hands over to the next. A ripple rings out at each click. Points in map cqw.
 */
export function Clicks({ points, lead = 650, leave }: { points: { x: number; y: number; at: number }[]; lead?: number; leave?: number }) {
	return (
		<>
			{points.map((p, k) => {
				const from = k ? points[k - 1] : { x: p.x + 16, y: p.y + 14 }
				const next = points[k + 1]
				const style = {
					...pos(p),
					zIndex: 9,
				} as CSSProperties
				const move = {
					"--fx": `${from.x - p.x}cqw`,
					"--fy": `${((from.y - p.y) * 16) / 9}cqh`,
				} as CSSProperties
				const hide = next ? next.at - lead : (leave ?? p.at + 1300)
				return (
					<div key={k} className="lpc-r6map-at" style={style}>
						{/* The ripple, centred on the click. */}
						<div className="lpc-r6map-ripple lpc-r5map-a" style={play(["lpc-r6map-ripple", p.at, 900, "ease-out"])} />
						{/* The hand: its tip is the element's top left. */}
						<div
							className="lpc-r6map-hand lpc-r5map-a"
							style={{
								...move,
								...play(
									[k ? "lpc-r6map-glide" : "lpc-r6map-glide-in", p.at - lead, lead, GLIDE],
									["lpc-r6map-press", p.at, 320, "ease-out"],
									["lpc-r6map-hide", hide, 160, "linear"],
								),
							}}
						>
							<Cursor />
						</div>
					</div>
				)
			})}
		</>
	)
}

const Cursor = () => (
	<svg className="lpc-r6map-cursor" viewBox="0 0 32 40" aria-hidden="true">
		<path d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z" fill="#fff" stroke="#0a0e1a" strokeWidth="2.2" strokeLinejoin="round" />
	</svg>
)

/**
 * An island as the Explorer draws it, with one, two or three colours: the rim runs through them and the picture is
 * tinted in bands. `w` in cqw.
 */
export function Island({
	seed,
	name,
	sub,
	colors,
	picture,
	w,
	ring,
}: {
	seed: string
	name?: string
	sub?: string
	colors: string[]
	picture?: string | null
	w: number
	/** An amber ring around it: picked. Drawn from `ring` ms on. */
	ring?: number
}) {
	const id = useId().replace(/:/g, "")
	const d = blobPath(seed)
	const rim = colors.length > 1 ? `url(#g${id})` : colors[0]
	const band = 100 / colors.length
	return (
		<div className="lpc-r6map-island" style={{ width: `${w}cqw`, height: `${w * 0.7}cqw` }}>
			<svg viewBox="-14 -14 128 98" className="lpc-r6map-island-svg" aria-hidden="true">
				<defs>
					<clipPath id={`c${id}`}>
						<path d={d} />
					</clipPath>
					{colors.length > 1 && (
						<linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
							{colors.map((c, k) => (
								<stop key={k} offset={k / (colors.length - 1)} stopColor={c} />
							))}
						</linearGradient>
					)}
				</defs>
				<path d={d} fill="none" stroke={rim} strokeWidth="16" opacity="0.12" />
				<path d={d} fill="none" stroke={rim} strokeWidth="8" opacity="0.22" />
				<g clipPath={`url(#c${id})`}>
					<rect x="0" y="0" width="100" height="70" fill="#0b0f1c" />
					{picture && <image href={picture} x="-10" y="-10" width="120" height="90" preserveAspectRatio="xMidYMid slice" opacity="0.8" />}
					{colors.map((c, k) => (
						<rect key={k} x={k * band} y="0" width={band} height="70" fill={c} opacity="0.32" />
					))}
					<rect x="0" y="0" width="100" height="70" fill="url(#lpc-r5map-vignette)" />
				</g>
				<path d={d} fill="none" stroke={rim} strokeWidth="2.2" />
				{ring !== undefined && (
					<path d={d} fill="none" stroke="#fbbf24" strokeWidth="3.2" className="lpc-r5map-a" style={play(["lpc-r5map-fade-in", ring, 350])} />
				)}
			</svg>
			{(name || sub) && (
				<div className="lpc-r6map-island-text" style={{ fontSize: `${Math.max(1.35, w * 0.13)}cqw` }}>
					{name && <span className="lpc-r6map-island-name">{name}</span>}
					{sub && <span className="lpc-r6map-island-sub">{sub}</span>}
				</div>
			)}
		</div>
	)
}

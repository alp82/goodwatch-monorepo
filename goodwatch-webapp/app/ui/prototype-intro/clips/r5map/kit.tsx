// PROTOTYPE - throwaway. Shared pieces of the round 5 "r5map" clips (Explorer and Streaming): timed animation styles,
// the headline, the night sea, an island drawn as the real Explorer draws it (an organic blob with a glowing rim in
// its colour, filled with its best title's picture), and a service logo tile.
import { type CSSProperties, Fragment, type ReactNode, useId } from "react"
import type { MapIsland, R5MapData, Service } from "~/server/prototype-intro/r5map.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"
export const GLIDE = "cubic-bezier(.65,0,.35,1)"

export const mapData = (data: IntroData) => (data.extra.r5map ?? null) as R5MapData | null
export const img = (path: string | null | undefined, size = "w342") => (path ? tmdbImageUrl(path, size) : "")
export const fmt = (n: number) => n.toLocaleString("en-US")

type Anim = [name: string, delay: number, duration?: number, ease?: string]

/**
 * Timed animations as inline custom properties the `.lpc-r5map-a` class reads (up to three on one element). Delays and
 * durations are ms at k = 1; the stage's `--k` scales them.
 */
export function play(a: Anim, b?: Anim, c?: Anim, extra?: CSSProperties): CSSProperties {
	const v: Record<string, string> = {}
	const set = (n: string, x: Anim) => {
		v[`--an${n}`] = x[0]
		v[`--d${n}`] = `${x[1]}ms`
		v[`--du${n}`] = `${x[2] ?? 800}ms`
		v[`--ez${n}`] = x[3] ?? SETTLE
	}
	set("", a)
	set("2", b ?? ["lpc-r5map-none", 0, 1])
	set("3", c ?? ["lpc-r5map-none", 0, 1])
	return { ...v, ...extra } as CSSProperties
}

/** A kicker and a headline whose words rise in one by one; `*word*` is amber. Optionally leaves at `out`. */
export function Headline({
	kicker,
	text,
	delay = 200,
	out,
	className = "",
	sub,
}: {
	kicker?: string
	text: string
	delay?: number
	out?: number
	className?: string
	sub?: ReactNode
}) {
	const words = text.split(" ")
	const leave: Anim | undefined = out === undefined ? undefined : ["lpc-r5map-out", out, 600, GLIDE]
	return (
		<div className={`lpc-r5map-head ${className}`}>
			{kicker && (
				<div className="lpc-r5map-kicker lpc-r5map-a" style={play(["lpc-r5map-rise", delay, 700], leave)}>
					{kicker}
				</div>
			)}
			<h2 className="lpc-r5map-h">
				{words.map((w, i) => (
					<Fragment key={i}>
						<span className="lpc-r5map-word">
							<span
								className={`lpc-r5map-a ${w.includes("*") ? "lpc-r5map-accent" : ""}`}
								style={play(["lpc-r5map-word-in", delay + 150 + i * 150, 850], leave)}
							>
								{w.replace(/\*/g, "")}
							</span>
						</span>{" "}
					</Fragment>
				))}
			</h2>
			{sub && (
				<div className="lpc-r5map-sub lpc-r5map-a" style={play(["lpc-r5map-rise", delay + 250 + words.length * 150, 800], leave)}>
					{sub}
				</div>
			)}
		</div>
	)
}

/** The Explorer's night sea: deep blue-black with slow drifting cloud light. */
export const Sea = () => (
	<div className="lpc-r5map-sea">
		<div className="lpc-r5map-clouds lpc-r5map-a" style={play(["lpc-r5map-drift", 0, 16000, "linear"])} />
	</div>
)

// ---------------------------------------------------------------------------------------------------------------
// Islands

/** A small, stable random from a string. */
function rng(seed: string) {
	let h = 2166136261
	for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507)
		h = Math.imul(h ^ (h >>> 13), 3266489909)
		return ((h ^= h >>> 16) >>> 0) / 4294967296
	}
}

/** An organic closed blob in a 100 x 70 box, smooth through 9 jittered points (Catmull-Rom as cubic Béziers). */
export function blobPath(seed: string, w = 100, h = 70) {
	const r = rng(seed)
	const n = 9
	const pts = Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2 + r() * 0.25
		const k = 0.84 + r() * 0.2
		return [w / 2 + Math.cos(a) * (w / 2) * k, h / 2 + Math.sin(a) * (h / 2) * k]
	})
	let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n]
		const p1 = pts[i]
		const p2 = pts[(i + 1) % n]
		const p3 = pts[(i + 2) % n]
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
		d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
	}
	return `${d}Z`
}

/**
 * An island as the Explorer draws it: a blob filled with a picture tinted in its colour, a soft glow and a bright rim.
 * `w` is its width in cqw. `colors` with two entries draws a merged island whose rim runs from one to the other.
 */
export function Blob({
	seed,
	name,
	sub,
	colors,
	picture,
	w,
	className = "",
	style,
	children,
}: {
	seed: string
	name?: ReactNode
	sub?: ReactNode
	colors: string[]
	picture?: string | null
	w: number
	className?: string
	style?: CSSProperties
	children?: ReactNode
}) {
	const id = useId().replace(/:/g, "")
	const d = blobPath(seed)
	const rim = colors.length > 1 ? `url(#g${id})` : colors[0]
	return (
		<div className={`lpc-r5map-blob ${className}`} style={{ width: `${w}cqw`, height: `${w * 0.7}cqw`, ...style }}>
			<svg viewBox="-14 -14 128 98" className="lpc-r5map-blob-svg" aria-hidden="true">
				<defs>
					<clipPath id={`c${id}`}>
						<path d={d} />
					</clipPath>
					{colors.length > 1 && (
						<linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
							<stop offset="0" stopColor={colors[0]} />
							<stop offset="1" stopColor={colors[1]} />
						</linearGradient>
					)}
				</defs>
				{/* The glow: wide, faint strokes under the rim. */}
				<path d={d} fill="none" stroke={rim} strokeWidth="16" opacity="0.12" />
				<path d={d} fill="none" stroke={rim} strokeWidth="8" opacity="0.22" />
				<g clipPath={`url(#c${id})`}>
					<rect x="0" y="0" width="100" height="70" fill="#0b0f1c" />
					{picture && <image href={picture} x="-10" y="-10" width="120" height="90" preserveAspectRatio="xMidYMid slice" opacity="0.8" />}
					<rect x="0" y="0" width="100" height="70" fill={colors[0]} opacity="0.32" />
					{colors[1] && <rect x="50" y="0" width="50" height="70" fill={colors[1]} opacity="0.32" />}
					<rect x="0" y="0" width="100" height="70" fill="url(#lpc-r5map-vignette)" />
				</g>
				<path d={d} fill="none" stroke={rim} strokeWidth="2.2" />
			</svg>
			{(name || sub) && (
				<div className="lpc-r5map-blob-text" style={{ fontSize: `${Math.max(1.5, w * 0.12)}cqw` }}>
					{name && <span className="lpc-r5map-blob-name">{name}</span>}
					{sub && <span className="lpc-r5map-blob-sub">{sub}</span>}
				</div>
			)}
			{children}
		</div>
	)
}

/** The shared vignette gradient the blobs use; put once in a clip. */
export const BlobDefs = () => (
	<svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
		<defs>
			<radialGradient id="lpc-r5map-vignette" cx="50%" cy="45%" r="70%">
				<stop offset="0.45" stopColor="#000" stopOpacity="0" />
				<stop offset="1" stopColor="#000" stopOpacity="0.55" />
			</radialGradient>
		</defs>
	</svg>
)

export const islandPicture = (i: MapIsland) => img(i.titles.find((t) => t.backdrop)?.backdrop ?? i.titles[0]?.poster, "w500")

/**
 * Spreads islands placed by their real map position so none overlaps (a few rounds of pushing overlapping pairs apart),
 * in cqw. Neighbours stay neighbours.
 */
export function spread(islands: { x: number; y: number; w: number }[], box: { cx: number; cy: number; rx: number; ry: number }) {
	const p = islands.map((i) => ({ x: box.cx + i.x * box.rx, y: box.cy + i.y * box.ry }))
	for (let round = 0; round < 90; round++) {
		for (let a = 0; a < p.length; a++)
			for (let b = a + 1; b < p.length; b++) {
				const dx = p[b].x - p[a].x
				const dy = (p[b].y - p[a].y) / 0.7
				const d = Math.hypot(dx, dy) || 0.01
				const need = (islands[a].w + islands[b].w) / 2 + 1.4
				if (d >= need) continue
				const push = (need - d) / 2
				p[a].x -= (dx / d) * push
				p[b].x += (dx / d) * push
				p[a].y -= (dy / d) * push * 0.7
				p[b].y += (dy / d) * push * 0.7
			}
		for (const q of p) {
			q.x = Math.min(box.cx + box.rx + 5, Math.max(box.cx - box.rx - 5, q.x))
			q.y = Math.min(box.cy + box.ry + 3, Math.max(box.cy - box.ry - 3, q.y))
		}
	}
	return p
}

// ---------------------------------------------------------------------------------------------------------------
// Services

/** A service's logo on a rounded tile. `w` in cqw. */
export function Logo({ s, w, className = "", style }: { s: Service; w: number; className?: string; style?: CSSProperties }) {
	return (
		<img
			src={img(s.logo, w > 8 ? "w300" : "w92")}
			alt={s.name}
			title={s.name}
			className={`lpc-r5map-logo ${className}`}
			style={{ width: `${w}cqw`, height: `${w}cqw`, borderRadius: `${w * 0.22}cqw`, ...style }}
			draggable={false}
		/>
	)
}

export const COUNTRY: Record<string, string> = {
	US: "United States",
	GB: "United Kingdom",
	DE: "Germany",
	FR: "France",
	ES: "Spain",
	BR: "Brazil",
	IN: "India",
	JP: "Japan",
	IT: "Italy",
	CA: "Canada",
	AU: "Australia",
	NL: "Netherlands",
	AT: "Austria",
	CH: "Switzerland",
	MX: "Mexico",
}

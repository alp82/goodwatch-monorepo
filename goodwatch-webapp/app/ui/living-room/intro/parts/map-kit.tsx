// Pieces the streaming and Explorer scenes share: timed animation styles, headlines, the sea, island shapes, service
// logos, country names.
import { type CSSProperties, Fragment, type ReactNode } from "react"
import type { AtlasData, Service } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { tmdbImageUrl } from "~/utils/tmdb-image"

export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"
export const GLIDE = "cubic-bezier(.65,0,.35,1)"

export const mapData = (data: IntroData) =>
	(data.extra.atlas ?? null) as AtlasData | null
export const img = (path: string | null | undefined, size = "w342") =>
	path ? tmdbImageUrl(path, size) : ""
export const fmt = (n: number) => n.toLocaleString("en-US")

type Anim = [name: string, delay: number, duration?: number, ease?: string]

/**
 * Timed animations as inline custom properties the `.intro-atlas-a` class reads (up to three on one element). Delays and
 * durations are ms at k = 1; the stage's `--k` scales them.
 */
export function play(
	a: Anim,
	b?: Anim,
	c?: Anim,
	extra?: CSSProperties,
): CSSProperties {
	const v: Record<string, string> = {}
	const set = (n: string, x: Anim) => {
		v[`--an${n}`] = x[0]
		v[`--d${n}`] = `${x[1]}ms`
		v[`--du${n}`] = `${x[2] ?? 800}ms`
		v[`--ez${n}`] = x[3] ?? SETTLE
	}
	set("", a)
	set("2", b ?? ["intro-atlas-none", 0, 1])
	set("3", c ?? ["intro-atlas-none", 0, 1])
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
	const leave: Anim | undefined =
		out === undefined ? undefined : ["intro-atlas-out", out, 600, GLIDE]
	return (
		<div className={`intro-atlas-head ${className}`}>
			{kicker && (
				<div
					className="intro-atlas-kicker intro-atlas-a"
					style={play(["intro-atlas-rise", delay, 700], leave)}
				>
					{kicker}
				</div>
			)}
			<h2 className="intro-atlas-h">
				{words.map((w, i) => (
					<Fragment key={i}>
						<span className="intro-atlas-word">
							<span
								className={`intro-atlas-a ${w.includes("*") ? "intro-atlas-accent" : ""}`}
								style={play(
									["intro-atlas-word-in", delay + 150 + i * 150, 850],
									leave,
								)}
							>
								{w.replace(/\*/g, "")}
							</span>
						</span>{" "}
					</Fragment>
				))}
			</h2>
			{sub && (
				<div
					className="intro-atlas-sub intro-atlas-a"
					style={play(
						["intro-atlas-rise", delay + 250 + words.length * 150, 800],
						leave,
					)}
				>
					{sub}
				</div>
			)}
		</div>
	)
}

/** The Explorer's night sea: deep blue-black with slow drifting cloud light. */
export const Sea = () => (
	<div className="intro-atlas-sea">
		<div
			className="intro-atlas-clouds intro-atlas-a"
			style={play(["intro-atlas-drift", 0, 16000, "linear"])}
		/>
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
		h ^= h >>> 16
		return (h >>> 0) / 4294967296
	}
}

/** An organic closed blob in a 100 x 70 box, smooth through 9 jittered points (Catmull-Rom as cubic Béziers). */
export function blobPath(seed: string, w = 100, h = 70) {
	const r = rng(seed)
	const n = 9
	const pts = Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2 + r() * 0.25
		const k = 0.84 + r() * 0.2
		return [
			w / 2 + Math.cos(a) * (w / 2) * k,
			h / 2 + Math.sin(a) * (h / 2) * k,
		]
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

/** The shared vignette gradient the blobs use; put once in a scene. */
export const BlobDefs = () => (
	<svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
		<defs>
			<radialGradient id="intro-atlas-vignette" cx="50%" cy="45%" r="70%">
				<stop offset="0.45" stopColor="#000" stopOpacity="0" />
				<stop offset="1" stopColor="#000" stopOpacity="0.55" />
			</radialGradient>
		</defs>
	</svg>
)

/** A service's logo on a rounded tile. `w` in cqw. */
export function Logo({
	s,
	w,
	className = "",
	style,
}: { s: Service; w: number; className?: string; style?: CSSProperties }) {
	return (
		<img
			src={img(s.logo, w > 8 ? "w300" : "w92")}
			alt={s.name}
			title={s.name}
			className={`intro-atlas-logo ${className}`}
			style={{
				width: `${w}cqw`,
				height: `${w}cqw`,
				borderRadius: `${w * 0.22}cqw`,
				...style,
			}}
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

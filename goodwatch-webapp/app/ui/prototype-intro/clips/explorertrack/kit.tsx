// PROTOTYPE - throwaway. Shared pieces of the "explorertrack" intro clips: timed animation styles, the headline, the
// islands as the Explorer draws them, and posters.
import { type CSSProperties, Fragment, type ReactNode } from "react"
import type { ExplorerTrackData } from "~/server/prototype-intro/explorertrack.server"
import type { IntroData } from "../../clip"
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** The sign-up wall's deal curve, and a soft settle. */
export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"

/**
 * One timed animation, as inline custom properties the `.lpc-et-a` class reads. Delays and durations are ms at k = 1;
 * the stage's `--k` scales them.
 */
export function at(name: string, delay: number, duration = 800, ease = SETTLE, extra?: CSSProperties): CSSProperties {
	return { "--an": name, "--d": `${delay}ms`, "--du": `${duration}ms`, "--ez": ease, ...extra } as CSSProperties
}

/** Two animations on one element: the entrance and a later change. */
export function at2(
	a: [string, number, number?, string?],
	b: [string, number, number?, string?],
	extra?: CSSProperties,
): CSSProperties {
	return {
		"--an": a[0],
		"--d": `${a[1]}ms`,
		"--du": `${a[2] ?? 800}ms`,
		"--ez": a[3] ?? SETTLE,
		"--an2": b[0],
		"--d2": `${b[1]}ms`,
		"--du2": `${b[2] ?? 800}ms`,
		"--ez2": b[3] ?? SETTLE,
		...extra,
	} as CSSProperties
}

export const etData = (data: IntroData) => (data.extra.explorertrack ?? null) as ExplorerTrackData | null

export const poster = (path: string | null | undefined, size = "w342") => (path ? tmdbImageUrl(path, size) : "")

/** A kicker and a headline whose words rise in one after another. Accent words are wrapped in `*`. */
export function Headline({
	kicker,
	text,
	delay = 200,
	className = "",
	size = "lpc-et-h-big",
}: {
	kicker?: string
	text: string
	delay?: number
	className?: string
	size?: string
}) {
	const words = text.split(" ")
	return (
		<div className={`lpc-et-head ${className}`}>
			{kicker && (
				<div className="lpc-et-kicker lpc-et-a" style={at("lpc-et-rise", delay, 700)}>
					{kicker}
				</div>
			)}
			<h2 className={`lpc-et-h ${size}`}>
				{words.map((w, i) => {
					const accent = w.startsWith("*")
					return (
						<Fragment key={i}>
							<span className="lpc-et-word">
								<span
									className={`lpc-et-a lpc-et-word-in ${accent ? "lpc-et-accent" : ""}`}
									style={at("lpc-et-word", delay + 150 + i * 140, 800)}
								>
									{w.replace(/\*/g, "")}
								</span>
							</span>{" "}
						</Fragment>
					)
				})}
			</h2>
		</div>
	)
}

/** An island as the Explorer's map draws it: a filled oval in its colour with its name on it. */
export function Island({
	name,
	color,
	w,
	style,
	className = "",
	children,
}: {
	name: string
	color: string
	/** Width in cqw; the height follows. */
	w: number
	style?: CSSProperties
	className?: string
	children?: ReactNode
}) {
	return (
		<div
			className={`lpc-et-island ${className}`}
			style={{ width: `${w}cqw`, height: `${w * 0.62}cqw`, "--c": color, fontSize: `${Math.max(1.6, w * 0.16)}cqw`, ...style } as CSSProperties}
		>
			<span className="lpc-et-island-name">{name}</span>
			{children}
		</div>
	)
}

export function Poster({ path, className = "", style }: { path: string | null | undefined; className?: string; style?: CSSProperties }) {
	if (!path) return null
	return <img src={poster(path)} alt="" className={`lpc-et-poster ${className}`} style={style} draggable={false} />
}

/** "For example": tells the viewer a member moment is illustrative. */
export const Example = ({ delay = 200, children = "What members get" }: { delay?: number; children?: ReactNode }) => (
	<div className="lpc-et-example lpc-et-a" style={at("lpc-et-rise", delay, 700)}>
		{children}
	</div>
)

/**
 * Spreads islands placed by their real map position so none overlaps: a few rounds of pushing overlapping pairs
 * apart, in cqw. The map's layout is kept (neighbours stay neighbours); only the overlaps go.
 */
export function spread(
	islands: { x: number; y: number; w: number }[],
	box: { cx: number; cy: number; rx: number; ry: number },
): { x: number; y: number }[] {
	const p = islands.map((i) => ({ x: box.cx + i.x * box.rx, y: box.cy + i.y * box.ry }))
	for (let round = 0; round < 80; round++) {
		for (let a = 0; a < p.length; a++)
			for (let b = a + 1; b < p.length; b++) {
				const dx = p[b].x - p[a].x
				// Ovals are 0.62 as tall as wide: compare in a space where they are round.
				const dy = (p[b].y - p[a].y) / 0.62
				const d = Math.hypot(dx, dy) || 0.01
				const need = (islands[a].w + islands[b].w) / 2 + 1.2
				if (d >= need) continue
				const push = (need - d) / 2
				p[a].x -= (dx / d) * push
				p[b].x += (dx / d) * push
				p[a].y -= ((dy / d) * push) * 0.62
				p[b].y += ((dy / d) * push) * 0.62
			}
		// Keep them in the box.
		for (const q of p) {
			q.x = Math.min(box.cx + box.rx + 4, Math.max(box.cx - box.rx - 4, q.x))
			q.y = Math.min(box.cy + box.ry + 3, Math.max(box.cy - box.ry - 3, q.y))
		}
	}
	return p
}

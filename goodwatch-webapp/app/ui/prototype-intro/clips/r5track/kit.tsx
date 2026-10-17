// PROTOTYPE - throwaway. Shared pieces of the round 5 "r5track" clips (chapter 9 tracking, chapter 10 your turn):
// timed animation styles, a word-by-word headline, posters, the example label and the titles from the pool.
import { type CSSProperties, Fragment, type ReactNode, type RefObject, useLayoutEffect, useState } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

/** The sign-up wall's deal curve, and a soft settle. */
export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"
export const SWEEP = "cubic-bezier(.65,0,.35,1)"

type Anim = [name: string, delay: number, duration?: number, ease?: string]

/**
 * Up to three timed animations on one element (entrance, change, exit), as custom properties the `.lpc-r5track-a`
 * classes read. Times are ms at k = 1; the stage's `--k` scales them.
 */
export function at(a: Anim, b?: Anim, c?: Anim, extra?: CSSProperties): CSSProperties {
	const v: Record<string, string> = {}
	;[a, b, c].forEach((x, i) => {
		const n = i === 0 ? "" : String(i + 1)
		if (!x) return
		v[`--an${n}`] = x[0]
		v[`--d${n}`] = `${x[1]}ms`
		v[`--du${n}`] = `${x[2] ?? 800}ms`
		v[`--ez${n}`] = x[3] ?? SETTLE
	})
	return { ...v, ...extra } as CSSProperties
}
/** The class that plays `at`'s animations: one, two or three. */
export const A = (b?: unknown, c?: unknown) => (c ? "lpc-r5track-a3" : b ? "lpc-r5track-a2" : "lpc-r5track-a")

/** A headline whose words rise in one after another. Accent words are wrapped in `*`. */
export function Headline({
	text,
	delay = 200,
	className = "",
	step = 140,
	exit,
}: {
	text: string
	delay?: number
	className?: string
	step?: number
	/** When the whole headline leaves: [animation, delay, duration]. */
	exit?: Anim
}) {
	const words = text.split(" ")
	return (
		<h2 className={`lpc-r5track-h ${exit ? A(exit) : ""} ${className}`} style={exit ? at(exit) : undefined}>
			{words.map((w, i) => (
				<Fragment key={i}>
					<span className="lpc-r5track-word">
						<span
							className={`lpc-r5track-a lpc-r5track-word-in ${w.startsWith("*") ? "lpc-r5track-accent" : ""}`}
							style={at(["lpc-r5track-word", delay + i * step, 850])}
						>
							{w.replace(/\*/g, "")}
						</span>
					</span>{" "}
				</Fragment>
			))}
		</h2>
	)
}

export const img = (path: string | null | undefined, size = "w342") => (path ? tmdbImageUrl(path, size) : "")

export function Poster({ path, className = "", style }: { path: string | null | undefined; className?: string; style?: CSSProperties }) {
	if (!path) return null
	return <img src={img(path)} alt="" className={`lpc-r5track-poster ${className}`} style={style} draggable={false} />
}

/** Tells the viewer a member moment is an example. */
export const Example = ({ delay = 300, children = "Example of what members get" }: { delay?: number; children?: ReactNode }) => (
	<div className="lpc-r5track-example lpc-r5track-a" style={at(["lpc-r5track-fade", delay, 700])}>
		{children}
	</div>
)

const KNOWN = ["netflix", "disney", "prime video", "max", "apple tv", "paramount", "hulu", "peacock", "sky", "wow"]

const byTitle = (cards: LandingCard[], names: string[]) =>
	names.flatMap((n) => cards.find((c) => c.title === n) ?? [])

/** The titles the tracking clips use, all from the pool: a movie that streams, and four famous shows. */
export function picks(data: IntroData) {
	const pool = data.pool.filter((c) => c.poster_path)
	// A service everybody knows, never an add-on channel.
	const known = (c: LandingCard) =>
		c.services?.find((s) => s.logo_path && !/channel/i.test(s.name) && KNOWN.some((k) => s.name.toLowerCase().includes(k))) ?? null
	const movies = pool.filter((c) => c.media_type === "movie" && known(c))
	const movie = byTitle(movies, ["Inception", "The Dark Knight", "Interstellar", "The Matrix"])[0] ?? movies[0]
	const allShows = pool.filter((c) => c.media_type === "show")
	const named = byTitle(allShows, ["Stranger Things", "The Last of Us", "Breaking Bad", "Chernobyl", "The Office", "Game of Thrones"])
	const shows = [...named, ...allShows.filter((s) => !named.includes(s))].slice(0, 4)
	const service = movie ? known(movie) : null
	const posters = pool.slice(1, 9).map((c) => c.poster_path as string)
	return { movie, service, shows, posters, pool }
}

/**
 * My shows' groups in their page order (CONTEXT.md: Continue, then the Waiting for episodes row, then Pick up, then
 * the shows to Start). The states are an example.
 */
export const STATUSES = [
	{ chip: "Continue", sub: "Next episode, out now", hot: true },
	{ chip: "Waiting for episodes", sub: "We'll tell you when it's back", hot: false },
	{ chip: "Pick up", sub: "Right where you left off", hot: false },
	{ chip: "Start", sub: "From your Wishlist", hot: false },
]

/**
 * The boxes of the elements `selector` finds inside `root`, relative to it, in cqw/cqh of the stage, measured after
 * layout. Lets a clip fly things into the places the quiz screen lays out.
 */
export function useBoxes(root: RefObject<HTMLElement | null>, selector: string) {
	const [boxes, setBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([])
	useLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () => {
			const r = el.getBoundingClientRect()
			if (!r.width) return
			setBoxes(
				[...el.querySelectorAll(selector)].map((n) => {
					const b = n.getBoundingClientRect()
					return {
						x: ((b.left - r.left + b.width / 2) / r.width) * 100,
						y: ((b.top - r.top + b.height / 2) / r.height) * 100,
						w: (b.width / r.width) * 100,
						h: (b.height / r.height) * 100,
					}
				}),
			)
		}
		// Again once a hand-over's transform has settled.
		measure()
		const ts = [120, 950].map((ms) => setTimeout(measure, ms))
		addEventListener("resize", measure)
		return () => {
			ts.forEach(clearTimeout)
			removeEventListener("resize", measure)
		}
	}, [root, selector])
	return boxes
}

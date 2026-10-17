// Pieces the tracking and ratings scenes share: timed animation styles, headlines, the stage's speed (`--k`) and the
// intro's titles.
import {
	type CSSProperties,
	Fragment,
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useState,
} from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** The sign-up wall's deal curve, a soft settle, and a sweep for moves. */
export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"
export const SWEEP = "cubic-bezier(.65,0,.35,1)"

type Anim = [name: string, delay: number, duration?: number, ease?: string]

/** Up to three timed animations on one element, as custom properties the `.intro-feed-a*` classes read (ms at k = 1). */
export function at(
	a: Anim,
	b?: Anim,
	c?: Anim,
	extra?: CSSProperties,
): CSSProperties {
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
export const A = (b?: unknown, c?: unknown) =>
	c ? "intro-feed-a3" : b ? "intro-feed-a2" : "intro-feed-a"

/** A headline whose words rise in one after another. Accent words are wrapped in `*`. */
export function Headline({
	text,
	delay = 200,
	className = "",
	step = 140,
}: { text: string; delay?: number; className?: string; step?: number }) {
	return (
		<h2 className={`intro-feed-h ${className}`}>
			{text.split(" ").map((w, i) => (
				<Fragment key={i}>
					<span className="intro-feed-word">
						<span
							className={`intro-feed-a intro-feed-word-in ${w.startsWith("*") ? "intro-feed-accent" : ""}`}
							style={at(["intro-feed-word", delay + i * step, 850])}
						>
							{w.replace(/\*/g, "")}
						</span>
					</span>{" "}
				</Fragment>
			))}
		</h2>
	)
}

export const img = (path: string | null | undefined, size = "w342") =>
	path ? tmdbImageUrl(path, size) : ""

export function Poster({
	path,
	className = "",
	style,
	size,
}: {
	path: string | null | undefined
	className?: string
	style?: CSSProperties
	size?: string
}) {
	if (!path) return null
	return (
		<img
			src={img(path, size)}
			alt=""
			className={`intro-feed-poster ${className}`}
			style={style}
			draggable={false}
		/>
	)
}

/** Tells the viewer a member moment is an example. */
export const Example = ({
	delay = 300,
	children = "Example of what members get",
}: { delay?: number; children?: ReactNode }) => (
	<div
		className="intro-feed-example intro-feed-a"
		style={at(["intro-feed-fade", delay, 700])}
	>
		{children}
	</div>
)

const KNOWN = [
	"netflix",
	"disney",
	"prime video",
	"max",
	"apple tv",
	"paramount",
	"hulu",
	"peacock",
	"sky",
	"wow",
]
const byTitle = (cards: IntroCard[], names: string[]) =>
	names.flatMap((n) => cards.find((c) => c.title === n) ?? [])

/** A service everybody knows that carries the title, never an add-on channel. */
export const knownService = (c: IntroCard) =>
	c.services?.find(
		(s) =>
			s.logo_path &&
			!/channel/i.test(s.name) &&
			KNOWN.some((k) => s.name.toLowerCase().includes(k)),
	) ?? null

/** The titles the tracking scenes use, all from the pool: a movie that streams, and four famous shows. */
export function picks(data: IntroData) {
	const pool = data.pool.filter((c) => c.poster_path)
	const movies = pool.filter((c) => c.media_type === "movie" && knownService(c))
	const movie =
		byTitle(movies, [
			"Inception",
			"The Dark Knight",
			"Interstellar",
			"The Matrix",
		])[0] ?? movies[0]
	const allShows = pool.filter((c) => c.media_type === "show")
	const named = byTitle(allShows, [
		"Stranger Things",
		"The Last of Us",
		"Breaking Bad",
		"Chernobyl",
		"The Office",
		"Game of Thrones",
	])
	const shows = [...named, ...allShows.filter((s) => !named.includes(s))].slice(
		0,
		4,
	)
	const service = movie ? knownService(movie) : null
	return { movie, service, shows, pool }
}

/** Reads the stage's speed factor, for timers that must keep pace with the CSS. */
export const stageK = (el: Element | null) => {
	const stage = el?.closest(".film-stage")
	const k = stage
		? Number.parseFloat(getComputedStyle(stage).getPropertyValue("--k"))
		: 1
	return Number.isFinite(k) && k > 0 ? k : 1
}

export type Box = { x: number; y: number; w: number; h: number }

/**
 * The boxes of the elements `selector` finds inside `root`, relative to it, in cqw/cqh of the stage, measured after
 * layout. Lets a scene fly things into the places the quiz screen lays out.
 */
export function useBoxes(
	root: RefObject<HTMLElement | null>,
	selector: string,
) {
	const [boxes, setBoxes] = useState<Box[]>([])
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

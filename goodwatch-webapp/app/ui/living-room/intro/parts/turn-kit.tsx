// Pieces the quiz scene uses: timed animation styles, headlines and the measured boxes the slots fly between.
import {
	type CSSProperties,
	Fragment,
	type RefObject,
	useLayoutEffect,
	useState,
} from "react"

/** The sign-up wall's deal curve, and a soft settle. */
export const DEAL = "cubic-bezier(.25,.8,.25,1)"
export const SETTLE = "cubic-bezier(.16,1,.3,1)"
export const SWEEP = "cubic-bezier(.65,0,.35,1)"

type Anim = [name: string, delay: number, duration?: number, ease?: string]

/**
 * Up to three timed animations on one element (entrance, change, exit), as custom properties the `.intro-turn-a`
 * classes read. Times are ms at k = 1; the stage's `--k` scales them.
 */
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
	c ? "intro-turn-a3" : b ? "intro-turn-a2" : "intro-turn-a"

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
		<h2
			className={`intro-turn-h ${exit ? A(exit) : ""} ${className}`}
			style={exit ? at(exit) : undefined}
		>
			{words.map((w, i) => (
				<Fragment key={i}>
					<span className="intro-turn-word">
						<span
							className={`intro-turn-a intro-turn-word-in ${w.startsWith("*") ? "intro-turn-accent" : ""}`}
							style={at(["intro-turn-word", delay + i * step, 850])}
						>
							{w.replace(/\*/g, "")}
						</span>
					</span>{" "}
				</Fragment>
			))}
		</h2>
	)
}

/**
 * The boxes of the elements `selector` finds inside `root`, relative to it, in cqw/cqh of the stage, measured after
 * layout. Lets a scene fly things into the places the quiz screen lays out.
 */
export function useBoxes(
	root: RefObject<HTMLElement | null>,
	selector: string,
) {
	const [boxes, setBoxes] = useState<
		{ x: number; y: number; w: number; h: number }[]
	>([])
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

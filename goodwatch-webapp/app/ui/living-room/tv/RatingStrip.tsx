// The TV's rating strip, and the screen that asks for a score with it: the taste quiz (screens/Quiz.tsx) and "How
// was it?" after Seen it (screens/Rate.tsx) are both this one screen.
//
// The strip is the app's own score control (ui/title-actions/ScoreControl.tsx) at TV size. Four labelled levels
// from low on the left to high on the right, read from `RATING_LEVELS`, each with its colour and, on the desktop,
// as wide as the scores it spans; under them the ten exact scores, each in its own colour. OK on a level gives the
// level's score; Down goes to the exact scores under it (the machine names that move, tv-machine.ts). The level
// the focus is in lights its scores, and a line over the strip says what the focus would give.
//
// On the phone the strip is the four levels alone, as equal keys in one row: a phone's score is 3, 5, 7 or 9, and
// the exact score is on the title's page. Which keys there are is the machine's (`items`, from `tvItems`).
//
// Every key is an `Item`: pointing at it gives it the focus, a click or a tap gives its score.
import type { ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { RATING_LEVELS, levelOf } from "../../taste-quiz/quiz-flow"
import {
	Ambient,
	CornerBar,
	Item,
	Shade,
	backdropSize,
	useKeySize,
	useTvView,
} from "./kit"
import { STRIP_SCORES } from "./tv-machine"
import { scoreLight, stripFocus, stripSays } from "./tv-strip"

/** How strong a score's colour is, by how it is lit: the last two digits of its `#rrggbbaa`. */
const TINT = { on: "", lit: "88", even: "55", dim: "30" }

/**
 * The strip. `value` is the score the title has already: its level and its exact score are marked, as the app's
 * control marks them.
 */
export function RatingStrip({
	items,
	value = null,
}: {
	/** The screen's items, from `tvItems`: the levels, and the exact scores where they show. */
	items: readonly string[]
	value?: number | null
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const focus = stripFocus(focused)
	const mine = value ? levelOf(value) : -1
	// On the phone a level is a touch target, 44 px or more on the phone's screen.
	const phoneKey = useKeySize(68)
	const levels = RATING_LEVELS.filter((level) =>
		items.includes(`level:${level.score}`),
	)
	const scores = STRIP_SCORES.filter((score) =>
		items.includes(`score:${score}`),
	)
	return (
		<fieldset
			aria-label="Your score"
			className={`grid ${P ? "gap-1.5" : "gap-2"}`}
			style={{
				gridTemplateColumns: `repeat(${P ? levels.length : 10}, minmax(0, 1fr))`,
			}}
		>
			{levels.map((level) => {
				const color = getVibeColorValue(level.score)
				const id = `level:${level.score}`
				// The level of the title's own score is marked, as the app's control marks it; the focus has its own look.
				const marked = RATING_LEVELS[mine] === level && focused !== id
				return (
					<Item
						key={level.name}
						id={id}
						label={`${level.name}, ${level.score}`}
						className={`tvc-lvl flex items-center ${P ? "flex-col justify-center gap-1.5 px-1" : "h-[92px] gap-4 px-5"}`}
						style={{
							...(P
								? { height: phoneKey }
								: { gridColumn: `span ${level.hi - level.lo + 1}` }),
							...(marked && {
								background: `${color}55`,
								boxShadow: `inset 0 0 0 3px ${color}`,
							}),
						}}
					>
						<span
							className={`shrink-0 rounded-full ${P ? "h-1.5 w-10" : "h-10 w-2"}`}
							style={{ background: color }}
						/>
						{P ? (
							<span className="text-[20px] leading-none">{level.name}</span>
						) : (
							// The name over its scores, as the app's control shows them at its roomy size.
							<span className="flex min-w-0 flex-col gap-1.5 leading-none">
								<span className="text-[28px]">{level.name}</span>
								<span className="whitespace-nowrap text-[21px] font-semibold tabular-nums text-white/55">
									{level.lo}–{level.hi}
								</span>
							</span>
						)}
					</Item>
				)
			})}
			{scores.map((score) => {
				const light = scoreLight(score, focus)
				return (
					<Item
						key={score}
						id={`score:${score}`}
						label={`${score}, ${scoreLabels[score]}`}
						// The focused score is dark type on its full colour (living-room.css).
						className={`tvc-num flex h-[64px] items-center justify-center text-[30px] ${light === "on" ? "" : light === "dim" ? "text-white/60" : "text-white"}`}
						style={{
							background: `${getVibeColorValue(score as Score)}${TINT[light]}`,
							...(value === score &&
								light !== "on" && { boxShadow: "inset 0 0 0 3px #fff" }),
						}}
					>
						{score}
					</Item>
				)
			})}
		</fieldset>
	)
}

/** A long question is set smaller, so it stays on two lines. */
const questionSize = (question: string, large: number, small: number) =>
	question.length > 16 ? small : large

/**
 * A question over a title's picture, and the strip to answer it with. It has no page to grow into, so there is no
 * Expand key and the bar stands in the picture's corner.
 */
export function RatingScreen({
	items,
	backdrop,
	kicker,
	question,
	line,
	value,
	children,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The title's backdrop, a TMDB path. */
	backdrop?: string | null
	/** What stands over the question: "Seen it", "Taste · 2 of 5 rated". */
	kicker: string
	question: string
	/** What stands under the question while the focus is not on the strip. */
	line?: string | null
	/** The score the title has already. */
	value?: number | null
	/** The keys under the strip: the quiz's "Haven't seen it". */
	children?: ReactNode
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const says = stripSays(focused, P)
	return (
		<>
			{backdrop && (
				<Ambient src={tmdbImageUrl(backdrop, backdropSize(canvas))} />
			)}
			<Shade dim={0.82} />
			{P ? (
				// The phone: the strip stands at the bottom, as large as a thumb needs, and the words in what is left
				// over it, under the bar's keys, which are touch targets. With the exact scores gone there is room
				// for the line that says what the focus would give.
				<div className="absolute inset-0 flex flex-col px-5 pb-4 pt-[84px]">
					<div className="flex min-h-0 flex-1 flex-col justify-center">
						<div className="truncate text-[20px] font-bold uppercase leading-tight tracking-[0.12em] text-white/75">
							{kicker}
						</div>
						<div
							className="mt-1 line-clamp-2 font-bold leading-[1.05] tracking-tight"
							style={{ fontSize: questionSize(question, 32, 26) }}
						>
							{question}
						</div>
						<div className="mt-1.5 h-[24px] truncate text-[20px] leading-tight text-white/85">
							{says ?? line}
						</div>
					</div>
					<div className="mt-2.5 shrink-0">
						<RatingStrip items={items} value={value} />
					</div>
					{children && <div className="mt-2.5 flex shrink-0">{children}</div>}
				</div>
			) : (
				<div className="absolute inset-0 flex flex-col justify-center px-14 pt-16">
					<div className="text-[24px] font-bold uppercase tracking-[0.16em] text-white/75">
						{kicker}
					</div>
					<div
						className="mt-2 line-clamp-2 font-bold leading-[1.02] tracking-tight"
						style={{ fontSize: questionSize(question, 72, 54) }}
					>
						{question}
					</div>
					<div className="mt-3 h-[40px] truncate text-[30px] text-white/85">
						{says ?? line}
					</div>
					<div className="mt-7">
						<RatingStrip items={items} value={value} />
					</div>
					{children && <div className="mt-7 flex">{children}</div>}
				</div>
			)}
			{/* The bar is last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}

import { QUIZ_GOAL } from "~/ui/taste-quiz/quiz-flow"
import { mediaFieldLanguage } from "~/utils/media-presentation"
// Taste on the TV: the taste quiz, one widely seen title at a time over its picture, with its poster, and the
// rating strip to answer with across the picture's width (../RatingStrip.tsx, the screen "How was it?" also is).
// A level or an exact score lights at once, is saved, holds for a moment and brings the next title, with the focus
// where it was: the same answer as on /taste/quiz (ui/scoring/score-ack.ts). "Haven't seen it" and Your taste are
// keys of their own under the strip. Once the goal is reached Your taste takes its place (tv-machine.ts,
// `quiz-done`). Its page is the site's quiz (the Expand key). A chunk the TV asks for on first use (screen-code.tsx).
import { RatingScreen } from "../RatingStrip"
import {
	CornerBar,
	ExpandCorner,
	Item,
	Shade,
	useKeySize,
	usePhone,
} from "../kit"
import { type TvQuizOnScreen, quizWords } from "../tv-taste"

export default function Quiz({
	items,
	quiz,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	quiz: TvQuizOnScreen
}) {
	const P = usePhone()
	// On the phone the keys are touch targets, 44 px or more on the phone's screen.
	const height = useKeySize(P ? 50 : 64)
	const words = quizWords(quiz)
	const key = `tvc-btn flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "px-3.5 text-[17px]" : "px-8 text-[26px]"}`
	const yourTaste = items.includes("your-taste") && (
		<Item id="your-taste" className={key} style={{ height }}>
			Your taste
		</Item>
	)
	if (!quiz.title)
		return (
			<>
				<Shade dim={0.82} />
				<div
					className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[84px]" : "px-14 pt-16"}`}
				>
					<div
						className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}
					>
						{words.kicker}
					</div>
					<div
						className={`text-white/80 ${P ? "mt-2 text-[22px]" : "mt-3 text-[30px]"}`}
					>
						{quiz.waiting
							? "Finding titles you may have seen."
							: quiz.failed
								? "Couldn't load more titles."
								: "No more titles to ask about right now."}
					</div>
					{(yourTaste || items.includes("retry-titles")) && (
						<div className={`${P ? "mt-4 gap-1.5" : "mt-8 gap-4"} flex`}>
							{items.includes("retry-titles") && (
								<Item id="retry-titles" className={key} style={{ height }}>
									Try again
								</Item>
							)}
							{yourTaste}
						</div>
					)}
				</div>
				<ExpandCorner items={items} />
				<CornerBar items={items} />
			</>
		)
	return (
		<RatingScreen
			items={items}
			backdrop={quiz.title.backdrop}
			poster={quiz.title.poster}
			kicker={words.kicker}
			question={quiz.title.title}
			questionLanguage={mediaFieldLanguage(quiz.title)}
			line={words.line}
			answered={quiz.answered}
			titleKey={quiz.title.key}
			title={quiz.title.title}
			progress={
				P
					? quiz.rated < QUIZ_GOAL
						? `${quiz.rated} of ${QUIZ_GOAL}`
						: `${quiz.rated} rated`
					: undefined
			}
		>
			{/* After a save that failed, the same key goes on to the next title without saving (tv-taste.ts,
			    `carryOutQuiz`). */}
			{items.includes("skip") && (
				<Item id="skip" className={key} style={{ height }}>
					{quiz.answered.failed ? "Next title" : "Haven't seen it"}
				</Item>
			)}
			{/* The phone's row holds "Haven't seen it" and the Expand key; Your taste is in the menu there. */}
			{!P && yourTaste}
		</RatingScreen>
	)
}

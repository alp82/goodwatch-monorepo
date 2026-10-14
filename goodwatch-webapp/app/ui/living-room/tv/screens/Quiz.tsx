import { mediaFieldLanguage } from "~/utils/media-presentation"
// The taste quiz: one widely seen title at a time over its picture, and the rating strip to answer with
// (../RatingStrip.tsx, the screen "How was it?" also is). A level or an exact score stores the score and brings
// the next title, with the focus where it was; "Haven't seen it" is a key of its own under the strip. The score
// that reaches the goal returns to Taste (tv-machine.ts). It has no page to grow into, so no Expand key. A chunk
// the TV asks for on first use (screen-code.tsx).
import { RatingScreen } from "../RatingStrip"
import { CornerBar, Item, Shade, useKeySize, usePhone } from "../kit"
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
	// On the phone the key is a touch target, 44 px or more on the phone's screen.
	const height = useKeySize(P ? 52 : 64)
	const words = quizWords(quiz)
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
							: "No more titles to ask about right now."}
					</div>
				</div>
				<CornerBar items={items} />
			</>
		)
	return (
		<RatingScreen
			items={items}
			backdrop={quiz.title.backdrop}
			kicker={words.kicker}
			question={quiz.title.title}
			questionLanguage={mediaFieldLanguage(quiz.title)}
			line={words.line}
		>
			{items.includes("skip") && (
				<Item
					id="skip"
					className={`tvc-btn flex shrink-0 items-center whitespace-nowrap ${P ? "px-5 text-[21px]" : "px-8 text-[26px]"}`}
					style={{ height }}
				>
					Haven't seen it
				</Item>
			)}
		</RatingScreen>
	)
}

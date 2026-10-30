import { mediaFieldLanguage } from "~/utils/media-presentation"
// Rate titles on the TV: the rating flow (ui/rating-flow) at TV size, one widely seen title at a time over its
// picture, with its poster, and the rating strip to answer with across the picture's width (../RatingStrip.tsx, the
// screen "How was it?" also is). A level or an exact score lights at once, is saved, holds for a moment and brings
// the next title, with the focus where it was: the same answer as on /taste/quiz (ui/scoring/score-ack.ts). The three
// marks, a bookmark for Want to See, "Haven't seen it" and "Not interested", are keys of their own under the strip;
// after a save that failed, "Haven't seen it" reads "Next title".
//
// The top line counts toward the next milestone, as the web's top strip does ("3 more liked to your taste", "4 more
// to new picks"). Your taste is the web's taste bar: a key beside the marks on the desktop, in the menu on the phone,
// that turns amber at a milestone ("Your taste is ready", "Your picks changed") and opens Your taste. A milestone never
// ends rating. On the phone the header always names the title with its year, and says the next step, or the answer
// just given, under it. A guest at the rating limit gets the web's locked panel in simple form: what they rated, that
// sign-up keeps rating going, and the keys Sign up free and Your taste. Its page is the site's /taste/quiz (the Expand
// key). A chunk the TV asks for on first use (screen-code.tsx).
import { BookmarkIcon } from "@heroicons/react/24/outline"
import { RatingScreen } from "../RatingStrip"
import {
	CornerBar,
	ExpandCorner,
	Item,
	Shade,
	useKeySize,
	usePhone,
} from "../kit"
import { WORDS } from "~/ui/rating-flow/words"
import { type TvQuizOnScreen, quizHeaderName, quizWords } from "../tv-taste"

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
	const lit = quiz.lit != null
	const key = `tvc-btn flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "px-3 text-[16px]" : "px-8 text-[26px]"}`
	// The web's taste bar: amber at a milestone, with one rise-in. Its totals stand beside it where the screen has
	// room (no title to ask about); beside the marks the Expand key needs the row's end.
	const yourTaste = items.includes("your-taste") && (
		<Item
			id="your-taste"
			key={lit ? `lit-${quiz.lit?.rated}` : "calm"}
			className={`${key} ${lit ? "tvc-cta score-ack-enter" : ""}`}
			style={{ height }}
		>
			{words.taste}
		</Item>
	)
	const totals = !P && !quiz.title && words.totals && (
		<span
			className={`self-center text-[22px] ${lit ? "font-semibold text-amber-200" : "text-white/65"}`}
		>
			{words.totals}
		</span>
	)
	// A milestone is announced once; the key's own name is read when it has the focus.
	const announce = (
		<span className="sr-only" aria-live="polite">
			{lit ? words.taste : ""}
		</span>
	)
	if (quiz.locked && items.includes("sign-up"))
		return (
			<>
				<Shade dim={0.82} />
				<div
					className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[84px]" : "px-14 pt-16"}`}
				>
					<div
						className={`font-bold ${P ? "text-[26px] leading-[30px]" : "text-[56px] leading-[1.05]"}`}
					>
						{WORDS.lockedHead(quiz.tally?.rated ?? 0)}
					</div>
					<div
						className={`text-white/80 ${P ? "mt-2 text-[18px]" : "mt-3 text-[30px]"}`}
					>
						{WORDS.lockedLine}
					</div>
					<div className={`${P ? "mt-4 gap-1.5" : "mt-8 gap-4"} flex`}>
						<Item id="sign-up" className={`${key} tvc-cta`} style={{ height }}>
							{WORDS.signUpFree}
						</Item>
						{yourTaste}
					</div>
					{announce}
				</div>
				<ExpandCorner items={items} />
				<CornerBar items={items} />
			</>
		)
	if (!quiz.title)
		return (
			<>
				<Shade dim={0.82} />
				<div
					className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[84px]" : "px-14 pt-16"}`}
				>
					<div
						className={`font-bold uppercase tracking-[0.16em] ${lit ? "text-amber-300" : "text-white/75"} ${P ? "text-[20px]" : "text-[24px]"}`}
					>
						{lit ? words.taste : words.kicker}
					</div>
					<div
						className={`text-white/80 ${P ? "mt-2 text-[22px]" : "mt-3 text-[30px]"}`}
					>
						{quiz.waiting
							? WORDS.loading
							: quiz.failed
								? WORDS.failed
								: WORDS.empty}
					</div>
					{(yourTaste || items.includes("retry-titles")) && (
						<div className={`${P ? "mt-4 gap-1.5" : "mt-8 gap-4"} flex`}>
							{items.includes("retry-titles") && (
								<Item id="retry-titles" className={key} style={{ height }}>
									{WORDS.tryAgain}
								</Item>
							)}
							{yourTaste}
							{totals}
						</div>
					)}
					{announce}
				</div>
				<ExpandCorner items={items} />
				<CornerBar items={items} />
			</>
		)
	const given = quiz.answered.short
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
			title={quizHeaderName(quiz.title)}
			// The phone's header, under the title: a failed save, the answer just given for its moment, else the next
			// step, or the milestone in amber while Your taste is lit.
			headerLine={
				quiz.answered.failed && quiz.answered.line
					? { text: quiz.answered.line, tone: "failed" }
					: given
						? { text: given, tone: "answer" }
						: lit
							? { text: words.taste, tone: "lit" }
							: { text: words.kicker, tone: "quiet" }
			}
		>
			{/* After a save that failed, the same key goes on to the next title without saving (tv-taste.ts,
			    `carryOutQuiz`). */}
			{items.includes("want") && (
				<Item
					id="want"
					label={WORDS.wantToSee}
					className={`${key} px-0!`}
					style={{ height, width: height }}
				>
					<BookmarkIcon className={P ? "size-6" : "size-8"} aria-hidden />
				</Item>
			)}
			{items.includes("skip") && (
				<Item id="skip" className={key} style={{ height }}>
					{quiz.answered.failed ? WORDS.nextTitle : WORDS.unseen}
				</Item>
			)}
			{items.includes("not-interested") && (
				<Item id="not-interested" className={key} style={{ height }}>
					{WORDS.notInterested}
				</Item>
			)}
			{/* The phone's row holds the three marks and the Expand key; Your taste is in its menu there. */}
			{!P && yourTaste}
			{announce}
		</RatingScreen>
	)
}

// "How was it?" after Seen it: one question over the title's picture, and the answers. Choosing one stores the
// score and returns to the title. It has no page to grow into, so no Expand key. A chunk the TV asks for on first
// use (screen-code.tsx).
//
// WAITING FOR A PROTOTYPE: the answer control. A rating strip from low on the left to high on the right, with
// labels and the ten exact scores, takes the place of the four answers here. Until then this is a plain working
// version: `Answers` is the one component the strip replaces, over the items the machine names (`answerItems` in
// tv-machine.ts) with their words (`RATE_ANSWERS` in tv-title.ts).
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Ambient,
	CornerBar,
	Item,
	Shade,
	backdropSize,
	useKeySize,
	usePhone,
	useTvView,
} from "../kit"
import { RATE_ANSWERS, type TvTitleOnScreen } from "../tv-title"

/** The answer control. */
function Answers({ items }: { items: readonly string[] }) {
	const P = usePhone()
	// On the phone an answer is a touch target, 44 px or more on the phone's screen.
	const height = useKeySize(52)
	const answers = RATE_ANSWERS.filter((answer) => items.includes(answer.item))
	return (
		<fieldset
			aria-label="Your score"
			className={`grid ${P ? "mt-4 gap-2.5" : "mt-10 gap-5"}`}
			style={{
				gridTemplateColumns: `repeat(${P ? 2 : answers.length}, minmax(0, 1fr))`,
			}}
		>
			{answers.map((answer) => (
				<Item
					key={answer.item}
					id={answer.item}
					className={`tvc-btn flex items-center justify-center px-4 text-center leading-tight ${P ? "text-[22px]" : "h-[116px] rounded-[26px] text-[32px]"}`}
					style={P ? { height } : undefined}
				>
					{answer.label}
				</Item>
			))}
		</fieldset>
	)
}

export default function Rate({
	items,
	title: on,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvTitleOnScreen
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const name = on.title?.title
	const question = name ? `How was ${name}?` : "How was it?"
	return (
		<>
			{on.title?.backdrop_path && (
				<Ambient
					src={tmdbImageUrl(on.title.backdrop_path, backdropSize(canvas))}
				/>
			)}
			<Shade dim={0.82} />
			<div
				// On the phone the question starts under the bar's keys, which are touch targets.
				className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[84px]" : "px-14 pt-16"}`}
			>
				<div
					className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}
				>
					Seen it
				</div>
				<div
					className={`line-clamp-2 font-bold leading-[1.02] tracking-tight ${P ? "mt-1" : "mt-2"}`}
					style={{ fontSize: P ? 32 : question.length > 26 ? 60 : 80 }}
				>
					{question}
				</div>
				<Answers items={items} />
			</div>
			<CornerBar items={items} />
		</>
	)
}

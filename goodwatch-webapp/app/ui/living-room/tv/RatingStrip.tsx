// TV uses the same word/number layout and selection treatment as the web picker (ui/scoring/ScoreChoices.tsx).
// Item registers each choice with the remote navigation machine. An answer just given lights and holds the same
// way as on /taste/quiz (ui/scoring/score-ack.ts, the `score-ack` classes of main.css).
import type { ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import { ScoreChoices } from "~/ui/scoring/ScoreChoices"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { MediaFact } from "./MediaFact"
import type { TvQuizAnswered } from "./tv-taste"
import {
	Ambient,
	CornerBar,
	Expand,
	ExpandCorner,
	Img,
	Item,
	Shade,
	backdropSize,
	useKeySize,
	useTvView,
} from "./kit"
import { stripFocus, stripSays } from "./tv-strip"

export function RatingStrip({
	items,
	value = null,
	acknowledged = false,
}: {
	items: readonly string[]
	value?: number | null
	/** `value` is an answer just given and held: its choices light (`score-ack`). */
	acknowledged?: boolean
}) {
	const { canvas, focused } = useTvView()
	const phone = canvas.edition === "phone"
	const focus = stripFocus(focused)
	const phoneKey = useKeySize(58)
	const numberKey = useKeySize(44)
	return (
		<div className="@container [&_[data-score-range]]:text-[18px]">
			<ScoreChoices
				value={value as Score | null}
				acknowledged={acknowledged}
				hot={focus?.at ?? null}
				renderChoice={(choice) =>
					items.includes(choice.id) ? (
						<Item
							key={choice.id}
							id={choice.id}
							label={choice.label}
							pressed={choice.selected}
							className={`${choice.acknowledged ? "score-ack" : ""} flex min-w-0 items-center justify-center gap-1.5 text-white ${choice.kind === "level" ? `tvc-lvl ${phone ? "text-[16px]" : "text-[26px]"}` : `tvc-num ${phone ? "text-[18px]" : "text-[30px]"}`}`}
							style={{
								...choice.style,
								height: phone
									? choice.kind === "level"
										? phoneKey
										: numberKey
									: choice.kind === "level"
										? 92
										: 64,
							}}
						>
							{choice.children}
						</Item>
					) : null
				}
			/>
		</div>
	)
}

/** A long question is set smaller, so it stays on two lines. */
const questionSize = (question: string, large: number, small: number) =>
	question.length > 16 ? small : large

/**
 * A question over a title's picture, and the strip to answer it with, the width of the picture. The bar stands in
 * the picture's corner; the Expand key, where the screen has a page (the quiz), in the opposite one on the desktop
 * and at the end of the keys under the strip on the phone. An answer just given (`answered`) lights on the strip,
 * the line under the question says what it was, and once it is held the title leaves for the next one.
 */
export function RatingScreen({
	items,
	backdrop,
	poster,
	kicker,
	question,
	questionLanguage,
	questionMedia,
	line,
	value,
	answered,
	titleKey,
	children,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The title's backdrop, a TMDB path. */
	backdrop?: string | null
	/** What stands over the question: "Seen it", "Taste · 2 of 5 rated". */
	kicker: string
	questionLanguage?: string
	questionMedia?: { text: string; lang: string; at?: number }
	question: string
	/** What stands under the question while the focus is not on the strip. */
	line?: string | null
	/** The score the title has already. */
	value?: number | null
	/** The keys under the strip: the quiz's "Haven't seen it" and "Your taste". */
	children?: ReactNode
	/** The title's poster, a TMDB path: beside the question on the desktop. */
	poster?: string | null
	/** The answer just given for this title. */
	answered?: TvQuizAnswered
	/** The title asked about: a new one rises in. */
	titleKey?: string
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const short = canvas.h < 400
	const given = answered?.line ?? null
	const says = given ?? stripSays(focused, P)
	const sayClass = answered?.failed
		? "text-red-300"
		: given
			? "text-amber-300"
			: ""
	const motion = answered?.leaving ? "score-ack-leave" : "score-ack-enter"
	const shownValue = answered?.score ?? value
	const lit = answered?.score != null
	const expands = items.includes("expand")
	return (
		<>
			{backdrop && (
				<Ambient src={tmdbImageUrl(backdrop, backdropSize(canvas))} />
			)}
			<Shade dim={0.82} />
			{P ? (
				// The phone: the strip stands at the bottom, as large as a thumb needs, and the words in what is left
				// over it, under the bar's keys. Both words and exact scores stay visible.
				<div className="absolute inset-0 flex flex-col px-5 pb-4 pt-[84px]">
					<div
						key={titleKey}
						className={`flex min-h-0 flex-1 flex-col justify-center ${titleKey ? motion : ""}`}
					>
						<div
							className={
								short
									? "sr-only"
									: "shrink-0 truncate text-[16px] font-bold uppercase leading-tight tracking-[0.12em] text-white/75"
							}
						>
							{kicker}
						</div>
						<div
							className="mt-1 shrink-0 line-clamp-2 font-bold leading-[1.05] tracking-tight"
							{...mediaTextAttributes(questionLanguage ?? "en")}
							style={{ fontSize: questionSize(question, 26, 22) }}
						>
							<MediaFact text={question} media={questionMedia} />
						</div>
						<div
							aria-live="polite"
							className={
								short && !given
									? "sr-only"
									: `mt-1 h-[20px] shrink-0 truncate text-[16px] font-bold leading-tight text-white/85 ${sayClass}`
							}
						>
							{says ?? line}
						</div>
					</div>
					<div className="mt-2.5 shrink-0">
						<RatingStrip items={items} value={shownValue} acknowledged={lit} />
					</div>
					{(children || expands) && (
						<div className="mt-2.5 flex shrink-0 gap-2.5">
							{children}
							{expands && <Expand />}
						</div>
					)}
				</div>
			) : (
				<div className="absolute inset-0 flex flex-col justify-center px-14 pt-16">
					<div
						key={titleKey}
						className={`flex items-end gap-8 ${titleKey ? motion : ""}`}
					>
						{poster && (
							<Img
								src={tmdbImageUrl(poster, "w342")}
								className="h-[210px] w-[140px] shrink-0 rounded-[14px] shadow-[0_14px_34px_rgba(0,0,0,.55)]"
							/>
						)}
						<div className="min-w-0 flex-1">
							<div className="text-[24px] font-bold uppercase tracking-[0.16em] text-white/75">
								{kicker}
							</div>
							<div
								className="mt-2 line-clamp-2 font-bold leading-[1.02] tracking-tight"
								{...mediaTextAttributes(questionLanguage ?? "en")}
								style={{ fontSize: questionSize(question, 72, 54) }}
							>
								<MediaFact text={question} media={questionMedia} />
							</div>
							<div
								aria-live="polite"
								className={`mt-3 h-[40px] truncate text-[30px] text-white/85 ${given ? "font-bold" : ""} ${sayClass}`}
							>
								{says ?? line}
							</div>
						</div>
					</div>
					<div className="mt-7">
						<RatingStrip items={items} value={shownValue} acknowledged={lit} />
					</div>
					{children && <div className="mt-7 flex gap-4">{children}</div>}
					{expands && <ExpandCorner items={items} />}
				</div>
			)}
			{/* The bar is last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}

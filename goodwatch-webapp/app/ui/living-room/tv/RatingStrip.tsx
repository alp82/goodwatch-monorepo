// TV uses the same word/number layout and selection treatment as the web picker (ui/scoring/ScoreChoices.tsx): four
// level keys over one row of ten numbers. On the phone it is one band (the owner, 2026-10-22: the ten numbers in one
// row under the four categories), each level joined over its own scores and every key a touch target; the desktop
// keeps its approved strip.
// Item registers each choice with the remote navigation machine. An answer just given lights and holds the same
// way as on /taste/quiz (ui/scoring/score-ack.ts, the `score-ack` classes of main.css).
import type { ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import { ScoreChoices } from "~/ui/scoring/ScoreChoices"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { MediaFact } from "./MediaFact"
import {
	Ambient,
	CornerBar,
	Expand,
	ExpandCorner,
	Img,
	Item,
	PHONE_HEAD,
	PhoneHeader,
	type PhoneHeaderLine,
	Shade,
	backdropSize,
	keySize,
	useTvView,
} from "./kit"
import { stripFocus, stripSays } from "./tv-strip"
import type { TvQuizAnswered } from "./tv-taste"

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
	// The phone's two rows of the band: each a touch target, 44 px or more on the phone's screen.
	const phoneKey = keySize(canvas, 50)
	return (
		<div className="@container [&_[data-score-range]]:text-[18px]">
			<ScoreChoices
				value={value as Score | null}
				acknowledged={acknowledged}
				hot={focus?.at ?? null}
				layout={phone ? "band" : undefined}
				renderChoice={(choice) =>
					items.includes(choice.id) ? (
						<Item
							key={choice.id}
							id={choice.id}
							label={choice.label}
							pressed={choice.selected}
							className={`${choice.acknowledged ? "score-ack" : ""} flex min-w-0 items-center justify-center gap-1.5 text-white ${phone ? "whitespace-nowrap" : ""} ${choice.kind === "level" ? `tvc-lvl ${phone ? "text-[16px]" : "text-[26px]"}` : `tvc-num ${phone ? "text-[18px]" : "text-[30px]"}`}`}
							style={{
								...choice.style,
								height: phone ? phoneKey : choice.kind === "level" ? 92 : 64,
								// The band: a level's top corners round, its scores' bottom ones, so each level and its scores
								// read as one part.
								...(phone &&
									(choice.kind === "level"
										? { borderRadius: "14px 14px 3px 3px" }
										: { borderRadius: "3px 3px 12px 12px", marginTop: 3 })),
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
 * the picture's corner; the Expand key, where the screen has a page (Rate titles), in the opposite one on the desktop
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
	title,
	headerLine,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The title's backdrop, a TMDB path. */
	backdrop?: string | null
	/** What stands over the question: "Seen it", "3 more liked to your taste". */
	kicker: string
	questionLanguage?: string
	questionMedia?: { text: string; lang: string; at?: number }
	question: string
	/** What stands under the question while the focus is not on the strip. */
	line?: string | null
	/** The score the title has already. */
	value?: number | null
	/** The keys under the strip: Rate titles' two marks and Your taste. */
	children?: ReactNode
	/** The title's poster, a TMDB path: beside the question on the desktop. */
	poster?: string | null
	/** The answer just given for this title. */
	answered?: TvQuizAnswered
	/** The title asked about: a new one rises in. */
	titleKey?: string
	/** The title's name with its year, for the phone's header: Rate titles' question is the title. */
	title?: string
	/** The phone's header, under the title: the next step, a milestone, or the answer just given. */
	headerLine?: PhoneHeaderLine
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
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
				// The phone: the question in the header, where the screen's name stands, and under it the band to answer
				// with, as large as a thumb needs, and the keys under the band. Nothing else: no kicker, no line under
				// the question (the header's second line says the next step, or the answer just given for its moment,
				// and the band lights). Nothing ever takes the title's place: the person must always see what they are
				// asked about. A save that failed says so over the band, or in the header's line where it has one.
				// A screen without keys under the band (the rating) has room for the question over the band too.
				<div
					className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-1.5 px-4 pb-2.5"
					style={{ top: PHONE_HEAD }}
				>
					<div aria-live="polite" className="sr-only">
						{given}
					</div>
					{answered?.failed && !headerLine && (
						<div
							aria-hidden
							className="shrink-0 text-[16px] font-semibold leading-tight text-red-300"
						>
							{given}
						</div>
					)}
					{!(children || expands) && (
						<div
							key={titleKey}
							className={`flex min-h-0 flex-1 items-center ${titleKey ? motion : ""}`}
						>
							<div
								className="line-clamp-2 font-bold leading-[1.1] tracking-tight"
								{...mediaTextAttributes(questionLanguage ?? "en")}
								style={{ fontSize: 22 }}
							>
								<MediaFact text={question} media={questionMedia} />
							</div>
						</div>
					)}
					<div className="shrink-0">
						<RatingStrip items={items} value={shownValue} acknowledged={lit} />
					</div>
					{(children || expands) && (
						<div className="flex shrink-0 items-center gap-1.5">
							{children}
							{expands && <Expand compact />}
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
			{/* The bar is last in the markup, as in `tvItems`: the items are met in reading order. On the phone it names
			    the title asked about, always, and under it what `headerLine` says. */}
			{P ? (
				<PhoneHeader
					items={items}
					name={children || expands ? (title ?? question) : undefined}
					line={headerLine}
				/>
			) : (
				<CornerBar items={items} />
			)}
		</>
	)
}

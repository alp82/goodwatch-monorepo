// The taste quiz on the TV (#226), for both editions: the desktop's 960 x 528 canvas and the phone's 560 x 308
// canvas (18 px minimum type). The same flow as /taste/quiz: one title at a time with the `stack` rating, "Keep
// these 5?", then picks three at a time between side arrows, and Rate more with the sign-up and "Back to my picks"
// at the bottom left. The TV flow owns the step and the focus; `view.quiz` (useTasteQuiz) owns the titles, the
// scores, and the picks. Nothing animates at idle: focus changes move transform and color only.
import type { ReactNode } from "react"
import type { Score as RatingScore } from "~/server/scores.server"
import { GoogleMark } from "~/ui/taste-quiz/GoogleMark"
import {
	QUIZ_GOAL,
	type QuizState,
	RATING_LEVELS,
	picksOnPage,
} from "~/ui/taste-quiz/quiz-flow"
import type { QuizPick } from "~/ui/taste-quiz/use-quiz-picks"
import { backdropUrl, posterUrl } from "~/ui/watch-next/style"
import { getVibeColorValue } from "~/utils/ratings"
import { Item, type TvView } from "./TvScreens"

const SCORES = Array.from({ length: 10 }, (_, i) => (i + 1) as RatingScore)

type Size = {
	phone: boolean
	/** Canvas padding on the left and right. */
	x: number
	/** Room the bar needs on the top right. */
	bar: number
}
const DESKTOP: Size = { phone: false, x: 48, bar: 200 }
const PHONE: Size = { phone: true, x: 20, bar: 216 }

export function TvQuiz({
	view,
	quiz,
	phone = false,
}: { view: TvView; quiz: QuizState; phone?: boolean }) {
	const z = phone ? PHONE : DESKTOP
	if (!view.quiz) return null
	switch (quiz.screen) {
		case "quiz":
			return <RateStep view={view} quiz={quiz} z={z} />
		case "keep":
			return <KeepStep view={view} z={z} />
		case "picks":
			return <PicksStep view={view} quiz={quiz} z={z} />
	}
}

// ---------------------------------------------------------------------------------------------------------

function QItem({
	view,
	z,
	id,
	className = "",
	primary,
	children,
}: {
	view: TvView
	z: Size
	id: string
	className?: string
	primary?: boolean
	children: ReactNode
}) {
	return (
		<Item
			view={view}
			id={id}
			grow={z.phone ? "scale-[1.03]" : "scale-[1.04]"}
			className={`${z.phone ? "!ring-4" : ""} ${className}`}
			{...(primary && {
				on: "ring-amber-300 bg-amber-400 text-black",
				off: "ring-transparent bg-amber-400/90 text-black",
			})}
		>
			{children}
		</Item>
	)
}

function Pill({
	view,
	z,
	id,
	primary,
	children,
}: {
	view: TvView
	z: Size
	id: string
	primary?: boolean
	children: ReactNode
}) {
	return (
		<QItem
			view={view}
			z={z}
			id={id}
			primary={primary}
			className={`flex shrink-0 items-center gap-2 rounded-full font-bold ${z.phone ? "px-4 py-1 text-[18px]" : "px-5 py-2 text-[16px]"}`}
		>
			{children}
		</QItem>
	)
}

function Head({
	z,
	eyebrow,
	title,
	line,
	right,
}: {
	z: Size
	eyebrow?: string
	title: string
	line?: string
	right?: ReactNode
}) {
	return (
		<div
			className={`absolute flex items-start gap-4 ${z.phone ? "top-3" : "top-9"}`}
			style={{ left: z.x, right: z.bar }}
		>
			<div className="min-w-0 flex-1">
				{eyebrow && (
					<div
						className={`font-bold text-amber-300/90 ${z.phone ? "text-[18px] leading-tight" : "mb-1 text-[12px] uppercase tracking-[0.25em]"}`}
					>
						{eyebrow}
					</div>
				)}
				<h2
					className={`truncate font-extrabold leading-none tracking-tight ${z.phone ? "text-[26px]" : "text-[34px]"}`}
				>
					{title}
				</h2>
				{line && (
					<div
						className={`truncate text-white/60 ${z.phone ? "text-[18px]" : "mt-2 text-[15px]"}`}
					>
						{line}
					</div>
				)}
			</div>
			{right}
		</div>
	)
}

function Dots({ at, of, z }: { at: number; of: number; z: Size }) {
	const d = z.phone ? "h-3 w-3" : "h-2.5 w-2.5"
	return (
		<span
			className="mt-2 inline-flex shrink-0 gap-1.5"
			role="img"
			aria-label={`${Math.min(at, of)} of ${of} ratings`}
		>
			{Array.from({ length: of }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length dots
					key={i}
					className={`${d} rounded-full ${i < at ? "bg-amber-400" : "bg-white/15"}`}
				/>
			))}
		</span>
	)
}

/** Continue with Google (guests) and "Back to my picks", bottom left in Rate more. */
function RateMoreRow({ view, z }: { view: TvView; z: Size }) {
	const q = view.quiz
	if (!q) return null
	return (
		<>
			{!q.member && (
				<Pill view={view} z={z} id="quiz-save">
					<GoogleMark size={z.phone ? 18 : 16} />
					Save these {q.progress}
				</Pill>
			)}
			<Pill view={view} z={z} id="back-to-picks">
				♥ Back to my picks
			</Pill>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// One title at a time.

function RateStep({
	view,
	quiz,
	z,
}: { view: TvView; quiz: QuizState; z: Size }) {
	const q = view.quiz
	if (!q) return null
	const x = q.title
	const rateMore = quiz.pickedBefore || q.member
	const eyebrow = q.member
		? "Sharpen your taste"
		: rateMore
			? `${q.progress} ratings`
			: "Rate what you've seen"
	const focusedLevel = view.focused?.startsWith("level:")
		? RATING_LEVELS.findIndex(
				(l) => `level:${l.name.toLowerCase()}` === view.focused,
			)
		: view.focused?.startsWith("score:")
			? RATING_LEVELS.findIndex((l) => Number(view.focused?.slice(6)) <= l.hi)
			: -1
	const poster = z.phone ? { w: 104, h: 156 } : { w: 170, h: 255 }
	const top = z.phone ? 66 : 120
	const left = z.x + poster.w + (z.phone ? 16 : 32)
	return (
		<>
			{x?.backdrop_path && (
				<img
					src={backdropUrl(x.backdrop_path, "w780")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-30"
				/>
			)}
			<div className="absolute inset-0 bg-gradient-to-r from-[#07080b] via-[#07080b]/80 to-[#07080b]/30" />
			<Head
				z={z}
				eyebrow={eyebrow}
				title="How was it?"
				right={
					<Dots
						at={q.progress - (quiz.goal - QUIZ_GOAL)}
						of={QUIZ_GOAL}
						z={z}
					/>
				}
			/>
			{x ? (
				<>
					<img
						key={`${x.media_type}-${x.tmdb_id}`}
						src={posterUrl(x.poster_path, "w342")}
						alt=""
						className="absolute rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
						style={{ left: z.x, top, width: poster.w, height: poster.h }}
					/>
					<div className="absolute" style={{ left, right: z.x, top }}>
						<div
							className={`truncate font-extrabold leading-tight ${z.phone ? "text-[22px]" : "text-[28px]"}`}
						>
							{x.title}
						</div>
						<div
							className={`truncate text-white/55 ${z.phone ? "text-[18px]" : "mt-1 text-[15px]"}`}
						>
							{[x.release_year, x.genres?.slice(0, 3).join(", ")]
								.filter(Boolean)
								.join(" · ")}
						</div>
						<fieldset
							className={`grid grid-cols-10 ${z.phone ? "mt-1.5 gap-1" : "mt-4 gap-1.5"}`}
						>
							<legend className="sr-only">Your score</legend>
							{RATING_LEVELS.map((l) => (
								<div
									key={l.name}
									className="flex"
									style={{ gridColumn: `span ${l.hi - l.lo + 1}` }}
								>
									<QItem
										view={view}
										z={z}
										id={`level:${l.name.toLowerCase()}`}
										className={`flex w-full items-center justify-center gap-2 rounded-xl font-extrabold ${z.phone ? "h-[34px] text-[18px]" : "h-14 text-[18px]"}`}
									>
										{!z.phone && (
											<span
												className="h-6 w-1.5 shrink-0 rounded-full"
												style={{ background: getVibeColorValue(l.score) }}
											/>
										)}
										{l.name}
										<span className="sr-only">, {l.score}</span>
									</QItem>
								</div>
							))}
							{SCORES.map((score) => {
								const lit =
									focusedLevel >= 0 &&
									score >= RATING_LEVELS[focusedLevel].lo &&
									score <= RATING_LEVELS[focusedLevel].hi
								return (
									<QItem
										key={score}
										view={view}
										z={z}
										id={`score:${score}`}
										className={`flex items-center justify-center rounded-md font-black leading-none tabular-nums ${z.phone ? "h-[24px] text-[18px]" : "h-7 text-[15px]"} ${lit ? "text-white" : "text-white/70"}`}
									>
										<span
											className="absolute inset-0 rounded-md"
											style={{
												background: `${getVibeColorValue(score)}${lit ? "77" : "44"}`,
											}}
										/>
										<span className="relative">{score}</span>
									</QItem>
								)
							})}
						</fieldset>
						<div
							className={`flex flex-wrap items-center ${z.phone ? "mt-2 gap-2" : "mt-4 gap-3"}`}
						>
							<Pill view={view} z={z} id="quiz-skip">
								Haven't seen it
							</Pill>
							<Pill view={view} z={z} id="quiz-want">
								+ Want to see
							</Pill>
						</div>
					</div>
				</>
			) : (
				<div
					className={`absolute text-white/60 ${z.phone ? "text-[18px]" : "text-[20px]"}`}
					style={{ left: z.x, top }}
				>
					{q.loadingTitles
						? "Finding titles for you…"
						: "That's every title for now."}
				</div>
			)}
			{rateMore && (
				<div
					className={`absolute flex items-center gap-2 ${z.phone ? "bottom-3" : "bottom-8"}`}
					style={{ left: z.x }}
				>
					<RateMoreRow view={view} z={z} />
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Keep these 5?

function KeepStep({ view, z }: { view: TvView; z: Size }) {
	const q = view.quiz
	if (!q) return null
	const kept = q.kept.slice(z.phone ? -6 : -8)
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<Head
				z={z}
				eyebrow={`${q.progress} ratings`}
				title={q.member ? "Saved to your taste." : `Keep these ${q.progress}?`}
				line={
					q.member
						? "Your picks moved with them."
						: "Your picks are ready. Save your ratings: free."
				}
			/>
			<div
				className={`absolute flex ${z.phone ? "top-[92px] gap-2" : "top-[150px] gap-3"}`}
				style={{ left: z.x, right: z.x }}
			>
				{kept.map(({ title, score }) => (
					<div
						key={`${title.media_type}-${title.tmdb_id}`}
						className="relative shrink-0"
					>
						<img
							src={posterUrl(title.poster_path, "w185")}
							alt=""
							className={`rounded-lg object-cover ring-1 ring-white/10 ${z.phone ? "h-[102px] w-[68px]" : "h-[165px] w-[110px]"}`}
						/>
						{score != null && (
							<span
								className={`absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-md px-1.5 font-extrabold text-white ring-2 ring-black ${z.phone ? "h-7 min-w-7 text-[18px]" : "h-7 min-w-7 text-[15px]"}`}
								style={{ background: getVibeColorValue(score) }}
							>
								{score}
							</span>
						)}
					</div>
				))}
			</div>
			<div
				className={`absolute flex items-center ${z.phone ? "bottom-3 gap-2" : "bottom-10 gap-3"}`}
				style={{ left: z.x }}
			>
				{!q.member && (
					<Pill view={view} z={z} id="quiz-save">
						<GoogleMark size={z.phone ? 18 : 16} />
						Save and show my picks
					</Pill>
				)}
				<Pill view={view} z={z} id="quiz-picks" primary={q.member}>
					{q.member ? "♥ Show my picks" : "Just show my picks"}
				</Pill>
				<Pill view={view} z={z} id="rate-more">
					{QUIZ_GOAL} more
				</Pill>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Picks, three at a time between side arrows.

function PicksStep({
	view,
	quiz,
	z,
}: { view: TvView; quiz: QuizState; z: Size }) {
	const q = view.quiz
	if (!q) return null
	const page = Math.min(quiz.page, q.pages - 1)
	const picks = picksOnPage(q.picks, page)
	const arrow = (side: "prev" | "next") => {
		const shown = side === "prev" ? page > 0 : page < q.pages - 1
		// Item draws a relative button, so a wrapper places it.
		return shown ? (
			<div
				className={`absolute top-1/2 -translate-y-1/2 ${side === "prev" ? "left-0" : "right-0"}`}
			>
				<QItem
					view={view}
					z={z}
					id={`picks-${side}`}
					className={`flex items-center justify-center rounded-xl font-black ${z.phone ? "h-20 w-9 text-[26px]" : "h-32 w-11 text-[30px]"}`}
				>
					<span aria-label={side === "prev" ? "Earlier picks" : "More picks"}>
						{side === "prev" ? "‹" : "›"}
					</span>
				</QItem>
			</div>
		) : null
	}
	const card = z.phone ? { w: 96, h: 144 } : { w: 150, h: 225 }
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<Head
				z={z}
				title={
					page
						? `More for you · ${page + 1} of ${q.pages}`
						: "Here are your picks."
				}
				line={
					q.member
						? "From your ratings."
						: `Closest to your ${q.progress} ratings.`
				}
			/>
			<div
				className={`absolute ${z.phone ? "top-[62px]" : "top-[118px]"}`}
				style={{
					left: z.x,
					right: z.x,
					height: card.h + (z.phone ? 26 : 60),
				}}
			>
				{arrow("prev")}
				<div
					className={`absolute inset-y-0 flex justify-center ${z.phone ? "inset-x-12 gap-4" : "inset-x-16 gap-8"}`}
				>
					{q.picksLoading ? (
						[0, 1, 2].map((i) => (
							<div
								key={i}
								className="rounded-lg bg-white/10"
								style={{ width: card.w, height: card.h }}
							/>
						))
					) : picks.length ? (
						picks.map((p) => (
							<PickCard
								key={pickKey(p)}
								view={view}
								z={z}
								pick={p}
								card={card}
							/>
						))
					) : (
						<p
							className={`self-center text-white/60 ${z.phone ? "text-[18px]" : "text-[18px]"}`}
						>
							Rate a few titles you liked to get picks.
						</p>
					)}
				</div>
				{arrow("next")}
			</div>
			<div
				className={`absolute flex items-center gap-2 ${z.phone ? "bottom-3" : "bottom-8"}`}
				style={{ left: z.x }}
			>
				{!q.member && (
					<Pill view={view} z={z} id="quiz-save">
						<GoogleMark size={z.phone ? 18 : 16} />
						Save these {q.progress}
					</Pill>
				)}
				<Pill view={view} z={z} id="rate-more">
					Rate more
				</Pill>
			</div>
			<div
				className={`absolute flex items-center gap-1.5 ${z.phone ? "bottom-6" : "bottom-11"}`}
				style={{ right: z.x }}
			>
				{Array.from({ length: q.pages }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: one dot per page
						key={i}
						className={`h-2 rounded-full ${i === page ? "w-6 bg-amber-400" : "w-2 bg-white/25"}`}
					/>
				))}
			</div>
		</>
	)
}

export const pickKey = (p: Pick<QuizPick, "media_type" | "tmdb_id">) =>
	`${p.media_type}-${p.tmdb_id}`

function PickCard({
	view,
	z,
	pick,
	card,
}: {
	view: TvView
	z: Size
	pick: QuizPick
	card: { w: number; h: number }
}) {
	const score = Math.round(pick.goodwatch_overall_score_normalized_percent ?? 0)
	return (
		<QItem
			view={view}
			z={z}
			id={`pick:${pickKey(pick)}`}
			className="flex shrink-0 flex-col overflow-hidden rounded-xl"
		>
			<div className="relative" style={{ width: card.w, height: card.h }}>
				<img
					src={posterUrl(pick.poster_path, "w342")}
					alt=""
					className="h-full w-full object-cover"
				/>
				{pick.match_percentage > 0 && (
					<span
						className={`absolute bottom-1.5 left-1.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-2 font-black tabular-nums text-black ring-2 ring-black/60 ${z.phone ? "text-[18px]" : "text-[13px]"}`}
					>
						{Math.round(pick.match_percentage)}%
					</span>
				)}
				{score > 0 && !z.phone && (
					<span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 text-[14px] font-black tabular-nums">
						{score}
					</span>
				)}
			</div>
			<div
				className={`truncate px-2 font-bold ${z.phone ? "py-0.5 text-[18px]" : "py-2 text-[15px]"}`}
				style={{ width: card.w }}
			>
				{pick.title}
			</div>
		</QItem>
	)
}

/** The Remote's one-line screen on the quiz. */
export function quizItemLabel(item: string): string | null {
	const [kind, arg] = item.split(":")
	if (kind === "level") {
		const l = RATING_LEVELS.find((r) => r.name.toLowerCase() === arg)
		return l ? `${l.name} · ${l.score}` : null
	}
	if (kind === "score") return `Score ${arg}`
	return (
		(
			{
				"taste-quiz": "Rate what you've seen",
				"quiz-skip": "Haven't seen it",
				"quiz-want": "Want to see",
				"quiz-save": "Continue with Google",
				"quiz-picks": "Show my picks",
				"back-to-picks": "Back to my picks",
				"rate-more": "Rate more",
				"picks-prev": "Earlier picks",
				"picks-next": "More picks",
				pick: "Open title",
			} as Record<string, string>
		)[kind] ?? null
	)
}

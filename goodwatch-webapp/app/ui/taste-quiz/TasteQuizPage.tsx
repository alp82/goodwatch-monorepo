// /taste/quiz: the taste quiz as a web page, on the title's backdrop. The flow lives in quiz-flow.ts and
// useTasteQuiz; this file only renders it.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect } from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { ForYouLink } from "~/ui/for-you/ForYouLink"
import { DockStrip } from "~/ui/navigation"
import type { ScoringMedia } from "~/ui/scoring/types"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { HiddenTileContext } from "~/ui/title-actions/hide-feedback"
import { useContinueWithGoogle } from "~/utils/auth-client"
import { useAuthHref } from "~/utils/auth-href"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import type { SizeRule } from "~/utils/tmdb-image"
import { GoogleMark } from "./GoogleMark"
import { QUIZ_GOAL, readQuizPress } from "./quiz-flow"
import type { QuizPick } from "./use-quiz-picks"
import { type TasteQuiz, useTasteQuiz } from "./use-taste-quiz"

export const QUIZ_PATH = "/taste/quiz"
/** Where Continue with Google returns to: the quiz, open on the picks. */
const SAVED_RETURN = `${QUIZ_PATH}?show=picks`
/** The Taste page, telling the banner the taste was just saved. */
const TASTE_SAVED = "/taste?saved=1"

const amber =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 font-black text-gray-950 hover:brightness-110 md:min-h-10"
const ghost =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"
const backToPicks =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500/15 px-5 font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/25 md:min-h-10"

const posterUrl = (path: string | undefined, size: string) =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
/** Three picks to a row, at most 56rem wide. */
/** The kept titles' posters: 80 px, 112 px from md. */
const KEPT_SIZES: SizeRule[] = [
	["(min-width: 768px)", "112px"],
	[null, "80px"],
]
const PICK_SIZES: SizeRule[] = [
	["(min-width: 768px)", "250px"],
	[null, "30vw"],
]

export function TasteQuizPage({
	titles,
	member,
	showPicks,
}: {
	titles: ScoringMedia[]
	member: boolean
	showPicks: boolean
}) {
	const q = useTasteQuiz({ titles, member, showPicks })
	useQuizKeys(q)
	return (
		<div className="pb-24 text-white lg:pb-32">
			{q.screen === "quiz" && <QuizStep q={q} />}
			{q.screen === "keep" && <KeepAsk q={q} />}
			{q.screen === "picks" && <Picks q={q} />}
		</div>
	)
}

function useQuizKeys(q: TasteQuiz) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if (
				(e.target as HTMLElement | null)?.closest?.(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			const intent = readQuizPress(e, q.state)
			if (!intent) return
			e.preventDefault()
			if (intent === "held") return
			if (intent.type === "score") q.rate(intent.score)
			else if (intent.type === "skip") q.skip()
			else if (intent.type === "show-picks") q.showPicks()
			else q.turn(intent.by)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
}

// ------------------------------------------------------------- pieces

function Section({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	return (
		<section
			className={`mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-10 ${className}`}
		>
			{children}
		</section>
	)
}

function Heading({
	eyebrow,
	title,
	line,
	right,
}: {
	eyebrow?: ReactNode
	title: string
	line?: ReactNode
	right?: ReactNode
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div>
				{eyebrow && (
					<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">
						{eyebrow}
					</div>
				)}
				<h1 className="text-2xl font-extrabold md:text-4xl">{title}</h1>
				{line && <p className="mt-1.5 max-w-2xl text-gray-300">{line}</p>}
			</div>
			{right}
		</div>
	)
}

export function RatingDots({ at, of }: { at: number; of: number }) {
	return (
		<span
			className="inline-flex gap-1.5"
			role="img"
			aria-label={`${Math.min(at, of)} of ${of} ratings`}
		>
			{Array.from({ length: of }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length dots
					key={i}
					className={`h-2.5 w-2.5 rounded-full ${i < at ? "bg-amber-400" : "bg-white/15"}`}
				/>
			))}
		</span>
	)
}

export function GoogleButton({
	children,
	onClick,
	className = "",
}: { children: ReactNode; onClick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-gray-100 px-5 text-sm font-bold text-gray-900 shadow-sm ring-2 ring-inset ring-gray-400 hover:bg-white hover:ring-blue-500 md:min-h-10 ${className}`}
		>
			<GoogleMark />
			{children}
		</button>
	)
}

/** Phone actions above the navigation dock. */
function PhoneDock({ children }: { children: ReactNode }) {
	return (
		<DockStrip>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
				{children}
			</div>
		</DockStrip>
	)
}

// ------------------------------------------------------------- one title at a time

function QuizStep({ q }: { q: TasteQuiz }) {
	const x = q.title
	const a = q.answered
	const rateMore = q.state.pickedBefore || q.member
	if (!x)
		return (
			<Section>
				<Heading
					title={
						q.loadingTitles
							? "Finding titles for you…"
							: "That's every title for now."
					}
				/>
				{!q.loadingTitles && (
					<div className="mt-6">
						<button type="button" className={amber} onClick={q.showPicks}>
							♥ Show my picks
						</button>
					</div>
				)}
			</Section>
		)
	return (
		<>
			<div className="relative overflow-hidden">
				{x.backdrop_path && (
					<img
						src={posterUrl(x.backdrop_path, "w1280")}
						alt=""
						className="absolute inset-0 h-full w-full object-cover opacity-30"
					/>
				)}
				<div className="absolute inset-0 bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
				<div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-gray-950 to-transparent" />
				<Section className="relative min-h-[70vh] pt-10 pb-20 md:pt-16 md:pb-32 lg:min-h-[600px]">
					<Heading
						eyebrow={
							q.member
								? "Sharpen your taste"
								: rateMore
									? `${q.progress} ratings`
									: "Rate what you've seen"
						}
						title="How was it?"
						right={
							<RatingDots
								at={q.progress - (q.goal - QUIZ_GOAL)}
								of={QUIZ_GOAL}
							/>
						}
					/>
					<div className="mt-6 flex flex-col gap-5 sm:flex-row sm:gap-8">
						{/* The title leaves after its answer's hold and the next one rises in (main.css, score-ack). */}
						<img
							key={`${x.media_type}-${x.tmdb_id}`}
							src={posterUrl(x.poster_path, "w342")}
							alt={`Poster for ${x.title}`}
							className={`${a.leaving ? "score-ack-leave" : "score-ack-enter"} mx-auto aspect-[2/3] w-36 shrink-0 rounded-md border-2 border-gray-800 object-cover shadow-2xl sm:mx-0 sm:w-48`}
						/>
						<div className="min-w-0 flex-1">
							<div
								key={`${x.media_type}-${x.tmdb_id}`}
								className={a.leaving ? "score-ack-leave" : "score-ack-enter"}
							>
								<div className="text-2xl font-extrabold leading-tight md:text-3xl">
									<span lang={mediaFieldLanguage(x)}>{x.title}</span>
								</div>
								<div className="mt-1 text-sm text-gray-400">
									{[x.release_year, x.genres?.slice(0, 3).join(", ")]
										.filter(Boolean)
										.join(" · ")}
								</div>
							</div>
							<p
								aria-live="polite"
								className={`mt-2 min-h-6 font-bold ${a.failed ? "text-red-300" : "text-amber-300"}`}
							>
								{a.line}
							</p>
							<div className="mt-3">
								<ScoreControl
									value={a.score}
									acknowledged={a.score != null}
									onRate={q.rate}
								/>
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<button type="button" className={ghost} onClick={q.skip}>
									Haven't seen it
								</button>
								<button
									type="button"
									className="min-h-11 cursor-pointer px-3 text-sm font-semibold text-gray-400 hover:text-gray-200 md:min-h-10"
									onClick={q.wantToSee}
								>
									+ Want to see
								</button>
								<span className="hidden text-xs text-gray-500 md:inline">
									Keys: 1–9, 0 = 10 · S skips
									{rateMore ? " · P back to picks" : ""}
								</span>
							</div>
							{rateMore && (
								<RateMoreActions q={q} className="mt-10 hidden lg:flex" />
							)}
						</div>
					</div>
				</Section>
			</div>
			{rateMore && (
				<PhoneDock>
					<RateMoreActions q={q} />
				</PhoneDock>
			)}
		</>
	)
}

/** In Rate more: the sign-up for a guest, then Back to my picks, bottom left. */
function RateMoreActions({
	q,
	className = "",
}: { q: TasteQuiz; className?: string }) {
	const google = useContinueWithGoogle()
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			{!q.member && (
				<GoogleButton onClick={() => google(SAVED_RETURN)}>
					Save these {q.progress}
					<span className="hidden sm:inline"> ratings · free</span>
				</GoogleButton>
			)}
			<button type="button" className={backToPicks} onClick={q.showPicks}>
				♥ Back to my picks
			</button>
		</div>
	)
}

// ------------------------------------------------------------- Keep these 5?

function KeepAsk({ q }: { q: TasteQuiz }) {
	const authHref = useAuthHref()
	const google = useContinueWithGoogle()
	return (
		<Section>
			<Heading
				eyebrow={`${q.progress} ratings`}
				title={q.member ? "Saved to your taste." : `Keep these ${q.progress}?`}
				line={
					q.member
						? "Your picks moved with them."
						: "Your picks are ready. Save your ratings and they follow you to every screen. Free."
				}
			/>
			<div className="mt-6 flex flex-wrap gap-3">
				{q.kept.slice(-8).map(({ title }) => (
					<div
						key={`${title.media_type}-${title.tmdb_id}`}
						className="w-20 md:w-28"
					>
						<MovieTvCard
							details={title}
							mediaType={title.media_type}
							posterSizes={KEPT_SIZES}
						/>
					</div>
				))}
			</div>
			<div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				{q.member ? (
					<button type="button" className={amber} onClick={q.showPicks}>
						♥ Show my picks
					</button>
				) : (
					<>
						<GoogleButton
							onClick={() => google(SAVED_RETURN)}
							className="text-base"
						>
							Save and show my picks
						</GoogleButton>
						<button type="button" className={ghost} onClick={q.showPicks}>
							Just show my picks
						</button>
					</>
				)}
				<button
					type="button"
					className="min-h-11 cursor-pointer px-3 font-semibold text-gray-400 hover:text-gray-200"
					onClick={q.rateMore}
				>
					{QUIZ_GOAL} more
				</button>
			</div>
			{!q.member && (
				<p className="mt-3 text-sm text-gray-500">
					Continue with Google: no password.{" "}
					<Link
						rel="nofollow"
						to={authHref("sign-up", SAVED_RETURN)}
						className="underline hover:text-gray-300"
					>
						Use email instead
					</Link>
				</p>
			)}
		</Section>
	)
}

// ------------------------------------------------------------- picks, three at a time

function Picks({ q }: { q: TasteQuiz }) {
	const google = useContinueWithGoogle()
	const actions = q.member ? (
		<>
			<Link to={TASTE_SAVED} className={ghost}>
				✓ Saved · Open Taste
			</Link>
			<button type="button" className={ghost} onClick={q.rateMore}>
				Rate more
			</button>
		</>
	) : (
		<>
			<GoogleButton onClick={() => google(SAVED_RETURN)}>
				Save these {q.progress}
				<span className="hidden sm:inline"> ratings · free</span>
			</GoogleButton>
			<button type="button" className={ghost} onClick={q.rateMore}>
				Rate more
			</button>
		</>
	)
	return (
		<Section>
			<Heading
				title={
					q.page
						? `More for you · ${q.page + 1} of ${q.pages}`
						: "Here are your picks."
				}
				line={
					q.member
						? "From your ratings."
						: `Closest to your ${q.progress} ratings.`
				}
			/>
			<div className="relative mx-auto mt-6 max-w-4xl md:px-14">
				<PageArrow side="prev" q={q} />
				{q.picksLoading ? (
					<div className="grid grid-cols-3 gap-2 sm:gap-4" aria-busy="true">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/60"
							/>
						))}
					</div>
				) : q.pagePicks.length ? (
					<HiddenTileContext.Provider value={q.picksKeeper}>
						<div key={q.page} className="grid grid-cols-3 gap-2 sm:gap-4">
							{q.pagePicks.map((p) => (
								<PickCard key={`${p.media_type}-${p.tmdb_id}`} pick={p} />
							))}
						</div>
					</HiddenTileContext.Provider>
				) : (
					<p className="py-10 text-center text-gray-400">
						Rate a few titles you liked to get picks.
					</p>
				)}
				<PageArrow side="next" q={q} />
			</div>
			<div className="mt-4 flex items-center justify-center gap-1.5">
				{Array.from({ length: q.pages }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: one dot per page
						key={i}
						className={`h-1.5 rounded-full ${i === q.page ? "w-5 bg-amber-400" : "w-1.5 bg-white/25"}`}
					/>
				))}
			</div>
			<div className="mt-4 flex justify-center">
				<ForYouLink>See your recommendations</ForYouLink>
			</div>
			<div className="mt-10 hidden flex-wrap items-center gap-2 lg:flex">
				{actions}
			</div>
			<PhoneDock>{actions}</PhoneDock>
		</Section>
	)
}

function PageArrow({ side, q }: { side: "prev" | "next"; q: TasteQuiz }) {
	const hidden = side === "prev" ? q.page === 0 : q.page >= q.pages - 1
	return (
		<button
			type="button"
			aria-label={side === "prev" ? "Earlier picks" : "More picks"}
			disabled={hidden}
			onClick={() => q.turn(side === "prev" ? -1 : 1)}
			className={`absolute top-1/3 z-10 flex h-24 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl bg-gray-950/80 text-2xl font-black text-white ring-1 ring-white/15 hover:bg-amber-500 hover:text-gray-950 md:h-32 md:w-11 ${side === "prev" ? "-left-2 md:left-0" : "-right-2 md:right-0"} ${hidden ? "invisible" : ""}`}
		>
			{side === "prev" ? "‹" : "›"}
		</button>
	)
}

/** A pick as the site's poster card, with how close it is to the ratings under it (the card shows no match). */
function PickCard({ pick }: { pick: QuizPick }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<MovieTvCard
				details={pick}
				mediaType={pick.media_type}
				posterSizes={PICK_SIZES}
			/>
			{pick.match_percentage > 0 && (
				<p className="text-center text-xs font-bold text-amber-200 md:text-sm">
					{Math.round(pick.match_percentage)}% match
				</p>
			)}
		</div>
	)
}

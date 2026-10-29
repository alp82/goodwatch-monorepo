// The rating flow (CONTEXT.md, Answer acknowledgement): one title at a time on its backdrop, with its poster, title
// and year, the score control, the two marks (Haven't seen it asks Want to see it? in their place), and the taste bar;
// a row on top counts toward the next milestone and shows the last answers, each of which opens again to change or
// clear it. The taste bar opens the taste view: picks, a guest's Save your taste, and Your ratings. A guest gets a
// quiet sign-up line under the bar from a few ratings on, and at the limit a locked panel in place of the score
// control. /taste/quiz shows it as the page; a member's Taste start (/taste) shows it as its rating step. State:
// flow.ts; binding: use-rating-flow.ts.
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { HiddenTileContext } from "~/ui/title-actions/hide-feedback"
import { MIN_LIKED } from "~/domain/taste-rules"
import { HERO_TIMING } from "~/utils/start-after-paint"
import { REPLAY_TAP_SCRIPT } from "~/utils/replay-tap"
import { useReplayedTap } from "~/utils/useReplayedTap"
import { tmdbFluidImage } from "~/utils/tmdb-image"
import {
	type FlowView,
	readFlowPress,
	readWantPress,
	pastCounting,
	showsSignUpLine,
} from "./flow"
import {
	Label,
	LockedPanel,
	Marks,
	NextStepDots,
	PicksGrid,
	PicksLoading,
	ReopenedNote,
	SaveTaste,
	SignUpLine,
	TasteBar,
	TitleLine,
	TopRow,
	ghostButton,
	image,
	quietButton,
} from "./parts"
import { type RatingFlowModel, useRatingFlow } from "./use-rating-flow"
import { WORDS } from "./words"
import { YourRatings } from "./YourRatings"

/** Picks shown in the taste view. */
const PICKS_SHOWN = 6

export function RatingFlow({
	titles,
	member,
	view,
	onView,
	backdrop = true,
	onOpenTaste,
	top,
}: {
	titles: ScoringMedia[]
	member: boolean
	view: FlowView
	onView: (view: FlowView) => void
	/** The title's backdrop behind the page (the Taste start has its own poster wall instead). */
	backdrop?: boolean
	/** Opens the taste somewhere else than this flow's taste view (the Taste start's last step, once it is ready). */
	onOpenTaste?: (flow: RatingFlowModel) => boolean
	/** Above the top strip, in the flow's column (the Taste start's note about a file on its way). */
	top?: ReactNode
}) {
	const flow = useRatingFlow({ titles, member, view })
	const openTaste = () => {
		if (onOpenTaste?.(flow)) return
		onView("taste")
	}
	// A new view starts at its top, not where the last one was scrolled to.
	const shownView = useRef(view)
	useEffect(() => {
		if (shownView.current === view) return
		shownView.current = view
		if (window.scrollY > 0) window.scrollTo({ top: 0 })
	}, [view])
	return view === "taste" ? (
		<TasteView flow={flow} onKeep={() => onView("rate")} />
	) : (
		<RateView
			flow={flow}
			backdrop={backdrop}
			onOpenTaste={openTaste}
			top={top}
		/>
	)
}

/** What the page's keys do now: the flow's keys, the Want to See question's while it is up, none while locked. */
type FlowKeys = {
	/** The Want to See question is up: Y/W, N and Escape/Backspace answer it. */
	asking: boolean
	/** Scores wait for sign-up: digits do nothing. */
	locked: boolean
	unseen: () => void
	want: () => void
	no: () => void
	back: () => void
}

function useFlowKeys(flow: RatingFlowModel, keys: FlowKeys) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				(e.target as HTMLElement | null)?.closest?.(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			if (!flow.title) return
			if (keys.asking) {
				const want = readWantPress(e)
				if (want) {
					e.preventDefault()
					if (want === "yes") keys.want()
					else if (want === "no") keys.no()
					else keys.back()
					return
				}
			}
			const intent = readFlowPress(e)
			if (!intent) return
			e.preventDefault()
			if (intent === "held") return
			if (intent.type === "score") {
				if (!keys.locked) flow.rate(intent.score)
			} else if (intent.type === "unseen") keys.unseen()
			else if (!keys.asking) flow.notInterested()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
}

function RateView({
	flow,
	backdrop,
	onOpenTaste,
	top,
}: {
	flow: RatingFlowModel
	backdrop: boolean
	onOpenTaste: () => void
	top?: ReactNode
}) {
	const t = flow.title
	const a = flow.answered
	const tKey = t ? `${t.media_type}-${t.tmdb_id}` : null
	const leaving = a.leaving ? "score-ack-leave" : "score-ack-enter"
	const re = flow.reopened
	// After Haven't seen it, the marks ask Want to see it? in their place until it is answered or taken back. A new
	// title ends it.
	const [asking, setAsking] = useState(false)
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new title ends the question
	useEffect(() => setAsking(false), [tKey])
	const answerWant = (yes: boolean) => {
		setAsking(false)
		if (yes) flow.wantToSee()
		else flow.unseen()
	}
	// Scores wait for sign-up, unless this is a title opened again that has one (changing it adds no rating).
	const locked = flow.locked && re?.answer?.type !== "score"
	useFlowKeys(flow, {
		asking,
		locked,
		unseen: () => !a.busy && setAsking(true),
		want: () => answerWant(true),
		no: () => answerWant(false),
		back: () => setAsking(false),
	})
	useReplayedTap("rate")
	const shownScore =
		a.score ?? (re?.answer?.type === "score" ? (re.answer.score ?? null) : null)
	const bar = flow.tally && (
		<>
			<TasteBar tally={flow.tally} lit={flow.lit} onOpen={onOpenTaste} />
			{showsSignUpLine(flow.tally, flow.member) && (
				<SignUpLine rated={flow.tally.rated} />
			)}
		</>
	)
	const line = re?.clearFailed ? WORDS.clearFailed : a.line
	return (
		<div className="relative overflow-hidden pb-32 text-white">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see utils/replay-tap.ts */}
			<script dangerouslySetInnerHTML={{ __html: REPLAY_TAP_SCRIPT }} />
			{backdrop && t?.backdrop_path && (
				<img
					key={tKey}
					src={image(t.backdrop_path, "w1280")}
					fetchPriority="high"
					{...HERO_TIMING}
					alt=""
					className={`${leaving} absolute inset-0 h-full max-h-[720px] w-full object-cover opacity-30`}
				/>
			)}
			{backdrop && (
				<>
					<div className="absolute inset-0 max-h-[720px] bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
					<div className="absolute inset-x-0 top-[560px] h-40 bg-linear-to-t from-gray-950 to-transparent" />
				</>
			)}
			<section
				className={`relative mx-auto max-w-5xl ${backdrop ? `px-4 pt-6 md:px-8 md:pt-12 ${FEEDBACK_ROOM}` : ""}`}
			>
				{top}
				<TopRow
					left={
						flow.next &&
						!pastCounting(flow.tally, flow.member) && (
							<NextStepDots step={flow.next} landed={flow.landed} />
						)
					}
					recent={flow.recent}
					openKey={re?.key ?? null}
					onOpen={flow.reopen}
				/>

				{!t ? (
					<div className="mt-10">
						<h1 className="text-2xl font-extrabold">
							{flow.loadingTitles
								? WORDS.loading
								: flow.titlesFailed
									? WORDS.failed
									: WORDS.empty}
						</h1>
						{flow.titlesFailed && (
							<button
								type="button"
								className={`${ghostButton} mt-5`}
								onClick={flow.retryTitles}
							>
								{WORDS.tryAgain}
							</button>
						)}
						{bar && <div className="mt-8">{bar}</div>}
					</div>
				) : (
					<div className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] items-end gap-x-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start sm:gap-x-8">
						<img
							key={tKey}
							{...(t.poster_path
								? tmdbFluidImage(
										"poster",
										t.poster_path,
										[
											["(min-width: 640px)", "192px"],
											[null, "96px"],
										],
										{ fallbackWidth: 342, minWidth: 92, maxWidth: 192 },
									)
								: {})}
							width={342}
							height={513}
							alt={`Poster for ${t.title}${t.release_year ? ` (${t.release_year})` : ""}`}
							className={`${leaving} aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover shadow-2xl sm:row-span-2`}
						/>
						<div
							key={`h-${tKey}`}
							className={`${leaving} min-w-0 pb-1 sm:pt-4`}
						>
							<h1 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400/90">
								{WORDS.ask}
							</h1>
							<TitleLine t={t} />
							{re && (
								<ReopenedNote
									answer={re.answer}
									clearing={re.clearing}
									onClear={flow.clear}
									onClose={flow.closeReopened}
								/>
							)}
						</div>
						<div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
							{/* What was given, or that it failed; never the Want to See question, which the marks ask. */}
							<p
								aria-live="polite"
								className={`mt-2 min-h-6 font-bold ${a.failed || re?.clearFailed ? "text-red-300" : "text-amber-300"}`}
							>
								{line}
							</p>
							<div className="mt-2">
								{locked && flow.tally ? (
									<LockedPanel rated={flow.tally.rated} />
								) : (
									<ScoreControl
										key={tKey}
										replayGroup={`rate:${tKey}`}
										value={shownScore}
										acknowledged={a.score != null}
										onRate={flow.rate}
									/>
								)}
							</div>
							<div className="mt-4">
								<Marks
									replayKey={`rate:${tKey}`}
									disabled={a.busy}
									asking={asking}
									onUnseen={() => setAsking(true)}
									onNotInterested={flow.notInterested}
									onWant={() => answerWant(true)}
									onNo={() => answerWant(false)}
									onBack={() => setAsking(false)}
								/>
							</div>
							{/* A save that failed: on without saving it. */}
							{a.failed && (
								<button
									type="button"
									className={`${ghostButton} mt-3`}
									onClick={flow.pass}
								>
									{WORDS.nextTitle}
								</button>
							)}
							<p className="mt-3 hidden text-xs text-gray-500 md:block">
								{asking ? WORDS.wantKeys : WORDS.keys}
							</p>
						</div>
						<div className="col-span-2 mt-5 min-h-16 md:mt-6">{bar}</div>
					</div>
				)}
			</section>
		</div>
	)
}

/**
 * Room for the Feedback tab on the right edge of a desktop window just wide enough for the flow's column, where the
 * tab would cover its right end (ui/feedback/FeedbackTab.tsx; phones reach Feedback from Go to…).
 */
const FEEDBACK_ROOM = "lg:max-[1080px]:pr-14"

function TasteView({
	flow,
	onKeep,
}: { flow: RatingFlowModel; onKeep: () => void }) {
	const t = flow.tally
	return (
		<section className="score-ack-enter mx-auto max-w-7xl space-y-8 px-4 pt-6 pb-32 text-white md:px-8 md:pt-10">
			<div>
				{t && (
					<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">
						{t.rated} rated · {t.liked} liked
					</div>
				)}
				<h1 className="text-2xl font-extrabold md:text-4xl">
					{WORDS.yourTaste}
				</h1>
			</div>
			{flow.ready ? (
				<section className="space-y-3">
					<Label line={WORDS.picksLine}>{WORDS.picks}</Label>
					{flow.picksLoading ? (
						<PicksLoading />
					) : flow.picks.length ? (
						<HiddenTileContext.Provider value={flow.picksKeeper}>
							<PicksGrid picks={flow.picks.slice(0, PICKS_SHOWN)} />
						</HiddenTileContext.Provider>
					) : (
						<p className="text-sm text-gray-500">{WORDS.noPicks}</p>
					)}
				</section>
			) : (
				t && (
					<p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-gray-400">
						Picks start when you've liked {MIN_LIKED} titles.{" "}
						{MIN_LIKED - Math.min(t.liked, MIN_LIKED)} to go.
					</p>
				)
			)}
			<div className="flex flex-wrap items-center gap-x-2 gap-y-3">
				{!flow.member && <SaveTaste />}
				<button
					type="button"
					className={flow.member ? ghostButton : quietButton}
					onClick={onKeep}
				>
					{WORDS.keepRating}
				</button>
			</div>
			<section className="space-y-3 border-t border-white/10 pt-6">
				<Label>{WORDS.yourRatings}</Label>
				<YourRatings ratings={flow.ratings} met={flow.met} />
			</section>
		</section>
	)
}

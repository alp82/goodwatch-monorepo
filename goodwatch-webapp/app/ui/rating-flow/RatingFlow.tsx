// The rating flow (CONTEXT.md, Answer acknowledgement): one title at a time on its backdrop, with its poster, title
// and year, the score control, the two marks, and the taste bar; a strip on top counts toward the next milestone. The
// taste bar opens the taste view: picks, a guest's Save your taste, and Your ratings. /taste/quiz shows it as the page;
// a member's Taste start (/taste) shows it as its rating step. State: flow.ts; binding: use-rating-flow.ts.
import { type ReactNode, useEffect, useRef } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { HiddenTileContext } from "~/ui/title-actions/hide-feedback"
import { MIN_LIKED } from "~/domain/taste-rules"
import { type FlowView, readFlowPress } from "./flow"
import {
	Label,
	Marks,
	NextStepDots,
	PicksGrid,
	PicksLoading,
	SaveTaste,
	TasteBar,
	TitleLine,
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

function useFlowKeys(flow: RatingFlowModel) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				(e.target as HTMLElement | null)?.closest?.(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			const intent = readFlowPress(e)
			if (!intent || !flow.title) return
			e.preventDefault()
			if (intent === "held") return
			if (intent.type === "score") flow.rate(intent.score)
			else if (intent.type === "unseen") flow.unseen()
			else flow.notInterested()
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
	useFlowKeys(flow)
	const t = flow.title
	const a = flow.answered
	const leaving = a.leaving ? "score-ack-leave" : "score-ack-enter"
	const bar = flow.tally && (
		<TasteBar tally={flow.tally} lit={flow.lit} onOpen={onOpenTaste} />
	)
	return (
		<div className="relative overflow-hidden pb-32 text-white">
			{backdrop && t?.backdrop_path && (
				<img
					key={`${t.media_type}-${t.tmdb_id}`}
					src={image(t.backdrop_path, "w1280")}
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
				className={`relative mx-auto max-w-5xl ${backdrop ? "px-4 pt-6 md:px-8 md:pt-12" : ""}`}
			>
				{top}
				<div className="flex min-h-6 items-center">
					{flow.next && <NextStepDots step={flow.next} landed={flow.landed} />}
				</div>

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
					<div className="mt-6 grid grid-cols-[6rem_minmax(0,1fr)] items-end gap-x-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start sm:gap-x-8">
						<img
							key={`${t.media_type}-${t.tmdb_id}`}
							src={image(t.poster_path, "w342")}
							alt={`Poster for ${t.title}${t.release_year ? ` (${t.release_year})` : ""}`}
							className={`${leaving} aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover shadow-2xl sm:row-span-2`}
						/>
						<div
							key={`h-${t.media_type}-${t.tmdb_id}`}
							className={`${leaving} min-w-0 pb-1 sm:pt-4`}
						>
							<h1 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400/90">
								{WORDS.ask}
							</h1>
							<TitleLine t={t} />
						</div>
						<div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
							<p
								aria-live="polite"
								className={`mt-2 min-h-6 font-bold ${a.failed ? "text-red-300" : "text-amber-300"}`}
							>
								{a.line}
							</p>
							<div className="mt-2">
								<ScoreControl
									key={`${t.media_type}-${t.tmdb_id}`}
									value={a.score}
									acknowledged={a.score != null}
									onRate={flow.rate}
								/>
							</div>
							<div className="mt-4">
								<Marks
									disabled={a.busy}
									onUnseen={flow.unseen}
									onNotInterested={flow.notInterested}
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
								{WORDS.keys}
							</p>
						</div>
						<div className="col-span-2 mt-5 min-h-16 md:mt-6">{bar}</div>
					</div>
				)}
			</section>
		</div>
	)
}

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

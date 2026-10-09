// The person's own score in the hero's ratings group: a rectangle with the number on its colour and the word for
// it, or, without a score, the same rectangle dashed and hollow that asks for one. It is the one control for
// scoring on the title page: a press opens the full picker (ScoreDialog), whose code loads on first use.
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import { type ScoredMedia, useScoreAction } from "~/ui/user/actions/ScoreAction"
import { useOpenedOnce } from "~/utils/first-use"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadScoreDialog = () => import("~/ui/details/hero/ScoreDialog")
const ScoreDialog = lazy(reloadOnStaleChunk(loadScoreDialog))
const preloadScoreDialog = () => {
	void loadScoreDialog().catch(() => {})
}

/** Sent on `window` to open the picker from elsewhere on the page: the prompt to rate of a tracked show. */
const OPEN_SCORE_EVENT = "gw:open-score"
/** Sent on `window` when the server has answered a score, so that what depends on it can be read again. */
export const SCORE_SAVED_EVENT = "gw:score-saved"

export function openScorePicker() {
	preloadScoreDialog()
	window.dispatchEvent(new Event(OPEN_SCORE_EVENT))
}

export default function OwnScore({ media, className = "" }: { media: ScoredMedia; className?: string }) {
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const { rate, isPending } = useScoreAction(media)
	const [open, setOpen] = useState(false)
	const opened = useOpenedOnce(open)
	const button = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		const onOpen = () => setOpen(true)
		window.addEventListener(OPEN_SCORE_EVENT, onOpen)
		return () => window.removeEventListener(OPEN_SCORE_EVENT, onOpen)
	}, [])

	const wasPending = useRef(false)
	useEffect(() => {
		if (wasPending.current && !isPending) window.dispatchEvent(new Event(SCORE_SAVED_EVENT))
		wasPending.current = isPending
	}, [isPending])

	const color = score ? getVibeColorValue(score) : ""
	return (
		<>
			<button
				ref={button}
				type="button"
				data-own-score={score ?? "none"}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={score ? `Your score: ${score}, ${scoreLabels[score]}. Change it` : `Rate this ${media.mediaType}`}
				onClick={() => setOpen(true)}
				onPointerEnter={preloadScoreDialog}
				onTouchStart={preloadScoreDialog}
				onFocus={preloadScoreDialog}
				className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
					score ? "pl-1.5 pr-3 hover:brightness-110" : "border-2 border-dashed border-amber-400/70 bg-amber-300/[0.06] pl-2.5 pr-3.5 hover:border-amber-300 hover:bg-amber-300/[0.12]"
				} ${className}`}
				style={score ? { background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
			>
				{score ? (
					<>
						<span
							className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums"
							style={{ background: color, color: score <= 3 ? "#fff" : "#0a0a0a" }}
						>
							{score}
						</span>
						<span className="min-w-0 flex-1 leading-tight">
							<span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Your score</span>
							<span className="block truncate text-sm font-bold text-white">{scoreLabels[score]}</span>
						</span>
						{/* A pencil (Heroicons 20 solid, MIT), drawn here: from the icon package it would join a chunk every page loads. */}
						<svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden="true">
							<path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
						</svg>
					</>
				) : (
					<>
						{/* A star (Heroicons 20 solid, MIT). */}
						<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true">
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
							/>
						</svg>
						<span className="min-w-0 flex-1 leading-tight">
							<span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/80">Your score</span>
							<span className="block whitespace-nowrap text-sm font-bold text-white">
								Rate <span className="sm:hidden">it</span>
								<span className="max-sm:hidden">this {media.mediaType}</span>
							</span>
						</span>
					</>
				)}
			</button>
			{opened && (
				<Suspense fallback={null}>
					<ScoreDialog
						title={media.details.title}
						open={open}
						value={score}
						busy={isPending}
						opener={button}
						onRate={(value) => {
							// A guest at the rating limit gets the sign-up prompt instead; either way this dialog is done.
							rate(value)
							setOpen(false)
						}}
						onClear={() => rate(null)}
						onClose={() => setOpen(false)}
					/>
				</Suspense>
			)}
		</>
	)
}

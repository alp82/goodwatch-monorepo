// The question before a movie stops being Seen from the score dialog's switch. A score counts as Seen (rating a
// movie records a watch), so Not seen takes the score with it, and the watches the member logged. The question shows
// the control as it is now, small and faded, over how it will be. Loaded on first use.
import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { memberWatches, withoutWatch } from "~/domain/watch-log"
import type { Score } from "~/server/scores.server"
import { TmdbImage } from "~/ui/TmdbImage"
import { NESTED_OVERLAY, useOverlayRoot } from "~/ui/overlay"
import { type ScoredMedia, useScoreAction } from "~/ui/user/actions/ScoreAction"
import { useWatchLog, useWatchLogAction } from "~/ui/watch-log/useWatchLog"
import { useAnchoredPanel } from "./anchor"
import { ScoreFace, SeenFace, SplitFrame } from "./seen-score-faces"
import { notSeenWords } from "./seen-score-words"

let byPointer = false
if (typeof window !== "undefined") {
	window.addEventListener(
		"pointerdown",
		() => {
			byPointer = true
		},
		true,
	)
	window.addEventListener(
		"keydown",
		() => {
			byPointer = false
		},
		true,
	)
}

export default function NotSeenConfirm({
	media,
	score,
	poster,
	year,
	onDone,
	anchor,
}: {
	/** What asked: from md up the question opens beside it. */
	anchor?: () => Element | null
	media: ScoredMedia
	score: Score | null
	poster: string | null
	year: string | null
	onDone: () => void
}) {
	const tmdbId = media.details.tmdb_id
	const { rate } = useScoreAction(media)
	const act = useWatchLogAction()
	const log = useWatchLog(tmdbId)
	const watches = log.data ? memberWatches(log.data).length : null
	const words = notSeenWords(score, watches)
	const panel = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const keep = useRef<HTMLButtonElement>(null)
	const at = useAnchoredPanel(panel, () => anchor?.() ?? null)
	// Over the score dialog that asked, in full screen too.
	const root = useOverlayRoot()
	const done = useRef(onDone)
	done.current = onDone

	const confirm = async () => {
		onDone()
		// The logged watches go first: while the score is there the movie stays Seen through it, and clearing the
		// score then takes the score's own watch.
		// Unless the log says there are none: a log that could not be read may still hold watches.
		if (watches !== 0) {
			const saved = await act(tmdbId, { type: "removeAll" }, (before) =>
				withoutWatch(before, null, {
					movieId: tmdbId,
					scored: score !== null,
					now: new Date(),
				}),
			)
			if (!saved) return
		}
		if (score !== null) rate(null)
	}

	useLayoutEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const sheet = !window.matchMedia("(min-width: 768px)").matches
		shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 160,
			easing: "ease-out",
		})
		panel.current?.animate(
			sheet
				? [{ transform: "translateY(100%)" }, { transform: "none" }]
				: [
						{ opacity: 0, transform: "scale(.96)" },
						{ opacity: 1, transform: "none" },
					],
			{
				duration: sheet ? 240 : 170,
				easing: "cubic-bezier(.2,.8,.2,1)",
			},
		)
	}, [])

	useEffect(() => {
		const from = document.activeElement as HTMLElement | null
		keep.current?.focus({ preventScroll: true })
		// In the capture phase, so the score dialog under it doesn't take the Escape too.
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.stopImmediatePropagation()
			done.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => {
			window.removeEventListener("keydown", onKey, true)
			// After a tap the focus goes back without a ring; after a key it shows.
			from?.focus({
				preventScroll: true,
				focusVisible: !byPointer,
			} as FocusOptions)
		}
	}, [])

	const label = "w-10 shrink-0 text-[10px] uppercase tracking-[0.08em]"
	if (!root) return null
	return createPortal(
		<div
			{...NESTED_OVERLAY}
			className="fixed inset-0 z-[1300] flex items-end justify-center md:items-center md:p-4"
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape and Keep as seen are the keyboard's way out. */}
			<div
				ref={shade}
				onClick={onDone}
				className="absolute inset-0 bg-black/70 md:bg-black/40"
			/>
			<div
				ref={panel}
				role="alertdialog"
				onKeyDown={(event) => {
					// Tab stays in the question: it goes round its two buttons.
					if (event.key !== "Tab") return
					const stops = [
						...(panel.current?.querySelectorAll<HTMLButtonElement>(
							"button:not([disabled])",
						) ?? []),
					]
					const at = stops.indexOf(document.activeElement as HTMLButtonElement)
					event.preventDefault()
					stops[
						(at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length
					]?.focus()
				}}
				aria-modal="true"
				aria-labelledby="not-seen-title"
				aria-describedby="not-seen-text"
				data-not-seen-confirm
				style={
					at ? { position: "absolute", top: at.top, left: at.left } : undefined
				}
				className="relative w-full rounded-t-3xl border-t border-white/15 bg-stone-900 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-12px_48px_rgba(0,0,0,.6)] md:w-[29rem] md:rounded-2xl md:border md:p-5 md:shadow-2xl"
			>
				<div
					className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden"
					aria-hidden="true"
				/>
				<h2 id="not-seen-title" className="text-base font-bold">
					Mark as not seen?
				</h2>
				<div className="mt-3 flex gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/10">
					{poster && (
						<span className="hidden w-12 shrink-0 self-start overflow-hidden rounded-md bg-stone-800 md:block">
							<TmdbImage
								kind="poster"
								path={poster}
								width={48}
								alt=""
								className="block aspect-[2/3] w-full object-cover"
								draggable={false}
							/>
						</span>
					)}
					<div
						className="flex min-w-0 flex-1 flex-col gap-2"
						aria-hidden="true"
					>
						<p className="truncate text-sm font-bold">
							{media.details.title}
							{year && (
								<span className="font-normal text-gray-400"> · {year}</span>
							)}
						</p>
						<div className="flex flex-col">
							{/* Now: smaller and faded, it's what goes away. After: full size. */}
							<div className="flex items-center gap-2">
								<span className={`${label} font-semibold text-gray-500`}>
									Now
								</span>
								<div className="min-w-0 flex-1 origin-left scale-[.86] opacity-45 saturate-[.35]">
									<SplitFrame
										score={score}
										left={
											<SeenFace
												seen
												count={watches && watches >= 2 ? `${watches}×` : null}
											/>
										}
										right={<ScoreFace score={score} ask="Rate it" />}
									/>
								</div>
							</div>
							<span className="flex h-4 items-center">
								<svg
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="ml-3 h-3.5 w-3.5 text-gray-500"
									aria-hidden="true"
								>
									<path d="M8 3v10m-4-4 4 4 4-4" />
								</svg>
							</span>
							<div className="flex items-center gap-2">
								<span className={`${label} font-bold text-white`}>After</span>
								<div className="min-w-0 flex-1">
									<SplitFrame
										score={null}
										left={<SeenFace seen={false} />}
										right={<ScoreFace score={null} ask="Rate it" />}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
				<p id="not-seen-text" className="mt-3 text-sm text-gray-300">
					{words.text}
				</p>
				<div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
					<button
						ref={keep}
						type="button"
						data-not-seen-keep
						onClick={onDone}
						className="h-11 w-full cursor-pointer sm:w-auto sm:flex-1 rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						Keep as seen
					</button>
					<button
						type="button"
						data-not-seen-go
						disabled={log.isLoading}
						onClick={() => void confirm()}
						className="h-11 w-full cursor-pointer sm:w-auto sm:flex-1 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{words.action}
					</button>
				</div>
			</div>
		</div>,
		root,
	)
}

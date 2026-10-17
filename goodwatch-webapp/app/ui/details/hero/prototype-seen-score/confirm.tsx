// PROTOTYPE - throwaway (seen-score), round 5. The Seen toggle of the score dialog, and the question that comes up
// before a change that loses something: a scored movie's score, or a show's watched episodes.
import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { TmdbImage } from "~/ui/TmdbImage"
import { scoreLabels } from "~/utils/ratings"
import { EyeIcon } from "./pieces"
import { SplitPicture } from "./round3"
import { ProtoPreview, type ProtoState, useProto } from "./store"
import { EyeSlash } from "./verdict"

/**
 * Seen as a sliding toggle: a round knob with the eye that moves across a pill, the word on the other side. Only
 * transform and opacity animate.
 */
export function SeenToggle() {
	const p = useProto()
	const on = p.seen
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="Seen"
			onClick={p.pressSeen}
			className={`relative inline-flex h-9 w-[7.25rem] shrink-0 cursor-pointer items-center rounded-full p-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
				on
					? "bg-green-500/[0.16] ring-1 ring-green-400/50"
					: "bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/10"
			}`}
		>
			<span
				className={`absolute left-3.5 text-green-300 transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
			>
				Seen
			</span>
			<span
				className={`absolute right-3 text-gray-400 transition-opacity duration-200 ${on ? "opacity-0" : "opacity-100"}`}
			>
				Not seen
			</span>
			<span
				className={`relative flex h-7 w-7 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,.45)] transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
					on
						? "translate-x-[4.25rem] bg-green-500 text-black"
						: "translate-x-0 bg-stone-600 text-gray-200"
				}`}
			>
				{on ? (
					<EyeIcon className="h-4 w-4" />
				) : (
					<EyeSlash className="h-4 w-4" />
				)}
			</span>
		</button>
	)
}

/** Asks before a change that loses something: the split control now and after, then Keep or the change. */
export function ConfirmUnsee() {
	const p = useProto()
	if (!p.pending) return null
	return <ConfirmPanel after={p.pending} />
}

function useWording() {
	const p = useProto()
	const { score, episodes } = p.state
	const scored = score ? `${score} (${scoreLabels[score]})` : ""
	if (p.media.mediaType === "show")
		return {
			title: "Mark as not started?",
			text: `This resets your ${episodes} watched ${episodes === 1 ? "episode" : "episodes"} to 0.${score ? ` Your score of ${scored} stays.` : ""}`,
			keep: "Keep progress",
			go: "Reset episodes",
		}
	return {
		title: "Mark as not seen?",
		text: `This removes your score of ${scored}. Only movies you've seen have a score.`,
		keep: "Keep as seen",
		go: "Remove score",
	}
}

function ConfirmPanel({ after }: { after: ProtoState }) {
	const p = useProto()
	const words = useWording()
	const panel = useRef<HTMLDivElement>(null)
	const keep = useRef<HTMLButtonElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const { title, poster_path, release_year } = p.media.details as {
		title: string
		poster_path?: string
		release_year?: string
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
			{ duration: sheet ? 240 : 170, easing: "cubic-bezier(.2,.8,.2,1)" },
		)
	}, [])

	useEffect(() => {
		const from = document.activeElement as HTMLElement | null
		keep.current?.focus({ preventScroll: true })
		// Capture, so the score dialog under it doesn't take the Escape as well.
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			e.stopImmediatePropagation()
			p.cancelPending()
		}
		window.addEventListener("keydown", onKey, true)
		return () => {
			window.removeEventListener("keydown", onKey, true)
			from?.focus({ preventScroll: true })
		}
	}, [p.cancelPending])

	return createPortal(
		<div className="fixed inset-0 z-[1200] flex items-end justify-center md:items-center md:p-4">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape and Keep are the keyboard's way. */}
			<div
				ref={shade}
				onClick={p.cancelPending}
				className="absolute inset-0 bg-black/70"
			/>
			<div
				ref={panel}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-unsee-title"
				aria-describedby="confirm-unsee-text"
				className="relative w-full rounded-t-3xl border-t border-white/15 bg-stone-900 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-12px_48px_rgba(0,0,0,.6)] md:w-[29rem] md:rounded-2xl md:border md:p-5 md:shadow-2xl"
			>
				<div
					className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden"
					aria-hidden="true"
				/>
				<h2 id="confirm-unsee-title" className="text-base font-bold">
					{words.title}
				</h2>
				<div className="mt-3 flex gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/10">
					{poster_path && (
						<span className="hidden w-12 shrink-0 self-start overflow-hidden rounded-md bg-stone-800 md:block">
							<TmdbImage
								kind="poster"
								path={poster_path}
								width={48}
								alt=""
								className="block aspect-[2/3] w-full object-cover"
								draggable={false}
							/>
						</span>
					)}
					<span className="flex min-w-0 flex-1 flex-col gap-2">
						<span className="truncate text-sm font-bold">
							{title}
							{release_year ? (
								<span className="font-normal text-gray-400">
									{" "}
									· {release_year}
								</span>
							) : null}
						</span>
						<span className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
							<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
								Now
							</span>
							<SplitPicture />
							<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
								After
							</span>
							<ProtoPreview state={after}>
								<SplitPicture />
							</ProtoPreview>
						</span>
					</span>
				</div>
				<p id="confirm-unsee-text" className="mt-3 text-sm text-gray-300">
					{words.text}
				</p>
				<div className="mt-4 flex gap-2">
					<button
						ref={keep}
						type="button"
						onClick={p.cancelPending}
						className="h-11 flex-1 cursor-pointer rounded-lg bg-white/10 text-sm font-semibold text-gray-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{words.keep}
					</button>
					<button
						type="button"
						onClick={p.confirmPending}
						className="h-11 flex-1 cursor-pointer rounded-lg bg-red-700 text-sm font-semibold text-white hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						{words.go}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}

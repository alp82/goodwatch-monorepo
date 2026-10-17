// PROTOTYPE - throwaway (seen-score), round 6. A show's score dialog: after a score on a show that isn't started,
// it asks how far you are (Watching up to an episode, Seen all, or only the score). A score never guesses progress.
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import ScoreDialog from "~/ui/details/hero/ScoreDialog"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { seasonsOf, useProto } from "./store"
import { EyeSlash, WatchIcon } from "./verdict"

export function ShowScoreDialog({
	open,
	onClose,
	opener,
}: {
	open: boolean
	onClose: () => void
	opener: React.RefObject<HTMLElement | null>
}) {
	const p = useProto()
	const [step, setStep] = useState<"score" | "where">("score")
	useEffect(() => {
		if (open) setStep("score")
	}, [open])
	return (
		<ScoreDialog
			title={p.media.details.title}
			open={open}
			value={p.state.score}
			busy={false}
			opener={opener}
			hideClear={step === "where"}
			control={step === "where" ? <WhereStep onDone={onClose} /> : undefined}
			onRate={(score) => {
				const ask = p.state.watch === "not_started"
				p.rate(score)
				if (ask) setStep("where")
				else onClose()
			}}
			onClear={p.clearScore}
			onClose={onClose}
		/>
	)
}

const ROW =
	"flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/80"

/** "How far are you?": the three answers, Watching opens the episode picker. */
function WhereStep({ onDone }: { onDone: () => void }) {
	const p = useProto()
	const box = useRef<HTMLDivElement>(null)
	const [picking, setPicking] = useState(false)
	const score = p.state.score
	const color = score ? getVibeColorValue(score) : ""
	const seenWord = p.running ? "Caught up" : "Seen all"

	useLayoutEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		box.current?.animate(
			[
				{ opacity: 0, transform: "translateX(16px)" },
				{ opacity: 1, transform: "none" },
			],
			{ duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" },
		)
	}, [])

	return (
		<div ref={box} className="mt-1">
			<div className="flex items-center gap-2.5">
				{score && (
					<span
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-black"
						style={{
							background: color,
							color: score <= 3 ? "#fff" : "#0a0a0a",
						}}
					>
						{score}
					</span>
				)}
				<span className="min-w-0 leading-tight">
					<span className="block text-lg font-bold text-white">
						How far are you?
					</span>
					<span className="block text-xs text-gray-400">
						{score
							? `Your score of ${score} (${scoreLabels[score]}) is saved.`
							: "Your score is saved."}
					</span>
				</span>
			</div>
			<div className="mt-4 flex flex-col gap-2">
				<button
					type="button"
					aria-expanded={picking}
					onClick={() => setPicking((x) => !x)}
					className={`${ROW} ${picking ? "bg-sky-500/[0.12] ring-sky-400/60" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"}`}
				>
					<WatchIcon
						watch="watching"
						className="h-5 w-5 shrink-0 text-sky-300"
					/>
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block text-sm font-bold text-white">Watching</span>
						<span className="block text-xs text-gray-400">
							Pick the last episode you saw
						</span>
					</span>
				</button>
				{picking && <EpisodePicker onDone={onDone} />}
				<button
					type="button"
					onClick={() => {
						p.setProgress("seen", p.total)
						onDone()
					}}
					className={`${ROW} bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]`}
				>
					<WatchIcon watch="seen" className="h-5 w-5 shrink-0 text-green-400" />
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block text-sm font-bold text-white">
							{seenWord}
						</span>
						<span className="block text-xs text-gray-400">
							{p.total ? `All ${p.total} episodes` : "Every episode"}
						</span>
					</span>
				</button>
				<button
					type="button"
					onClick={onDone}
					className={`${ROW} bg-transparent ring-white/10 hover:bg-white/[0.06]`}
				>
					<EyeSlash className="h-5 w-5 shrink-0 text-gray-400" />
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block text-sm font-bold text-gray-200">
							Only the score
						</span>
						<span className="block text-xs text-gray-400">
							Stays Not started
						</span>
					</span>
				</button>
			</div>
		</div>
	)
}

/** Season chips, then that season's episodes: the press marks every episode up to it. */
function EpisodePicker({ onDone }: { onDone: () => void }) {
	const p = useProto()
	const seasons = seasonsOf(p.media)
	const [season, setSeason] = useState(seasons[0]?.season ?? 1)
	const [episode, setEpisode] = useState<number | null>(null)
	const current = seasons.find((s) => s.season === season)
	const before = seasons
		.filter((s) => s.season < season)
		.reduce((n, s) => n + s.count, 0)
	const count = episode ? before + episode : 0
	const chip =
		"flex h-8 cursor-pointer items-center justify-center rounded-lg text-xs font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-white/80"

	if (!seasons.length)
		return (
			<button
				type="button"
				onClick={() => {
					p.setProgress("watching", 0)
					onDone()
				}}
				className="h-10 cursor-pointer rounded-lg bg-sky-500 text-sm font-bold text-black hover:bg-sky-400"
			>
				Mark as Watching
			</button>
		)

	return (
		<div className="rounded-xl bg-sky-500/[0.06] p-3 ring-1 ring-sky-400/25">
			<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
				Season
			</div>
			<div className="mt-1.5 flex flex-wrap gap-1.5">
				{seasons.map((s) => (
					<button
						key={s.season}
						type="button"
						aria-pressed={s.season === season}
						onClick={() => {
							setSeason(s.season)
							setEpisode(null)
						}}
						className={`${chip} min-w-8 px-2 ${s.season === season ? "bg-sky-400 text-black" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.12]"}`}
					>
						{s.season}
					</button>
				))}
			</div>
			<div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
				Last episode you saw
			</div>
			<div className="mt-1.5 grid grid-cols-8 gap-1.5">
				{Array.from({ length: current?.count ?? 0 }, (_, i) => i + 1).map(
					(e) => (
						<button
							key={e}
							type="button"
							aria-pressed={e === episode}
							aria-label={`Season ${season}, episode ${e}`}
							onClick={() => setEpisode(e)}
							className={`${chip} ${
								episode && e === episode
									? "bg-sky-400 text-black"
									: episode && e < episode
										? "bg-sky-400/25 text-sky-100"
										: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.12]"
							}`}
						>
							{e}
						</button>
					),
				)}
			</div>
			<button
				type="button"
				onClick={() => {
					p.setProgress("watching", count)
					onDone()
				}}
				className="mt-3 h-10 w-full cursor-pointer rounded-lg bg-sky-500 text-sm font-bold text-black hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				{episode
					? `Watching, up to S${season} E${episode}`
					: "Watching, no episode yet"}
			</button>
			{episode ? (
				<p className="mt-1.5 text-center text-xs text-gray-400">{`${count} of ${p.total || count} episodes`}</p>
			) : null}
		</div>
	)
}

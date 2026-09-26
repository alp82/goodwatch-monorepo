import { StarIcon } from "@heroicons/react/20/solid"
import React, { useRef, useState } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import type { Score } from "~/server/scores.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import Drawer from "~/ui/modal/Drawer"
import ScoreAction from "~/ui/user/actions/ScoreAction"
import { scoreLabels } from "~/utils/ratings"

// Solid yellow on phones, outlined on desktop. Once rated, it shows your
// score in the score color.
export default function RateButton({ media, className = "" }: { media: MovieResult | ShowResult; className?: string }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	// The phone sheet renders in a portal, outside `ref`.
	const sheetRef = useRef<HTMLDivElement>(null)
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	useClickOutside([ref, sheetRef], () => setOpen(false))
	const look = score
		? `bg-vibe-${score * 10} text-white`
		: "bg-yellow-400 text-black hover:bg-yellow-300 md:border-2 md:border-yellow-400 md:bg-transparent md:text-yellow-300 md:hover:bg-yellow-400/10"
	return (
		<div ref={ref} className={`relative ${className}`}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="dialog"
				className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-bold shadow-lg shadow-black/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${look}`}
			>
				<StarIcon className="h-5 w-5" />
				{score ? `Your score: ${score}` : "Rate this"}
			</button>
			{open && (
				<dialog
					open
					aria-label={`Rate ${media.details.title}`}
					className="absolute left-auto right-0 top-full z-50 mt-3 hidden w-[26rem] rounded-2xl border border-white/10 bg-stone-900 p-5 text-white shadow-2xl shadow-black/70 md:block"
				>
					<span aria-hidden="true" className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 border-l border-t border-white/10 bg-stone-900" />
					<ScorePicker media={media} onDone={() => setOpen(false)} />
				</dialog>
			)}
			<div className="md:hidden">
				<Drawer open={open} onClose={() => setOpen(false)}>
					<div ref={sheetRef} className="p-2">
						<ScorePicker media={media} onDone={() => setOpen(false)} />
					</div>
				</Drawer>
			</div>
		</div>
	)
}

// Ten bars that grow with the score, in the score colors. Hover previews the
// label; a click saves through ScoreAction.
export function ScorePicker({ media, onDone }: { media: MovieResult | ShowResult; onDone: () => void }) {
	const current = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const [hover, setHover] = useState<number | null>(null)
	const shown = hover ?? current
	return (
		<div>
			<div className="flex items-baseline justify-between gap-4">
				<h3 className="text-sm font-semibold text-gray-300">Your score for {media.details.title}</h3>
				{current && (
					<ScoreAction media={media} score={null} onChange={onDone}>
						<button type="button" className="text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white cursor-pointer">
							Clear
						</button>
					</ScoreAction>
				)}
			</div>
			<p className="mt-2 flex h-9 items-baseline gap-2">
				{shown ? (
					<>
						<span className="text-3xl font-bold tabular-nums" style={{ color: `var(--color-vibe-${shown * 10})` }}>
							{shown}
						</span>
						<span className="text-lg font-semibold text-white">{scoreLabels[shown]}</span>
					</>
				) : (
					<span className="text-lg text-gray-400">Pick a score from 1 to 10</span>
				)}
			</p>
			<div className="mt-4 flex h-24 items-end gap-1.5" onPointerLeave={() => setHover(null)}>
				{Array.from({ length: 10 }, (_, i) => (i + 1) as Score).map((n) => {
					const lit = shown != null && n <= shown
					return (
						<ScoreAction key={n} media={media} score={n} onChange={onDone}>
							<button
								type="button"
								aria-label={`${n}, ${scoreLabels[n]}`}
								aria-pressed={current === n}
								onPointerEnter={() => setHover(n)}
								onFocus={() => setHover(n)}
								className="flex h-full flex-1 cursor-pointer items-end rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
							>
								<span
									className="block w-full rounded-md transition-[height,background-color] duration-150 motion-reduce:transition-none"
									style={{ height: `${28 + n * 7.2}%`, background: lit ? `var(--color-vibe-${n * 10})` : "rgba(255,255,255,.1)" }}
								/>
							</button>
						</ScoreAction>
					)
				})}
			</div>
			<div className="mt-1.5 flex justify-between text-[11px] text-gray-500">
				<span>1 {scoreLabels[1]}</span>
				<span>10 {scoreLabels[10]}</span>
			</div>
		</div>
	)
}

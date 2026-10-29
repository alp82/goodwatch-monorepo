// The open grid of the titles that share the selection, in the site's poster card (MovieTvCard: score pill, title
// band, hover actions). A click on a poster opens the quick view, stepping through the grid's titles; phones get the
// card without its tap-to-reveal actions, so a tap opens the quick view, whose footer has Seen and the score. Loads
// on the first Show more; the quick view's code loads on the first click.
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from "react"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { useTouchPointer } from "~/ui/title-actions/pointer"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { SharedTitle } from "./population"

const SharedQuickView = lazy(
	reloadOnStaleChunk(() =>
		import("./SharedQuickView").then((module) => ({
			default: module.SharedQuickView,
		})),
	),
)

export const anchorId = (p: SharedTitle) => `fingerprint-${p.tmdbId}`

export function SharedGrid({
	list,
	type,
	effects,
	fades,
	late,
	onMount,
}: {
	list: SharedTitle[]
	type: "movie" | "show"
	effects: EffectReading[]
	/** Class for the whole grid (its crossfade). */
	fades: string
	/** The first posters fly in from the stack; the rest fade in late. */
	late: number
	/** Called once the grid is in the page, so the stacked posters can fly to their places. */
	onMount: () => void
}) {
	const touch = useTouchPointer()
	const [open, setOpen] = useState<number | null>(null)
	// Once, on mount: the grid is in the page.
	useLayoutEffect(() => onMount(), [])
	useEffect(() => {
		if (open !== null && open >= list.length) setOpen(null)
	}, [open, list.length])
	return (
		<>
			<div
				className={`grid grid-cols-4 gap-2.5 @min-[520px]/fp:grid-cols-6 @min-[640px]/fp:gap-3 @min-[760px]/fp:grid-cols-8 ${fades}`}
			>
				{list.map((p, i) => (
					<div
						key={p.tmdbId}
						data-p={p.tmdbId}
						data-pop-id={anchorId(p)}
						className={`relative min-w-0 ${i >= late ? "fp-late" : ""}`}
						style={
							i >= late
								? { animationDelay: `${Math.min(10, i - late) * 18}ms` }
								: undefined
						}
						onClickCapture={(e) => {
							if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
							const target = e.target as Element
							// The card's own actions keep working; the poster opens the quick view.
							if (!target.closest("a") || target.closest("button")) return
							e.preventDefault()
							e.stopPropagation()
							setOpen(i)
						}}
					>
						<MovieTvCard
							mediaType={type}
							actions={touch ? false : undefined}
							details={{
								tmdb_id: p.tmdbId,
								title: p.title,
								release_year: p.year,
								poster_path: p.poster,
								goodwatch_overall_score_normalized_percent: p.goodwatch,
							}}
						/>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-amber-400 transition-opacity duration-200"
							style={{ opacity: open === i ? 1 : 0 }}
						/>
					</div>
				))}
			</div>
			{open !== null && list[open] && (
				<Suspense fallback={null}>
					<SharedQuickView
						list={list}
						type={type}
						effects={effects}
						index={open}
						onIndex={setOpen}
						onClose={() => setOpen(null)}
					/>
				</Suspense>
			)}
		</>
	)
}

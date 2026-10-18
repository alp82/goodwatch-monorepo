import { formatScore, imdbVibe, vibeTileColor } from "./scale"

/** A score as a small tile in the episode grid's colours. */
export function ScoreTile({
	score,
	title,
	className = "h-5 min-w-8 text-[11px]",
}: {
	score: number | null
	title?: string
	className?: string
}) {
	if (score === null) return null
	return (
		<span
			title={title}
			className={`inline-flex shrink-0 items-center justify-center rounded-[4px] px-1 font-semibold tabular-nums text-white ${className}`}
			style={{ background: vibeTileColor(imdbVibe(score)) }}
		>
			{formatScore(score)}
		</span>
	)
}

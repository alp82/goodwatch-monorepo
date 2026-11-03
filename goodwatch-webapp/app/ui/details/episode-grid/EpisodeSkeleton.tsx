import type { CSSProperties } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import EpisodeHeading from "./EpisodeHeading"
import { GAP, LABEL_W, ROW, ROW_CHROME, plotFor } from "./strip-layout"

/**
 * Matches the grid's geometry before JavaScript or watch data arrive: a 24 px row per season, its label, its squares
 * at the size the grid will pick for this width, and its score chip. One placeholder per season, not per episode.
 * The square size comes from container queries (one per candidate size), and a season's lines from its share of the
 * longest season, so nothing moves when the grid replaces it.
 */
export default function EpisodeSkeleton({
	layout,
	state = "loading",
	onRetry,
}: {
	layout: EpisodeLayout
	state?: "loading" | "failed" | "changed"
	onRetry?: () => void
}) {
	const regular = layout.seasons.filter((s) => s.number !== 0)
	const most = Math.max(1, ...regular.map((s) => s.count))
	const special = layout.seasons.find((s) => s.number === 0)
	// The biggest square c whose lines fit a row and hold the longest season: the width that first allows it.
	const sizes: string[] = []
	for (let c = 3; c <= ROW - 2; c++) {
		const lines = Math.floor((ROW + GAP) / (c + GAP))
		sizes.push(
			`@container episode-skeleton (min-width:${plotFor(most, c) + ROW_CHROME}px){.episode-skeleton-rows{--cell:${c}px;--lines:${lines}}}`,
		)
	}
	return (
		<section
			aria-labelledby="episode-list-title"
			aria-busy={state === "loading"}
			data-episode-skeleton
		>
			<EpisodeHeading loading={state} onRetry={onRetry} />
			{layout.note && (
				<p className="mt-2 text-sm text-gray-400">{layout.note}</p>
			)}
			<div
				className="mt-4"
				style={{
					containerType: "inline-size",
					containerName: "episode-skeleton",
				}}
			>
				<style>{`
.episode-skeleton-rows{--cell:2px;--lines:6;--plot:max(60px,calc(100cqw - ${ROW_CHROME}px));display:flex;flex-direction:column;gap:4px}
.episode-skeleton-row{--n:calc(var(--share)*var(--lines));--ls:round(up,var(--n),1);display:grid;grid-template-columns:${LABEL_W}px var(--plot) 1fr;column-gap:4px;height:${ROW + 4}px;align-items:center}
.episode-skeleton-tiles{display:flex;flex-direction:column}
.episode-skeleton-line,.episode-skeleton-full{background:rgb(255 255 255/.08);border-radius:2px;--cols:linear-gradient(90deg,#000 var(--cell),transparent var(--cell)) 0 0/calc(var(--cell) + ${GAP}px) 100%;--rows:linear-gradient(180deg,#000 var(--cell),transparent var(--cell)) 0 0/100% calc(var(--cell) + ${GAP}px)}
.episode-skeleton-line{height:var(--cell);mask:var(--cols)}
.episode-skeleton-full{width:calc((var(--plot) + ${GAP}px) - mod(var(--plot) + ${GAP}px,var(--cell) + ${GAP}px) - ${GAP}px);height:max(0px,calc((var(--ls) - 1)*(var(--cell) + ${GAP}px) - ${GAP}px));margin-bottom:calc(min(1,var(--ls) - 1)*${GAP}px);mask:var(--cols),var(--rows);mask-composite:intersect}
.episode-skeleton-last{width:min(calc(var(--count)*(var(--cell) + ${GAP}px) - ${GAP}px),calc(var(--plot)*(var(--n) - var(--ls) + 1)))}
${sizes.join("\n")}
`}</style>
				<div
					className="episode-skeleton-rows animate-pulse motion-reduce:animate-none"
					aria-hidden
				>
					{regular.map((season) => (
						<div
							key={season.number}
							className="episode-skeleton-row"
							style={
								{
									"--count": season.count,
									"--share": season.count / most,
								} as CSSProperties
							}
						>
							<span className="ml-1.5 h-2 w-5 rounded bg-white/[0.08]" />
							<span className="episode-skeleton-tiles">
								<span className="episode-skeleton-full" />
								<span className="episode-skeleton-line episode-skeleton-last" />
							</span>
							<span className="mr-1 h-5 w-8 justify-self-end rounded-[4px] bg-white/[0.08]" />
						</div>
					))}
				</div>
				{special && (
					<div
						aria-hidden
						className="mt-1.5 flex h-10 items-center px-1.5 lg:h-8"
					>
						<span className="h-2 w-16 rounded bg-white/[0.07] animate-pulse motion-reduce:animate-none" />
					</div>
				)}
			</div>
			<span role="status" className="sr-only">
				{state === "loading"
					? "Loading episodes"
					: state === "changed"
						? "Episodes changed. Reload to show the updated list."
						: "Episodes could not be loaded. Try again."}
			</span>
		</section>
	)
}

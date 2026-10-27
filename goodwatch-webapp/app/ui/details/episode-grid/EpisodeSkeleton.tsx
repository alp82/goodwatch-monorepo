import type { CSSProperties } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import EpisodeHeading from "./EpisodeHeading"

/** Matches RatingsGrid's geometry before JavaScript or watch data arrive. One placeholder row per season, not per episode. */
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
	const rules = (score: number) => {
		const base = 47 + score
		const wrapAt = base + most * 21 + (most - 1) * 3
		if (most * 21 + (most - 1) * 3 <= 120) return ""
		const sizes = [1, 2, 3, 4, 5, 6, 8, 10, 12]
		return (
			`@container episode-skeleton (max-width:${wrapAt - 0.01}px){.episode-skeleton-rows{--wrapped:1;--cols:12;--plot:var(--avail);--row-gap:12px}}` +
			sizes
				.slice(0, -1)
				.reverse()
				.map((n, i) => {
					const next = sizes[sizes.length - 1 - i]
					return `@container episode-skeleton (max-width:${Math.min(wrapAt, base + next * 28 + (next - 1) * 3) - 0.01}px){.episode-skeleton-rows{--cols:${n}}}`
				})
				.join("")
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
.episode-skeleton-rows{--score:0px;--cols:${most};--wrapped:0;--avail:max(120px,calc(100cqw - 47px - var(--score)));--cell:min(40px,calc((var(--avail) - (var(--cols) - 1)*3px)/var(--cols)));--plot:max(calc(var(--cell)*${most} + ${(most - 1) * 3}px),min(var(--avail),560px));--row-gap:3px;display:flex;flex-direction:column;gap:var(--row-gap);padding-top:20px}
.episode-skeleton-row{--lines:round(up,calc(var(--count)/var(--cols)),1);--grid-h:calc(var(--lines)*30px + (var(--lines) - 1)*3px);--row-h:max(40px,var(--grid-h));display:grid;grid-template-columns:44px var(--plot);column-gap:3px;height:var(--row-h);align-items:center}
.episode-skeleton-tiles{height:var(--grid-h);width:min(var(--plot),calc(var(--count)*(var(--cell) + 3px) - 3px));background:repeating-linear-gradient(90deg,rgb(255 255 255/.07) 0 var(--cell),transparent var(--cell) calc(var(--cell) + 3px));mask:repeating-linear-gradient(180deg,#000 0 30px,transparent 30px 33px);border-radius:3px}
.episode-skeleton-score{display:none}
@media(max-width:1023.99px){${rules(0)}}
@media(min-width:1024px){.episode-skeleton-rows{--score:39px}.episode-skeleton-row{grid-template-columns:44px var(--plot) 36px}.episode-skeleton-score{display:block}${rules(39)}}
`}</style>
				<div
					className="episode-skeleton-rows animate-pulse motion-reduce:animate-none"
					aria-hidden
					style={!regular.length ? { paddingTop: 0 } : undefined}
				>
					{regular.map((season) => (
						<div
							key={season.number}
							className="episode-skeleton-row"
							style={{ "--count": season.count } as CSSProperties}
						>
							<span className="ml-1.5 h-2 w-5 rounded bg-white/[0.07]" />
							<div className="episode-skeleton-tiles" />
							<span className="episode-skeleton-score h-5 w-8 rounded bg-white/[0.07]" />
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

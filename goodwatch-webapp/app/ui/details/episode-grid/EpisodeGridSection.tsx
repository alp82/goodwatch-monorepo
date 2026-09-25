// PROTOTYPE (#153): four episode grid layouts on the real show page, picked with
// ?grid=a|b|c|d and the floating switcher. Once the owner picks one, keep that layout,
// delete the others and the switcher, and keep this section, scale.ts and shared.tsx.
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { paletteVars } from "~/ui/details/episode-grid/scale"
import { ImdbAttribution, PaletteToggle, usePalette } from "~/ui/details/episode-grid/shared"
import GridPrototypeSwitcher from "~/ui/details/episode-grid/prototype/GridPrototypeSwitcher"
import VariantHeatmap from "~/ui/details/episode-grid/prototype/VariantHeatmap"
import VariantScoreboard from "~/ui/details/episode-grid/prototype/VariantScoreboard"
import VariantStrips from "~/ui/details/episode-grid/prototype/VariantStrips"
import VariantTransposed from "~/ui/details/episode-grid/prototype/VariantTransposed"

export interface GridVariantProps {
	grid: EpisodeGrid
	title: string
}

const VARIANTS = [
	{ key: "a", name: "Heatmap", Component: VariantHeatmap },
	{ key: "b", name: "Season columns", Component: VariantTransposed },
	{ key: "c", name: "Season strips", Component: VariantStrips },
	{ key: "d", name: "Scoreboard", Component: VariantScoreboard },
] as const

type VariantKey = (typeof VARIANTS)[number]["key"]

const isVariantKey = (value: string | null): value is VariantKey => VARIANTS.some((v) => v.key === value)

export default function EpisodeGridSection({ grid, title }: GridVariantProps) {
	const [searchParams] = useSearchParams()
	const requested = searchParams.get("grid")
	const [variant, setVariant] = useState<VariantKey>(isVariantKey(requested) ? requested : "a")
	const [palette, setPalette] = usePalette()

	// Switch without a navigation, so the page loader does not run again.
	const switchTo = (key: VariantKey) => {
		setVariant(key)
		const url = new URL(window.location.href)
		url.searchParams.set("grid", key)
		window.history.replaceState(window.history.state, "", url)
	}

	const { Component } = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0]
	const episodeCount = grid.seasons.reduce((sum, s) => sum + s.episodes.length, 0) + grid.specials.length

	return (
		<section aria-labelledby="episode-grid-title" style={paletteVars(palette)}>
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<div>
					<h2 id="episode-grid-title" className="text-2xl font-bold">
						Episode ratings
					</h2>
					<p className="mt-1 text-gray-400">
						{episodeCount} rated episode{episodeCount === 1 ? "" : "s"} across {grid.seasons.length} season
						{grid.seasons.length === 1 ? "" : "s"}, with every site's score for each season.
					</p>
				</div>
				<PaletteToggle palette={palette} onChange={setPalette} />
			</div>
			<div className="mt-6">
				<Component grid={grid} title={title} />
			</div>
			<ImdbAttribution className="mt-4" />
			<GridPrototypeSwitcher
				variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
				current={variant}
				onChange={(key) => switchTo(key as VariantKey)}
			/>
		</section>
	)
}

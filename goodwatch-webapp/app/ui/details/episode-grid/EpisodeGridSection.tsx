// PROTOTYPE (#153): round 2 of the episode grid, four designs of the same responsive grid
// picked with ?grid=e|f|g|h and the floating switcher. Once the owner picks one, inline
// its choices into EpisodeGrid.tsx, then delete prototype/ and render EpisodeGrid directly.
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import GridPrototypeSwitcher from "~/ui/details/episode-grid/prototype/GridPrototypeSwitcher"
import { DESIGNS, isDesignKey } from "~/ui/details/episode-grid/prototype/designs"

export default function EpisodeGridSection({ grid }: { grid: EpisodeGridData; title: string }) {
	const [searchParams] = useSearchParams()
	const requested = searchParams.get("grid")
	const [key, setKey] = useState(isDesignKey(requested) ? (requested as string) : DESIGNS[0].key)

	// Switch without a navigation, so the page loader does not run again.
	const switchTo = (next: string) => {
		setKey(next)
		const url = new URL(window.location.href)
		url.searchParams.set("grid", next)
		window.history.replaceState(window.history.state, "", url)
	}

	const design = DESIGNS.find((d) => d.key === key) ?? DESIGNS[0]
	return (
		<>
			{/* A new key per design, so switching starts from a closed, collapsed grid. */}
			<EpisodeGrid key={design.key} grid={grid} design={design} />
			<GridPrototypeSwitcher variants={DESIGNS.map(({ key, name }) => ({ key, name }))} current={design.key} onChange={switchTo} />
		</>
	)
}

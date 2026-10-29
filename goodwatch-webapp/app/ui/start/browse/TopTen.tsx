// Top 10 on GoodWatch: the ten best movies or shows of all time (the best-of lists), with big outlined ranks. Movies
// and Shows switch in place: the rail keeps its height, and only the cards change. Both lists are one link away in the
// server HTML whichever shows, under the rail.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { SizeRule } from "~/utils/tmdb-image"
import { BROWSE_HUBS, type BrowseKind } from "./browse-data"
import { Rail, RailHead, useRailNav } from "./Rail"
import { RailCard } from "./Rails"

/** The Top 10's poster is 108 px wide on a phone, 136 px from 640 px, and 152 px from 1024 px (start.css). */
const TOP_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "152px"],
	["(min-width: 640px)", "136px"],
	[null, "108px"],
]

const KINDS: { kind: BrowseKind; label: string }[] = [
	{ kind: "movie", label: "Movies" },
	{ kind: "show", label: "Shows" },
]

export function TopTen({ top }: { top: Record<BrowseKind, StartTitle[]> }) {
	const [kind, setKind] = useState<BrowseKind>(
		top.movie.length ? "movie" : "show",
	)
	const nav = useRailNav()
	const kinds = KINDS.filter((option) => top[option.kind].length)
	if (!kinds.length) return null
	const choose = (next: BrowseKind) => {
		if (next === kind) return
		setKind(next)
		// The other list starts at its first card.
		nav.reset()
	}
	return (
		<section aria-labelledby="sb-top">
			<RailHead
				id="sb-top"
				title="Top 10 on GoodWatch"
				line="The highest scores of all time"
				href={kind === "movie" ? BROWSE_HUBS.bestMovies : BROWSE_HUBS.bestShows}
				nav={nav}
			/>
			<div role="tablist" aria-label="Top 10" className="sb-tabs">
				{kinds.map((option) => (
					<button
						key={option.kind}
						type="button"
						role="tab"
						aria-selected={kind === option.kind}
						onClick={() => choose(option.kind)}
					>
						{option.label}
					</button>
				))}
			</div>
			<Rail
				nav={nav}
				name={kind === "movie" ? "Top 10 movies" : "Top 10 shows"}
				className="sb-ranks"
			>
				{top[kind].map((title, i) => (
					<li key={`${title.media_type}-${title.tmdb_id}`}>
						<span aria-hidden className="sb-rank">
							{i + 1}
						</span>
						<div className="sb-card">
							<RailCard title={title} sizes={TOP_POSTER_SIZES} />
						</div>
					</li>
				))}
			</Rail>
			<p className="sb-also">
				All the best{" "}
				<Link to={BROWSE_HUBS.bestMovies} discover="none">
					movies
				</Link>{" "}
				and{" "}
				<Link to={BROWSE_HUBS.bestShows} discover="none">
					shows
				</Link>
			</p>
		</section>
	)
}

// The Where to start section's rails of cards and tiles: New on streaming, the moods, and the services. Every card and
// tile is one link to its page, with the page's name as its text; the posters in a tile are decoration.
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { tmdbImageUrl, type SizeRule } from "~/utils/tmdb-image"
import {
	BROWSE_HUBS,
	BROWSE_MOODS,
	type BrowseMood,
	type BrowseService,
	moodHref,
} from "./browse-data"
import { Rail, RailHead, useRailNav } from "./Rail"

/** A rail's poster card is 116 px wide on a phone, 144 px from 640 px, and 164 px from 1024 px (start.css). */
export const RAIL_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "164px"],
	["(min-width: 640px)", "144px"],
	[null, "116px"],
]

/** A start title as the site's poster card, its link named by the title and year. Lazy: the section is below. */
export function RailCard({
	title,
	sizes = RAIL_POSTER_SIZES,
}: { title: StartTitle; sizes?: SizeRule[] }) {
	return (
		<MovieTvCard
			details={title}
			mediaType={title.media_type}
			discover="none"
			actions={false}
			posterSizes={sizes}
			posterMaxWidth={164}
		/>
	)
}

/** A poster drawn as decoration, inside a link that names its page. */
export function Poster({
	path,
	size = "w185",
	className,
	style,
}: {
	path: string | undefined
	size?: "w92" | "w185"
	className?: string
	style?: CSSProperties
}) {
	if (!path)
		return (
			<span
				className={className ? `sb-poster ${className}` : "sb-poster"}
				style={style}
			/>
		)
	return (
		<img
			src={tmdbImageUrl(path, size)}
			alt=""
			loading="lazy"
			decoding="async"
			width={size === "w92" ? 92 : 185}
			height={size === "w92" ? 138 : 278}
			className={className ? `sb-poster ${className}` : "sb-poster"}
			style={style}
		/>
	)
}

/** Three posters fanned out from the bottom center, the first in front. They spread a little on hover or focus. */
export function Fan({
	posters,
	className,
}: { posters: readonly string[]; className?: string }) {
	return (
		<div aria-hidden className={className ? `sb-fan ${className}` : "sb-fan"}>
			<Poster path={posters[1]} className="sb-fan-l" />
			<Poster path={posters[2]} className="sb-fan-r" />
			<Poster path={posters[0]} className="sb-fan-c" />
		</div>
	)
}

export function ArrivalsRail({ titles }: { titles: StartTitle[] }) {
	const nav = useRailNav()
	if (!titles.length) return null
	return (
		<section aria-labelledby="sb-new">
			<RailHead
				id="sb-new"
				title="New on streaming"
				line="Arrived on the big services lately"
				href={BROWSE_HUBS.arrivals}
				nav={nav}
			/>
			<Rail nav={nav} name="New on streaming">
				{titles.map((title) => (
					<li key={`${title.media_type}-${title.tmdb_id}`} className="sb-card">
						<RailCard title={title} />
					</li>
				))}
			</Rail>
		</section>
	)
}

const MOOD_INFO = new Map<string, (typeof BROWSE_MOODS)[number]>(
	BROWSE_MOODS.map((mood) => [mood.path, mood]),
)

export function MoodRail({ moods }: { moods: BrowseMood[] }) {
	const nav = useRailNav()
	if (!moods.length) return null
	return (
		<section aria-labelledby="sb-moods">
			<RailHead
				id="sb-moods"
				title="By mood"
				line="Pick the kind of evening"
				href={BROWSE_HUBS.moods}
				nav={nav}
			/>
			<Rail nav={nav} name="Moods">
				{moods.map((mood) => {
					const info = MOOD_INFO.get(mood.path)
					if (!info) return null
					return (
						<li
							key={mood.path}
							className="sb-mood"
							style={{ "--hue": info.hue } as CSSProperties}
						>
							<Link
								to={moodHref(mood.path)}
								discover="none"
								className="sb-tile"
							>
								<Fan posters={mood.posters} />
								<b>{info.name}</b>
								<span>{info.line}</span>
							</Link>
						</li>
					)
				})}
			</Rail>
		</section>
	)
}

export function ServiceRail({ services }: { services: BrowseService[] }) {
	const nav = useRailNav()
	if (!services.length) return null
	return (
		<section aria-labelledby="sb-services">
			<RailHead
				id="sb-services"
				title="Streaming services"
				line="The most popular on each"
				href={BROWSE_HUBS.services}
				nav={nav}
			/>
			<Rail nav={nav} name="Streaming services">
				{services.map((service) => (
					<li key={service.href} className="sb-service">
						<Link to={service.href} discover="none" className="sb-tile">
							<b>
								{service.logo ? (
									<img
										src={tmdbImageUrl(service.logo, "w92")}
										alt=""
										width={36}
										height={36}
										loading="lazy"
										decoding="async"
									/>
								) : (
									<i />
								)}
								{service.name}
							</b>
							<span aria-hidden className="sb-stack">
								{service.posters.map((path) => (
									<Poster key={path} path={path} />
								))}
							</span>
						</Link>
					</li>
				))}
			</Rail>
		</section>
	)
}

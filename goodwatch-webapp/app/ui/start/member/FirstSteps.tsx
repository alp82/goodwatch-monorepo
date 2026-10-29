// What a member with nothing on any list sees in the open card, where "this or that" would be: rating a few titles as
// the main step, a fan of start titles beside it, and the two other ways in as rows next to it (under it on phones):
// bringing their ratings from another site (the import sources' marks), and finding something now (the moods' colors).
// Every step is one link, so nothing here waits for data.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import { MOODS } from "~/domain/moods"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { assetUrl } from "~/utils/asset-url"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ShelfTitle } from "../room/ShelfCovers"
import { MEMBER_HREF } from "./doors"
import { PERSONAL_AT } from "./member-data"

/** The import sources whose marks the row shows. */
const MARKS = IMPORT_SOURCE_LIST.filter((source) => source.logo).slice(0, 5)

export function FirstSteps({
	ratings,
	posters,
}: {
	ratings: number
	/** The start titles, for the fan beside the main step. */
	posters: readonly ShelfTitle[]
}) {
	const fan = posters.filter((p) => p.poster_path).slice(0, 5)
	return (
		<div className="first-steps">
			<Link to={MEMBER_HREF.taste} prefetch="intent" className="first-main">
				<span className="first-main-words">
					<span className="first-kicker">Start here</span>
					<span className="first-title">Rate a few titles you've seen</span>
					<span className="first-line">
						Picks get personal at {PERSONAL_AT} ratings.
					</span>
					<Progress have={ratings} />
					<span className="first-go">
						Start rating
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</span>
				</span>
				<Fan posters={fan} />
			</Link>
			<div className="first-ways">
				<Link to={MEMBER_HREF.imports} prefetch="intent" className="first-way">
					<span aria-hidden className="first-marks">
						{MARKS.map((source) => (
							<span key={source.id} className="first-mark" data-id={source.id}>
								<img
									src={assetUrl(source.logo as string)}
									alt=""
									{...{ fetchpriority: "low" }}
								/>
							</span>
						))}
					</span>
					<span className="first-way-words">
						<span className="first-way-title">Bring your ratings</span>
						<span className="first-way-line">
							From IMDb, Letterboxd, Trakt, Plex and more.
						</span>
					</span>
					<ArrowRightIcon className="first-chev" aria-hidden />
				</Link>
				<Link to={MEMBER_HREF.discover} prefetch="intent" className="first-way">
					<span aria-hidden className="first-moods">
						{MOODS.slice(0, 4).map((mood) => (
							<span
								key={mood.key}
								className="first-mood"
								style={{ "--h": mood.hue } as CSSProperties}
							/>
						))}
					</span>
					<span className="first-way-words">
						<span className="first-way-title">Find something now</span>
						<span className="first-way-line">
							Search by mood above, or browse Discover.
						</span>
					</span>
					<ArrowRightIcon className="first-chev" aria-hidden />
				</Link>
			</div>
		</div>
	)
}

/** The ratings so far, toward PERSONAL_AT. */
function Progress({ have }: { have: number }) {
	const n = Math.min(have, PERSONAL_AT)
	return (
		<span className="first-bar">
			<span aria-hidden className="first-bar-track">
				<span style={{ transform: `scaleX(${n / PERSONAL_AT})` }} />
			</span>
			<span className="first-bar-text">
				{n} of {PERSONAL_AT} ratings
			</span>
		</span>
	)
}

function Fan({ posters }: { posters: readonly ShelfTitle[] }) {
	const mid = (posters.length - 1) / 2
	return (
		<span aria-hidden className="first-fan">
			{posters.map((p, i) => (
				<img
					key={`${p.media_type}-${p.tmdb_id}`}
					src={tmdbImageUrl(p.poster_path as string, "w185")}
					alt=""
					decoding="async"
					{...{ fetchpriority: "low" }}
					style={
						{
							"--d": i - mid,
							zIndex: 10 - Math.abs(Math.round(i - mid)),
						} as CSSProperties
					}
				/>
			))}
		</span>
	)
}

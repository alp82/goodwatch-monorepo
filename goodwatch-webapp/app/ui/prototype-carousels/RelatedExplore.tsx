// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// Variant "explore": an entry into exploring similar titles, in the fashion of the Explorer. At page load it is a
// teaser that needs no script: this title in the middle, its eight closest titles around it as links, and every
// other related title as a plain link in a closed <details>. A tap on "Explore from here" loads the walk
// (SimilarWalk.tsx) into the same box.
//
// Real: the titles, the walk's data (the related titles endpoint, one request per title visited), and the link to
// the Explorer's mood island this title fits (the Explorer can open on an island, not on a title).
// Faked: the map look. The walk is not the Explorer's engine: no islands, no zoom, no taste match.
import { Link } from "@remix-run/react"
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useRelatedPanel } from "~/routes/api.related"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { titlePath } from "~/ui/prototype-carousels/RelatedList"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import {
	OVERALL_PANEL,
	type RelatedCard,
	relatedPanelParams,
} from "~/utils/related-panel"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

type Media = MovieResult | ShowResult
type MediaType = "movie" | "show"

const loadWalk = () => import("~/ui/prototype-carousels/SimilarWalk")
const SimilarWalk = lazy(reloadOnStaleChunk(loadWalk))

export const ORBIT_SIZE = 8

/** Where the nth of the closest titles sits around the middle, in percent of the box. The closest are larger. */
export function orbitPlace(index: number, count: number) {
	const angle = (index / count) * Math.PI * 2 - Math.PI / 2
	// Alternate two radii, so that neighbors don't touch on a phone.
	const radius = index % 2 === 0 ? 37 : 40
	return {
		left: 50 + Math.cos(angle) * radius,
		top: 50 + Math.sin(angle) * radius * 0.92,
		width: index < 2 ? 21 : index < 5 ? 19 : 17,
	}
}

export const EXPLORE_CSS = `
.px-orbit{position:relative;width:100%;max-width:30rem;aspect-ratio:1/1.12;margin:0 auto}
.px-orbit svg{position:absolute;inset:0;width:100%;height:100%}
.px-node{position:absolute;transform:translate(-50%,-50%);border-radius:.5rem;overflow:hidden;
box-shadow:0 6px 18px rgba(0,0,0,.55);outline:2px solid rgba(255,255,255,.14);transition:transform .15s,outline-color .15s}
.px-node img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover}
a.px-node:hover,button.px-node:hover,.px-node:focus-visible{transform:translate(-50%,-50%) scale(1.08);outline-color:#fbbf24;z-index:2}
.px-center{left:50%;top:50%;width:27%;outline:3px solid #fbbf24;z-index:1}
`

export function OrbitLines({ count }: { count: number }) {
	return (
		<svg viewBox="0 0 100 112" preserveAspectRatio="none" aria-hidden="true">
			{Array.from({ length: count }, (_, index) => {
				const place = orbitPlace(index, count)
				return (
					<line
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed positions.
						key={index}
						x1="50"
						y1="56"
						x2={place.left}
						y2={place.top * 1.12}
						stroke="rgba(251,191,36,.35)"
						strokeWidth=".5"
					/>
				)
			})}
		</svg>
	)
}

export default function RelatedExplore({ media }: { media: Media }) {
	const prototype = useCarouselPrototype()
	const panel = useRelatedPanel(relatedPanelParams(media, OVERALL_PANEL))
	const titleId = `${media.mediaType}-${media.details.tmdb_id}`
	const [openFor, setOpenFor] = useState<string | null>(null)
	const open = openFor === titleId
	// A tap that came before this button was hydrated (NativeRow's inline script marked it) opens the walk now.
	const button = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		if (button.current?.dataset.tapped) setOpenFor(titleId)
	}, [])

	if (!media.fingerprint) return null
	const same =
		(media.mediaType === "movie" ? panel.data?.movies : panel.data?.shows) ?? []
	const other =
		(media.mediaType === "movie" ? panel.data?.shows : panel.data?.movies) ?? []
	const otherType: MediaType = media.mediaType === "movie" ? "show" : "movie"
	const orbit = same.slice(0, ORBIT_SIZE)
	const rest: [MediaType, RelatedCard][] = [
		...same
			.slice(ORBIT_SIZE)
			.map((card) => [media.mediaType, card] as [MediaType, RelatedCard]),
		...other.map((card) => [otherType, card] as [MediaType, RelatedCard]),
	]
	const island = prototype?.island

	return (
		<section className="flex flex-col gap-6 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: EXPLORE_CSS }} />
			{open ? (
				<Suspense
					fallback={
						<div className="px-orbit animate-pulse rounded-xl bg-white/5" />
					}
				>
					<SimilarWalk
						start={{
							mediaType: media.mediaType,
							tmdb_id: media.details.tmdb_id,
							title: media.details.title,
							release_year: String(media.details.release_year ?? ""),
							poster_path: media.details.poster_path,
							goodwatch_overall_score_normalized_percent: 0,
						}}
						onClose={() => setOpenFor(null)}
					/>
				</Suspense>
			) : (
				<div className="grid items-center gap-6 md:grid-cols-2">
					<div className="flex flex-col gap-4">
						<h2 className="text-2xl font-extrabold tracking-tight">
							Explore titles like {media.details.title}
						</h2>
						<p className="text-gray-300">
							The {orbit.length} closest{" "}
							{media.mediaType === "movie" ? "movies" : "shows"} by fingerprint.
							Step onto one to see what is close to it, and keep walking.
						</p>
						<div className="flex flex-wrap gap-3">
							<button
								ref={button}
								type="button"
								data-early-tap=""
								onClick={() => setOpenFor(titleId)}
								onPointerEnter={() => void loadWalk().catch(() => {})}
								onFocus={() => void loadWalk().catch(() => {})}
								className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300 cursor-pointer"
							>
								Explore from here
							</button>
							{island && (
								<a
									href={`/explorer?grouping=mood&island=${island.id}`}
									className="rounded-lg border border-white/20 px-4 py-2 font-semibold hover:bg-white/10"
								>
									<span
										aria-hidden="true"
										className="mr-2 inline-block h-3 w-3 rounded-full"
										style={{ backgroundColor: island.color }}
									/>
									Open the {island.name} island on the map
								</a>
							)}
						</div>
					</div>
					<div className="px-orbit">
						<OrbitLines count={orbit.length} />
						<span className="px-node px-center">
							<TmdbImage
								kind="poster"
								path={media.details.poster_path}
								width={130}
								alt=""
							/>
						</span>
						{orbit.map((card, index) => {
							const place = orbitPlace(index, orbit.length)
							return (
								<Link
									key={card.tmdb_id}
									to={titlePath(media.mediaType, card)}
									prefetch="intent"
									title={`${card.title} (${card.release_year})`}
									className="px-node"
									style={{
										left: `${place.left}%`,
										top: `${place.top}%`,
										width: `${place.width}%`,
									}}
								>
									<TmdbImage
										kind="poster"
										path={card.poster_path}
										width={100}
										alt={`${card.title} (${card.release_year})`}
									/>
								</Link>
							)
						})}
					</div>
				</div>
			)}
			{rest.length > 0 && (
				<details>
					<summary className="cursor-pointer text-sm text-gray-300 hover:text-white">
						All {orbit.length + rest.length} similar titles as a list
					</summary>
					<ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
						{rest.map(([type, card]) => (
							<li key={`${type}-${card.tmdb_id}`}>
								<Link
									to={titlePath(type, card)}
									prefetch="intent"
									className="hover:underline"
								>
									{card.title} ({card.release_year}
									{type === "show" ? ", show" : ""})
								</Link>
							</li>
						))}
					</ul>
				</details>
			)}
		</section>
	)
}

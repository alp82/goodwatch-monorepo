// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// The walk through similar titles that the "explore" variant loads on tap: the title you stand on in the middle, its
// closest titles around it. A tap on one steps onto it and asks the related titles endpoint for its neighbors. The
// trail shows where you have been. Data is real (one /api/related request per title, cached for the visit); the
// view is a stand-in for the Explorer's map, not the map itself.
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	ORBIT_SIZE,
	OrbitLines,
	orbitPlace,
} from "~/ui/prototype-carousels/RelatedExplore"
import { titlePath } from "~/ui/prototype-carousels/RelatedList"
import {
	type RelatedCard,
	relatedPanelQueryOptions,
} from "~/utils/related-panel"

type MediaType = "movie" | "show"
export type WalkTitle = RelatedCard & { mediaType: MediaType }

export default function SimilarWalk({
	start,
	onClose,
}: {
	start: WalkTitle
	onClose: () => void
}) {
	const [trail, setTrail] = useState<WalkTitle[]>([start])
	const [show, setShow] = useState<MediaType>(start.mediaType)
	const here = trail[trail.length - 1]
	const panel = useQuery(
		relatedPanelQueryOptions({
			tmdbId: here.tmdb_id,
			sourceMediaType: here.mediaType,
		}),
	)
	const near = (
		(show === "movie" ? panel.data?.movies : panel.data?.shows) ?? []
	).slice(0, ORBIT_SIZE)
	const tab = (type: MediaType, label: string) => (
		<button
			type="button"
			onClick={() => setShow(type)}
			aria-pressed={show === type}
			className={`rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer ${show === type ? "bg-amber-400 text-black" : "border border-white/20 hover:bg-white/10"}`}
		>
			{label}
		</button>
	)
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="mr-auto text-2xl font-extrabold tracking-tight">
					Close to {here.title}
				</h2>
				{tab("movie", "Movies")}
				{tab("show", "Shows")}
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/10 cursor-pointer"
				>
					Close
				</button>
			</div>
			<ol className="flex flex-wrap items-center gap-1 text-sm text-gray-300">
				{trail.map((step, index) => (
					<li key={`${step.mediaType}-${step.tmdb_id}-${index}`}>
						{index > 0 && <span aria-hidden="true"> → </span>}
						{index === trail.length - 1 ? (
							<span className="font-bold text-white">{step.title}</span>
						) : (
							<button
								type="button"
								onClick={() => setTrail(trail.slice(0, index + 1))}
								className="underline hover:text-white cursor-pointer"
							>
								{step.title}
							</button>
						)}
					</li>
				))}
			</ol>
			<div className="px-orbit" aria-busy={panel.isPending}>
				<OrbitLines count={ORBIT_SIZE} />
				<Link
					to={titlePath(here.mediaType, here)}
					className="px-node px-center"
					title={`Open ${here.title}`}
				>
					<TmdbImage
						kind="poster"
						path={here.poster_path}
						width={130}
						alt={`Open ${here.title}`}
						priority="eager"
					/>
				</Link>
				{panel.isPending
					? Array.from({ length: ORBIT_SIZE }, (_, index) => {
							const place = orbitPlace(index, ORBIT_SIZE)
							return (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed positions.
									key={index}
									className="px-node animate-pulse bg-white/10"
									style={{
										left: `${place.left}%`,
										top: `${place.top}%`,
										width: `${place.width}%`,
										aspectRatio: "2/3",
									}}
								/>
							)
						})
					: near.map((card, index) => {
							const place = orbitPlace(index, ORBIT_SIZE)
							return (
								<button
									key={card.tmdb_id}
									type="button"
									onClick={() => {
										setTrail([...trail, { ...card, mediaType: show }])
									}}
									title={`${card.title} (${card.release_year})`}
									className="px-node cursor-pointer p-0"
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
										priority="eager"
									/>
								</button>
							)
						})}
			</div>
			<p className="text-center text-sm text-gray-300">
				Tap a poster to step onto it. Tap the middle to open{" "}
				<Link
					to={titlePath(here.mediaType, here)}
					className="font-semibold text-white underline"
				>
					{here.title}
				</Link>
				.{!panel.isPending && near.length === 0 && " Nothing close here."}
			</p>
			<ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-300 sm:grid-cols-4">
				{near.map((card) => (
					<li key={card.tmdb_id} className="truncate">
						{card.title} ({card.release_year})
					</li>
				))}
			</ul>
		</div>
	)
}

// One shelf per reason a title is like this one, all the same Shelf: what each says, where its titles come from
// (sources.tsx), its control, and where its Show all goes in the expanded view (discover-links.ts).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import RelatedMap, { useRelatedMap } from "~/ui/related-map/RelatedMap"
import { personPath } from "~/utils/helpers"
import { feelsControls, feelsNote, feelsTitle } from "./FeelsControl"
import { ACTION, Shelf } from "./Shelf"
import {
	feelsLink,
	genreLink,
	personLink,
	seriesLink,
	similarLink,
} from "./discover-links"
import {
	type PersonOption,
	type Sources,
	effectWords,
	useGenreShelf,
	usePersonShelf,
} from "./sources"

export function SeriesShelf({ src }: { src: Sources }) {
	const s = src.series
	if (!s) return null
	const now = new Date().getFullYear()
	return (
		<Shelf
			id="shelf-series"
			kind="Watch order"
			title={s.name}
			note={s.note}
			titles={s.titles}
			// The row shows the whole series; it is the expanded view's first block all the same.
			seeAll={false}
			discover={seriesLink(src)}
			order="Watch order"
			current={src.self}
			reason={`Film ${s.here + 1} of ${s.titles.length} is this page`}
			caption={(t, i) =>
				t.tmdbId === src.id
					? "You're here"
					: !t.goodwatch && (t.year ?? 0) >= now
						? `Film ${i + 1} · coming`
						: `Film ${i + 1}`
			}
		/>
	)
}

/** The titles that share the picked effects, with the rare mix control under the heading. */
export function FeelsShelf({ src }: { src: Sources }) {
	const m = src.mix
	if (!m.ready || !m.options.length) return null
	const words = m.effects.length ? effectWords(m.effects) : null
	return (
		<Shelf
			id="shelf-feels"
			kind="Feels the same"
			title={feelsTitle(src)}
			note={feelsNote(src)}
			action={
				<a href="#fingerprint" className={ACTION}>
					Fingerprint
					<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
				</a>
			}
			controls={feelsControls(src)}
			titles={m.selected.length ? m.titles : []}
			discover={feelsLink(src)}
			listKey={m.key}
			busy={m.busy}
			empty={
				m.selected.length
					? m.busy
						? "Finding them…"
						: `No other ${src.noun} do all of that`
					: `Pick a feeling to see ${src.noun} that have it too`
			}
			reason={words ? <>Also {words}</> : undefined}
		/>
	)
}

/** The related map's nearest titles; the map itself opens under the shelf. */
export function SimilarShelf({ src }: { src: Sources }) {
	const mapData = useRelatedMap()
	const [mapOpen, setMapOpen] = useState(false)
	const titles = src.similar.titles
	if (!titles.length) return null
	return (
		<Shelf
			id="shelf-similar"
			kind="Similar"
			title={`Most like ${src.title} overall`}
			note="Nearest on the related map: closest in everything it does to you, not one trait"
			action={
				mapData ? (
					<button
						type="button"
						onClick={() => setMapOpen(!mapOpen)}
						aria-expanded={mapOpen}
						className={ACTION}
					>
						{mapOpen ? "Close the map" : "Open the map"}
						<ChevronRightIcon
							className={`h-4 w-4 transition-transform duration-200 ${mapOpen ? "rotate-90" : ""}`}
							aria-hidden="true"
						/>
					</button>
				) : null
			}
			titles={titles}
			discover={similarLink(src)}
			reason={`Close to ${src.title} in everything it does`}
		>
			{mapOpen && (
				<div className="mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-100">
					<RelatedMap media={src.media} />
				</div>
			)}
		</Shelf>
	)
}

export function PersonShelf({
	src,
	option,
	controls,
	keepEmpty = false,
}: {
	src: Sources
	option: PersonOption | null
	controls?: ReactNode
	/** Keep the shelf (and its switch) when this person has nothing else: another person is a tap away. */
	keepEmpty?: boolean
}) {
	const work = usePersonShelf(src, option)
	if (!option || (!work.titles.length && !keepEmpty)) return null
	const to = personPath(option.id, option.name)
	return (
		<Shelf
			id="shelf-person"
			kind={`Same ${option.role.toLowerCase()}`}
			title={
				<Link
					to={to}
					prefetch="intent"
					className="transition-colors hover:text-amber-300"
				>
					More from {option.name}
				</Link>
			}
			note={`${option.verb} ${option.name} too, most watched first`}
			action={
				<Link to={to} prefetch="intent" className={ACTION}>
					All their work
					<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
				</Link>
			}
			controls={controls}
			titles={work.titles}
			discover={personLink(option)}
			listKey={option.key}
			busy={work.busy}
			empty={
				work.loaded
					? `Nothing else of ${option.name}'s here yet`
					: "Finding them…"
			}
			reason={`${option.verb} ${option.name}`}
		/>
	)
}

export function GenreShelf({
	src,
	genre,
	controls,
	keepEmpty = false,
}: {
	src: Sources
	genre: string | null
	controls?: ReactNode
	keepEmpty?: boolean
}) {
	const g = useGenreShelf(src, genre)
	if (!g.titles.length && !keepEmpty) return null
	const heading = g.path ? (
		<Link to={g.path} className="transition-colors hover:text-amber-300">
			{g.heading}
		</Link>
	) : (
		g.heading
	)
	return (
		<Shelf
			id="shelf-genre"
			kind="Same genre"
			title={heading}
			controls={controls}
			titles={g.titles}
			discover={genreLink(src, genre)}
			listKey={genre ?? ""}
			busy={g.busy}
			empty={
				g.loaded ? "No titles of this genre to show here" : "Finding them…"
			}
			reason={g.heading}
		/>
	)
}

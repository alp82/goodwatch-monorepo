// The title page's More like this: shelves, each saying why its titles are here, in this order: the watch order (a
// movie's series), titles that feel the same (a rare mix of the title's effects, with its own control), the related
// map's nearest titles, a person's other titles (director, writer, composer, leads: a switch picks whose), and a
// genre's titles (a switch picks which genre). A reason without titles isn't shown. Every shelf with more than its row
// opens the expanded view (expanded-view.tsx). The title page renders the section and its header around this.
import { useState } from "react"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { SegmentedTabs } from "~/ui/details/SegmentedTabs"
import { RidgeSprite } from "~/ui/details/fingerprint-section/Shape"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { FEELS_RIDGES } from "./FeelsControl"
import { SHELF_STYLE } from "./Shelf"
import { ExpandProvider } from "./expanded-view"
import type { ShelfTitle } from "./shelf-data"
import {
	FeelsShelf,
	GenreShelf,
	PersonShelf,
	SeriesShelf,
	SimilarShelf,
} from "./shelves"
import {
	type Sources,
	useGenreShelf,
	usePersonShelf,
	useShelfSources,
} from "./sources"

type Media = MovieResult | ShowResult

export function MoreLikeThis({
	media,
	genreRow,
	similar,
}: {
	media: Media
	/** The loader's genre row (the first genre's shelf). */
	genreRow?: GenreRow
	/** The loader's Similar shelf; undefined when it had none in time (the browser asks for it). */
	similar?: ShelfTitle[]
}) {
	const src = useShelfSources(media, genreRow, similar)
	return (
		<div data-feedback-area="related">
			<style>{SHELF_STYLE}</style>
			{/* The one print the Feels the same control's mini prints draw from. */}
			{src.mix.geo && <RidgeSprite id={FEELS_RIDGES} geo={src.mix.geo} />}
			<ExpandProvider
				pageTitle={src.title}
				poster={media.details.poster_path ?? null}
				end={<ScoreRing media={media} size={30} label={false} />}
			>
				<Shelves src={src} />
			</ExpandProvider>
		</div>
	)
}

function Shelves({ src }: { src: Sources }) {
	const [personKey, setPersonKey] = useState<string | null>(null)
	const [genre, setGenre] = useState<string | null>(null)
	const person =
		src.people.find((p) => p.key === personKey) ?? src.people[0] ?? null
	// The genre shelf and the person shelf stay once they have shown titles, so a switch to an empty one says so.
	const firstGenre = useGenreShelf(src, null)
	const firstPerson = usePersonShelf(src, src.people[0] ?? null)
	return (
		<div className="flex flex-col gap-10">
			<SeriesShelf src={src} />
			<FeelsShelf src={src} />
			<SimilarShelf src={src} />
			<PersonShelf
				src={src}
				option={person}
				keepEmpty={firstPerson.titles.length > 0}
				controls={
					src.people.length > 1 && (
						<SegmentedTabs
							label="Whose work"
							value={person?.key ?? ""}
							onChange={setPersonKey}
							tabs={src.people.map((p) => ({ key: p.key, label: p.role }))}
						/>
					)
				}
			/>
			<GenreShelf
				src={src}
				genre={genre}
				keepEmpty={firstGenre.titles.length > 0}
				controls={
					src.genres.length > 1 && (
						<SegmentedTabs
							label="Which genre"
							value={genre ?? src.genres[0]}
							onChange={(g) => setGenre(g === src.genres[0] ? null : g)}
							tabs={src.genres.map((g) => ({ key: g, label: g }))}
						/>
					)
				}
			/>
		</div>
	)
}

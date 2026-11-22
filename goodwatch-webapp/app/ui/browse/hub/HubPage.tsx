// The owner's idea: the hub is every
// family's index page in miniature. Moods as the lattice, eras as the ribbon you drag, places as the map with each
// country in its flag, genres as words that open into their kinds, streaming as logos, Best as the top five. Point at a
// place and its tile previews it (titles included); a click opens it.
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import {
	type Family,
	type Kind,
	top,
	familyPage,
	ing,
	kindLabel,
	kindNoun,
	place,
} from "~/domain/browse/address"
import type { PlaceRef } from "~/domain/browse/types"
import { WRAP } from "~/ui/browse/index"
import type { BrowseViewProps } from "~/ui/browse/view"
import {
	BestSwitcher,
	EraRibbon,
	FlagMap,
	GenreShelf,
	MoodLattice,
	Occasions,
	ServiceRow,
	Tile,
} from "~/ui/browse/hub/tiles"
import type { HubViewData } from "~/server/browse/hub/view-data"

/** a tile's line says what is in it, plainly ("1930s to 2020s"), no prose. */
const eraLine = (decades: HubViewData["decades"]) => {
	const names = decades.map((d) => d.place.label).sort()
	return names.length > 1 ? `${names[0]} to ${names[names.length - 1]}` : `${names.length} decades`
}

export function HubPage({ data, address, to }: BrowseViewProps<HubViewData>) {
	const kind: Kind = address.kind
	const noun = kindNoun(kind)
	const room = (f: Family) => to(familyPage(kind, f))
	const at = (p: PlaceRef) => to(place(kind, [ing(p.family, p.slug)]))
	const blend = (parts: PlaceRef[]) =>
		to(
			place(
				kind,
				parts.map((p) => ing(p.family, p.slug)),
			),
		)
	const tropeAt = (slug: string) => to(place(kind, [ing("trope", slug)]))
	const kindAt = (p: PlaceRef, id: string) =>
		`${to({ ...place(kind, [ing(p.family, p.slug)]), kind_: id })}#all`
	return (
		<>
			<header className={`${WRAP} pt-6 pb-6 sm:pt-8`}>
				<Kicker>Browse</Kicker>
				<div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
					<PageTitle className="text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl">
						{kindLabel(kind)}
					</PageTitle>
					{data.lede && (
						<p className="max-w-2xl pb-1 text-[17px] leading-relaxed text-pretty text-gray-300">
							{data.lede}
						</p>
					)}
				</div>
			</header>
			<div className={`${WRAP} grid gap-4 sm:gap-5 lg:grid-cols-12`}>
				<Tile
					title="Moods"
					href={room("mood")}
					line={`${data.moods.length} moods`}
					className="lg:col-span-12"
					action="All moods"
				>
					<MoodLattice moods={data.moods} start={data.moodStart} href={at} tropeHref={tropeAt} />
				</Tile>

				<Tile
					title="Eras"
					href={room("decade")}
					line={eraLine(data.decades)}
					className="lg:col-span-7"
					action="All eras"
				>
					<EraRibbon decades={data.decades} href={at} tropeHref={tropeAt} />
				</Tile>

				<Tile
					title="Top"
					href={to(top(kind))}
					line={`${data.lists.length} lists`}
					className="lg:col-span-5"
					action="Full ranking"
				>
					<BestSwitcher lists={data.lists} href={(l) => to(top(kind, l.parts))} />
				</Tile>

				{data.occasions.length > 0 && (
					<Tile
						title="For the night you're having"
						line={`${data.occasions.length} nights`}
						className="lg:col-span-12"
					>
						<Occasions occasions={data.occasions} kind={kind} href={blend} />
					</Tile>
				)}

				<Tile
					title="Places"
					href={room("country")}
					line={`${data.countries.length} countries`}
					className="lg:col-span-12"
					action="All places"
				>
					<FlagMap countries={data.countries} mapped={data.mapped} href={at} tropeHref={tropeAt} />
				</Tile>

				<Tile
					title="Genres"
					href={room("genre")}
					line={`${data.genres.length} genres`}
					className="lg:col-span-12"
					action="All genres"
				>
					<GenreShelf
						genres={data.genres}
						kind={kind}
						href={at}
						kindHref={kindAt}
						tropeHref={tropeAt}
					/>
				</Tile>

				{data.streamingReady && data.services.length > 0 && (
					<Tile
						title="Streaming"
						href={room("service")}
						line={`${data.services.length} services`}
						className="lg:col-span-12"
						action="All services"
					>
						<ServiceRow services={data.services} kind={kind} href={at} />
					</Tile>
				)}
			</div>
			<p className="sr-only">The top {noun} of all time are on the Top page.</p>
		</>
	)
}

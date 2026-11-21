// PROTOTYPE - throwaway (prototype/explore-r6, slot "hub", variant "miniatures"). The owner's idea: the hub is every
// family's index page in miniature. Moods as the lattice, eras as the ribbon you drag, places as the map with each
// country in its flag, genres as words that open into their kinds, streaming as logos, Best as the top five. Point at a
// place and its tile previews it (titles included); a click opens it.
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import {
	type Family,
	type Kind,
	best,
	familyPage,
	ing,
	kindLabel,
	kindNoun,
	place,
} from "../../../../kit/address"
import type { PlaceRef } from "../../../../kit/types"
import { WRAP } from "../../../../kit/ui"
import type { PageViewProps, SlotVariant } from "../../contract"
import {
	BestSwitcher,
	EraRibbon,
	FlagMap,
	GenreShelf,
	MoodLattice,
	Occasions,
	ServiceRow,
	Tile,
} from "./mini"
import type { MiniData } from "./miniatures.server"

/** Round 8: a tile's line says what is in it, plainly ("1930s to 2020s"), no prose. */
const eraLine = (decades: MiniData["decades"]) => {
	const names = decades.map((d) => d.place.label).sort()
	return names.length > 1 ? `${names[0]} to ${names[names.length - 1]}` : `${names.length} decades`
}

function View({ data, address, to }: PageViewProps<MiniData>) {
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
					title="Best"
					href={to(best(kind))}
					line={`${data.lists.length} lists`}
					className="lg:col-span-5"
					action="Full ranking"
				>
					<BestSwitcher lists={data.lists} href={(l) => to(best(kind, l.parts))} />
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
			<p className="sr-only">The best {noun} of all time are on the Best page.</p>
		</>
	)
}

export const variant: SlotVariant<MiniData> = {
	id: "miniatures",
	name: "Miniatures",
	what: "Every family's index page in miniature: the mood lattice, the era ribbon you drag, best-of lists that take turns, the night you're having, a map you can zoom with every country in its flag, genres opening into their kinds, the services. Point or tap to preview, click to open.",
	order: 1,
	View,
	notes: () => [
		{
			term: "Miniature",
			means:
				"A family's index page shrunk to a tile you can play with. What you point at (or drag to) shows its titles and one line in the tile; a click opens its page.",
			isNew: true,
		},
		{
			term: "Mood lattice",
			means:
				"Left is lighter, right is darker, up is calmer, down is more intense. The mood you point at comes forward; the farther a mood is from it, the more it steps back.",
		},
		{
			term: "Flag map",
			means:
				"Every country with a page wears its flag on the map and in the rail under it. Drag to pan; double-click, the + button or a pinch zooms; once you've pressed the map, the wheel zooms too. Pointing at a country in the rail flies the map to its region.",
			isNew: true,
		},
		{
			term: "Known for",
			means:
				"A place's defining tropes: not the ones it has most (every place has a Chekhov's Gun) but the ones it has far more often than the whole catalog, among enough of its titles.",
			isNew: true,
		},
		{
			term: "Best-of lists",
			means:
				"Best shows one list at a time from a pool of about twenty. The list's key word is underlined by a line that fills; when it's full the next list comes. Pointing at the tile pauses it.",
			isNew: true,
		},
		{
			term: "Era ribbon",
			means: "Drag the amber window along the decades, or use the arrow keys. The tile follows.",
		},
	],
}

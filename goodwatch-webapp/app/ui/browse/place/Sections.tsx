// A place page's informative sections under the list: the essentials with a sentence each, what it goes well with, what is close to it, the people and the awards.
import { add, kindNoun, place } from "~/domain/browse/address"
import { headings } from "~/domain/browse/copy/index"
import { FAMILY } from "~/domain/browse/address"
import { AwardStrip, PLACE_STRIP, PeopleStrip, PlaceCard, Reveal } from "~/ui/browse/index"
import {
	Essentials,
	ModuleHead,
	MoreLink,
	NearRow,
	Onward,
	TraitMeters,
} from "~/ui/browse/place-parts"
import { PrintBars } from "~/ui/browse/dials/PrintBars"
import { Lattice, onwardItems } from "~/ui/browse/place/PlaceHead"
import type { PlaceDisplayData } from "~/server/browse/place-display.server"
import { type Props, asWord, cap, said } from "~/ui/browse/place/shared"

type P = Pick<Props, "data" | "address" | "to">

export function EssentialsSection({ data, listTo }: { data: PlaceDisplayData; listTo?: string }) {
	const what = said(data.room.title, data.room.parts)
	if (!data.room.essentials.length) return null
	return (
		<Reveal as="section" className="space-y-5">
			<ModuleHead
				title={headings.essential(what)}
				line="The ones that define it, and why."
				aside={listTo ? <MoreLink to={listTo}>{headings.all(what)}</MoreLink> : undefined}
			/>
			<Essentials titles={data.room.essentials} eager={false} />
		</Reveal>
	)
}

/** A genre's whole fingerprint as bars you can point at (the Dials genre page's form), where the place has one. */
export function ShapeSection({ data, address }: Pick<P, "data" | "address">) {
	const { dz, room } = data
	if (!dz.print || !dz.standouts) return null
	return (
		<Reveal as="section">
			<PrintBars
				bars={dz.print}
				standouts={dz.standouts}
				noun={kindNoun(address.kind)}
				what={said(room.title, room.parts)}
			/>
		</Reveal>
	)
}

export function GoesWithSection({ data, address, to }: P) {
	const { room } = data
	const lead = room.parts[0]
	if (!room.goesWith.length) return null
	return (
		<Reveal as="section" className="space-y-5">
			<ModuleHead
				title={headings.goesWith(room.parts.length > 1 ? room.title.toLowerCase() : asWord(lead))}
				line="Add one more ingredient and the list gets more specific."
			/>
			<div className={PLACE_STRIP}>
				{room.goesWith.map((s) => (
					<PlaceCard
						key={`${s.place.family}-${s.place.slug}`}
						place={s.place}
						to={to(
							add(
								{
									...address,
									sort: undefined,
									page: undefined,
									kind_: undefined,
									level: undefined,
								},
								{ family: s.place.family, slug: s.place.slug },
							),
						)}
						titles={s.titles}
						line={s.name}
					/>
				))}
			</div>
		</Reveal>
	)
}

export function CloseToSection({ data, address, to }: P) {
	const { room } = data
	const lead = room.parts[0]
	if (!room.neighbors.length) return null
	return (
		<Reveal as="section" className="space-y-5">
			<ModuleHead title={headings.closeTo(asWord(lead))} line="Next door, and how it differs." />
			<NearRow
				items={room.neighbors.map((n) => ({
					place: n.place,
					to: to(place(address.kind, [{ family: n.place.family, slug: n.place.slug }])),
					differs: `${cap(n.differs)}.`,
				}))}
			/>
		</Reveal>
	)
}

export function PeopleSection({ data }: { data: PlaceDisplayData }) {
	return (
		<>
			{data.people.length > 0 && (
				<Reveal as="section" className="space-y-5">
					<ModuleHead
						title={headings.people}
						aside={<MoreLink to="/people">All people</MoreLink>}
					/>
					<PeopleStrip people={data.people} />
				</Reveal>
			)}
			{data.awards.length > 0 && (
				<Reveal as="section" className="space-y-4">
					<ModuleHead
						title={headings.awards}
						aside={<MoreLink to="/awards">All awards</MoreLink>}
					/>
					<AwardStrip wins={data.awards} />
				</Reveal>
			)}
		</>
	)
}

/**
 * The room in words, for a layout whose head doesn't hold it: the lede and the ways onward beside what sets it apart,
 * then the lattice across the full width (lighter to darker in eight steps, calmer over more intense).
 */
export function AboutSection({ data, address, to, lede = true }: P & { lede?: boolean }) {
	const { room, dz } = data
	const lead = room.parts[0]
	const noun = kindNoun(address.kind)
	const field = dz.field && dz.field.length > 1 ? dz.field : null
	return (
		<section className="space-y-10">
			<div className="grid items-start gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
				<div className="min-w-0">
					{lede && room.copy?.lede && (
						<p className="max-w-2xl text-xl leading-relaxed text-pretty text-gray-200">
							{room.copy.lede}
						</p>
					)}
					<div className={lede ? "" : "[&>ul]:mt-0 [&>ul]:border-t-0 [&>ul]:pt-0"}>
						<Onward items={onwardItems(data, address, to)} />
					</div>
				</div>
				<TraitMeters more={room.more} less={room.less} noun={noun} />
			</div>
			{field && (
				<Lattice
					places={field}
					here={lead.label}
					familyNoun={FAMILY[lead.family].many.toLowerCase()}
					cols={8}
				/>
			)}
		</section>
	)
}

/** Everything informative under a list: essentials, goes well with, close to, people, awards. */
export function PlaceSections({
	data,
	address,
	to,
	essentials = true,
}: P & { essentials?: boolean }) {
	return (
		<>
			{essentials && <EssentialsSection data={data} listTo="#titles" />}
			<ShapeSection data={data} address={address} />
			<GoesWithSection data={data} address={address} to={to} />
			<CloseToSection data={data} address={address} to={to} />
			<PeopleSection data={data} />
		</>
	)
}

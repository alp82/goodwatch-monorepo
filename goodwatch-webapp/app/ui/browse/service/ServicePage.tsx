// A streaming service's page (`/movies/streaming/us/netflix`): the service's whole library in the country. The head
// says what it's strong and thinner on, in moods that carry their own colors; a full-width row teases what just
// arrived; then its best titles, its kinds, the ingredients that go well with it (filling their row), the services next
// door, the people and awards behind it, the other services, and the full list with Discover's controls.
import { Link } from "@remix-run/react"
import { type Address, type Ingredient, add, browsePath, ing, place } from "~/domain/browse/address"
import { headings } from "~/domain/browse/copy"
import type { PlaceRef, Viewer } from "~/domain/browse/types"
import type { ServicePageData } from "~/server/browse/streaming-page.server"
import { WRAP, poster } from "../base"
import { GridFooter, ListControls } from "../ListControls"
import { FOCUS, Reveal } from "../motion"
import { AwardStrip, PeopleStrip } from "../People"
import { PlaceMark } from "../PlaceMark"
import {
	ArrivalsRow,
	Essentials,
	KindCard,
	ModuleHead,
	MoreLink,
	NearRow,
	PlaceCard,
	PlaceHead,
	cap,
	lower,
	placeStrip,
} from "../place-sections"
import { TitleGrid } from "../Posters"

const one = (p: PlaceRef): Ingredient => ing(p.family, p.slug)

export function ServicePage({
	data,
	address,
	viewer,
	kindId,
}: {
	data: ServicePageData
	address: Address
	viewer: Viewer
	/** The kind the list is narrowed to (`?kind=`). */
	kindId: string | null
}) {
	const kind = address.kind
	const lead = data.service
	const said = data.title.charAt(0).toLowerCase() + data.title.slice(1)
	const listPath = (a: Address, extra?: Record<string, string | undefined>) =>
		browsePath(a, { kind: kindId ?? undefined, ...extra })
	const blendTo = (p: PlaceRef) => browsePath(add({ ...address, sort: undefined }, one(p)))
	const placeTo = (p: PlaceRef) => browsePath(place(kind, [one(p)], address.country))
	const listHeading = data.activeKind ?? headings.all(said)

	return (
		<>
			<PlaceHead
				kicker={`Streaming in ${data.countryName}`}
				title={
					lead.logo ? (
						<span className="flex items-center gap-4">
							<img
								src={poster(lead.logo, "w154")}
								alt=""
								className="h-14 w-14 shrink-0 rounded-2xl ring-1 ring-white/10 sm:h-16 sm:w-16"
							/>
							{data.title}
						</span>
					) : (
						data.title
					)
				}
				lede={data.copy?.lede}
			>
				{data.goodAt.length > 0 && (
					<p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-300">
						Strong on{" "}
						{data.goodAt.map((g, i, all) => (
							<span key={`${g.place.family}-${g.place.slug}`}>
								{i > 0 && (i === all.length - 1 ? " and " : ", ")}
								<Link
									to={blendTo(g.place)}
									prefetch="intent"
									title={g.line}
									className={`rounded-sm font-semibold underline decoration-white/25 decoration-dotted underline-offset-4 transition-colors hover:decoration-solid ${FOCUS}`}
									style={{ color: g.place.hue ?? "#ffffff" }}
								>
									{lower(g.place.label)}
								</Link>
							</span>
						))}
						{data.thinOn.length > 0 && (
							<>
								. Thinner on{" "}
								{data.thinOn.map((t, i, all) => (
									<span key={`${t.family}-${t.slug}`}>
										{i > 0 && (i === all.length - 1 ? " and " : ", ")}
										<Link
											to={blendTo(t)}
											prefetch="intent"
											className={`rounded-sm font-semibold underline decoration-white/20 decoration-dotted underline-offset-4 opacity-80 transition-[opacity,text-decoration-color] hover:opacity-100 hover:decoration-solid ${FOCUS}`}
											style={{ color: t.hue ?? "#d1d5db" }}
										>
											{lower(t.label)}
										</Link>
									</span>
								))}
							</>
						)}
						.
					</p>
				)}
			</PlaceHead>

			<div className={`${WRAP} space-y-14 pb-16`}>
				<ArrivalsRow
					href={data.newHref}
					name={lead.label}
					logo={lead.logo}
					fresh={data.fresh}
					arrivals={data.arrivals}
				/>

				<section className="space-y-5">
					<ModuleHead
						title={headings.bestOf(said)}
						line="The ones people love most, and why."
						aside={<MoreLink to="#all">{headings.all(said)}</MoreLink>}
					/>
					<Essentials titles={data.essentials} />
				</section>

				{data.kinds.length > 1 && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={headings.kindsOf(said)}
							line="Pick one and the list below narrows to it."
						/>
						<div className={placeStrip(data.kinds.length)}>
							{data.kinds.map((k) => {
								const on = kindId === k.id
								return (
									<KindCard
										key={k.id}
										kind={k}
										on={on}
										to={`${browsePath({ ...address, page: undefined }, { kind: on ? undefined : k.id })}#all`}
									/>
								)
							})}
						</div>
					</Reveal>
				)}

				{data.goesWith.length > 0 && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={headings.goesWith(lead.label)}
							line="Add one more ingredient and the list gets more specific."
						/>
						<div className={placeStrip(data.goesWith.length)}>
							{data.goesWith.map((s) => (
								<PlaceCard
									key={`${s.place.family}-${s.place.slug}`}
									place={s.place}
									to={blendTo(s.place)}
									titles={s.titles}
									line={s.name}
								/>
							))}
						</div>
					</Reveal>
				)}

				{data.neighbors.length > 0 && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={headings.closeTo(lead.label)}
							line="Next door, and how it differs."
						/>
						<NearRow
							items={data.neighbors.map((n) => ({
								place: n.place,
								to: placeTo(n.place),
								differs: `${cap(n.differs)}.`,
							}))}
						/>
					</Reveal>
				)}

				{data.people.length > 0 && (
					<Reveal as="section" className="space-y-5">
						<PeopleStrip
							people={data.people}
							head={(arrows) => (
								<ModuleHead
									title={headings.people}
									aside={
										<span className="flex items-center gap-4">
											<MoreLink to="/people">All people</MoreLink>
											{arrows}
										</span>
									}
								/>
							)}
						/>
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

				{data.others.length > 0 && (
					<Reveal as="section" className="space-y-4">
						<ModuleHead title="Other services" />
						<ul className="flex flex-wrap gap-x-6 gap-y-3">
							{data.others.map((o) => (
								<li key={o.slug}>
									<Link
										to={placeTo(o)}
										prefetch="intent"
										className={`group flex items-center gap-2.5 rounded-lg font-semibold text-gray-200 transition-colors hover:text-amber-200 ${FOCUS}`}
									>
										<PlaceMark place={o} size={24} />
										{o.label}
									</Link>
								</li>
							))}
						</ul>
					</Reveal>
				)}

				<section id="all" className="scroll-mt-40 space-y-5">
					<ModuleHead
						title={listHeading}
						aside={
							data.activeKind ? (
								<MoreLink to={`${browsePath({ ...address, page: undefined })}#all`}>
									{headings.all(said)}
								</MoreLink>
							) : undefined
						}
					/>
					<ListControls
						address={address}
						to={(a) => listPath(a)}
						viewer={viewer}
						discoverHref={data.list.discoverHref}
					/>
					{data.list.titles.length > 0 ? (
						<>
							<TitleGrid titles={data.list.titles} eager={false} />
							<GridFooter
								page={data.list.page}
								pages={data.list.pages}
								total={data.list.total}
								shown={data.list.titles.length}
								to={(n) => `${listPath({ ...address, page: n })}#all`}
								discoverHref={data.list.discoverHref}
							/>
						</>
					) : (
						<p className="py-10 text-center text-gray-400">
							{data.ready
								? "Nothing fits all of that at once. Take a filter off and it opens up again."
								: "The catalog for this country is still loading. Try again in a moment."}
						</p>
					)}
				</section>
			</div>
		</>
	)
}

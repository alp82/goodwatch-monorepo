// PROTOTYPE - throwaway (prototype/explore-r4, concept rooms). A place's page (one ingredient or a blend) and Best.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { withArticle } from "~/utils/country-article"
import {
	FAMILY,
	type Family,
	type Ingredient,
	type Kind,
	add,
	best,
	familyPage,
	hub,
	ing,
	kindLabel,
	kindNoun,
	place,
	remove,
} from "../../kit/address"
import { headings } from "../../kit/copy"
import type { ConceptPageProps } from "../../kit/contract"
import type { PlaceRef, ShowTitle } from "../../kit/types"
import {
	BlendEntry,
	AwardStrip,
	type BigStat,
	BigStats,
	BestTable,
	Crumbs,
	IntensityScale,
	ListControls,
	PLACE_STRIP,
	Pager,
	PeopleStrip,
	PlaceCard,
	PlaceLede,
	PlaceMark,
	Reveal,
	ShowMark,
	TitleGrid,
	TraitSentence,
	VennSwitch,
	WRAP,
	GridFooter,
	isMixed,
	poster,
} from "../../kit/ui"
import { WorldMap } from "../../kit/world-map/WorldMap"
import { ROOMS, roomOf } from "./bar"
import { ArrivalsRow, CrumbsData } from "./bits"
import { DecadeLine } from "./decade-line"
import type { PlaceData, RoomsData } from "./loader.server"
import {
	Essentials,
	Head,
	KindCard,
	ModuleHead,
	MoreLink,
	NearRow,
	Onward,
	PartLink,
	PickMenu,
	ShiftPanel,
	TraitMeters,
	cap,
	low,
	lower,
} from "./parts"

type To = ConceptPageProps["to"]
const RING = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** A place's name inside a sentence: "cozy movies", "Japanese movies" (a demonym keeps its capital). */
function inSentence(title: string, parts: PlaceRef[]) {
	const proper =
		parts.some((p) => p.family === "country") &&
		!parts.some((p) => p.family === "mood" || p.family === "trait" || p.family === "style")
	return proper && !/^(Movies|Shows|Best)\b/.test(title) ? title : low(title)
}

/** A single place as a word in a heading: "cozy", "comedy", "the 1990s", "Japan", "Netflix". */
function asWord(p: PlaceRef) {
	if (p.family === "decade") return `the ${p.label}`
	if (p.family === "country") return withArticle(p.label)
	if (p.family === "service") return p.label
	return low(p.label)
}

const one = (p: PlaceRef): Ingredient => ing(p.family, p.slug)

/** A decade's standout of each year: a year's place in the row is its place in the decade. */
function YearRail({
	years,
	heading,
	line,
}: {
	years: { year: number; title: ShowTitle }[]
	heading: string
	line?: ReactNode
}) {
	const row = useStepRow<HTMLUListElement>([years.length])
	const mixed = isMixed(years.map((y) => y.title))
	return (
		<section className="min-w-0 space-y-4">
			<ModuleHead title={heading} line={line} aside={<RowArrows row={row} label="years" />} />
			<ul
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:-mx-6 sm:gap-3 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
			>
				{years.map((y, i) => (
					<li
						key={y.year}
						className="w-[calc((100%-2*0.5rem)/3.3)] shrink-0 snap-start sm:w-[calc((100%-4*0.75rem)/5.5)] lg:w-[calc((100%-9*0.75rem)/10)]"
					>
						<p className="mb-1.5 flex items-center gap-2 font-display text-lg leading-none font-bold text-white tabular-nums">
							{y.year}
							<span aria-hidden className="h-px flex-1 bg-white/15" />
						</p>
						<div className="relative">
							<TitlePosterCard card={y.title.card} posterPriority={i < 6 ? "high" : "lazy"} />
							<ShowMark title={y.title} mixed={mixed} />
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}

/** A country's head: the title beside the map, with the country lit where it lies. */
function CountryHead({
	data,
	crumbs,
	kind,
	to,
	after,
}: {
	data: PlaceData
	crumbs: ReactNode
	kind: Kind
	to: To
	after?: ReactNode
}) {
	const lead = data.parts[0]
	const countries = (data.map ?? []).map((c) => ({
		code: c.code,
		name: c.name,
		href: to(place(kind, [ing("country", c.slug)])),
		weight: c.weight,
	}))
	return (
		<header className="relative isolate overflow-hidden">
			<div className="absolute inset-y-0 right-0 -z-10 w-[62%] max-lg:hidden">
				<WorldMap
					variant="hero"
					fade="left"
					active={lead.code}
					countries={countries}
					className="h-full"
				/>
			</div>
			<div className={`${WRAP} pt-6 pb-8 sm:pt-8 sm:pb-10`}>
				{crumbs}
				<div className="mt-5 lg:min-h-[17rem] lg:max-w-[46%]">
					<Kicker className="flex items-center gap-2">
						<PlaceMark place={lead} size={14} />
						Country
					</Kicker>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
						<PageTitle className="text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
							{data.title}
						</PageTitle>
						{after}
					</div>
					{data.copy?.lede && (
						<p className="mt-4 text-lg leading-relaxed text-pretty text-gray-200">
							{data.copy.lede}
						</p>
					)}
					<TraitSentence more={data.more.slice(0, 4)} noun={kindNoun(kind)} className="mt-3" />
				</div>
			</div>
			<div className="lg:hidden">
				<WorldMap variant="hero" active={lead.code} countries={countries} />
			</div>
		</header>
	)
}

/**
 * A lab variant may put its own part in place of the standouts of each year (`years`) or of the essentials
 * (`essentials`); `null` leaves that part out. Left out, the page is the round 4 page.
 */
/** Round 9: a strip of fewer than four cards still fills its row (two cards take half each, not two of four slots). */
const fillStrip = (n: number) =>
	n >= 4
		? PLACE_STRIP
		: PLACE_STRIP.replace("lg:grid-cols-4", n === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2").replace(
				"sm:grid-cols-2",
				n === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2",
			)

export interface PlaceStage {
	years?: ReactNode
	essentials?: ReactNode
	/** Round 6: one band in place of both "Goes well with" and "Close to" (a single place's page only). */
	onward?: ReactNode
}

export function PlacePage({
	data,
	address,
	to,
	viewer,
	stage,
	afterHead,
}: ConceptPageProps<PlaceData> & {
	stage?: PlaceStage
	/** Round 5: a band a lab variant adds right under the head (the round 4 page passes none). */
	afterHead?: ReactNode
}) {
	const kind = address.kind
	const noun = kindNoun(kind)
	const lead = data.parts[0]
	const single = data.parts.length === 1
	const mood = data.parts.find((p) => p.family === "mood")
	const said = inSentence(data.title, data.parts)
	const room = ROOMS.find((r) => r.key === roomOf(address))
	// Round 7: the rooms row already says where you are, so the trail is structured data only (no visible crumbs).
	const crumbs = (
		<CrumbsData
			items={[
				{ label: kindLabel(kind), to: to(hub(kind)) },
				{
					label: room?.label ?? FAMILY[lead.family].many,
					to: to(
						familyPage(
							kind,
							lead.family === "theme" || lead.family === "style" ? "genre" : lead.family,
							address.country,
						),
					),
				},
				...(single
					? [{ label: lead.label }]
					: [
							{ label: lead.label, to: to(place(kind, [one(lead)], address.country)) },
							{ label: data.title },
						]),
			]}
		/>
	)
	const blendTo = (p: PlaceRef) => to(add({ ...address, sort: undefined }, one(p)))

	// Ways onward, as the big facts under the head. A decade's head says its own (what rose and fell), so it has none.
	const stats: BigStat[] = []
	if (single && !data.era) {
		if (!data.service) {
			const [pair] = data.goesWith
			if (pair)
				stats.push({
					label: "Pairs well with",
					value: pair.place.label,
					hue: pair.place.hue,
					sub: `${pair.name}.`,
					to: blendTo(pair.place),
				})
			const [near] = data.neighbors
			if (near)
				stats.push({
					label: "Close to it",
					value: near.place.label,
					hue: near.place.hue,
					sub: `${cap(near.differs)}.`,
					to: to(place(kind, [one(near.place)])),
				})
			if (data.bestOne)
				stats.push({
					label: "The one to start with",
					value: data.bestOne.card.title,
					sub: `${data.bestOne.card.release_year ?? ""} · the best-loved of them all.`,
					to: data.bestOne.to,
				})
		}
	}

	const band = data.intensity && address.level ? data.intensity.trait.word : null
	const listHeading = band
		? address.level === "touch"
			? `A touch ${band}`
			: address.level === "plenty"
				? `Properly ${band}`
				: `As ${band} as it gets`
		: data.activeKind
			? data.activeKind
			: data.venn && address.venn === "a"
				? `${data.parts[0].label}, but not ${low(data.parts[1].label)}`
				: data.venn && address.venn === "b"
					? `${data.parts[1].label}, but not ${low(data.parts[0].label)}`
					: headings.all(said)

	const list = (
		<section id="all" className="scroll-mt-40 space-y-5">
			<ModuleHead
				title={listHeading}
				aside={
					data.activeKind ? (
						<MoreLink to={`${to({ ...address, kind_: undefined, page: undefined })}#all`}>
							{headings.all(said)}
						</MoreLink>
					) : undefined
				}
			/>
			{data.intensity && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<span className="text-[15px] font-semibold text-gray-200">{`How ${data.intensity.trait.word}?`}</span>
					<IntensityScale
						intensity={data.intensity}
						value={address.level}
						to={(level) => `${to({ ...address, level, page: undefined })}#all`}
					/>
				</div>
			)}
			<ListControls
				address={address}
				to={to}
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
						to={(n) => `${to({ ...address, page: n })}#all`}
						discoverHref={data.list.discoverHref}
						noun={noun}
					/>
				</>
			) : (
				<p className="py-10 text-center text-gray-400">
					Nothing fits all of that at once. Take a filter off and it opens up again.
				</p>
			)}
		</section>
	)

	const goesWith = data.goesWith.length > 0 && (
		<Reveal as="section" className="space-y-5">
			<ModuleHead
				title={single ? headings.goesWith(asWord(lead)) : "Narrow it further"}
				line={
					single
						? `Add one more ingredient and the list gets more specific.`
						: `One more ingredient, and what it would give you.`
				}
			/>
			<div className={fillStrip(data.goesWith.length)}>
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
	)

	const people = (data.people.length > 0 || data.awards.length > 0) && (
		<>
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
		</>
	)

	// A blend: the Venn switch decides which titles the list right under it shows.
	if (!single)
		return (
			<>
				<PlaceLede
					kicker={data.parts.map((p) => FAMILY[p.family].one).join(" + ")}
					title={data.title}
					more={data.more.slice(0, 4)}
					noun={noun}
					hue={mood?.hue}
					crumbs={crumbs}
					aside={
						data.venn && data.parts.length === 2 ? (
							<div className="lg:flex lg:justify-end">
								<VennSwitch
									a={data.parts[0]}
									b={data.parts[1]}
									value={address.venn ?? "both"}
									counts={data.venn}
									to={(v) => to({ ...address, venn: v, page: undefined, kind_: undefined })}
								/>
							</div>
						) : undefined
					}
				>
					<div className="mt-5 flex flex-wrap items-center gap-2">
						{data.parts.map((p) => (
							<PartLink
								key={`${p.family}-${p.slug}`}
								place={p}
								to={to(place(kind, [one(p)], address.country))}
								removeTo={to(remove({ ...address, sort: undefined }, one(p)))}
							/>
						))}
					</div>
					{data.goesWith.length > 0 && (
						<p className="mt-4 text-[15px] text-gray-400">
							Add one more:{" "}
							{data.goesWith.map((s, i) => (
								<span key={`${s.place.family}-${s.place.slug}`}>
									{i > 0 && <span className="text-gray-600">, </span>}
									<Link
										to={blendTo(s.place)}
										prefetch="intent"
										className={`rounded-sm font-semibold text-gray-100 underline decoration-white/20 underline-offset-4 transition-colors hover:text-amber-200 hover:decoration-amber-300/60 ${RING}`}
									>
										{s.place.label}
									</Link>
								</span>
							))}
						</p>
					)}
				</PlaceLede>
				<div className={`${WRAP} space-y-14`}>
					{list}
					{goesWith}
					{people}
				</div>
			</>
		)

	const shift = (x: { label: string; place: PlaceRef | null }) => ({
		label: x.label,
		place: x.place,
		to: x.place ? blendTo(x.place) : "#all",
	})
	// Beside the head: a decade says what changed after the one before; other places show what sets them apart.
	const aside =
		data.era?.before && (data.era.rose.length > 0 || data.era.fell.length > 0) ? (
			<ShiftPanel
				before={data.era.before}
				rose={data.era.rose.map(shift)}
				fell={data.era.fell.map(shift)}
			/>
		) : data.era ? (
			// The first decade of a kind has no decade before it: a short panel, so the head stays as low as the others'.
			<TraitMeters more={data.more.slice(0, 4)} less={[]} noun={noun} />
		) : lead.family !== "country" && lead.family !== "service" ? (
			<TraitMeters more={data.more} less={data.less} noun={noun} />
		) : undefined

	const byBest = lead.family === "service" || lead.family === "decade" || lead.family === "country"
	// Beside the trait panel the head has room for the ways onward; without a panel they get their own row.
	const inHead = Boolean(aside) && !data.era && stats.length > 0

	// In the lab: how a blend starts from this place (slot "blend-entry"). Outside the lab it draws nothing.
	const entry = <BlendEntry address={address} to={to} />

	return (
		<>
			{lead.family === "country" ? (
				<CountryHead data={data} crumbs={crumbs} kind={kind} to={to} after={entry} />
			) : (
				<Head
					kicker={
						lead.family === "service"
							? `Streaming in ${data.service?.countryName ?? "the United States"}`
							: FAMILY[lead.family].one
					}
					title={
						lead.family === "service" && lead.logo ? (
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
					hue={mood?.hue}
					crumbs={crumbs}
					aside={
						// With a lab variant's own main part, a phone shows that part first and this panel after it.
						aside && stage?.essentials ? <div className="max-lg:hidden">{aside}</div> : aside
					}
					after={entry}
				>
					{!aside && !data.service && (
						<TraitSentence
							more={data.more.slice(0, 4)}
							less={data.less}
							noun={noun}
							className="mt-3 max-w-2xl"
						/>
					)}
					{data.service && data.service.goodAt.length > 0 && (
						<p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-300">
							Strong on{" "}
							{data.service.goodAt.map((g, i, all) => (
								<span key={`${g.place.family}-${g.place.slug}`}>
									{i > 0 && (i === all.length - 1 ? " and " : ", ")}
									<Link
										to={blendTo(g.place)}
										prefetch="intent"
										title={g.line}
										className={`rounded-sm font-semibold underline decoration-white/25 decoration-dotted underline-offset-4 transition-colors hover:decoration-solid ${RING}`}
										style={{ color: g.place.hue ?? "#ffffff" }}
									>
										{lower(g.place.label)}
									</Link>
								</span>
							))}
							{data.service.thinOn.length > 0 && (
								<>
									. Thinner on{" "}
									{data.service.thinOn.map((t, i, all) => (
										<span key={`${t.family}-${t.slug}`}>
											{i > 0 && (i === all.length - 1 ? " and " : ", ")}
											<Link
												to={blendTo(t)}
												prefetch="intent"
												className={`rounded-sm font-semibold underline decoration-white/20 decoration-dotted underline-offset-4 opacity-80 transition-[opacity,text-decoration-color] hover:opacity-100 hover:decoration-solid ${RING}`}
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

					{inHead && (
						<Onward
							items={stats.map((st) => ({
								label: st.label,
								value: String(st.value),
								sub: typeof st.sub === "string" ? st.sub : undefined,
								to: st.to ?? "#all",
								hue: st.hue,
							}))}
						/>
					)}
				</Head>
			)}
			{afterHead}
			<div className={`${WRAP} space-y-14`}>
				{data.service && (
					<ArrivalsRow
						href={data.service.newHref}
						name={lead.label}
						logo={lead.logo}
						fresh={data.service.fresh}
						arrivals={data.service.arrivals}
					/>
				)}

				{stats.length > 0 && !inHead && (
					<BigStats items={stats} className="border-y border-white/[0.07] py-2" />
				)}

				{stage?.years !== undefined
					? stage.years
					: data.era &&
						data.era.years.length > 0 && (
							<YearRail
								years={data.era.years}
								heading={`${lead.label}, year by year`}
								line="The standout of each year."
							/>
						)}

				{stage?.essentials !== undefined ? (
					<>
						{stage.essentials}
						{aside && stage.essentials && <div className="lg:hidden">{aside}</div>}
					</>
				) : (
					<section className="space-y-5">
						<ModuleHead
							title={byBest ? headings.bestOf(said) : headings.essential(said)}
							line={
								byBest ? "The ones people love most, and why." : "The ones that define it, and why."
							}
							aside={<MoreLink to="#all">{headings.all(said)}</MoreLink>}
						/>
						<Essentials titles={data.essentials} />
					</section>
				)}

				{data.kinds.length > 1 && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={headings.kindsOf(lead.family === "genre" ? low(lead.label) : said)}
							line="Pick one and the list below narrows to it."
						/>
						<div className={PLACE_STRIP}>
							{data.kinds.map((k) => {
								const on = address.kind_ === k.id
								return (
									<KindCard
										key={k.id}
										kind={k}
										on={on}
										to={`${to({ ...address, kind_: on ? undefined : k.id, page: undefined, level: undefined })}#all`}
									/>
								)
							})}
						</div>
					</Reveal>
				)}

				{stage?.onward !== undefined ? stage.onward : goesWith}

				{stage?.onward === undefined && data.neighbors.length > 0 && data.decades && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={`${lead.label} among the decades`}
							line={`The lit ones feel most like the ${lead.label}. The word says how each differs.`}
						/>
						<DecadeLine
							here={lead}
							decades={data.decades}
							alike={data.neighbors}
							hrefOf={(p) => to(place(kind, [one(p)]))}
						/>
					</Reveal>
				)}

				{stage?.onward === undefined && data.neighbors.length > 0 && !data.decades && (
					<Reveal as="section" className="space-y-5">
						<ModuleHead
							title={headings.closeTo(asWord(lead))}
							line="Next door, and how it differs."
						/>
						<NearRow
							items={data.neighbors.map((n) => ({
								place: n.place,
								to: to(place(kind, [one(n.place)])),
								differs: `${cap(n.differs)}.`,
							}))}
						/>
					</Reveal>
				)}

				{people}

				{data.service && data.service.others.length > 0 && (
					<Reveal as="section" className="space-y-4">
						<ModuleHead title="Other services" />
						<ul className="flex flex-wrap gap-x-6 gap-y-3">
							{data.service.others.map((o) => (
								<li key={o.slug}>
									<Link
										to={to(place(kind, [one(o)], address.country))}
										prefetch="intent"
										className={`group flex items-center gap-2.5 rounded-lg font-semibold text-gray-200 transition-colors hover:text-amber-200 ${RING}`}
									>
										<PlaceMark place={o} size={24} />
										{o.label}
									</Link>
								</li>
							))}
						</ul>
					</Reveal>
				)}

				{list}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Best

export function BestPage({
	data,
	address,
	to,
}: ConceptPageProps<Extract<RoomsData, { view: "best" }>>) {
	const kind = address.kind
	const withPart = (family: Family, slug: string | null, year = address.year) => {
		const parts = address.parts.filter((p) => p.family !== family)
		if (slug) parts.push(ing(family, slug))
		return to(best(kind, parts, year))
	}
	const part = (family: Family) => address.parts.find((p) => p.family === family)?.slug ?? null
	const withYear = (year: number | undefined) =>
		to(
			best(
				kind,
				// A year sits inside one decade, so picking one drops the decade.
				year ? address.parts.filter((p) => p.family !== "decade") : address.parts,
				year,
			),
		)
	const filtered = address.parts.length > 0 || address.year !== undefined
	const dot = (hue?: string) =>
		hue ? (
			<span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue }} />
		) : undefined
	return (
		<>
			<PlaceLede
				kicker="Best"
				title={data.title}
				lede={
					data.copy?.lede ??
					`Ranked by one score built from every source, and only among ${kindNoun(kind)} enough people have rated to trust it.`
				}
				crumbs={
					<Crumbs
						items={[
							{ label: kindLabel(kind), to: to(hub(kind)) },
							filtered ? { label: "Best", to: to(best(kind)) } : { label: "Best" },
							...(filtered ? [{ label: data.title }] : []),
						]}
					/>
				}
			/>
			<div className={`${WRAP} space-y-6`}>
				<div className="flex flex-wrap items-center gap-2">
					<span className="mr-1 text-sm font-semibold text-gray-400">Best within</span>
					<PickMenu
						label="Mood"
						value={part("mood")}
						clearTo={withPart("mood", null)}
						columns={2}
						options={data.moods.map((m) => ({
							key: m.slug,
							label: m.label,
							to: withPart("mood", m.slug),
							mark: dot(m.hue),
						}))}
					/>
					<PickMenu
						label="Genre"
						value={part("genre")}
						clearTo={withPart("genre", null)}
						columns={2}
						options={data.genres.map((g) => ({
							key: g.slug,
							label: g.label,
							to: withPart("genre", g.slug),
						}))}
					/>
					<PickMenu
						label="Decade"
						value={part("decade")}
						clearTo={withPart("decade", null)}
						options={data.decades.map((d) => ({
							key: d.slug,
							label: d.label,
							// A decade replaces a single year.
							to: withPart("decade", d.slug, undefined),
						}))}
					/>
					<PickMenu
						label="Year"
						value={address.year ? String(address.year) : null}
						clearTo={withYear(undefined)}
						columns={3}
						options={data.years.map((y) => ({ key: String(y), label: String(y), to: withYear(y) }))}
					/>
					{filtered && (
						<Link
							to={to(best(kind))}
							prefetch="intent"
							preventScrollReset
							className={`ml-1 rounded-sm text-sm font-bold text-gray-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white ${RING}`}
						>
							Clear
						</Link>
					)}
				</div>
				{data.list.rows.length > 0 ? (
					<>
						<BestTable rows={data.list.rows} />
						<Pager page={data.page} pages={data.pages} to={(n) => to({ ...address, page: n })} />
					</>
				) : (
					<p className="py-12 text-center text-gray-400">
						Not enough well-rated {kindNoun(kind)} fit all of that yet. Take a filter off and the
						ranking fills up again.
					</p>
				)}
			</div>
		</>
	)
}

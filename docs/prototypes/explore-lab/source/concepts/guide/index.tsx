// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). The programme guide: a screen over rows of channels.
// A channel is a place (a mood, a genre, an era, a country, a service, Best) and its cells are real poster cards; the
// screen shows the title in focus. Opening a channel keeps the same instrument and puts the channel's character in
// the screen's left half. Two channels on screen at once are a split (a blend).
import { ViewColumnsIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { CSSProperties, ReactNode } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { withArticle } from "~/utils/country-article"
import {
	type Address,
	FAMILY,
	type Family,
	best,
	familyPage,
	href,
	hub,
	kindLabel,
	kindNoun,
	otherKind,
	place,
	remove,
} from "../../kit/address"
import type { ConceptModule, ConceptPageProps } from "../../kit/contract"
import type { PlaceRef } from "../../kit/types"
import {
	AwardStrip,
	BestTable,
	Crumbs,
	ListControls,
	Pager,
	PeopleStrip,
	PlaceCard,
	PlaceMark,
	TitleGrid,
	TraitSentence,
	TraitWord,
	VennSwitch,
	WRAP,
	poster,
	wash,
} from "../../kit/ui"
import { WorldMap } from "../../kit/world-map/WorldMap"
import { exploreTabs } from "../../shell/Shell"
import { ChannelTag, EraLine, EraShifts, PickMenu, Plate, useMoreChannels } from "./bits"
import { headings } from "./copy"
import { Guide } from "./Guide"
import { GROUPS } from "./lineup"
import { SCREEN_BUTTON } from "./Screen"
import type { Cell, Channel, GuideData } from "./types"

type Props = ConceptPageProps<GuideData>
type Of<V extends GuideData["view"]> = Extract<GuideData, { view: V }>

const lower = (s: string) =>
	/^[A-Z][a-z]/.test(s) ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : s
const BY: Record<Family, string> = {
	mood: headings.moods,
	genre: headings.genres,
	theme: headings.themes,
	style: headings.styles,
	decade: headings.decades,
	country: headings.countries,
	service: headings.services,
	trait: "By trait",
	trope: "By trope",
}

/** The pill in the screen's top corner: what you are looking at. */
function Corner({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex rounded-full bg-black/55 px-3 py-1.5 backdrop-blur">
			<Kicker as="span">{children}</Kicker>
		</span>
	)
}

/** What the screen says around a focused title on a page of many channels. */
const onChannel =
	(to: Props["to"], corner?: ReactNode) =>
	({ channel, cell }: { channel: Channel; cell: Cell }) => ({
		corner: corner ? <Corner>{corner}</Corner> : undefined,
		eyebrow: <ChannelTag channel={channel} to={to} rank={cell.rank} />,
		action: channel.open ? (
			<Link to={to(channel.open)} prefetch="intent" className={SCREEN_BUTTON}>
				Open {channel.name}
				<span aria-hidden className="text-gray-400">
					›
				</span>
			</Link>
		) : undefined,
	})

// ---------------------------------------------------------------------------------------------------------
// The hub: tonight's line-up.

function Hub({ address, data, to }: Props & { data: Of<"hub"> }) {
	const kind = address.kind
	const { channels, loader } = useMoreChannels(data.channels, data.next, `hub:${kind}`)
	return (
		<>
			<h1 className="sr-only">
				{kindLabel(kind)}: {data.day}'s line-up
			</h1>
			<Guide
				channels={channels}
				to={to}
				screen={onChannel(to, `${data.day}'s line-up`)}
				intro={
					<p className="mb-4 max-w-3xl text-base leading-relaxed text-pretty text-gray-300 lg:mb-3">
						<span className="font-semibold text-white">{data.day} night.</span> {data.note}
					</p>
				}
			>
				{loader}
			</Guide>
			<nav aria-label="Every group of channels" className={`${WRAP} mt-10 lg:hidden`}>
				<SectionHeading size="group">More channels</SectionHeading>
				<ul className="mt-2 divide-y divide-white/[0.07]">
					{GROUPS.map((g) => (
						<li key={g.family}>
							<Link
								to={to(familyPage(kind, g.family))}
								prefetch="intent"
								className="flex items-baseline gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="w-24 shrink-0 font-semibold text-white">{g.label}</span>
								<span className="min-w-0 flex-1 text-sm text-gray-400">{g.line}</span>
								<span aria-hidden className="text-gray-500">
									›
								</span>
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A family: every channel of one group.

function FamilyPage({ address, data, to }: Props & { data: Of<"family"> }) {
	const kind = address.kind
	const family = data.family
	const { channels, loader } = useMoreChannels(data.channels, data.next, `${family}:${kind}`)
	const title = `${kindLabel(kind)} ${BY[family].toLowerCase()}`
	const map = !!data.countries
	const head = (
		<>
			<div className={map ? "" : "lg:hidden"}>
				<Crumbs
					items={[{ label: kindLabel(kind), to: to(hub(kind)) }, { label: FAMILY[family].many }]}
				/>
			</div>
			<div>
				{!map && <Kicker className="max-lg:mt-1">Channels</Kicker>}
				<PageTitle className="mt-1.5 text-3xl leading-[1.05] tracking-tight text-balance text-white sm:text-4xl">
					{title}
				</PageTitle>
			</div>
			{data.lede && (
				<p className="max-w-2xl text-base leading-relaxed text-pretty text-gray-200">{data.lede}</p>
			)}
		</>
	)
	if (data.waiting)
		return (
			<div className={`${WRAP} space-y-3 pt-6`}>
				{head}
				<p className="py-10 text-gray-300">
					The streaming catalogs are still loading. Give it a minute, then reload.
				</p>
			</div>
		)
	return (
		<>
			{/* Countries open on the map; every other family opens straight on its channels. */}
			{data.countries && (
				<div className={`${WRAP} space-y-3 pt-6 pb-8`}>
					{head}
					<div className="pt-3">
						<WorldMap
							variant="page"
							countries={data.countries.map((c) => ({
								code: c.code,
								name: c.name,
								weight: c.weight,
								href: to(place(kind, [{ family: "country", slug: c.slug }])),
							}))}
						/>
					</div>
				</div>
			)}
			<Guide
				channels={channels}
				to={to}
				timeline={family === "decade"}
				screen={onChannel(to)}
				lead={
					map ? undefined : (
						<div className="flex h-full min-w-0 flex-col justify-center gap-3 px-4 pt-6 pb-5 sm:px-6 lg:p-7">
							{head}
						</div>
					)
				}
				leadClassName="lg:rounded-l-2xl lg:bg-white/[0.035]"
			>
				{loader}
			</Guide>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A channel's own page: the screen's left half is the channel's character.

const KICKER: Record<Family, string> = {
	mood: "Mood",
	genre: "Genre",
	theme: "Theme",
	style: "Style",
	decade: "Era",
	country: "Country",
	service: "Streaming",
	trait: "Trait",
	trope: "Trope",
}

function nowShowing() {
	return ({ channel }: { channel: Channel; cell: Cell }) => ({
		corner: <Corner>Now showing</Corner>,
		phone: "corner" as const,
		eyebrow:
			channel.sort === "essentials" ? undefined : (
				<span className="flex min-w-0 items-center gap-2">
					{channel.place && channel.sort !== "kind" && (
						<PlaceMark place={channel.place} size={15} />
					)}
					<span className="truncate">{channel.name}</span>
				</span>
			),
	})
}

function ChannelLead({ address, data, to }: Props & { data: Of<"place"> }) {
	const kind = address.kind
	const lead = data.parts[0]
	const family = lead.family
	return (
		<div className="flex h-full min-w-0 flex-col justify-center gap-3 px-4 pt-6 pb-5 sm:px-6 lg:p-7">
			{/* From `lg` the row under Explore is the trail (the family is lit there). */}
			<div className="lg:hidden">
				<Crumbs
					items={[
						{ label: kindLabel(kind), to: to(hub(kind)) },
						{
							label: FAMILY[family].many,
							to: to(familyPage(kind, family, address.country)),
						},
						{ label: lead.label },
					]}
				/>
			</div>
			<div className="flex min-w-0 items-center gap-4">
				<div className="min-w-0 flex-1">
					<Kicker className="flex items-center gap-2">
						{family === "mood" && <PlaceMark place={lead} size={14} />}
						{KICKER[family]}
					</Kicker>
					<PageTitle className="mt-1.5 text-3xl leading-[1.05] tracking-tight text-balance text-white sm:text-4xl">
						{data.title}
					</PageTitle>
				</div>
				{family === "service" && lead.logo && (
					<img
						src={poster(lead.logo, "w154")}
						alt=""
						className="size-16 shrink-0 rounded-2xl shadow-lg shadow-black/40 ring-1 ring-white/15"
					/>
				)}
				{/* Where it is: the country in amber, and its neighbors with pages are links. */}
				{family === "country" && lead.code && data.countries && (
					<div className="w-36 shrink-0 overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10 sm:w-44">
						<WorldMap
							variant="hero"
							active={lead.code}
							className="aspect-[3/2]"
							countries={data.countries.map((c) => ({
								code: c.code,
								name: c.name,
								weight: c.weight,
								href: to(place(kind, [{ family: "country", slug: c.slug }])),
							}))}
						/>
					</div>
				)}
			</div>
			{data.lede && (
				<p className="max-w-2xl text-[15px] leading-relaxed text-pretty text-gray-200">
					{data.lede}
				</p>
			)}
			{data.more.length > 0 && family !== "service" && (
				<TraitSentence
					more={data.more}
					less={data.less}
					noun={kindNoun(kind)}
					className="max-w-2xl !text-base !leading-relaxed"
				/>
			)}
		</div>
	)
}

function SplitLead({ address, data, to }: Props & { data: Of<"place"> }) {
	const blend = data.blend
	const two = data.parts.length === 2
	return (
		<div className="flex h-full min-w-0 flex-col justify-center gap-3 px-4 pt-6 pb-5 sm:px-6 lg:p-7">
			<Kicker className="flex items-center gap-2">
				<ViewColumnsIcon aria-hidden className="size-4" />
				Split screen
			</Kicker>
			<PageTitle className="text-3xl leading-[1.05] tracking-tight text-balance text-white sm:text-4xl">
				{data.title}
			</PageTitle>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				{data.parts.map((p) => (
					<Plate key={`${p.family}:${p.slug}`} place={p} leave={to(remove(address, p))} />
				))}
			</div>
			{blend && blend.traits.length > 0 && (
				<p className="max-w-2xl text-base leading-relaxed text-gray-300">
					Together they turn{" "}
					{blend.traits.map((t, i) => (
						<span key={t.key}>
							{i > 0 && (i === blend.traits.length - 1 ? " and " : ", ")}
							<TraitWord trait={t} noun={kindNoun(address.kind)} />
						</span>
					))}
					.
				</p>
			)}
			{two && blend?.venn && (
				<div className="max-lg:max-w-[20rem] lg:-mt-1 lg:max-w-[17rem]">
					<VennSwitch
						a={data.parts[0]}
						b={data.parts[1]}
						value={address.venn ?? "both"}
						counts={blend.venn}
						to={(v) => to({ ...address, venn: v, page: undefined })}
					/>
				</div>
			)}
		</div>
	)
}

function PlacePage(props: Props & { data: Of<"place"> }) {
	const { address, data, to, viewer } = props
	const kind = address.kind
	const lead = data.parts[0]
	const single = data.parts.length === 1
	const moods = data.parts.filter((p) => p.family === "mood" && p.hue)
	// A mood's hue washes the channel's half of the screen; a split of two moods shows both, side by side.
	const leadStyle: CSSProperties | undefined =
		moods.length >= 2
			? {
					background: `linear-gradient(90deg, ${wash(
						moods[0].hue as string,
						28,
					)} 0%, ${wash(moods[0].hue as string, 22)} 49.8%, ${wash(
						moods[1].hue as string,
						22,
					)} 50.2%, ${wash(moods[1].hue as string, 28)} 100%)`,
				}
			: moods.length === 1
				? {
						background: `radial-gradient(130% 120% at 0% 0%, ${wash(
							moods[0].hue as string,
							34,
						)} 0%, ${wash(moods[0].hue as string, 9)} 70%)`,
					}
				: undefined
	const all = `All ${lower(data.title)}`
	const placeTo = (p: PlaceRef) => to(place(kind, [p], address.country))
	const intro =
		single && lead.family === "decade" && data.decades ? (
			<div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-8">
				<EraLine decades={data.decades} here={lead.slug} to={placeTo} />
				{data.era && (
					<EraShifts
						label={data.era.label}
						rose={data.era.rose}
						fell={data.era.fell}
						to={placeTo}
					/>
				)}
			</div>
		) : single && lead.family === "service" && data.profile?.loaded ? (
			<p className="mb-4 max-w-4xl text-base leading-relaxed text-pretty text-gray-300">
				{data.profile.goodAt.length > 0 && (
					<>
						Strong on{" "}
						{data.profile.goodAt.map((g, i) => (
							<span key={`${g.place.family}:${g.place.slug}`}>
								{i > 0 && (i === data.profile!.goodAt.length - 1 ? " and " : ", ")}
								<Link
									to={to(place(kind, [lead, g.place], address.country))}
									prefetch="intent"
									title={`${g.times}× the usual share`}
									className="inline-flex items-baseline gap-1.5 font-semibold text-white underline decoration-white/25 decoration-dotted underline-offset-4 outline-none hover:decoration-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									{g.place.family === "mood" && <PlaceMark place={g.place} size={13} />}
									{g.place.label.toLowerCase()}
								</Link>
							</span>
						))}
						.{" "}
					</>
				)}
				{data.profile.thinOn.length > 0 && (
					<>Thin on {data.profile.thinOn.map((g) => g.place.label.toLowerCase()).join(" and ")}. </>
				)}
				<Link
					to={`/new/${address.country}/${lead.slug}`}
					className="font-semibold whitespace-nowrap text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					What's new on {lead.label} ›
				</Link>
			</p>
		) : undefined
	return (
		<>
			{data.waiting ? (
				<div className={WRAP}>
					<ChannelLead {...props} />
					<p className="py-10 text-gray-300">
						The streaming catalogs are still loading. Give it a minute, then reload.
					</p>
				</div>
			) : (
				<Guide
					channels={data.channels}
					to={to}
					screen={nowShowing()}
					lead={single ? <ChannelLead {...props} /> : <SplitLead {...props} />}
					leadClassName="lg:rounded-l-2xl lg:bg-white/[0.035]"
					leadStyle={leadStyle}
					intro={intro}
				/>
			)}
			<div className={`${WRAP} mt-12 space-y-12`}>
				{single && data.blend && data.blend.suggestions.length > 0 && (
					<section id="split" className="scroll-mt-40 space-y-4">
						<div>
							<SectionHeading className="flex items-center gap-2.5">
								<ViewColumnsIcon aria-hidden className="size-5 text-gray-400" />
								Split the screen
							</SectionHeading>
							<p className="mt-1 text-sm text-gray-400">
								Put a second channel next to {lower(withArticle(lead.label))} and see what they
								share.
							</p>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
							{data.blend.suggestions.map((s) => (
								<PlaceCard
									key={`${s.place.family}:${s.place.slug}`}
									place={s.place}
									to={to(place(kind, [lead, s.place], address.country))}
									titles={s.titles}
									line={`${lead.label} + ${s.place.label}`}
								/>
							))}
						</div>
					</section>
				)}
				{data.people.length > 0 && (
					<section className="space-y-4">
						<SectionHeading>{headings.people}</SectionHeading>
						<PeopleStrip people={data.people} />
					</section>
				)}
				{data.awards.length > 0 && (
					<section className="space-y-4">
						<SectionHeading>{headings.awards}</SectionHeading>
						<AwardStrip wins={data.awards} />
					</section>
				)}
				<section id="all" className="scroll-mt-40 space-y-5">
					<SectionHeading>{all}</SectionHeading>
					<ListControls
						address={address}
						to={to}
						viewer={viewer}
						discoverHref={data.list.discoverHref}
					/>
					<TitleGrid titles={data.list.titles} eager={false} />
					<Pager
						page={data.list.page}
						pages={data.list.pages}
						to={(n) => `${to({ ...address, page: n })}#all`}
					/>
				</section>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Best: the ranking, with every source's own score, inside any channel or year.

function BestPage({ address, data, to }: Props & { data: Of<"best"> }) {
	const kind = address.kind
	const picked = (family: Family) => data.filters.find((f) => f.family === family) ?? null
	const menu = (label: string, family: Family, options: PlaceRef[]) => {
		const on = picked(family)
		const rest = address.parts.filter((p) => p.family !== family)
		return (
			<PickMenu
				label={label}
				value={on?.label ?? null}
				picks={[
					{
						key: "any",
						label: `Any ${label.toLowerCase()}`,
						to: to(best(kind, rest, address.year)),
						on: !on,
					},
					...options.map((o) => ({
						key: o.slug,
						label: (
							<>
								<PlaceMark place={o} size={14} />
								{o.label}
							</>
						),
						to: to(best(kind, [...rest, o], address.year)),
						on: on?.slug === o.slug,
					})),
				]}
			/>
		)
	}
	const filtered = address.parts.length > 0 || !!address.year
	const lead = (
		<div className="flex h-full min-w-0 flex-col justify-center gap-3 px-4 pt-6 pb-5 sm:px-6 lg:p-7">
			<div className="lg:hidden">
				<Crumbs items={[{ label: kindLabel(kind), to: to(hub(kind)) }, { label: "Best" }]} />
			</div>
			<div>
				<Kicker>Best</Kicker>
				<PageTitle className="mt-1.5 text-3xl leading-[1.05] tracking-tight text-balance text-white sm:text-4xl">
					{data.title}
				</PageTitle>
			</div>
			<p className="max-w-2xl text-[15px] leading-relaxed text-pretty text-gray-200">
				{data.lede ??
					"One ranking from every score that counts, so a title has to win over critics and audiences alike to climb."}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{menu("Mood", "mood", data.moods)}
				{menu("Genre", "genre", data.genres)}
				{menu("Decade", "decade", data.decades)}
				<PickMenu
					label="Year"
					value={address.year ? String(address.year) : null}
					picks={[
						{
							key: "any",
							label: "Any year",
							to: to(best(kind, address.parts)),
							on: !address.year,
						},
						...data.years.map((y) => ({
							key: String(y),
							label: String(y),
							to: to(best(kind, address.parts, y)),
							on: address.year === y,
						})),
					]}
				/>
				{filtered && (
					<Link
						to={to(best(kind))}
						className="px-2 text-sm font-semibold text-gray-400 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</Link>
				)}
			</div>
		</div>
	)
	if (!data.best.rows.length)
		return (
			<div className={WRAP}>
				{lead}
				<p className="py-10 text-gray-300">Nothing ranks here yet. Loosen one of the choices.</p>
			</div>
		)
	return (
		<>
			<Guide
				channels={[data.top]}
				to={to}
				lead={lead}
				leadClassName="lg:rounded-l-2xl lg:bg-white/[0.035]"
				screen={({ cell }) => ({
					corner: <Corner>No. {cell.rank}</Corner>,
				})}
			/>
			<section className={`${WRAP} mt-12 space-y-4`}>
				<SectionHeading>The full ranking</SectionHeading>
				<BestTable rows={data.best.rows} />
			</section>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------

function Page(props: Props) {
	const { data } = props
	if (data.view === "hub") return <Hub {...props} data={data} />
	if (data.view === "family") return <FamilyPage {...props} data={data} />
	if (data.view === "best") return <BestPage {...props} data={data} />
	return <PlacePage {...props} data={data} />
}

export const concept: ConceptModule<GuideData> = {
	id: "guide",
	name: "Guide",
	tagline:
		"A screen over rows of channels. Point at a title and the screen shows it; open a channel and it tunes to that place.",
	order: 4,
	Page,
	chrome: ({ concept: id, address }) => {
		const kind = address.kind
		const at: Family | "lineup" | null =
			address.view === "hub"
				? "lineup"
				: address.view === "family"
					? (address.family ?? null)
					: address.view === "place"
						? (address.parts[0]?.family ?? null)
						: null
		const link = (a: Address) => href(id, a)
		return {
			tabs: exploreTabs(id, address, { bestTab: true }),
			pinned: {
				label: "Channels",
				items: [
					{
						key: "movie",
						label: "Movies",
						href: link(kind === "movie" ? address : otherKind(address)),
						here: false,
					},
					{
						key: "show",
						label: "Shows",
						href: link(kind === "show" ? address : otherKind(address)),
						here: false,
					},
					{
						key: "lineup",
						label: "Tonight",
						href: link(hub(kind)),
						here: at === "lineup",
						sep: true,
					},
					...GROUPS.map((g) => ({
						key: g.family,
						label: g.label,
						href: link(familyPage(kind, g.family, address.country)),
						here: at === g.family,
					})),
				],
			},
		}
	},
	notes: ({ data }) => [
		{
			term: "The screen",
			means:
				"The title in focus, large: its picture, one sentence of GoodWatch's title analysis, the GoodWatch score beside each source's own score, and where it streams. It follows the card you point at, tab to, or swipe to.",
			isNew: true,
		},
		{
			term: "A row",
			means:
				"A channel: one place (a mood, a genre, an era, a country, a service, Best) and real poster cards of titles that show what it is. No title appears on two rows of a page.",
			isNew: true,
		},
		{
			term: "The row's label",
			means:
				"The channel's name opens its own page. A mood's label carries the mood's hue, a service its logo, a country its code; an era is set in the display face.",
			isNew: true,
		},
		{
			term: "White ring",
			means:
				"The card the screen is showing. White is the app's selection color; amber is never used for it.",
		},
		{
			term: "Moving",
			means:
				"Mouse: point at a card. Keyboard: Tab into a row, then left/right through its titles and up/down between channels. Touch: scroll, and the channel right under the screen is live; swipe the row and its first card is.",
		},
		...(data.view === "hub"
			? [
					{
						term: `${data.day}'s line-up`,
						means:
							"Which channels the hub shows and in what order, programmed by hand for each day of the week. Best is always first; Popular sits in the middle.",
						isNew: true,
					},
				]
			: []),
		...(data.view === "place"
			? [
					{
						term: "The left half of the screen",
						means:
							"The channel's character: hand-written lede and its traits as colored words (hover one for the value). A mood washes this half in its hue; a split of two moods shows both.",
						isNew: true,
					},
					{
						term: "Split the screen",
						means:
							"Two channels at once: only what both have. Each plate has an × to leave the split, and the two circles pick one side or the overlap.",
						isNew: true,
					},
				]
			: []),
		{
			term: "Row under Explore",
			means:
				"Movies | Shows, then the groups of channels: Tonight (the line-up), Moods, Genres, Themes, Styles, Eras, Countries, Streaming. Best has its own Explore tab and is also the first channel.",
		},
	],
}

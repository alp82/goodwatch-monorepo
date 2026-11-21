// PROTOTYPE - throwaway (prototype/explore-r4, concept rooms). The hub (a front page with one module per family, each
// in that family's own format) and the rooms themselves: Moods, Genres, Eras, Places, Streaming.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useContext, useState } from "react"
import { Caption } from "~/ui/eyebrow"
import { Segmented } from "~/ui/selection/Segmented"
import {
	type Address,
	type Family,
	type Kind,
	best,
	familyPage,
	ing,
	kindLabel,
	kindNoun,
	place,
} from "../../kit/address"
import { headings } from "../../kit/copy"
import type { PlaceRef, ShowTitle } from "../../kit/types"
import {
	BestTable,
	PANEL,
	PLACE_GRID,
	PlaceCard,
	PlaceCardSlot,
	PlaceLede,
	PlaceMark,
	PosterRail,
	PosterTrio,
	Reveal,
	Thumb,
	WRAP,
} from "../../kit/ui"
import { WorldMap } from "../../kit/world-map/WorldMap"
import type {
	BestPreset,
	CardPlace,
	CountryCard,
	EraCard,
	GenreRow,
	RoomsData,
	ServiceCard,
} from "./loader.server"
import {
	CardRail,
	EraColumn,
	EraTimeline,
	KindLinks,
	ModuleHead,
	MoreLink,
	ServiceCardView,
	lower,
} from "./parts"

type To = (a: Address, extra?: Record<string, string | undefined>) => string
type Of<V extends RoomsData["view"]> = Extract<RoomsData, { view: V }>

const RING = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
/** On a phone one sideways strip of cards (a module stays one screen tall); from `sm` a grid. Add the columns. */
const STRIP =
	"-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] *:w-[84%] *:shrink-0 *:snap-start sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:*:w-auto"

const placeTo = (to: To, kind: Kind, p: PlaceRef, country = "us") =>
	to(place(kind, [ing(p.family, p.slug)], country))
const kindTo = (to: To, kind: Kind, p: PlaceRef) => (id: string) =>
	`${to({ ...place(kind, [ing(p.family, p.slug)]), kind_: id })}#all`

// ---------------------------------------------------------------------------------------------------------
// Moods: cards. A mood's hue lives in its card's header; three posters say what it feels like.

function MoodCards({ moods, to, kind }: { moods: CardPlace[]; to: To; kind: Kind }) {
	return (
		<>
			<div className={`max-sm:hidden ${PLACE_GRID}`}>
				{moods.map((m) => (
					<PlaceCard
						key={m.place.slug}
						place={m.place}
						to={placeTo(to, kind, m.place)}
						titles={m.titles}
						line={m.line}
						words={m.words}
					/>
				))}
			</div>
			{/* A phone gets the same sixteen as short rows, so the whole family fits a few thumb-lengths. */}
			<ul className="divide-y divide-white/[0.07] sm:hidden">
				{moods.map((m) => (
					<li key={m.place.slug}>
						<Link
							to={placeTo(to, kind, m.place)}
							prefetch="intent"
							className={`group flex items-center gap-3 py-3 ${RING}`}
						>
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-2">
									<PlaceMark place={m.place} size={16} />
									<span className="font-display text-lg font-bold tracking-tight text-white">
										{m.place.label}
									</span>
								</span>
								{m.line && (
									<span className="mt-0.5 block text-sm leading-snug text-gray-400">{m.line}</span>
								)}
							</span>
							<PosterTrio titles={m.titles} className="w-[7.5rem] shrink-0" />
						</Link>
					</li>
				))}
			</ul>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Genres: rows. A genre is a shelf you already know, so each row opens it up into its kinds.

export function GenreBlock({
	row,
	to,
	kind,
	rail,
}: {
	row: GenreRow
	to: To
	kind: Kind
	/** The full row with a rail of real poster cards; otherwise the short panel with four small posters. */
	rail: boolean
}) {
	const href = placeTo(to, kind, row.place)
	const Over = useContext(PlaceCardSlot)
	// Round 5: the short panel is a card, so the lab's picked card variant takes it over.
	if (Over && !rail)
		return (
			<Over
				place={row.place}
				href={href}
				copy={row.line ? { short: row.line, lede: "" } : null}
				titles={row.titles}
				traits={row.words ?? []}
				kinds={row.kinds.map((k) => ({ id: k.id, name: k.name }))}
				kindHref={kindTo(to, kind, row.place)}
				size="m"
			/>
		)
	const head = <GenreHead place={row.place} line={row.line} href={href} />
	if (rail)
		return (
			<div className="grid items-start gap-x-8 gap-y-4 py-7 lg:grid-cols-[17rem_minmax(0,1fr)]">
				<div className="min-w-0">
					{head}
					<KindLinks
						kinds={row.kinds}
						to={kindTo(to, kind, row.place)}
						className="mt-3 max-lg:grid-cols-2"
					/>
				</div>
				<PosterRail id={`genre-${row.place.slug}`} titles={row.titles} wide />
			</div>
		)
	return (
		<GenrePanelPlain
			place={row.place}
			line={row.line}
			kinds={row.kinds}
			titles={row.titles}
			href={href}
			kindHref={kindTo(to, kind, row.place)}
		/>
	)
}

function GenreHead({ place: p, line, href }: { place: PlaceRef; line?: string; href: string }) {
	return (
		<>
			<Link
				to={href}
				prefetch="intent"
				className={`group inline-flex items-baseline gap-1.5 rounded-sm ${RING}`}
			>
				<span className="font-display text-2xl font-bold tracking-tight text-white transition-colors group-hover:text-amber-200">
					{p.label}
				</span>
				<span
					aria-hidden
					className="text-lg text-amber-300 transition-transform duration-200 group-hover:translate-x-0.5"
				>
					›
				</span>
			</Link>
			{line && <p className="mt-1 text-[15px] leading-snug text-gray-400">{line}</p>}
		</>
	)
}

/** A genre as a short panel: its name, its kinds as links, five small posters. The round 4 genre card. */
export function GenrePanelPlain({
	place: p,
	line,
	kinds,
	titles,
	href,
	kindHref,
}: {
	place: PlaceRef
	line?: string
	kinds: { id: string; name: string }[]
	titles: ShowTitle[]
	href: string
	kindHref: (id: string) => string
}) {
	return (
		<div className={`${PANEL} flex flex-col p-5`}>
			<GenreHead place={p} line={line} href={href} />
			<KindLinks
				kinds={kinds.map((k) => ({ ...k, titles: [] }))}
				to={kindHref}
				className="mt-3 grid-cols-1 min-[420px]:grid-cols-2"
			/>
			<div className="mt-4 flex gap-2">
				{titles.slice(0, 5).map((t) => (
					<Thumb key={t.card.key} title={t} className="min-w-0 flex-1" />
				))}
			</div>
		</div>
	)
}

function WordList({
	title,
	line,
	items,
	to,
	kind,
}: {
	title: string
	line: string
	items: { place: PlaceRef; line?: string }[]
	to: To
	kind: Kind
}) {
	return (
		<section className="min-w-0">
			<ModuleHead title={title} line={line} />
			<ul className="mt-4 grid gap-x-6 sm:grid-cols-2">
				{items.map((it) => (
					<li key={it.place.slug} className="border-t border-white/[0.07]">
						<Link
							to={placeTo(to, kind, it.place)}
							prefetch="intent"
							className={`group flex items-start gap-3 py-3 ${RING}`}
						>
							<span className="mt-1.5">
								<PlaceMark place={it.place} size={18} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-white transition-colors group-hover:text-amber-200">
									{it.place.label}
								</span>
								{it.line && (
									<span className="block text-sm leading-snug text-gray-400">{it.line}</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Places: the world map. Geography is the format; a country under the pointer says what it is known for.

const REGIONS: { name: string; codes: string[] }[] = [
	{
		name: "Europe",
		codes: ["GB", "FR", "DE", "IT", "ES", "SE", "DK", "NO", "IE", "BE", "NL", "PL", "RU", "TR"],
	},
	{ name: "Asia & Pacific", codes: ["JP", "KR", "CN", "HK", "IN", "AU", "NZ", "TW", "TH", "IR"] },
	{ name: "Americas", codes: ["US", "CA", "MX", "BR", "AR"] },
]

function PlacesMap({ countries, to, kind }: { countries: CountryCard[]; to: To; kind: Kind }) {
	const withText = countries.filter((c) => c.titles.length > 0)
	const [code, setCode] = useState<string | null>(null)
	// The last country pointed at stays, so the pointer can travel to its preview.
	const shown =
		countries.find((c) => c.place.code === code && c.titles.length > 0) ??
		withText.find((c) => c.place.code === "JP") ??
		withText[0]
	const listed = new Set(REGIONS.flatMap((r) => r.codes))
	const regions = [
		...REGIONS,
		{
			name: "Elsewhere",
			codes: countries.map((c) => c.place.code ?? "").filter((c) => c && !listed.has(c)),
		},
	]
		.map((r) => ({
			name: r.name,
			items: countries
				.filter((c) => r.codes.includes(c.place.code ?? ""))
				.sort((a, b) => a.place.label.localeCompare(b.place.label)),
		}))
		.filter((r) => r.items.length > 0)
	return (
		<div className="space-y-8">
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<WorldMap
					variant="page"
					list={false}
					countries={countries.map((c) => ({
						code: c.place.code ?? "",
						name: c.place.label,
						href: placeTo(to, kind, c.place),
						weight: c.weight,
					}))}
					onHotChange={(hot) => hot && setCode(hot)}
				/>
				{/* What the country under the pointer is known for. The last one pointed at stays. */}
				{shown && (
					<div
						className={`${PANEL} overflow-hidden max-lg:hidden lg:mt-[3.25rem]`}
						aria-live="polite"
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={shown.place.slug}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
							>
								<Link
									to={placeTo(to, kind, shown.place)}
									prefetch="intent"
									className={`group block p-5 ${RING} focus-visible:ring-inset`}
								>
									<span className="flex items-center gap-2.5">
										<PlaceMark place={shown.place} size={18} />
										<span className="min-w-0 flex-1 font-display text-2xl leading-tight font-bold tracking-tight text-white transition-colors group-hover:text-amber-200">
											{shown.place.label}
										</span>
										<span
											aria-hidden
											className="text-lg text-amber-300 transition-transform duration-200 group-hover:translate-x-0.5"
										>
											›
										</span>
									</span>
									{(shown.lede ?? shown.line) && (
										<span className="mt-2.5 block text-[15px] leading-relaxed text-gray-300 lg:min-h-[9.75rem]">
											{shown.lede ?? shown.line}
										</span>
									)}
									<PosterTrio titles={shown.titles} className="mt-4" />
								</Link>
							</motion.div>
						</AnimatePresence>
					</div>
				)}
			</div>
			<nav aria-label="Countries" className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
				{regions.map((r) => (
					<div key={r.name}>
						<Caption as="h2">{r.name}</Caption>
						<ul className="mt-2 columns-2 gap-x-6">
							{r.items.map((c) => (
								<li key={c.place.slug} className="break-inside-avoid">
									<Link
										to={placeTo(to, kind, c.place)}
										prefetch="intent"
										onPointerEnter={() => setCode(c.place.code ?? null)}
										onFocus={() => setCode(c.place.code ?? null)}
										className={`block rounded-sm py-1 text-[15px] font-semibold text-gray-200 transition-colors hover:text-amber-200 ${RING}`}
									>
										{c.place.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				))}
			</nav>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Streaming: logo cards, and a clear hand-off to New (what arrived this week lives there, not here).

export function NewHandOff({ country }: { country: string }) {
	return (
		<Link
			to={`/new/${country}`}
			prefetch="intent"
			className={`group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/[0.04] px-5 py-3.5 ring-1 ring-white/10 transition-colors hover:ring-white/25 ${RING}`}
		>
			<span className="font-semibold text-white">Looking for what just arrived?</span>
			<span className="text-[15px] text-gray-400">
				New lists this week's arrivals for every service. These pages are the whole library.
			</span>
			<span className="ml-auto flex items-center gap-1 text-sm font-bold text-amber-300">
				Open New
				<span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
					›
				</span>
			</span>
		</Link>
	)
}

function ServiceGrid({
	services,
	to,
	kind,
	country,
	strip = false,
}: {
	services: ServiceCard[]
	to: To
	kind: Kind
	country: string
	/** One sideways strip on a phone (the hub's module). */
	strip?: boolean
}) {
	return (
		<div
			className={
				strip
					? `${STRIP} sm:grid-cols-2 lg:grid-cols-3`
					: "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
			}
		>
			{services.map((s) => (
				<ServiceCardView
					key={s.place.slug}
					place={s.place}
					to={placeTo(to, kind, s.place, country)}
					line={s.line}
					goodAt={s.goodAt}
					titles={s.titles}
					words={s.words}
				/>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Best on the hub: the top five with every source's score, and a small switch of eras.

export function BestModule({ presets, to, kind }: { presets: BestPreset[]; to: To; kind: Kind }) {
	const [key, setKey] = useState(presets[0]?.key ?? "all")
	const [switched, setSwitched] = useState(false)
	const chosen = presets.find((p) => p.key === key) ?? presets[0]
	if (!chosen) return null
	return (
		<section className="space-y-4">
			<ModuleHead
				title={headings.best}
				to={to(best(kind))}
				line={`Ranked by one score built from every source. Each source's own score sits beside it.`}
				aside={
					<Segmented<string>
						label="Best of when"
						size="sm"
						value={chosen.key}
						onChange={(k) => {
							setSwitched(true)
							setKey(k)
						}}
						options={presets.map((p) => ({ key: p.key, label: p.label }))}
					/>
				}
			/>
			{/* The server's HTML shows the rows; only a switch of era fades the new five in. */}
			<motion.div
				key={chosen.key}
				initial={switched ? { opacity: 0, y: 6 } : false}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
			>
				<BestTable rows={chosen.rows} />
			</motion.div>
			<MoreLink to={to(best(kind, chosen.parts, chosen.year))}>
				{chosen.key === "all"
					? "The full ranking"
					: `The best ${kindNoun(kind)} of ${chosen.year ?? `the ${chosen.label}`}, in full`}
			</MoreLink>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The pages

export function Hub({ data, to, kind }: { data: Of<"hub">; to: To; kind: Kind }) {
	const room = (f: Family) => to(familyPage(kind, f))
	return (
		<>
			<PlaceLede kicker="Browse" title={kindLabel(kind)} lede={data.copy?.lede} />
			<div className={`${WRAP} space-y-16`}>
				<CardRail
					label="moods"
					head={(arrows) => (
						<ModuleHead
							title={headings.moods}
							to={room("mood")}
							line="Start from how you want the evening to feel."
							aside={arrows}
						/>
					)}
				>
					{data.moods.map((m) => (
						<PlaceCard
							key={m.place.slug}
							place={m.place}
							to={placeTo(to, kind, m.place)}
							titles={m.titles}
							line={m.line}
							words={m.words}
						/>
					))}
				</CardRail>

				<PosterRail
					id="popular"
					title={headings.popular}
					line={`What people are watching this week, whatever the mood.`}
					titles={data.popular}
					eager
				/>

				<BestModule presets={data.best} to={to} kind={kind} />

				<Reveal as="section" className="space-y-5">
					<ModuleHead
						title={headings.genres}
						to={room("genre")}
						line="The shelves you know, each opened up into its kinds."
					/>
					<div className={`${STRIP} lg:grid-cols-2`}>
						{data.genres.map((g) => (
							<GenreBlock key={g.place.slug} row={g} to={to} kind={kind} rail={false} />
						))}
					</div>
					<p className="text-[15px] leading-relaxed text-gray-400">
						<span className="text-gray-500">Also </span>
						{data.moreGenres.map((g, i) => (
							<span key={g.slug}>
								{i > 0 && <span className="text-gray-600">, </span>}
								<Link
									to={placeTo(to, kind, g)}
									prefetch="intent"
									className={`rounded-sm font-semibold text-gray-200 transition-colors hover:text-amber-200 ${RING}`}
								>
									{lower(g.label)}
								</Link>
							</span>
						))}
						<span className="text-gray-600">. </span>
					</p>
				</Reveal>

				<Reveal as="section" className="space-y-5">
					<ModuleHead
						title={headings.decades}
						to={room("decade")}
						line="Every decade had its own obsessions. Walk back through them."
					/>
					<EraTimeline eras={data.eras} to={(p) => placeTo(to, kind, p)} phone="row" />
				</Reveal>

				<Reveal as="section" className="space-y-5">
					<ModuleHead
						title={headings.countries}
						to={room("country")}
						line="Every country tells stories its own way. Pick one on the map."
					/>
					{/* The map across the full width; the countries to start with sit under it. */}
					<div className="space-y-5">
						<WorldMap
							variant="page"
							list={false}
							countries={data.countries.map((c) => ({
								code: c.place.code ?? "",
								name: c.place.label,
								href: placeTo(to, kind, c.place),
								weight: c.weight,
							}))}
						/>
						<div className={`${STRIP} sm:grid-cols-2 lg:grid-cols-4`}>
							{data.countries
								.filter((c) => c.titles.length > 0)
								.slice(0, 4)
								.map((c) => (
									<PlaceCard
										key={c.place.slug}
										place={c.place}
										to={placeTo(to, kind, c.place)}
										titles={c.titles}
										line={c.line}
										lede={c.lede}
										words={c.words}
										more={{ weight: c.weight }}
									/>
								))}
						</div>
					</div>
				</Reveal>

				<Reveal as="section" className="space-y-5">
					<ModuleHead
						title={headings.services}
						to={to(familyPage(kind, "service"))}
						line="See what's good where you already subscribe."
					/>
					{data.streamingReady ? (
						<ServiceGrid services={data.services} to={to} kind={kind} country="us" strip />
					) : (
						<p className="text-gray-400">
							The streaming catalogs are still loading. Try again in a moment.
						</p>
					)}
					<NewHandOff country="us" />
				</Reveal>
			</div>
		</>
	)
}

export function MoodsRoom({ data, to, kind }: { data: Of<"moods">; to: To; kind: Kind }) {
	return (
		<>
			<PlaceLede
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} by mood`}
				lede={data.copy?.lede}
			/>
			<div className={WRAP}>
				<MoodCards moods={data.moods} to={to} kind={kind} />
			</div>
		</>
	)
}

export function GenresRoom({ data, to, kind }: { data: Of<"genres">; to: To; kind: Kind }) {
	const lead = data.rows.slice(0, 8)
	const rest = data.rows.slice(8)
	return (
		<>
			<PlaceLede
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} by genre`}
				lede={data.copy?.lede}
			/>
			<div className={`${WRAP} space-y-14`}>
				<div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
					{lead.map((row) => (
						<GenreBlock key={row.place.slug} row={row} to={to} kind={kind} rail />
					))}
				</div>
				{rest.length > 0 && (
					<section className="space-y-5">
						<ModuleHead title="More genres" />
						<div className="grid gap-4 lg:grid-cols-2">
							{rest.map((row) => (
								<GenreBlock key={row.place.slug} row={row} to={to} kind={kind} rail={false} />
							))}
						</div>
					</section>
				)}
				<div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
					<WordList
						title={headings.themes}
						line="What the story is about, whatever shelf it sits on."
						items={data.themes}
						to={to}
						kind={kind}
					/>
					<WordList
						title={headings.styles}
						line="How the story is told."
						items={data.styles}
						to={to}
						kind={kind}
					/>
				</div>
			</div>
		</>
	)
}

export function ErasRoom({ data, to, kind }: { data: Of<"eras">; to: To; kind: Kind }) {
	return (
		<>
			<PlaceLede
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} by decade`}
				lede={data.copy?.lede}
			/>
			<div className={WRAP}>
				<EraColumn eras={data.eras as EraCard[]} to={(p) => placeTo(to, kind, p)} />
			</div>
		</>
	)
}

export function PlacesRoom({ data, to, kind }: { data: Of<"places">; to: To; kind: Kind }) {
	return (
		<>
			<PlaceLede
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} by country`}
				lede={data.copy?.lede}
			/>
			<div className={`${WRAP} space-y-14`}>
				<PlacesMap countries={data.countries} to={to} kind={kind} />
				<section className="space-y-5">
					<ModuleHead title="Good places to start" />
					<div className={PLACE_GRID}>
						{data.countries.slice(0, 8).map((c) => (
							<PlaceCard
								key={c.place.slug}
								place={c.place}
								to={placeTo(to, kind, c.place)}
								titles={c.titles}
								line={c.line}
								lede={c.lede}
								words={c.words}
								more={{ weight: c.weight }}
							/>
						))}
					</div>
				</section>
			</div>
		</>
	)
}

export function StreamingRoom({ data, to, kind }: { data: Of<"streaming">; to: To; kind: Kind }) {
	return (
		<>
			<PlaceLede
				kicker={`${kindLabel(kind)} · streaming in the United States`}
				title={`${kindLabel(kind)} by streaming service`}
				lede={data.copy?.lede}
			/>
			<div className={`${WRAP} space-y-6`}>
				<NewHandOff country={data.country} />
				{data.ready ? (
					<ServiceGrid services={data.services} to={to} kind={kind} country={data.country} />
				) : (
					<p className="text-gray-400">
						The streaming catalogs are still loading. Try again in a moment.
					</p>
				)}
			</div>
		</>
	)
}

export function CardsRoom({ data, to, kind }: { data: Of<"cards">; to: To; kind: Kind }) {
	return (
		<>
			<PlaceLede
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} ${data.family === "theme" ? "by subject" : "by style"}`}
				lede={data.copy?.lede}
			/>
			<div className={`${WRAP} ${PLACE_GRID}`}>
				{data.cards.map((c) => (
					<PlaceCard
						key={c.place.slug}
						place={c.place}
						to={placeTo(to, kind, c.place)}
						titles={c.titles}
						line={c.line}
						words={c.words}
					/>
				))}
			</div>
		</>
	)
}

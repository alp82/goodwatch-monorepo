// PROTOTYPE - throwaway (prototype/explore-r4). The kit gallery: every shared component once, on real data, with the
// import a concept builder needs. Address: /prototype/explore/_kit
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { Caption } from "~/ui/eyebrow"
import { SectionHeading } from "~/ui/heading"
import { type Address, PREFIX, best, familyPage, href, hub, ing, place } from "../kit/address"
import { WorldMap, copyFor } from "../kit/optional"
import { CountryShape } from "../kit/world-map/CountryShape"
import type { Viewer } from "../kit/types"
import {
	AwardStrip,
	BestTable,
	BigStats,
	Crumbs,
	IntensityScale,
	ListControls,
	PLACE_GRID,
	PeopleStrip,
	PlaceCard,
	PlaceLede,
	PlaceMark,
	PosterRail,
	Reveal,
	SourceScores,
	Thumb,
	TitleGrid,
	TraitSentence,
	TraitWord,
	VennSwitch,
	WRAP,
} from "../kit/ui"
import { CardBench } from "../concepts/lab/slots/card/Bench"
import type { BenchData } from "../concepts/lab/slots/card/bench.server"
import type { GalleryData } from "./loader.server"

/** A place opens in the demo concept. */
const at = (a: Address) => href("demo", a)

function Part({
	name,
	from,
	children,
	means,
}: {
	name: string
	from: string
	means: string
	children: ReactNode
}) {
	return (
		<Reveal as="section" className="border-t border-white/10 py-10">
			<div className={WRAP}>
				<div className="mb-6 max-w-3xl">
					<SectionHeading>{name}</SectionHeading>
					<p className="mt-1 text-sm text-gray-400">{means}</p>
					<code className="mt-2 inline-block rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-gray-300">
						{from}
					</code>
				</div>
				{children}
			</div>
		</Reveal>
	)
}

export function Gallery({ d, viewer }: { d: GalleryData; viewer: Viewer }) {
	// Round 5: ?bench=cards shows the card bench instead.
	if ((d as unknown as { bench?: string }).bench === "cards")
		return <CardBench d={d as unknown as BenchData} />
	return <GalleryPage d={d} viewer={viewer} />
}

function GalleryPage({ d, viewer }: { d: GalleryData; viewer: Viewer }) {
	const cozyAddr = place("movie", [ing("mood", "cozy"), ing("genre", "comedy")])
	const galleryHref = (extra: Record<string, string | undefined>) => {
		const q = new URLSearchParams()
		if (d.venn !== "both") q.set("venn", d.venn)
		if (d.level) q.set("level", d.level)
		for (const [k, v] of Object.entries(extra)) {
			if (v === undefined) q.delete(k)
			else q.set(k, v)
		}
		const s = q.toString()
		return `${PREFIX}/_kit${s ? `?${s}` : ""}`
	}
	const cozyCopy = copyFor("movie", "mood", "cozy")
	const nearest = d.neighbors[0]
	const decade = d.bestCozy.rows[0]
	return (
		<div>
			<PlaceLede
				kicker="Kit gallery"
				title="Every shared part, on real data"
				lede="What a concept builds with. Each part below names its import and says what it means to someone choosing a thing to watch. If a part has no meaning for a viewer, it shouldn't be on a page."
				crumbs={<Crumbs items={[{ label: "Explore", to: PREFIX }, { label: "Kit" }]} />}
			/>

			<Part
				name="PlaceLede"
				from='import { PlaceLede, Crumbs } from "../../kit/ui"'
				means="A place's head: the page type, its name, a human lede from the copy deck, and its character as one sentence of trait words. A mood's hue washes the head, never a poster."
			>
				<div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
					<PlaceLede
						kicker="Mood"
						title="Cozy movies"
						hue={d.cozy.hue}
						lede={
							cozyCopy?.lede ??
							"The copy deck's lede goes here (kit/copy, built on a parallel branch): a film lover telling a friend what a cozy night in feels like."
						}
						more={d.traits.more}
						less={d.traits.less}
						noun="movies"
						crumbs={
							<Crumbs
								items={[
									{ label: "Movies", to: at(hub("movie")) },
									{ label: "Moods", to: at(familyPage("movie", "mood")) },
									{ label: "Cozy" },
								]}
							/>
						}
						aside={
							<div className="grid grid-cols-3 gap-2">
								{d.defining.map((t) => (
									<Thumb key={t.card.key} title={t} size="w342" />
								))}
							</div>
						}
					/>
				</div>
			</Part>

			<Part
				name="TraitWord and TraitSentence"
				from='import { TraitWord, TraitSentence } from "../../kit/ui"'
				means="A fingerprint trait as a word in its family's color (feel rose, humor yellow, world sky, story violet). No numbers up front: hover, focus or tap a word to see what it measures and where this place sits against the usual."
			>
				<TraitSentence more={d.traits.more} less={d.traits.less} noun="movies" />
				<p className="mt-4 max-w-2xl text-base text-gray-400">
					Inside running text a single word works too: cozy movies are{" "}
					<TraitWord trait={d.traits.more[0]} /> first, and what they leave out matters as much,
					since they are almost never <TraitWord trait={d.traits.less[0]} />.
				</p>
			</Part>

			<Part
				name="PlaceCard"
				from='import { PlaceCard, PLACE_GRID } from "../../kit/ui"'
				means="A place as ONE link: name, a short line, three distinct untinted posters. A mood's hue lives in the card's header. No poster repeats anywhere on the page (kit.showcase tracks what it handed out)."
			>
				<div className={PLACE_GRID}>
					{d.moodCards.map((m) => (
						<PlaceCard
							key={m.place.slug}
							place={m.place}
							to={at(place("movie", [m.place]))}
							titles={m.titles}
							line={copyFor("movie", "mood", m.place.slug)?.short}
						/>
					))}
				</div>
				<Caption className="mt-10 mb-3">
					Other families: neutral card, the family's own mark, trait words when there is no line
				</Caption>
				<div className={PLACE_GRID}>
					{d.genreCards.slice(0, 4).map((g) => (
						<PlaceCard
							key={g.place.slug}
							place={g.place}
							to={at(place("movie", [g.place]))}
							titles={g.titles}
							words={g.words}
							line={copyFor("movie", "genre", g.place.slug)?.short}
						/>
					))}
					{d.serviceCards.map((s) => (
						<PlaceCard
							key={s.place.slug}
							place={s.place}
							to={at(place("movie", [s.place]))}
							titles={s.titles}
							line={
								s.profile?.goodAt.length
									? `Strong on ${s.profile.goodAt
											.slice(0, 2)
											.map((g) => g.place.label.toLowerCase())
											.join(" and ")}.`
									: undefined
							}
						/>
					))}
				</div>
			</Part>

			<Part
				name="PlaceMark"
				from='import { PlaceMark } from "../../kit/ui"'
				means="The small mark that says which family a place belongs to, the same everywhere: a mood is its hue, a service its logo, a country its code, a theme or style its color bar."
			>
				<ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-base font-semibold text-white">
					{[
						d.cozy,
						...d.serviceCards.slice(0, 2).map((s) => s.place),
						...d.countries.slice(2, 4).map((c) => c.place),
						...d.blend.suggestions
							.filter((s) => s.place.family === "theme" || s.place.family === "style")
							.slice(0, 2)
							.map((s) => s.place),
					].map((p) => (
						<li key={`${p.family}:${p.slug}`} className="flex items-center gap-2">
							<PlaceMark place={p} size={18} />
							{p.label}
						</li>
					))}
				</ul>
			</Part>

			<Part
				name="PosterRail"
				from='import { PosterRail } from "../../kit/ui"'
				means="A row of the real poster cards with the title page shelves' arrows. The heading is the link to the full page. Use one Popular rail per page, placed where it helps."
			>
				<PosterRail
					id="popular"
					title="Popular now"
					line="What people are watching this week."
					to={at(cozyAddr)}
					titles={d.popular}
					eager
				/>
			</Part>

			<Part
				name="BigStats"
				from='import { BigStats } from "../../kit/ui"'
				means="Three big facts a viewer can act on, each a link: where it's nearest to, when it was at its best, where to stream it. Never a count of titles."
			>
				<BigStats
					items={[
						{
							label: "Nearest mood",
							value: nearest?.place.label ?? "Romantic",
							sub: nearest ? `The same warmth, ${nearest.differs}.` : undefined,
							hue: nearest?.place.hue,
							to: at(cozyAddr),
						},
						{
							label: "Best of the 2010s",
							value: decade?.title.card.title ?? "—",
							sub: "The best-scored cozy movie of the decade.",
							to: decade?.title.to,
						},
						{
							label: "Most at home on",
							value:
								d.serviceCards.find((s) => s.profile?.goodAt.some((g) => g.place.slug === "cozy"))
									?.place.label ?? "Disney+",
							sub: "More cozy movies than any other service in the US.",
							to: at(cozyAddr),
						},
					]}
				/>
			</Part>

			<Part
				name="BestTable and SourceScores"
				from='import { BestTable, SourceScores } from "../../kit/ui"'
				means="A ranking where every title shows each source's own score beside the GoodWatch score that sets the rank. One rank size. On a phone the sources fold under the title and open on tap."
			>
				<BestTable rows={d.best.rows} />
				<Caption className="mt-10 mb-3">SourceScores alone, for one title</Caption>
				{d.best.rows[0] && <SourceScores sources={d.best.rows[0].sources} />}
			</Part>

			<Part
				name="VennSwitch"
				from='import { VennSwitch } from "../../kit/ui"'
				means="For a blend of two: only the first, both, or only the second. Each region is a link to its list; the overlap is drawn to the real share of titles the two have in common."
			>
				<div className="grid items-center gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
					{d.blend.venn && (
						<VennSwitch
							a={d.cozy}
							b={d.comedy}
							value={d.venn}
							counts={d.blend.venn}
							to={(v) => galleryHref({ venn: v === "both" ? undefined : v, level: undefined })}
						/>
					)}
					<div className="min-w-0">
						<p className="mb-3 text-lg font-semibold text-white">
							{d.venn === "both"
								? d.names.pair
								: d.venn === "a"
									? "Cozy, but not a comedy"
									: "Comedies that aren't cozy"}
						</p>
						<TitleGrid titles={d.list.titles.slice(0, 6)} eager={false} />
					</div>
				</div>
			</Part>

			<Part
				name="IntensityScale"
				from='import { IntensityScale } from "../../kit/ui"'
				means="How much of it: a touch, plenty, all the way. Not always the 10's. The mark fills by one, two or three steps in the trait's color. Each stop is a link to that band's list."
			>
				{d.intensity && (
					<>
						<div className="flex flex-wrap items-center gap-4">
							<span className="text-base font-semibold text-white">
								How <TraitWord trait={d.intensity.trait} />?
							</span>
							<IntensityScale
								intensity={d.intensity}
								value={d.level ?? undefined}
								to={(level) => galleryHref({ level, venn: undefined })}
							/>
						</div>
						<div className="mt-6 space-y-8">
							{d.intensity.bands
								.filter((b) => !d.level || b.level === d.level)
								.map((b) => (
									<PosterRail
										key={b.level}
										id={`band-${b.level}`}
										title={b.name}
										line={b.blurb}
										titles={b.titles}
									/>
								))}
						</div>
					</>
				)}
			</Part>

			<Part
				name="ListControls, TitleGrid and Pager"
				from='import { ListControls, TitleGrid, Pager } from "../../kit/ui"'
				means="A place's full list with the real controls from Discover and Watch next: the sort menu, On my services | Everywhere, Not seen yet. Each state is an address; More filters opens Discover with the same filters."
			>
				<ListControls
					address={{ ...cozyAddr, sort: d.list.sort }}
					to={(a) =>
						galleryHref({
							sort: a.sort,
							mine: a.mine ? "1" : undefined,
							unseen: a.unseen ? "1" : undefined,
						})
					}
					viewer={viewer}
					discoverHref={d.list.discoverHref}
				/>
				<div className="mt-5">
					<TitleGrid titles={d.list.titles} eager={false} />
				</div>
			</Part>

			<Part
				name="PeopleStrip and AwardStrip"
				from='import { PeopleStrip, AwardStrip } from "../../kit/ui"'
				means="The people and the award winners of a place, as hand-offs to the real /person and /awards pages. kit.people(parts) and kit.awards(parts) read them."
			>
				<Caption className="mb-4">Who makes comedies</Caption>
				<PeopleStrip people={d.people} />
				<Caption className="mt-10 mb-3">Dramas that won</Caption>
				<AwardStrip wins={d.awards} />
			</Part>

			{WorldMap && (
				<Part
					name="WorldMap"
					from='import { WorldMap } from "../../kit/optional"'
					means="Where titles come from: real geography, one link per country."
				>
					<WorldMap
						countries={d.countries.map((c) => ({
							code: c.place.code ?? "",
							name: c.place.label,
							href: at(cozyAddr),
							weight: c.n / Math.max(...d.countries.map((x) => x.n)),
						}))}
					/>
				</Part>
			)}

			<Part
				name="CountryShape"
				from='import { CountryShape } from "../../kit/world-map/CountryShape"'
				means="One country's outline on its own, for a card whose identity is the country. It takes the text color. Round 5."
			>
				<div className="flex flex-wrap items-end gap-x-8 gap-y-6 text-gray-300">
					{d.countries.slice(0, 14).map((c) => (
						<div key={c.place.slug} className="flex flex-col items-center gap-2">
							<CountryShape code={c.place.code ?? ""} size={72} />
							<span className="text-xs text-gray-400">{c.place.label}</span>
						</div>
					))}
					<div className="flex items-center gap-3 text-amber-300">
						<CountryShape code="jp" size={28} />
						<CountryShape code="it" size={28} />
						<CountryShape code="in" size={28} />
						<span className="text-xs text-gray-400">28 px, in a color</span>
					</div>
				</div>
			</Part>

			<Part
				name="Data without a component yet"
				from="const kit = await openKit(request, kind, country)"
				means="What the data kit returns beyond the parts above. Concepts give these their own form; this is only proof the data is real and sensible."
			>
				<div className="grid gap-x-10 gap-y-8 text-sm lg:grid-cols-2">
					<Fact label="kit.kinds(comedy): the kinds inside a place">
						{d.kinds.map((k) => (
							<li key={k.id}>
								<span className="font-semibold text-white">{k.name}</span>{" "}
								<span className="text-gray-500">
									·{" "}
									{k.titles
										.slice(0, 3)
										.map((t) => t.card.title)
										.join(", ")}
								</span>
							</li>
						))}
					</Fact>
					<Fact label="kit.neighbors(cozy): next door, and the word that differs">
						{d.neighbors.map((n) => (
							<li key={n.place.slug}>
								<span className="font-semibold text-white">{n.place.label}</span>{" "}
								<span className="text-gray-400">is {n.differs}</span>
							</li>
						))}
						{d.neighborsAll.map((n) => (
							<li key={`${n.place.family}:${n.place.slug}`} className="text-gray-500">
								across families: {n.place.label} ({n.place.family}), {n.differs}
							</li>
						))}
					</Fact>
					<Fact label="kit.era(1990s): what rose and fell, as ideas">
						{d.era && (
							<>
								<li>
									<span className="text-gray-400">More of:</span>{" "}
									<span className="font-semibold text-white">
										{d.era.rose.map((s) => s.label).join(", ")}
									</span>
								</li>
								<li>
									<span className="text-gray-400">Less of:</span>{" "}
									<span className="font-semibold text-white">
										{d.era.fell.map((s) => s.label).join(", ")}
									</span>
								</li>
								<li className="text-gray-500">
									1994:{" "}
									{d.era.years
										.find((y) => y.year === 1994)
										?.titles.map((t) => t.card.title)
										.join(", ")}
								</li>
							</>
						)}
					</Fact>
					<Fact label="kit.dials(cozy): four named directions">
						{d.dials.map((x) => (
							<li key={x.key}>
								<span className="text-gray-400">{x.low}</span>{" "}
								<span className="text-gray-600">{x.lower ? `← ${x.lower.label}` : ""}</span>{" "}
								<span className="font-semibold text-white tabular-nums">
									{Math.round(x.at * 100)}%
								</span>{" "}
								<span className="text-gray-600">{x.higher ? `${x.higher.label} →` : ""}</span>{" "}
								<span className="text-gray-400">{x.high}</span>
							</li>
						))}
					</Fact>
					<Fact label="kit.blend(cozy + comedy): goes well with">
						{d.blend.suggestions.map((s) => (
							<li key={`${s.place.family}:${s.place.slug}`}>
								<span className="font-semibold text-white">+ {s.place.label}</span>{" "}
								<span className="text-gray-500">
									· {s.titles.map((t) => t.card.title).join(", ")}
								</span>
							</li>
						))}
					</Fact>
					<Fact label="kit.famousBlends() and kit.name(): blends said the way a person would">
						{d.famous.map((f) => (
							<li key={f.name}>
								<span className="font-semibold text-white">{f.name}</span>{" "}
								<span className="text-gray-500">
									· {f.titles.map((t) => t.card.title).join(", ")}
								</span>
							</li>
						))}
						{Object.values(d.names).map((n) => (
							<li key={n} className="text-gray-400">
								{n}
							</li>
						))}
					</Fact>
					<Fact label="kit.showcase(cozy, { lines: true }): a sentence from the title analysis">
						{d.defining.map((t) => (
							<li key={t.card.key}>
								<span className="font-semibold text-white">{t.card.title}</span>{" "}
								<span className="text-gray-400 italic">{t.line}</span>
							</li>
						))}
					</Fact>
					<Fact label={`Server time for this page: ${d.totalMs} ms`}>
						{d.timings.map((t) => (
							<li key={t.name} className="flex justify-between gap-4 text-gray-400">
								<span>{t.name}</span>
								<span className="tabular-nums">{t.ms} ms</span>
							</li>
						))}
					</Fact>
				</div>
				<p className="mt-8 text-sm text-gray-500">
					The contract end to end, in the smallest concept:{" "}
					<Link className="font-semibold text-amber-300 hover:text-amber-200" to={at(hub("movie"))}>
						demo hub
					</Link>
					,{" "}
					<Link
						className="font-semibold text-amber-300 hover:text-amber-200"
						to={at(place("movie", [ing("mood", "cozy")]))}
					>
						a place
					</Link>
					,{" "}
					<Link
						className="font-semibold text-amber-300 hover:text-amber-200"
						to={at(best("movie"))}
					>
						Best
					</Link>
					.
				</p>
			</Part>
		</div>
	)
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<Caption className="mb-2">{label}</Caption>
			<ul className="space-y-1.5 leading-snug">{children}</ul>
		</div>
	)
}

// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). A place: one ingredient, or a blend of several.
// The headline is the blend. Under it the titles start straight away; what to add next runs beside them (above them
// on a phone). One ingredient keeps its own character: its lede, its trait words, its kinds, people and awards.
import { Link } from "@remix-run/react"
import { CheckBadgeIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Kicker } from "~/ui/eyebrow"
import { SectionHeading } from "~/ui/heading"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { gridPosterPriority } from "~/utils/tmdb-image"
import {
	FAMILY,
	type Address,
	add,
	best as bestAddress,
	familyPage,
	hub,
	kindLabel,
	kindNoun,
	place,
} from "../../kit/address"
import type { ConceptPageProps } from "../../kit/contract"
import { headings } from "../../kit/copy/headings"
import type { KindOf, PlaceRef, TraitWord as Trait } from "../../kit/types"
import {
	AwardStrip,
	Crumbs,
	ListControls,
	Pager,
	PeopleStrip,
	PosterTrio,
	Reveal,
	ShowMark,
	Thumb,
	TraitSentence,
	TraitWord,
	WRAP,
	isMixed,
} from "../../kit/ui"
import { BlendBar } from "./BlendBar"
import { pitchFor } from "./curated"
import type { BlendData } from "./loader.server"
import { BlendVenn, PairStrip } from "./Overlap"
import { BlendCard, SuggestCard, idOf, moodHues } from "./parts"
import { inSentence, phrase, without } from "./phrase"

type PlaceData = Extract<BlendData, { view: "place" }>

/** The list's own grid: Discover's, one column narrower from `lg` up because the mixer runs beside it. */
const GRID = "grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5"

const COUNT_WORD = ["", "", "two", "three", "four", "five", "six", "seven"]

function Together({ traits, noun, many }: { traits: Trait[]; noun: string; many: boolean }) {
	if (!traits.length) return null
	return (
		<p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-300">
			Put together, these {noun} come out{" "}
			{traits.map((t, i) => (
				<span key={t.key}>
					{i > 0 && (i === traits.length - 1 ? " and " : ", ")}
					{t.dir === "less" ? "less " : "more "}
					<TraitWord trait={t} noun={noun} />
				</span>
			))}{" "}
			than {many ? "any of them" : "either"} alone.
		</p>
	)
}

function KindCard({ kind, to }: { kind: KindOf; to: string }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			preventScrollReset
			className="group flex flex-col rounded-2xl bg-[#151b28] p-4 ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
		>
			<span className="font-display text-lg leading-snug font-bold text-white sm:min-h-[3.2rem]">
				{kind.name}
			</span>
			<PosterTrio titles={kind.titles.slice(0, 3)} className="mt-3" />
		</Link>
	)
}

export function PlacePage({ address, data, to, viewer }: ConceptPageProps<BlendData>) {
	const d = data as PlaceData
	const kind = address.kind
	const noun = kindNoun(kind)
	const parts = d.parts
	const single = parts.length === 1
	const segs = phrase(kind, parts)
	const said = inSentence(segs)
	const mixed = isMixed(d.list.titles)
	const hues = moodHues(parts)
	const pitch = pitchFor(kind, parts)
	const home = { label: kindLabel(kind), to: to(hub(kind)) }
	const lead = parts[0]
	const venn = address.venn ?? "both"
	const activeKind = address.kind_ ? d.kinds.find((k) => k.id === address.kind_) : undefined

	const listTitle =
		parts.length === 2 && venn !== "both"
			? `${phrase(kind, [venn === "a" ? parts[0] : parts[1]])
					.map((s) => s.text)
					.join(" ")} ${without(kind, venn === "a" ? parts[1] : parts[0])}`
			: activeKind
				? activeKind.name
				: headings.all(said)

	const suggestions = d.suggestions.map((s) => (
		<SuggestCard
			key={idOf(s.place)}
			kind={kind}
			place={s.place}
			becomes={phrase(kind, [...parts, s.place])}
			titles={s.titles}
			to={to(add(address, s.place))}
			className="max-lg:w-[68%] max-lg:shrink-0 max-lg:snap-start sm:max-lg:w-[38%]"
		/>
	))

	return (
		<>
			<header className="relative isolate">
				{hues.length > 0 && (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full transition-[background] duration-500"
						style={{
							background: [
								`radial-gradient(90% 100% at 12% 0%, color-mix(in oklab, ${hues[0]} 26%, transparent) 0%, transparent 62%)`,
								hues[1]
									? `radial-gradient(70% 90% at 78% 0%, color-mix(in oklab, ${hues[1]} 20%, transparent) 0%, transparent 60%)`
									: "",
							]
								.filter(Boolean)
								.join(", "),
						}}
					/>
				)}
				<div className={`${WRAP} pt-6 pb-9 sm:pt-8 sm:pb-11`}>
					<Crumbs
						items={
							single
								? [
										home,
										{
											label: FAMILY[lead.family].many,
											to: to(familyPage(kind, lead.family, address.country)),
										},
										{ label: lead.label },
									]
								: [home, { label: "Blend" }]
						}
					/>
					<div
						className={`mt-5 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] ${
							parts.length >= 3 ? "items-start" : "items-end"
						}`}
					>
						<div className="min-w-0">
							<Kicker>
								{single
									? FAMILY[lead.family].one
									: `A blend of ${COUNT_WORD[parts.length] ?? parts.length}`}
							</Kicker>
							<div className="mt-2">
								<BlendBar
									kind={kind}
									address={address}
									parts={parts}
									shorts={d.shorts}
									swaps={d.swaps}
									pantry={d.pantry}
									to={to}
								/>
							</div>
							{(d.lede || pitch) && (
								<p className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
									{d.lede ?? pitch}
								</p>
							)}
							{single ? (
								<TraitSentence more={d.more} less={d.less} noun={noun} className="mt-3 max-w-2xl" />
							) : (
								<Together traits={d.together} noun={noun} many={parts.length > 2} />
							)}
							{single && lead.family === "service" && (
								<p className="mt-3 text-[15px] text-gray-400">
									Everything here is on {lead.label} right now. For what just arrived, see{" "}
									<Link
										to="/new"
										className="rounded-sm font-semibold text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										New on {lead.label} ›
									</Link>
								</p>
							)}
							{d.hasBest && (
								<Link
									to={to(bestAddress(kind, address.parts))}
									prefetch="intent"
									className="group mt-4 inline-flex items-center gap-1.5 rounded-sm text-[15px] font-semibold text-gray-200 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<CheckBadgeIcon className="h-4.5 w-4.5 text-amber-400" />
									<span className="underline decoration-white/25 underline-offset-4 group-hover:decoration-white/70">
										See only the best {said}, ranked
									</span>
								</Link>
							)}
						</div>
						{parts.length === 2 && d.venn && !d.narrow && (
							<div className="max-lg:mx-auto max-lg:w-full max-lg:max-w-[19rem]">
								<BlendVenn
									kind={kind}
									a={parts[0]}
									b={parts[1]}
									value={venn}
									counts={d.venn}
									to={(v) =>
										to({
											...address,
											venn: v,
											page: undefined,
											kind_: undefined,
										})
									}
								/>
							</div>
						)}
						{parts.length >= 3 && (
							<PairStrip pairs={d.pairs} to={(a, b) => to(place(kind, [a, b], address.country))} />
						)}
						{single && d.defining.length > 0 && (
							<div className="hidden grid-cols-3 gap-3 lg:grid">
								{d.defining.map((t) => (
									<Thumb
										key={t.card.key}
										title={t}
										size="w342"
										className="shadow-xl shadow-black/40"
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</header>

			{d.narrow ? (
				<Narrow d={d} address={address} to={to} said={said} />
			) : (
				<div className={`${WRAP} grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem]`}>
					{d.suggestions.length > 0 && (
						<aside aria-labelledby="mix-heading" className="hidden min-w-0 lg:order-2 lg:block">
							<SectionHeading as="h2" size="group" id="mix-heading">
								Goes well with it
							</SectionHeading>
							<p className="mt-0.5 text-sm text-gray-400">
								One more ingredient, and what you&rsquo;d get.
							</p>
							<div className="mt-3 flex flex-col gap-3">{suggestions}</div>
						</aside>
					)}
					<section
						id="all"
						aria-labelledby="all-heading"
						className="min-w-0 scroll-mt-40 space-y-5"
					>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<SectionHeading id="all-heading">
								{listTitle.charAt(0).toUpperCase() + listTitle.slice(1)}
							</SectionHeading>
							{activeKind && (
								<Link
									to={to({ ...address, kind_: undefined, page: undefined })}
									preventScrollReset
									className="flex h-8 items-center gap-1 rounded-full bg-white/[0.07] pr-3 pl-2 text-sm font-bold text-gray-200 ring-1 ring-white/15 outline-none transition-colors hover:bg-white hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<XMarkIcon className="h-4 w-4" />
									All {said}
								</Link>
							)}
						</div>
						<ListControls
							address={address}
							to={to}
							viewer={viewer}
							discoverHref={d.list.discoverHref}
						/>
						{d.list.titles.length > 0 ? (
							<div className={GRID}>
								{d.list.titles.flatMap((t, i) => {
									const card = (
										<div key={t.card.key} className="relative">
											<TitlePosterCard
												card={t.card}
												posterPriority={gridPosterPriority(i)}
												skipOffscreen={i > 14}
											/>
											<ShowMark title={t} mixed={mixed} />
										</div>
									)
									// Below `lg` the mixer sits inside the list, after its first two rows.
									return i === 6 && d.suggestions.length > 0
										? [
												<div key="mix" className="col-span-full py-3 lg:hidden">
													<SectionHeading as="h2" size="group">
														Goes well with it
													</SectionHeading>
													<p className="mt-0.5 text-sm text-gray-400">
														One more ingredient, and what you&rsquo;d get.
													</p>
													<div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6">
														{suggestions}
													</div>
												</div>,
												card,
											]
										: [card]
								})}
							</div>
						) : (
							<p className="rounded-2xl bg-white/[0.04] p-6 text-gray-300 ring-1 ring-white/10">
								Nothing left with those filters on. Switch one off to see {said} again.
							</p>
						)}
						<Pager
							page={d.list.page}
							pages={d.list.pages}
							to={(n) => to({ ...address, page: n })}
						/>
					</section>
				</div>
			)}

			{!d.narrow && (
				<div className={`${WRAP} mt-16 space-y-14`}>
					{single && d.kinds.length > 1 && (
						<Reveal as="section" className="space-y-4">
							<SectionHeading>{headings.kindsOf(said)}</SectionHeading>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
								{d.kinds.map((k) => (
									<KindCard
										key={k.id}
										kind={k}
										to={`${to({
											...address,
											kind_: k.id,
											page: undefined,
											venn: undefined,
										})}#all`}
									/>
								))}
							</div>
						</Reveal>
					)}
					{d.people.length > 0 && (
						<Reveal as="section" className="space-y-4">
							<SectionHeading>{headings.people}</SectionHeading>
							<PeopleStrip people={d.people} />
						</Reveal>
					)}
					{d.awards.length > 0 && (
						<Reveal as="section" className="space-y-4">
							<SectionHeading>{headings.awards}</SectionHeading>
							<AwardStrip wins={d.awards} />
						</Reveal>
					)}
				</div>
			)}
		</>
	)
}

/** A blend that holds only a handful, or nothing: say so kindly, show what there is, and offer the nearest fuller ones. */
function Narrow({
	d,
	address,
	to,
	said,
}: {
	d: PlaceData
	address: Address
	to: ConceptPageProps<BlendData>["to"]
	said: string
}) {
	const kind = address.kind
	const noun = kindNoun(kind)
	const none = d.count === 0
	const mixed = isMixed(d.list.titles)
	return (
		<div className={`${WRAP} space-y-10`}>
			<section className="max-w-3xl rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
				<SectionHeading>{none ? "Nothing is all of that at once" : "A rare blend"}</SectionHeading>
				<p className="mt-2 text-lg leading-relaxed text-gray-300">
					{none
						? `We don't know any ${noun} that fit every part of this. It happens: some things just don't meet. Take one thing out and it opens right up.`
						: `Only a handful of ${noun} are all of this at once. Here they are. If you'd like more to pick from, take one thing out.`}
				</p>
			</section>
			{!none && (
				<section className="space-y-4">
					<SectionHeading size="group">{headings.all(said)}</SectionHeading>
					<div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-6 lg:gap-5">
						{d.list.titles.map((t, i) => (
							<div key={t.card.key} className="relative">
								<TitlePosterCard card={t.card} posterPriority={gridPosterPriority(i)} />
								<ShowMark title={t} mixed={mixed} />
							</div>
						))}
					</div>
				</section>
			)}
			{d.loosen.length > 0 && (
				<section className="space-y-4">
					<SectionHeading size="group">The nearest blends with more in them</SectionHeading>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
						{d.loosen.map((l) => (
							<BlendCard
								key={idOf(l.dropped)}
								kind={kind}
								parts={l.parts}
								titles={l.titles}
								to={to(place(kind, l.parts, address.country))}
								label={`Without ${l.dropped.label}`}
							/>
						))}
					</div>
				</section>
			)}
		</div>
	)
}

export type { PlaceRef }

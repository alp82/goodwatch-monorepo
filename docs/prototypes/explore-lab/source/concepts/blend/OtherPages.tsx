// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). A family's landing (every first ingredient of one
// kind) and Best (the ranking, where Best is one more ingredient of the headline).
import { Link } from "@remix-run/react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { Segmented } from "~/ui/selection/Segmented"
import {
	FAMILY,
	add,
	best as bestAddress,
	hub,
	kindLabel,
	kindNoun,
	place,
} from "../../kit/address"
import type { ConceptPageProps } from "../../kit/contract"
import { headings } from "../../kit/copy/headings"
import { WorldMap } from "../../kit/optional"
import { BestTable, Crumbs, PLACE_GRID, Pager, PlaceCard, WRAP } from "../../kit/ui"
import { BlendBar } from "./BlendBar"
import type { BlendData } from "./loader.server"
import { SuggestCard, idOf, moodHues, nice } from "./parts"
import { inSentence, phrase } from "./phrase"

type FamilyData = Extract<BlendData, { view: "family" }>
type BestData = Extract<BlendData, { view: "best" }>

/** The ranking's first rows come before the suggestions, so the list starts on the first screen. */
const HEAD_ROWS = 10

const FAMILY_TITLE: Record<string, (kind: string) => string> = {
	mood: (k) => `${k} by mood`,
	genre: (k) => `${k} by genre`,
	theme: (k) => `${k} by subject`,
	style: (k) => `${k} by style`,
	decade: (k) => `${k} by decade`,
	country: (k) => `${k} by country`,
	service: (k) => `${k} by streaming service`,
}

export function FamilyPage({ address, data, to }: ConceptPageProps<BlendData>) {
	const d = data as FamilyData
	const kind = address.kind
	const family = d.family
	const max = Math.max(1, ...d.places.map((p) => p.weight ?? 0))
	return (
		<>
			<header className={`${WRAP} pt-6 pb-8 sm:pt-8`}>
				<Crumbs
					items={[{ label: kindLabel(kind), to: to(hub(kind)) }, { label: FAMILY[family].many }]}
				/>
				<Kicker className="mt-5">Start with one thing</Kicker>
				<PageTitle className="mt-2 text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl">
					{FAMILY_TITLE[family]?.(kindLabel(kind)) ?? FAMILY[family].many}
				</PageTitle>
				{d.lede && (
					<p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
						{d.lede}
					</p>
				)}
			</header>
			<div className={`${WRAP} space-y-10`}>
				{family === "country" && WorldMap && (
					<WorldMap
						countries={d.places.flatMap((p) =>
							p.place.code
								? [
										{
											code: p.place.code,
											name: nice(p.place),
											href: to(place(kind, [p.place])),
											weight: (p.weight ?? 0) / max,
										},
									]
								: [],
						)}
					/>
				)}
				{family === "country" && <SectionHeading>Eight good places to start</SectionHeading>}
				<div className={PLACE_GRID}>
					{(family === "country" ? d.places.slice(0, 8) : d.places).map((p) => (
						<PlaceCard
							key={p.place.slug}
							place={{ ...p.place, label: nice(p.place) }}
							to={to(place(kind, [p.place], address.country))}
							titles={p.titles}
							line={p.line}
						/>
					))}
				</div>
				{family === "service" && (
					<p className="text-[15px] text-gray-400">
						Looking for what just arrived?{" "}
						<Link
							to="/new"
							className="rounded-sm font-semibold text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							New has this week&rsquo;s arrivals on every service ›
						</Link>
					</p>
				)}
			</div>
		</>
	)
}

export function BestPage({ address, data, to }: ConceptPageProps<BlendData>) {
	const d = data as BestData
	const kind = address.kind
	const noun = kindNoun(kind)
	const year = d.year ?? undefined
	const said = inSentence(phrase(kind, d.parts, { best: true, year }))
	const hues = moodHues(d.parts)
	const yearKey = d.year ? String(d.year) : "all"
	return (
		<>
			<header className="relative isolate">
				{hues.length > 0 && (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
						style={{
							background: `radial-gradient(90% 100% at 12% 0%, color-mix(in oklab, ${hues[0]} 24%, transparent) 0%, transparent 62%)`,
						}}
					/>
				)}
				<div className={`${WRAP} pt-6 pb-8 sm:pt-8 sm:pb-10`}>
					<Crumbs items={[{ label: kindLabel(kind), to: to(hub(kind)) }, { label: "Best" }]} />
					<Kicker className="mt-5">The ranking</Kicker>
					<div className="mt-2">
						<BlendBar
							kind={kind}
							address={address}
							parts={d.parts}
							isBest
							year={d.year}
							years={d.years}
							shorts={d.shorts}
							swaps={d.swaps}
							pantry={d.pantry}
							to={to}
						/>
					</div>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
						{d.best.published
							? `The ${noun} that critics and audiences agree on, in order. Every row shows what each source gave it, so you can see who loved it most.`
							: `Ranked by score, trusting many ratings over a few. Every row shows what each source gave it. Add anything to rank inside it.`}
					</p>
					{!d.parts.some((p) => p.family === "decade") && (
						<div className="mt-5 flex flex-wrap items-center gap-3">
							<span className="text-sm font-semibold text-gray-400">Released</span>
							<Segmented
								label="Release year"
								size="sm"
								replace
								value={d.years.includes(d.year ?? -1) || !d.year ? yearKey : "other"}
								options={[
									{
										key: "all",
										label: "Any year",
										href: to({ ...address, year: undefined, page: undefined }),
									},
									...d.years.map((y) => ({
										key: String(y),
										label: String(y),
										href: to({ ...bestAddress(kind, address.parts, y) }),
									})),
								]}
							/>
						</div>
					)}
				</div>
			</header>

			<div className={`${WRAP} space-y-10`}>
				<section aria-labelledby="ranking-heading" className="space-y-4">
					<SectionHeading id="ranking-heading">
						{said.charAt(0).toUpperCase() + said.slice(1)}
					</SectionHeading>
					{d.best.rows.length > 0 ? (
						<BestTable rows={d.best.rows.slice(0, HEAD_ROWS)} />
					) : (
						<p className="max-w-3xl rounded-2xl bg-white/[0.04] p-6 text-lg text-gray-300 ring-1 ring-white/10">
							Nothing to rank here yet. Take one thing out of the title, or pick another year.
						</p>
					)}
				</section>
				{d.suggestions.length > 0 && (
					<section aria-labelledby="narrow-heading" className="min-w-0">
						<SectionHeading as="h2" size="group" id="narrow-heading">
							{d.parts.length ? "Goes well with it" : "The best of one thing"}
						</SectionHeading>
						<p className="mt-0.5 text-sm text-gray-400">
							One more ingredient, and the top of what it would rank.
						</p>
						<div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:p-0">
							{d.suggestions.slice(0, 4).map((s) => (
								<SuggestCard
									key={idOf(s.place)}
									kind={kind}
									place={s.place}
									becomes={phrase(kind, [...d.parts, s.place], { best: true, year })}
									titles={s.titles}
									to={to(add(address, s.place))}
									className="max-lg:w-[68%] max-lg:shrink-0 max-lg:snap-start sm:max-lg:w-[38%]"
								/>
							))}
						</div>
					</section>
				)}
				{d.best.rows.length > HEAD_ROWS && (
					<section aria-label="The ranking, continued" className="space-y-4">
						<BestTable rows={d.best.rows.slice(HEAD_ROWS)} />
					</section>
				)}
				<Pager page={d.page} pages={d.pages} to={(n) => to({ ...address, page: n })} />
				<p className="text-[15px] text-gray-400">
					{headings.awards} live on their own page:{" "}
					<Link
						to="/awards"
						className="rounded-sm font-semibold text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						the Oscars, Emmys, Globes and BAFTAs ›
					</Link>
				</p>
			</div>
		</>
	)
}

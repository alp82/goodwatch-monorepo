// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). The hub: blends, named the way a person would say
// them. One big blend of the day with its real titles (a different one each day, "Another one" turns to the next),
// then blends people already have a name for, what everyone is watching, blends you wouldn't think to ask for, one
// family at a time to start from a single ingredient, and the top of Best.
import { Link } from "@remix-run/react"
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useState } from "react"
import { PrimaryButton } from "~/ui/button/PrimaryButton"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { SELECTED_QUIET } from "~/ui/selection/selected"
import {
	FAMILY,
	best as bestAddress,
	familyPage,
	hub,
	kindLabel,
	kindNoun,
	place,
} from "../../kit/address"
import type { ConceptPageProps } from "../../kit/contract"
import { headings } from "../../kit/copy/headings"
import {
	BestTable,
	EASE,
	PLACE_STRIP,
	PlaceCard,
	PosterRail,
	Reveal,
	WRAP,
	wash,
} from "../../kit/ui"
import type { BlendCardData, BlendData } from "./loader.server"
import { BLEND_CARDS as CARDS, BlendCard, PhraseText, idOf, moodHues, nice } from "./parts"
import { FAMILY_WORD, phrase, phraseText } from "./phrase"

type HubData = Extract<BlendData, { view: "hub" }>
type To = ConceptPageProps<BlendData>["to"]

function Feature({
	kind,
	features,
	to,
}: {
	kind: import("../../kit/address").Kind
	features: BlendCardData[]
	to: To
}) {
	const reduce = useReducedMotion()
	const [i, setI] = useState(0)
	const f = features[i % features.length]
	if (!f) return null
	const hues = moodHues(f.parts)
	const href = to(place(kind, f.parts))
	return (
		<section
			aria-label="Blend of the day"
			className="relative isolate overflow-hidden rounded-3xl ring-1 ring-white/10"
		>
			<AnimatePresence initial={false}>
				<motion.div
					key={`wash-${i}`}
					aria-hidden
					className="absolute inset-0 -z-10"
					style={{
						background: `linear-gradient(135deg, ${wash(hues[0] ?? "#64748b", 34)} 0%, ${wash(
							hues[1] ?? hues[0] ?? "#64748b",
							14,
						)} 46%, #131926 100%)`,
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
				/>
			</AnimatePresence>
			<div className="px-4 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-7">
				<div className="flex flex-wrap items-end gap-x-8 gap-y-5">
					<AnimatePresence initial={false} mode="wait">
						<motion.div
							key={`head-${i}`}
							className="min-w-0 flex-1 basis-[28rem]"
							initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
							transition={{ duration: 0.22, ease: EASE }}
						>
							<Kicker>Blend of the day</Kicker>
							<h2 className="mt-2 font-display text-3xl leading-[1.12] font-bold tracking-tight text-balance text-white sm:text-5xl">
								<Link
									to={href}
									prefetch="intent"
									className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<PhraseText segs={phrase(kind, f.parts)} />
								</Link>
							</h2>
							{f.pitch && (
								<p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
									{f.pitch}
								</p>
							)}
						</motion.div>
					</AnimatePresence>
					<div className="flex shrink-0 items-center gap-2">
						<PrimaryButton
							to={href}
							prefetch="intent"
							className="flex h-11 items-center px-5 text-[15px]"
						>
							Open this blend
						</PrimaryButton>
						{features.length > 1 && (
							<button
								type="button"
								onClick={() => setI((n) => (n + 1) % features.length)}
								className="group flex h-11 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[15px] font-bold text-gray-100 ring-1 ring-white/20 outline-none transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
							>
								<ArrowPathIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none" />
								Another one
							</button>
						)}
					</div>
				</div>
				<AnimatePresence initial={false} mode="wait">
					<motion.div
						key={`rail-${i}`}
						className="mt-6"
						initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.28, ease: EASE }}
					>
						<PosterRail id={`feature-${i}`} titles={f.titles} eager={i === 0} />
					</motion.div>
				</AnimatePresence>
			</div>
		</section>
	)
}

export function HubPage({ address, data, to }: ConceptPageProps<BlendData>) {
	const d = data as HubData
	const kind = address.kind
	const noun = kindNoun(kind)
	const cards = (list: BlendCardData[]) =>
		list.map((b) => (
			<BlendCard
				key={b.parts.map(idOf).join("+")}
				kind={kind}
				parts={b.parts}
				pitch={b.pitch}
				titles={b.titles}
				to={to(place(kind, b.parts))}
			/>
		))
	const startAll = FAMILY[d.startFamily].many.toLowerCase()
	return (
		<>
			<header className={`${WRAP} pt-6 pb-6 sm:pt-8`}>
				<Kicker>Browse</Kicker>
				<PageTitle className="mt-2 text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl">
					{kindLabel(kind)}
				</PageTitle>
				<p className="mt-3 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
					{d.lede ??
						`Pick a feeling, add a genre, a decade, a country. Every mix is its own shelf of ${noun}.`}
				</p>
			</header>
			<div className={`${WRAP} space-y-14`}>
				<Feature kind={kind} features={d.features} to={to} />

				<section className="space-y-4">
					<SectionHeading>Blends everyone knows</SectionHeading>
					<div className={CARDS}>{cards(d.favorites)}</div>
				</section>

				<Reveal>
					<PosterRail
						id="popular"
						title={headings.popular}
						line={`What people are watching this week. Open one and start a blend from what it is.`}
						titles={d.popular}
					/>
				</Reveal>

				<Reveal as="section" className="space-y-4">
					<SectionHeading>Odd pairs that work</SectionHeading>
					<div className={CARDS}>{cards(d.odd)}</div>
				</Reveal>

				<Reveal as="section" className="space-y-4">
					<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
						<SectionHeading id="start">Start with one thing</SectionHeading>
						<nav
							aria-label="What to start from"
							className="-mx-4 flex max-w-full gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
						>
							{d.startFamilies.map((f) => (
								<Link
									key={f}
									to={`${to(hub(kind), {
										from: f === "mood" ? undefined : f,
									})}#start`}
									preventScrollReset
									replace
									prefetch="intent"
									aria-current={f === d.startFamily ? "true" : undefined}
									className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
										f === d.startFamily ? SELECTED_QUIET : "text-gray-400 hover:text-white"
									}`}
								>
									{FAMILY_WORD[f]}
								</Link>
							))}
						</nav>
					</div>
					<AnimatePresence initial={false} mode="wait">
						<motion.div
							key={d.startFamily}
							className={PLACE_STRIP}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.16 }}
						>
							{d.start.map((s) => (
								<PlaceCard
									key={s.place.slug}
									place={{ ...s.place, label: nice(s.place) }}
									to={to(place(kind, [s.place]))}
									titles={s.titles}
									line={s.line}
								/>
							))}
						</motion.div>
					</AnimatePresence>
					{d.startMore > 0 && (
						<Link
							to={to(familyPage(kind, d.startFamily))}
							prefetch="intent"
							className="group inline-flex items-center gap-1 rounded-sm text-[15px] font-semibold text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							All {d.start.length + d.startMore} {startAll === "streaming" ? "services" : startAll}
							<span
								aria-hidden
								className="transition-transform duration-200 group-hover:translate-x-0.5"
							>
								›
							</span>
						</Link>
					)}
				</Reveal>

				<Reveal as="section" className="space-y-4">
					<Link
						to={to(bestAddress(kind))}
						prefetch="intent"
						className="group inline-block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<SectionHeading className="group-hover:text-amber-300">
							{headings.best}
							<span
								aria-hidden
								className="ml-1 inline-block text-amber-300 transition-transform duration-200 group-hover:translate-x-0.5"
							>
								›
							</span>
						</SectionHeading>
					</Link>
					<BestTable rows={d.best.rows} />
					{d.bestStarts.length > 0 && (
						<p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[15px] text-gray-400">
							<span>Or the best of one thing:</span>
							{d.bestStarts.map((p) => (
								<Link
									key={idOf(p)}
									to={to(bestAddress(kind, [p]))}
									prefetch="intent"
									className="rounded-sm font-semibold text-gray-100 underline decoration-white/25 underline-offset-4 outline-none transition-colors hover:text-white hover:decoration-white/70 focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									{phraseText(phrase(kind, [p], { best: true })).replace(/ of all time$/, "")}
								</Link>
							))}
						</p>
					)}
				</Reveal>
			</div>
		</>
	)
}

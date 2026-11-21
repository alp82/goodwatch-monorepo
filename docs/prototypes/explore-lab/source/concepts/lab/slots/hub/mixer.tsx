// PROTOTYPE - throwaway (prototype/explore-r6, slot "hub", variant "mixer"). Round 5's Mix, as the owner asked:
// "a sidebar/content relation instead of below each other. The sentence as title would still work." The title is the
// blend ("Cozy comedies from the 1990s": tap a word to swap it or take it out). The sidebar is the pantry, every family
// in its own form; a click adds or removes one ingredient and the titles beside it follow. On a phone the pantry
// becomes one sideways row per family above the titles. The sentence lives in the address (`?mix=`).
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/20/solid"
import { Link, useLocation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { PrimaryButton } from "~/ui/button/PrimaryButton"
import { CAPTION, Kicker } from "~/ui/eyebrow"
import {
	type Address,
	type Family,
	type Ingredient,
	type Kind,
	familyPage,
	hub,
	kindLabel,
	kindNoun,
	place,
	same,
	sortParts,
} from "../../../../kit/address"
import type { PlaceRef } from "../../../../kit/types"
import { FOCUS, TraitSentence, WRAP, poster, wash } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import { BlendBar } from "../../../blend/BlendBar"
import { DragProvider, PhraseText, moodHues } from "../../../blend/parts"
import { phrase } from "../../../blend/phrase"
import { TunedGrid } from "../../../dials/Tuner"
import type { PageViewProps, SlotVariant } from "../../contract"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import type { MixData, MixOption } from "./mixer.server"
import { BlendRow, nice } from "./pieces"

const idOf = (p: Ingredient) => `${p.family}:${p.slug}`

const LABEL: Record<string, string> = {
	mood: "Feels",
	genre: "Genre",
	decade: "From when",
	country: "From where",
	service: "On",
}

/** How an option reads in each state: lit when it is in the sentence, struck when it would leave nothing. */
const tone = (s: MixOption["state"]) =>
	s === "in"
		? "bg-white/[0.1] text-white ring-1 ring-amber-300/70"
		: s === "none"
			? "pointer-events-none text-gray-600 line-through decoration-gray-700 opacity-60"
			: s === "thin"
				? "text-gray-500 hover:bg-white/[0.05] hover:text-gray-200"
				: "text-gray-200 hover:bg-white/[0.06] hover:text-white"

function Option({
	o,
	to,
	kind,
	parts,
}: {
	o: MixOption
	to: string
	kind: Kind
	parts: PlaceRef[]
}) {
	const p = o.place
	const on = o.state === "in"
	const title =
		o.state === "in"
			? `In your mix. Click to take ${nice(p)} out.`
			: o.state === "none"
				? `Nothing is all of that and ${nice(p)} at once.`
				: `${o.state === "thin" ? "Only a handful: " : ""}${phrase(kind, [...parts, p])
						.map((x) => x.text)
						.join("")}`
	const mark =
		p.family === "mood" ? (
			<span
				aria-hidden
				className="h-2.5 w-2.5 shrink-0 rounded-full"
				style={{ background: p.hue ?? "#cbd5e1", boxShadow: on ? `0 0 10px ${p.hue}` : undefined }}
			/>
		) : p.family === "country" && p.code ? (
			<span className="grid w-6 shrink-0 place-items-center">
				<FlagShape code={p.code} size={22} />
			</span>
		) : p.family === "service" && p.logo ? (
			<img
				src={poster(p.logo, "w92")}
				alt=""
				loading="lazy"
				className="h-5 w-5 shrink-0 rounded-[24%]"
			/>
		) : null
	return (
		<Link
			to={to}
			preventScrollReset
			replace
			title={title}
			aria-current={on ? "true" : undefined}
			aria-disabled={o.state === "none" || undefined}
			tabIndex={o.state === "none" ? -1 : undefined}
			className={`${on ? "max-lg:order-first" : ""} flex min-w-0 shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-tight font-semibold whitespace-nowrap lg:whitespace-normal ${QUICK_T} ${tone(o.state)} ${FOCUS}`}
		>
			{mark}
			<span className="min-w-0 max-lg:truncate">{p.family === "decade" ? p.label : nice(p)}</span>
			{on && <CheckIcon aria-hidden className="ml-auto h-4 w-4 shrink-0 text-amber-300" />}
		</Link>
	)
}

/** Each family's grid in the sidebar; on a phone one sideways row. */
const GRID: Record<string, string> = {
	mood: "lg:grid-cols-2",
	genre: "lg:grid-cols-2",
	decade: "lg:grid-cols-3",
	country: "lg:grid-cols-2",
	service: "lg:grid-cols-2",
}

function View({ data, address, to }: PageViewProps<MixData>) {
	const kind: Kind = address.kind
	const noun = kindNoun(kind)
	const location = useLocation()
	const hubPath = to(hub(kind))
	const mixHref = (parts: Ingredient[]) => {
		const q = new URLSearchParams()
		const lab = new URLSearchParams(location.search).get("lab")
		if (lab) q.set("lab", lab)
		q.set("mix", parts.length ? sortParts(parts).map(idOf).join(",") : "-")
		return `${hubPath}?${q.toString().replace(/%3A/g, ":").replace(/%2C/g, ",")}`
	}
	const mixTo = (a: Address, extra?: Record<string, string | undefined>) =>
		a.view === "place" || a.view === "hub" ? mixHref(a.parts) : to(a, extra)
	const here = place(kind, data.parts)
	const hues = moodHues(data.parts)
	const empty = data.parts.length === 0
	const none = !empty && data.titles.length === 0
	const thin = !empty && !none && data.count < 24
	const toggle = (o: MixOption) =>
		mixHref(
			o.state === "in" ? data.parts.filter((p) => !same(p, o.place)) : [...data.parts, o.place],
		)

	return (
		<DragProvider>
			<header className="relative isolate">
				<AnimatePresence initial={false}>
					<motion.div
						key={hues.join("+") || "none"}
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10"
						style={{
							background: hues.length
								? `radial-gradient(70% 140% at 10% 0%, color-mix(in oklab, ${hues[0]} 26%, transparent) 0%, transparent 62%)${
										hues[1]
											? `, radial-gradient(60% 120% at 70% 0%, color-mix(in oklab, ${hues[1]} 18%, transparent) 0%, transparent 60%)`
											: ""
									}`
								: `radial-gradient(70% 130% at 12% 0%, ${wash("#64748b", 30)} 0%, transparent 62%)`,
						}}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.45 }}
					/>
				</AnimatePresence>
				<div className={`${WRAP} pt-6 pb-6 sm:pt-8`}>
					<Kicker>{kindLabel(kind)} · mix your own</Kicker>
					<div className="mt-3">
						<BlendBar
							kind={kind}
							address={here}
							parts={data.parts}
							shorts={data.shorts}
							swaps={data.swaps}
							pantry={[]}
							to={mixTo}
							adds={false}
						/>
					</div>
					<div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
						<div className="min-w-0 flex-1 basis-[26rem]">
							{none ? (
								<p className="max-w-2xl text-lg leading-relaxed text-gray-200">
									Nothing is all of that at once. Take a word out of the title and it opens up
									again.
								</p>
							) : data.pitch ? (
								<p className="max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
									{data.pitch}
								</p>
							) : empty ? (
								<p className="max-w-2xl text-lg leading-relaxed text-gray-200">
									Pick one thing from the pantry, then another. The titles follow.
								</p>
							) : (
								<TraitSentence more={data.traits} noun={noun} className="max-w-2xl" />
							)}
							{thin && (
								<p className="mt-1.5 text-[15px] text-gray-400">
									Only a handful are all of that at once.
								</p>
							)}
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{!empty && !none && (
								<PrimaryButton
									to={to(here)}
									prefetch="intent"
									className="flex h-11 items-center px-5 text-[15px]"
								>
									Open this blend
								</PrimaryButton>
							)}
							{data.next && (
								<Link
									to={mixHref(data.next)}
									preventScrollReset
									className={`group flex h-11 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[15px] font-bold text-gray-100 ring-1 ring-white/20 transition-colors hover:bg-white/[0.16] active:scale-[0.98] ${FOCUS}`}
								>
									<ArrowPathIcon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none" />
									Another one
								</Link>
							)}
						</div>
					</div>
				</div>
			</header>

			<div className={`${WRAP} grid gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-8`}>
				<aside
					aria-label="The pantry"
					className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:rounded-3xl lg:bg-white/[0.028] lg:p-4 lg:ring-1 lg:ring-white/[0.08] lg:[scrollbar-width:thin]"
				>
					<div className="mb-1 flex items-baseline justify-between gap-2 max-lg:hidden">
						<h2 className={CAPTION}>The pantry</h2>
						<span className="text-xs text-gray-500">Click to add or remove</span>
					</div>
					{data.shelves.map((s) => (
						<section
							key={s.family}
							className="border-white/[0.07] py-2.5 lg:border-t lg:first-of-type:border-t-0"
						>
							<h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
								<Link
									to={to(familyPage(kind, s.family as Family))}
									prefetch="intent"
									className={`rounded-sm hover:text-amber-200 ${FOCUS}`}
								>
									{LABEL[s.family] ?? s.family}
								</Link>
							</h3>
							<div
								className={`-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 ${GRID[s.family] ?? ""}`}
							>
								{s.options.map((o) => (
									<Option key={idOf(o.place)} o={o} to={toggle(o)} kind={kind} parts={data.parts} />
								))}
							</div>
						</section>
					))}
				</aside>

				<main className="min-w-0 space-y-10">
					<section aria-label="What this mix gives you">
						<div className="mb-3 flex items-baseline justify-between gap-3">
							<h2 className="font-display text-xl font-bold tracking-tight text-white">
								{empty ? (
									"Popular while you decide"
								) : (
									<PhraseText segs={phrase(kind, data.parts)} />
								)}
							</h2>
							{!empty && !none && (
								<Link
									to={to(here)}
									prefetch="intent"
									className={`shrink-0 rounded-sm text-sm font-bold text-amber-300 hover:text-amber-200 ${FOCUS}`}
								>
									The full list ›
								</Link>
							)}
						</div>
						<TunedGrid
							titles={data.titles}
							className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-6"
						/>
					</section>

					{data.blends.length > 0 && (
						<section className="space-y-4">
							<div>
								<h2 className="font-display text-xl font-bold tracking-tight text-white">
									Or start from one of these
								</h2>
								<p className="mt-1 text-[15px] text-gray-400">
									Blends people already have a name for. Each loads into the title, ready to change.
								</p>
							</div>
							<div className="grid gap-3 xl:grid-cols-2">
								{data.blends.map((b) => (
									<BlendRow
										key={b.parts.map(idOf).join("+")}
										kind={kind}
										parts={b.parts}
										pitch={b.pitch}
										titles={b.titles}
										to={mixHref(b.parts)}
									/>
								))}
							</div>
						</section>
					)}
				</main>
			</div>
		</DragProvider>
	)
}

export const variant: SlotVariant<MixData> = {
	id: "mixer",
	name: "Mixer",
	what: "Round 5's Mix with the pantry as a sidebar: the blend is the title, every family sits beside the titles, and each click adds or removes one ingredient while the titles follow.",
	order: 2,
	View,
	notes: () => [
		{
			term: "The title",
			means:
				"The blend, said the way a person would say it. Tap an underlined word to swap it for a sibling or take it out.",
		},
		{
			term: "The pantry",
			means:
				"Every family beside the titles: moods with their color, genres, decades, countries in their flag, services as logos. A click adds or removes one; what would leave nothing is struck through, what leaves only a few is quieter.",
			isNew: true,
		},
	],
}

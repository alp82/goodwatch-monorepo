// PROTOTYPE - throwaway (prototype/explore-r4, concept "dials"). Tune it: intensity and direction are how you move
// through Explore. Every page has two to four dials in plain words; turning one re-sorts the titles in front of you,
// and pushing past its end travels to the place that lies that way.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Link } from "@remix-run/react"
import { type ReactNode, forwardRef, useEffect, useRef, useState } from "react"
import { CAPTION, Kicker } from "~/ui/eyebrow"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { NAV_PILL } from "~/ui/selection/selected"
import { SHELL } from "~/ui/filter-bar/motion"
import {
	FAMILY,
	LEVELS,
	type Level,
	best,
	familyPage,
	hub,
	ing,
	kindNoun,
	place,
} from "../../kit/address"
import type { ConceptModule, ConceptPageProps, Note } from "../../kit/contract"
import { WorldMap } from "../../kit/optional"
import type { PlaceRef, ShowTitle, TraitWord } from "../../kit/types"
import {
	BlendEntry,
	AwardStrip,
	BestTable,
	BigStats,
	Crumbs,
	FOCUS,
	FlipItem,
	ListControls,
	PANEL,
	PLACE_GRID,
	PLACE_STRIP,
	Pager,
	PeopleStrip,
	PlaceCard,
	PlaceMark,
	PosterRail,
	PosterTrio,
	Reveal,
	SPRING,
	Thumb,
	TraitSentence,
	VennSwitch,
	WRAP,
	wash,
} from "../../kit/ui"
import { exploreTabs } from "../../shell/Shell"
import { Field } from "./Field"
import { PrintBars } from "./PrintBars"
import { TunedGrid, TunerPanel, TunerRow, tunedLine, useSteps, useTuner } from "./Tuner"
import type { DialsData, EveningBand, FieldPlace } from "./loader.server"
import { type DialSpec, type Settings, nearestStop, rank } from "./tune"

type Props = ConceptPageProps<DialsData>
type Of<V extends DialsData["view"]> = Extract<DialsData, { view: V }>

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A trait's adjective as people say it on a dial: "situationally funny" is just "funny". */
const dialWord = (adj: string) => (adj === "situationally funny" ? "funny" : adj)
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** "Cozy movies" reads "cozy movies" in a sentence; "Japanese movies" and "Movies on Netflix" keep their capitals. */
const inSentence = (title: string, keep: boolean) => (keep ? title : low(title))

const GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4"
const GRID_WIDE = "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4"

// ---------------------------------------------------------------------------------------------------------
// The head of every page

export function Head({
	d,
	hue,
	more,
	less,
	traitTo,
	noun,
	aside,
	asideWide = false,
	after,
	children,
}: {
	d: {
		kicker: string
		title: string
		lede: string | null
		crumbs: { label: string; to?: string }[]
	}
	hue?: string
	more?: TraitWord[]
	less?: TraitWord[]
	traitTo?: (t: TraitWord) => string
	noun?: string
	aside?: ReactNode
	asideWide?: boolean
	/** Next to the title (the lab's "blend-entry" slot). */
	after?: ReactNode
	children?: ReactNode
}) {
	const [open, setOpen] = useState(false)
	return (
		<header className="relative isolate">
			{hue && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
					style={{
						background: `radial-gradient(120% 100% at 15% 0%, color-mix(in oklab, ${hue} 26%, transparent) 0%, transparent 62%)`,
					}}
				/>
			)}
			<div className={`${WRAP} pt-5 pb-6 sm:pt-8 sm:pb-10`}>
				{d.crumbs.length > 0 && <Crumbs items={d.crumbs} />}
				<div
					className={`grid items-start gap-x-12 gap-y-8 ${d.crumbs.length ? "mt-5" : ""} ${
						aside
							? asideWide
								? "lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]"
								: "lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
							: ""
					}`}
				>
					<div className="min-w-0">
						<Kicker className="flex items-center gap-2">
							{hue && (
								<span
									aria-hidden
									className="h-2 w-2 rounded-full"
									style={{ background: hue, boxShadow: `0 0 12px ${hue}` }}
								/>
							)}
							{d.kicker}
						</Kicker>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
							<PageTitle className="text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
								{d.title}
							</PageTitle>
							{after}
						</div>
						{d.lede && (
							<p
								className={`mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200 ${open ? "" : "max-sm:line-clamp-3"}`}
							>
								{d.lede}
							</p>
						)}
						{d.lede && d.lede.length > 130 && !open && (
							<button
								type="button"
								onClick={() => setOpen(true)}
								className={`mt-1 rounded-sm text-sm font-bold text-gray-400 hover:text-white sm:hidden ${FOCUS}`}
							>
								Read on
							</button>
						)}
						{more && more.length > 0 && (
							<TraitSentence
								more={more}
								less={less}
								to={traitTo}
								noun={noun}
								className="mt-3 max-w-2xl"
							/>
						)}
						{children}
					</div>
					{aside && <div className="min-w-0">{aside}</div>}
				</div>
			</div>
		</header>
	)
}

function Onward({ title, line, children }: { title: string; line?: string; children: ReactNode }) {
	return (
		<Reveal as="section" className="space-y-4">
			<div>
				<SectionHeading>{title}</SectionHeading>
				{line && <p className="mt-1 text-sm text-gray-400">{line}</p>}
			</div>
			{children}
		</Reveal>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The hub: start from a feeling

const CORNERS: [number, number][] = [
	[0.1, 0.2],
	[0.3, 0.85],
	[0.8, 0.15],
	[0.9, 0.8],
]

function moodsFor(moods: FieldPlace[], dials: DialSpec[], settings: Settings): FieldPlace[] {
	const tone = settings.tone
	const pace = settings.pace
	if (tone == null && pace == null) {
		const picked: FieldPlace[] = []
		for (const [x, y] of CORNERS) {
			const best_ = [...moods]
				.filter((m) => !picked.includes(m))
				.sort((a, b) => Math.hypot(a.tone - x, a.pace - y) - Math.hypot(b.tone - x, b.pace - y))[0]
			if (best_) picked.push(best_)
		}
		return picked
	}
	void dials
	const cost = (m: FieldPlace) =>
		(tone == null ? 0 : Math.abs(m.tone - tone)) + (pace == null ? 0 : Math.abs(m.pace - pace))
	return [...moods].sort((a, b) => cost(a) - cost(b)).slice(0, 4)
}

function Hub({ data, address, to }: Props & { data: Of<"hub"> }) {
	const tuner = useTuner(data.dials)
	const noun = kindNoun(address.kind)
	const steps = useSteps(tuner.settings)
	const titles = rank(data.pool, data.dials, steps, 6).map((i) => i.t)
	const tone = tuner.settings.tone ?? null
	const pace = tuner.settings.pace ?? null
	const words = data.dials
		.filter((d) => tuner.settings[d.id] != null)
		.map((d) => nearestStop(d, tuner.settings[d.id] as number).name.toLowerCase())
	const answer = words.length
		? `${/^[aeiou]/.test(words[0]) ? "An" : "A"} ${words.join(", ")} night.`
		: data.title
	const moods = moodsFor(data.moods, data.dials, steps)
	// Three nights to start from, each a real address with both dials set.
	const toneDial = data.dials.find((d) => d.id === "tone")
	const paceDial = data.dials.find((d) => d.id === "pace")
	const tries =
		toneDial && paceDial
			? (
					[
						[0, 0.25, "night"],
						[0.25, 1, "one"],
						[0.75, 0.75, "one"],
					] as const
				).map(([t, p, tail]) => {
					const a = nearestStop(toneDial, t)
					const b = nearestStop(paceDial, p)
					return {
						label: `${/^[aeiou]/i.test(a.name) ? "an" : "a"} ${a.name.toLowerCase()}, ${b.name.toLowerCase()} ${tail}`,
						to: `?tone=${a.id}&pace=${b.id}`,
					}
				})
			: []
	const glow = (hue: string, at: string, opacity: number) => (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 ease-out motion-reduce:transition-none"
			style={{
				opacity,
				background: `radial-gradient(90% 120% at ${at}, color-mix(in oklab, ${hue} 30%, transparent) 0%, transparent 60%)`,
			}}
		/>
	)
	return (
		<>
			<header className="relative isolate overflow-hidden">
				{/* The room's light follows the dials: warm when it's light, cold when it's dark, red when it's intense. */}
				{/* At rest the room is lit a little from both sides, so the page has its light before a dial is touched. */}
				{glow("#fb923c", "12% 0%", tone === null ? 0.42 : (1 - tone) * 0.9)}
				{glow("#6366f1", "12% 0%", tone === null ? 0 : tone * 0.95)}
				{glow("#e11d48", "92% 10%", pace === null ? 0.3 : pace * 0.75)}
				<div className={`${WRAP} pt-6 pb-7 sm:pt-9`}>
					<Kicker>{data.kicker}</Kicker>
					<PageTitle className="mt-2 text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={answer}
								className="inline-block"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
							>
								{answer}
							</motion.span>
						</AnimatePresence>
					</PageTitle>
					<p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-200">{data.lede}</p>
					<div className="mt-6">
						<TunerRow dials={data.dials} tuner={tuner} />
					</div>
					{tries.length > 0 && (
						<p className="mt-4 text-[15px] leading-relaxed text-gray-400">
							Not sure? Try{" "}
							{tries.map((t, i) => (
								<span key={t.to}>
									{i > 0 && (i === tries.length - 1 ? ", or " : ", ")}
									<Link
										to={t.to}
										replace
										preventScrollReset
										prefetch="intent"
										className={`rounded-sm font-semibold text-gray-100 underline decoration-white/25 decoration-1 underline-offset-4 transition-colors duration-200 hover:text-amber-200 hover:decoration-amber-300/60 ${FOCUS}`}
									>
										{t.label}
									</Link>
								</span>
							))}
							.
						</p>
					)}
				</div>
			</header>
			<div className={`${WRAP} space-y-14`}>
				<section className="space-y-4">
					<SectionHeading>
						{words.length ? `${cap(noun)} for that kind of night` : "Popular right now"}
					</SectionHeading>
					<TunedGrid titles={titles} className={GRID_WIDE} />
				</section>

				<section className="space-y-4">
					<div className="flex items-baseline gap-3">
						<SectionHeading>
							{words.length ? "Moods that fit" : "Four moods to start from"}
						</SectionHeading>
						<Link
							to={to(familyPage(address.kind, "mood"))}
							prefetch="intent"
							className={`ml-auto rounded-sm text-sm font-bold whitespace-nowrap text-gray-300 hover:text-white ${FOCUS}`}
						>
							All moods ›
						</Link>
					</div>
					<div className={PLACE_STRIP}>
						<AnimatePresence initial={false} mode="popLayout">
							{moods.map((m) => (
								<FlipCard key={m.place.slug}>
									<PlaceCard place={m.place} to={m.to} titles={m.titles} line={m.line} />
								</FlipCard>
							))}
						</AnimatePresence>
					</div>
				</section>

				<Onward title="Other ways in" line="Every one of them has dials of its own.">
					<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
						{data.doors.map((door) => (
							<Link
								key={door.family}
								to={door.to}
								prefetch="intent"
								className={`group flex flex-col rounded-2xl bg-[#151b28] p-4 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/25 motion-reduce:transition-none ${FOCUS}`}
							>
								<span className="flex items-center font-display text-lg font-bold tracking-tight text-white">
									{door.label}
									<span
										aria-hidden
										className="ml-auto text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
									>
										›
									</span>
								</span>
								<span className="mt-1 text-sm leading-snug text-gray-400 lg:min-h-[3.75rem]">
									{door.line}
								</span>
								<PosterTrio titles={door.titles} className="mt-3" />
							</Link>
						))}
					</div>
				</Onward>

				<Reveal>
					<PosterRail
						id="best"
						title="The best of all time"
						line="Ranked, with every source's score side by side."
						to={data.bestTo}
						titles={data.best}
					/>
				</Reveal>
			</div>
		</>
	)
}

/** A card that glides when its neighbors change, and fades in or out when it joins or leaves. */
export const FlipCard = forwardRef<HTMLDivElement, { children: ReactNode }>(function FlipCard(
	{ children },
	ref,
) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			ref={ref}
			layout={reduce ? false : "position"}
			initial={reduce ? false : { opacity: 0, scale: 0.94 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: reduce ? 1 : 0.94 }}
			transition={{ ...SPRING, opacity: { duration: 0.18 } }}
			className="flex *:w-full"
		>
			{children}
		</motion.div>
	)
})

// ---------------------------------------------------------------------------------------------------------
// A family: its places, brought forward by the dials

function FamilyView({ data, address }: Props & { data: Of<"family"> }) {
	const tuner = useTuner(data.dials)
	const active = data.dials.filter((d) => tuner.settings[d.id] != null)
	const places = active.length
		? [...data.places].sort((a, b) => {
				const cost = (p: (typeof data.places)[number]) =>
					active.reduce(
						(s, d) => s + Math.abs((p.s[d.col] ?? 0.5) - (tuner.settings[d.id] as number)),
						0,
					)
				return cost(a) - cost(b)
			})
		: data.places
	const noun = kindNoun(address.kind)
	return (
		<>
			<Head d={data} />
			<div className={`${WRAP} space-y-10`}>
				{data.countries && WorldMap && <WorldMap countries={data.countries} variant="page" list />}
				{data.dials.length > 0 && (
					<div className="space-y-2.5">
						<TunerRow dials={data.dials} tuner={tuner} />
						<p className="text-sm text-gray-400">
							{active.length
								? `Nearest to ${tunedLine(data.dials, tuner.settings).toLowerCase()} first.`
								: data.arranged}
						</p>
					</div>
				)}
				{!data.dials.length && data.arranged && !data.countries && (
					<p className="-mt-4 text-sm text-gray-400">{data.arranged}</p>
				)}
				<section className="space-y-4">
					{data.groups && <SectionHeading>Eight to start with</SectionHeading>}
					{data.countries && <SectionHeading>Where most of it comes from</SectionHeading>}
					<div className={PLACE_GRID}>
						{places.map((p) => (
							<FlipItem key={p.place.slug} id={p.place.slug} className="flex *:w-full">
								<PlaceCard
									place={
										p.place.family === "trait" && p.place.adj
											? { ...p.place, label: cap(dialWord(p.place.adj)) }
											: p.place
									}
									to={p.to}
									titles={p.titles}
									line={p.line}
									words={p.words}
								/>
							</FlipItem>
						))}
					</div>
				</section>
				{data.groups && (
					<Onward
						title={`Everything you can turn up or down`}
						line={`Each one is a dial of its own: a touch, plenty, or all the way.`}
					>
						<div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
							{data.groups.map((g) => (
								<div key={g.label}>
									<p className={`flex items-center gap-2 ${CAPTION}`}>
										<span
											aria-hidden
											className="h-2 w-2 rounded-full"
											style={{ background: g.color }}
										/>
										{g.label}
									</p>
									<ul className="mt-2.5 space-y-0.5">
										{g.traits.map((t) => (
											<li key={t.place.slug}>
												<Link
													to={t.to}
													prefetch="intent"
													className={`-mx-2 block rounded-md px-2 py-1 text-[15px] font-semibold text-gray-200 transition-colors hover:bg-white/[0.07] hover:text-white ${FOCUS}`}
												>
													{cap(t.place.adj ?? t.place.label)}
												</Link>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
						<p className="sr-only">{noun}</p>
					</Onward>
				)}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A place

const STEPS: Record<Level, number> = { touch: 1, plenty: 2, full: 3 }

function Evenings({
	trait,
	bands,
	level,
}: {
	trait: TraitWord
	bands: EveningBand[]
	level?: Level
}) {
	return (
		<section
			aria-label={`How ${trait.word}: three evenings`}
			className="grid gap-3 lg:grid-cols-3 lg:gap-4"
		>
			{bands.map((b) => {
				const n = STEPS[b.level]
				const on = level === b.level
				return (
					<div
						key={b.level}
						className={`flex flex-col rounded-2xl p-4 ring-1 transition-shadow duration-200 sm:p-5 ${on ? "ring-white/40" : "ring-white/10"}`}
						style={{
							background: `linear-gradient(180deg, ${wash(trait.color, 6 + n * 9)} 0%, ${wash(trait.color, 2 + n * 3)} 60%, #151b28 100%)`,
						}}
					>
						<p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-gray-300 uppercase">
							<span aria-hidden className="flex items-end gap-[3px]">
								{[1, 2, 3].map((i) => (
									<span
										key={i}
										className="w-[5px] rounded-[2px]"
										style={{
											height: 5 + i * 4,
											background: i <= n ? trait.color : "rgba(255,255,255,.16)",
										}}
									/>
								))}
							</span>
							{b.name}
						</p>
						<h2 className="mt-2 font-display text-2xl leading-tight font-bold tracking-tight text-white">
							{b.headline}
						</h2>
						<p className="mt-1.5 text-[15px] leading-snug text-gray-300 lg:min-h-[4.1em]">
							{b.line}
						</p>
						<div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
							{b.titles.slice(0, 8).map((t) => (
								<Thumb key={t.card.key} title={t} className="w-[22%] lg:w-auto" />
							))}
						</div>
						<Link
							to={`${b.to}#titles`}
							prefetch="intent"
							className={`mt-4 flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${on ? "bg-white text-gray-950" : "bg-white/[0.08] text-white hover:bg-white/[0.16]"} ${FOCUS}`}
						>
							{on ? "Showing these below" : "See all of these"}
							{!on && <span aria-hidden>›</span>}
						</Link>
					</div>
				)
			})}
		</section>
	)
}

function Tokens({ removes }: { removes: { part: PlaceRef; to: string; name: string }[] }) {
	return (
		<ul className="mt-4 flex flex-wrap items-center gap-2">
			{removes.map((r, i) => (
				<li key={`${r.part.family}:${r.part.slug}`} className="flex items-center gap-2">
					{i > 0 && (
						<span aria-hidden className="text-lg font-bold text-gray-600">
							+
						</span>
					)}
					<span className="flex h-9 items-center gap-2 rounded-full bg-white/[0.07] pr-1 pl-3 text-sm font-bold text-white ring-1 ring-white/10">
						<PlaceMark place={r.part} size={14} />
						{r.part.label}
						<Link
							to={r.to}
							prefetch="intent"
							aria-label={`Take ${r.part.label} out`}
							title={`Take ${r.part.label} out`}
							className={`grid h-7 w-7 place-items-center rounded-full text-gray-400 transition-colors hover:bg-white/15 hover:text-white ${FOCUS}`}
						>
							<svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
								<path
									d="M2 2l8 8M10 2l-8 8"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
							</svg>
						</Link>
					</span>
				</li>
			))}
		</ul>
	)
}

function EraAside({ d, noun }: { d: Of<"place">; noun: string }) {
	const era = d.era
	if (!era) return null
	const names = (xs: typeof era.rose) => {
		const seen = new Set<string>()
		return xs
			.filter((x) => !x.place || x.place.family === "genre" || x.place.family === "theme")
			.filter((x) => {
				const k = x.label.toLowerCase()
				if (seen.has(k)) return false
				seen.add(k)
				return true
			})
			.slice(0, 3)
			.map((x) => x.label.toLowerCase())
	}
	const list = (xs: string[]) =>
		xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? "")
	const rose = names(era.rose)
	const fell = names(era.fell)
	return (
		<div className={`${PANEL} p-5`}>
			<p className={CAPTION}>What the {era.label} were about</p>
			<TraitSentence more={era.traits.slice(0, 4)} noun={noun} className="mt-2 !text-xl" />
			{(rose.length > 0 || fell.length > 0) && (
				<p className="mt-3 text-[15px] leading-relaxed text-gray-300">
					{rose.length > 0 && <>More {list(rose)} than the decade before. </>}
					{fell.length > 0 && <>Less {list(fell)}.</>}
				</p>
			)}
		</div>
	)
}

function ServiceAside({ d, noun }: { d: Of<"place">; noun: string }) {
	const s = d.service
	if (!s) return null
	const links = (xs: typeof s.goodAt) =>
		xs.slice(0, 3).map((x, i, all) => (
			<span key={x.place.slug}>
				{i > 0 && (i === all.length - 1 ? " and " : ", ")}
				<span className="font-bold whitespace-nowrap text-white">
					<PlaceMark place={x.place} size={12} /> {x.place.label.toLowerCase()}
				</span>
			</span>
		))
	return (
		<div className={`${PANEL} flex gap-4 p-5`}>
			<PlaceMark place={s.service} size={44} />
			<div className="min-w-0">
				<p className={CAPTION}>What it's good at</p>
				{s.goodAt.length > 0 ? (
					<p className="mt-1.5 text-lg leading-snug text-gray-200">
						Strong on {links(s.goodAt)} {noun}
						{s.thinOn.length > 0 && <>, thin on {links(s.thinOn.slice(0, 1))}</>}.
					</p>
				) : (
					<p className="mt-1.5 text-[15px] text-gray-400">Still reading this country's catalog.</p>
				)}
				<a
					href={s.newTo}
					className={`mt-3 inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.16] ${FOCUS}`}
				>
					What's new on {s.service.label} <span aria-hidden>›</span>
				</a>
			</div>
		</div>
	)
}

function PlaceView({ data, address, to, viewer }: Props & { data: Of<"place"> }) {
	const tuner = useTuner(data.dials)
	const noun = kindNoun(address.kind)
	const family = data.lead.family
	const keep = data.parts.some((p) => p.family === "country")
	const what = inSentence(data.title, keep)
	const steps = useSteps(tuner.settings)
	const titles = tuner.tuned
		? rank(data.pool, data.dials, steps, 24).map((i) => i.t)
		: data.list.titles
	const traitTo = (t: TraitWord) => to(place(address.kind, [t.part]))
	const hasField = !!data.field && data.field.length > 1
	const field = hasField && (
		<Field
			places={data.field as FieldPlace[]}
			here={data.lead.label}
			familyNoun={FAMILY[family].many.toLowerCase()}
		/>
	)
	const mapCountries = data.country?.countries
	const venn = data.blend?.venn && data.parts.length === 2 ? data.blend.venn : null
	const aside = hasField ? (
		<div className="max-lg:hidden">{field}</div>
	) : data.era ? (
		<EraAside d={data} noun={noun} />
	) : data.service ? (
		<ServiceAside d={data} noun={noun} />
	) : mapCountries && WorldMap ? (
		<WorldMap
			countries={mapCountries}
			active={data.country?.code}
			variant="hero"
			className="aspect-[16/10] w-full"
		/>
	) : venn ? (
		<div className={`${PANEL} grid place-items-center p-4`}>
			<VennSwitch
				a={data.parts[0]}
				b={data.parts[1]}
				value={address.venn ?? "both"}
				counts={venn}
				to={(v) => to({ ...address, venn: v, page: undefined })}
			/>
		</div>
	) : data.removes && data.removes.length > 2 ? (
		<div className={`${PANEL} p-5`}>
			<p className={CAPTION}>One ingredient fewer</p>
			<ul className="mt-2 divide-y divide-white/[0.07]">
				{data.removes.map((r) => (
					<li key={`${r.part.family}:${r.part.slug}`}>
						<Link
							to={r.to}
							prefetch="intent"
							className={`group flex items-center gap-2 rounded-md py-2.5 text-[15px] font-bold text-white ${FOCUS}`}
						>
							<span className="min-w-0 flex-1 truncate">{r.name}</span>
							<span className="shrink-0 text-xs font-medium text-gray-500">
								without {r.part.label}
							</span>
							<span
								aria-hidden
								className="text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
							>
								›
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	) : undefined
	const kindOn = data.kinds?.find((k) => k.id === address.kind_)
	const gridRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (window.location.hash === "#titles") gridRef.current?.scrollIntoView({ block: "start" })
	}, [])

	return (
		<>
			<Head
				d={data}
				hue={data.hue}
				more={data.evenings || data.era || data.service ? undefined : data.more}
				less={data.less}
				traitTo={traitTo}
				noun={noun}
				aside={aside}
				asideWide={hasField}
				// In the lab: how a blend starts from this place (slot "blend-entry"). Outside the lab it draws nothing.
				after={<BlendEntry address={address} to={to} />}
			>
				{data.removes && <Tokens removes={data.removes} />}
			</Head>
			<div className={`${WRAP} space-y-14`}>
				{data.evenings && <Evenings {...data.evenings} level={address.level} />}
				{data.print && data.standouts && (
					<PrintBars bars={data.print} standouts={data.standouts} noun={noun} what={what} />
				)}

				{data.kinds && data.kinds.length > 1 && (
					<Onward title={`Kinds of ${low(data.lead.label)}`}>
						<div className={PLACE_STRIP}>
							{data.kinds.map((k) => (
								<Link
									key={k.id}
									to={k.to}
									prefetch="intent"
									className={`group flex flex-col rounded-2xl bg-[#151b28] p-4 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/25 motion-reduce:transition-none ${address.kind_ === k.id ? "!ring-white/50" : ""} ${FOCUS}`}
								>
									<span className="flex items-center font-display text-xl font-bold tracking-tight text-white">
										{k.name}
										<span
											aria-hidden
											className="ml-auto text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
										>
											›
										</span>
									</span>
									<span className="mt-1 text-sm leading-snug text-gray-400 sm:min-h-[2.5rem]">
										{k.traits.slice(0, 2).map((w, i) => (
											<span key={w.key}>
												{i > 0 && " · "}
												<span className="font-semibold" style={{ color: w.color }}>
													{w.word}
												</span>
											</span>
										))}
									</span>
									<PosterTrio titles={k.titles.slice(0, 3)} className="mt-3" />
								</Link>
							))}
						</div>
					</Onward>
				)}

				<section
					id="titles"
					ref={gridRef}
					className="grid scroll-mt-44 items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[21.5rem_minmax(0,1fr)]"
				>
					<div className="lg:sticky" style={{ top: "calc(var(--best-head-top, 4rem) + 1rem)" }}>
						<TunerPanel dials={data.dials} tuner={tuner} />
					</div>
					<div className="min-w-0 space-y-4">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<SectionHeading>
								{tuner.tuned ? "Closest to your dials" : kindOn ? kindOn.name : `All ${what}`}
							</SectionHeading>
							{kindOn && !tuner.tuned && (
								<Link
									to={to({ ...address, kind_: undefined, page: undefined })}
									preventScrollReset
									className={`rounded-sm text-sm font-bold text-gray-300 hover:text-white ${FOCUS}`}
								>
									All {what} ›
								</Link>
							)}
						</div>
						{tuner.tuned && (
							<div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
								<p className="text-[15px] font-semibold text-gray-200">
									{tunedLine(data.dials, tuner.settings)}
								</p>
								<button
									type="button"
									onClick={tuner.reset}
									className={`flex h-9 items-center px-3 text-sm font-bold text-gray-200 hover:text-white ${SHELL} ${FOCUS}`}
								>
									Back to all {what}
								</button>
								{data.hand.discover && (
									<Link
										to={data.hand.discover}
										className={`ml-auto flex h-9 items-center px-3 text-sm font-bold text-gray-200 hover:text-white max-sm:hidden ${SHELL} ${FOCUS}`}
									>
										More filters in Discover
									</Link>
								)}
							</div>
						)}
						{!tuner.tuned && (
							<>
								<div className="max-sm:hidden">
									<ListControls
										address={address}
										to={to}
										viewer={viewer}
										discoverHref={data.list.discoverHref}
									/>
								</div>
								<details className="group/more sm:hidden">
									<summary
										className={`flex h-9 w-fit cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-bold text-gray-200 select-none [&::-webkit-details-marker]:hidden ${SHELL} ${FOCUS}`}
									>
										Sort and filter
										<svg
											viewBox="0 0 20 20"
											className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open/more:rotate-180"
											aria-hidden
										>
											<path
												d="M5 7.5 10 12.5 15 7.5"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</summary>
									<div className="mt-2">
										<ListControls
											address={address}
											to={to}
											viewer={viewer}
											discoverHref={data.list.discoverHref}
										/>
									</div>
								</details>
							</>
						)}
						{titles.length > 0 ? (
							<TunedGrid titles={titles} className={GRID} />
						) : (
							<p className={`${PANEL} p-6 text-gray-300`}>
								{family === "service"
									? "This country's streaming catalog is still loading. Give it a minute."
									: "Nothing here with these switches on."}
							</p>
						)}
						{tuner.tuned ? (
							<p className="pt-1 text-sm text-gray-400">These are the two dozen nearest.</p>
						) : (
							<Pager
								page={data.list.page}
								pages={data.list.pages}
								to={(n) => to({ ...address, page: n })}
							/>
						)}
					</div>
				</section>

				{hasField && <section className="lg:hidden">{field}</section>}

				{data.suggestions && data.suggestions.length > 0 && (
					<Onward
						title={`Goes well with ${data.single ? low(data.lead.label) : "this"}`}
						line="Add one, and its dial joins the others."
					>
						<div className={PLACE_STRIP}>
							{data.suggestions.map((s) => (
								<PlaceCard
									key={`${s.place.family}:${s.place.slug}`}
									place={s.place}
									to={s.to}
									titles={s.titles}
									line={s.name}
								/>
							))}
						</div>
					</Onward>
				)}

				{data.near && data.near.length > 0 && (
					<Onward title={data.nearTitle ?? `Close to ${data.lead.label}`}>
						<div className={PLACE_STRIP}>
							{data.near.map((n) => (
								<PlaceCard
									key={`${n.place.family}:${n.place.slug}`}
									place={n.place}
									to={n.to}
									titles={n.titles}
									line={n.differs ? `${cap(n.differs)}.` : undefined}
								/>
							))}
						</div>
					</Onward>
				)}

				{data.people.length > 0 && (
					<Onward title="The people behind them">
						<PeopleStrip people={data.people} />
					</Onward>
				)}
				{data.awards.length > 0 && (
					<Onward title="Award winners">
						<AwardStrip wins={data.awards} />
					</Onward>
				)}

				<Reveal>
					<BigStats
						className="border-t border-white/10 pt-6"
						items={[
							{
								label: "Ranked",
								value: "The best of these",
								sub: "With every source's score side by side.",
								to: data.hand.bestTo,
							},
							...(data.hand.mapTo
								? [
										{
											label: "Wander",
											value: "See it on the map",
											sub: "Islands of titles, and bridges between them.",
											to: data.hand.mapTo,
										},
									]
								: []),
							...(data.hand.discover
								? [
										{
											label: "Every filter",
											value: "Open in Discover",
											sub: "The same titles, with all the controls.",
											to: data.hand.discover,
										},
									]
								: []),
						]}
					/>
				</Reveal>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Best

export function Pick({ f }: { f: Of<"best">["filters"][number] }) {
	const ref = useRef<HTMLDetailsElement>(null)
	useEffect(() => {
		const away = (e: Event) => {
			if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
		}
		document.addEventListener("pointerdown", away)
		return () => document.removeEventListener("pointerdown", away)
	}, [])
	return (
		<details ref={ref} className="group/pick relative">
			<summary
				className={`flex h-9 cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-bold select-none [&::-webkit-details-marker]:hidden ${SHELL} ${f.value ? "text-white" : "text-gray-300"} ${FOCUS}`}
			>
				<span className="font-medium text-gray-400">{f.label}</span>
				{f.value ?? "Any"}
				<svg
					viewBox="0 0 20 20"
					className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open/pick:rotate-180"
					aria-hidden
				>
					<path
						d="M5 7.5 10 12.5 15 7.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</summary>
			<div className="absolute top-full left-0 z-30 mt-2 grid w-[min(22rem,calc(100vw-2rem))] grid-cols-2 gap-0.5 rounded-xl bg-gray-900 p-2 shadow-2xl shadow-black/60 ring-1 ring-white/15">
				<Link
					to={f.clear}
					preventScrollReset
					onClick={() => ref.current?.removeAttribute("open")}
					className={`col-span-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${f.value ? "text-gray-300 hover:bg-white/10 hover:text-white" : NAV_PILL} ${FOCUS}`}
				>
					Any {f.label.toLowerCase()}
				</Link>
				{f.options.map((o) => (
					<Link
						key={o.label}
						to={o.to}
						preventScrollReset
						onClick={() => ref.current?.removeAttribute("open")}
						className={`truncate rounded-lg px-2.5 py-1.5 text-sm font-semibold ${o.on ? NAV_PILL : "text-gray-200 hover:bg-white/10 hover:text-white"} ${FOCUS}`}
					>
						{o.label}
					</Link>
				))}
			</div>
		</details>
	)
}

function BestView({ data }: Props & { data: Of<"best"> }) {
	const tuner = useTuner(data.dials)
	const active = data.dials.filter((d) => tuner.settings[d.id] != null)
	const norm = (d: DialSpec, x: number) =>
		d.hi > d.lo ? Math.min(1, Math.max(0, (x - d.lo) / (d.hi - d.lo))) : 0.5
	const rows = active.length
		? data.rows
				.map((r, index) => ({
					r,
					cost:
						active.reduce(
							(s, d) =>
								s +
								Math.abs(
									norm(d, data.scores[r.title.card.key]?.[d.col] ?? 0) -
										(tuner.settings[d.id] as number),
								),
							0,
						) +
						(index / data.rows.length) * 0.05,
				}))
				.sort((a, b) => a.cost - b.cost)
				.slice(0, 25)
				.map((x) => x.r)
		: data.rows.slice(0, 50)
	const orderKey = rows.map((r) => r.rank).join("-")
	return (
		<>
			<Head d={data} />
			<div className={`${WRAP} space-y-6`}>
				<div className="flex flex-wrap items-center gap-2">
					<span className={`${CAPTION} mr-1`}>The best of</span>
					{data.filters.map((f) => (
						<Pick key={f.label} f={f} />
					))}
				</div>
				<TunerRow dials={data.dials} tuner={tuner} />
				<p className="text-sm text-gray-400">
					{active.length
						? `The 25 nearest to ${tunedLine(data.dials, tuner.settings).toLowerCase()}. Each keeps its real rank.`
						: data.published
							? "Ranked by the GoodWatch score, which blends every source beside it."
							: "Ranked inside your picks, trusting many ratings over few."}
				</p>
				{rows.length ? (
					<motion.div
						key={orderKey}
						initial={{ opacity: 0.35, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
					>
						<BestTable rows={rows} />
					</motion.div>
				) : (
					<p className={`${PANEL} p-6 text-gray-300`}>
						Nothing ranked for that pick yet. Loosen one of them.
					</p>
				)}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------

export function Page(props: Props) {
	const d = props.data
	if (d.view === "hub") return <Hub {...props} data={d} />
	if (d.view === "family") return <FamilyView {...props} data={d} />
	if (d.view === "best") return <BestView {...props} data={d} />
	return <PlaceView {...props} data={d} />
}

const notes = ({ data }: Props): Note[] => {
	const shared: Note[] = [
		{
			term: "Dial",
			means:
				"A plain question with named stops. Drag the knob, tap a stop or use the arrow keys: the titles re-sort while it moves, and the address takes the stop when you let go. A ringed knob with a dark center is a dial at rest: it asks nothing. A dial with a color wears it at rest too.",
			isNew: true,
		},
	]
	if (data.view === "hub")
		return [
			...shared,
			{
				term: "Two dials",
				means:
					"Light to dark and calm to intense: the two things people say first about the night they want. The posters under them are the titles nearest to where the knobs are.",
				isNew: true,
			},
			{
				term: "Moods that fit",
				means:
					"The four moods nearest to the dials; they swap as you turn. At rest: one mood from each corner.",
			},
			{ term: "Other ways in", means: "One door per family. Each card is one link." },
			{ term: "Best", means: "Its own Explore tab in this concept." },
		]
	if (data.view === "family")
		return [
			...shared,
			{
				term: "Cards that come forward",
				means:
					"The family's places re-order by how near they sit to the dials. At rest they run from the lightest to the darkest.",
				isNew: true,
			},
			...(data.groups
				? [
						{
							term: "Traits",
							means:
								"Every fingerprint attribute that says what a title is like is a place of its own, grouped by fingerprint family (the dot's color).",
						},
					]
				: []),
		]
	if (data.view === "best")
		return [
			...shared,
			{
				term: "Critics or the crowd?",
				means:
					"Moves along the gap between critic scores (Metacritic, RT critics) and audience scores (IMDb, Letterboxd, users). The middle is where everyone agrees.",
				isNew: true,
			},
			{
				term: "The best of ... menus",
				means:
					"Mood, genre, decade and year narrow the ranking; each choice is an address (best cozy movies of 2026).",
			},
			{
				term: "Rank number",
				means: "A title's real rank in the list, also when the dials bring it forward.",
			},
		]
	return [
		...shared,
		{
			term: "The mark on a track",
			means: "Where this place itself sits on that dial.",
			isNew: true,
		},
		{
			term: "Ends of a direction dial",
			means:
				"The place that lies further that way. Push the knob past the end (or tap the name) to travel there.",
			isNew: true,
		},
		...(data.field
			? [
					{
						term: "Where it sits",
						means:
							"The whole family on two directions: left is lighter, right darker; up calmer, down more intense. One cell per place, so nothing overlaps. Brighter names are more alike. Hover for posters.",
						isNew: true,
					},
				]
			: []),
		...(data.print
			? [
					{
						term: "What it's made of",
						means:
							"The fingerprint as bars, grouped by family and sorted tallest first. Bright bars set the genre apart; the pale shape behind is what titles usually have. Point at a bar or its word to light both; click to pin; a pinned bar links to that trait's place.",
						isNew: true,
					},
				]
			: []),
		...(data.evenings
			? [
					{
						term: "Three evenings",
						means:
							"The same trait at a touch, plenty and all the way. More color means more of it.",
						isNew: true,
					},
				]
			: []),
		{
			term: "Trait words",
			means:
				"The colored words under the title: the fingerprint attributes that set the place apart. Each links to that trait's own place.",
		},
		{
			term: "Goes well with",
			means: "One more ingredient makes a blend; its dial joins the others.",
		},
	]
}

export const concept: ConceptModule<DialsData> = {
	id: "dials",
	name: "Dials",
	tagline: "Tune it: intensity and direction are how you move.",
	order: 2,
	Page: Page as never,
	notes: notes as never,
	chrome: (props) => ({ tabs: exploreTabs(props.concept, props.address, { bestTab: true }) }),
	quickLinks: (kind) => [
		{ label: "Hub", address: hub(kind) },
		{ label: "Moods", address: familyPage(kind, "mood") },
		{ label: "Mood", address: place(kind, [ing("mood", "cozy")]) },
		{ label: "Genre", address: place(kind, [ing("genre", "horror")]) },
		{ label: "Traits", address: familyPage(kind, "trait") },
		{ label: "Trait", address: place(kind, [ing("trait", "scare")]) },
		{ label: "Decade", address: place(kind, [ing("decade", "1990s")]) },
		{ label: "Country", address: place(kind, [ing("country", "japan")]) },
		{ label: "Service", address: place(kind, [ing("service", "netflix")]) },
		{ label: "Best", address: best(kind) },
		{ label: "Blend of 2", address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy")]) },
		{
			label: "Blend of 3",
			address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy"), ing("decade", "1990s")]),
		},
	],
}

void LEVELS
void (null as unknown as ShowTitle)

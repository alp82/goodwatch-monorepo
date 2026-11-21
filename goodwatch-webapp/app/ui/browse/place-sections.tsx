// The sections a Browse place page is built from (a service's page today; a decade's and a country's share them):
// the head, a module's heading and its quiet way onward, the essentials, a kind as a card, the places next door, a
// place as a card, and a service's teaser of what just arrived. Each says in its comment what it means to someone
// choosing a thing to watch.
import { CheckIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"
import type { KindLink } from "~/server/browse/streaming-page.server"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { WRAP, poster, wash } from "./base"
import { FOCUS, QUICK_T } from "./motion"
import { PlaceMark } from "./PlaceMark"
import { PosterTrio, ShowMark, isMixed } from "./Posters"

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** A genre's or mood's name inside a sentence: "science fiction", "TV movies". */
export const lower = (label: string) => (label === "TV Movie" ? "TV movies" : label.toLowerCase())

/** A place page's head: a kicker, the title (and what sits next to it), the lede, and whatever the page adds. */
export function PlaceHead({
	kicker,
	title,
	lede,
	hue,
	aside,
	after,
	children,
}: {
	kicker: ReactNode
	title: ReactNode
	lede?: ReactNode
	hue?: string
	aside?: ReactNode
	/** Next to the title: the way to blend one more ingredient in. */
	after?: ReactNode
	children?: ReactNode
}) {
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
			<div className={`${WRAP} pt-6 pb-8 sm:pt-8 sm:pb-10`}>
				<div
					className={`mt-5 grid items-start gap-x-12 gap-y-7 ${aside ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : ""}`}
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
							{kicker}
						</Kicker>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
							<PageTitle className="text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
								{title}
							</PageTitle>
							{after}
						</div>
						{lede && (
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
								{lede}
							</p>
						)}
						{children}
					</div>
					{aside && <div className="min-w-0">{aside}</div>}
				</div>
			</div>
		</header>
	)
}

/** A module's heading. With `to` the heading is the link to the page it previews. */
export function ModuleHead({
	title,
	to,
	line,
	aside,
	id,
}: {
	title: string
	to?: string
	line?: ReactNode
	aside?: ReactNode
	id?: string
}) {
	const head = (
		<>
			<SectionHeading id={id} className={to ? "transition-colors group-hover:text-amber-200" : ""}>
				{title}
				{to && (
					<span
						aria-hidden
						className="ml-1.5 inline-block text-amber-300 transition-transform duration-200 group-hover:translate-x-1"
					>
						›
					</span>
				)}
			</SectionHeading>
			{line && <p className="mt-1 max-w-2xl text-[15px] leading-snug text-gray-400">{line}</p>}
		</>
	)
	return (
		<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
			{to ? (
				<Link to={to} prefetch="intent" className={`group min-w-0 flex-1 rounded-sm ${FOCUS}`}>
					{head}
				</Link>
			) : (
				<div className="min-w-0 flex-1">{head}</div>
			)}
			{aside}
		</div>
	)
}

/** A quiet link onward: "All 19 genres". */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group inline-flex items-center gap-1 rounded-sm text-sm font-bold text-amber-300 transition-colors hover:text-amber-200 ${FOCUS}`}
		>
			{children}
			<span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
				›
			</span>
		</Link>
	)
}

/** The few titles that define a place, each with a sentence from GoodWatch's title analysis. */
export function Essentials({ titles }: { titles: ShowTitle[] }) {
	if (!titles.length) return null
	const mixed = isMixed(titles)
	return (
		<ul className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
			{titles.map((t, i) => (
				<li key={t.card.key} className="relative w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
					<ShowMark title={t} mixed={mixed} />
					<TitlePosterCard card={t.card} posterPriority={i < 5 ? "high" : "lazy"} />
					{t.line && (
						<p
							title={t.line}
							className="mt-2.5 line-clamp-5 text-sm leading-snug text-pretty text-gray-300"
						>
							{t.line}
						</p>
					)}
				</li>
			))}
		</ul>
	)
}

/** A kind inside a place, as a card that is one link to the place's list narrowed to it. */
export function KindCard({ kind, to, on }: { kind: KindLink; to: string; on: boolean }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			aria-current={on ? "true" : undefined}
			className={`group flex flex-col rounded-2xl px-4 pt-3.5 pb-4 ring-1 transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS} ${
				on
					? "bg-amber-400/[0.08] ring-amber-400/50"
					: "bg-white/[0.04] ring-white/10 hover:ring-white/25"
			}`}
		>
			<span className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-white">
					{kind.name}
				</span>
				{on ? (
					<CheckIcon aria-hidden className="h-4 w-4 shrink-0 text-amber-300" />
				) : (
					<span
						aria-hidden
						className="text-lg leading-none text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
					>
						›
					</span>
				)}
			</span>
			<PosterTrio titles={kind.titles.slice(0, 4)} className="mt-3" />
		</Link>
	)
}

/** The places next door as one slim row: the name, and the word that says how it differs. Each cell is one link. */
export function NearRow({ items }: { items: { place: PlaceRef; to: string; differs: string }[] }) {
	return (
		<ul className="grid gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-4">
			{items.map((n) => (
				<li key={`${n.place.family}-${n.place.slug}`} className="flex">
					<Link
						to={n.to}
						prefetch="intent"
						className={`group flex w-full flex-col gap-0.5 bg-[#151b28] px-4 py-3.5 transition-colors hover:bg-[#1c2333] ${FOCUS} focus-visible:ring-inset`}
					>
						<span className="flex items-center gap-2">
							<PlaceMark place={n.place} size={16} />
							<span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-white">
								{n.place.label}
							</span>
							<span
								aria-hidden
								className="text-lg leading-none text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
							>
								›
							</span>
						</span>
						<span className="text-sm text-gray-400">{n.differs}</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * The same cards as one sideways strip on a phone (each most of the screen wide, snapping), and a grid that fills its
 * row from `sm` up: four across, or as many as there are when fewer.
 */
export function placeStrip(n: number) {
	const lg =
		n >= 4 ? "lg:grid-cols-4" : n === 3 ? "lg:grid-cols-3" : n === 2 ? "lg:grid-cols-2" : ""
	const sm = n === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2"
	return `-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] *:w-[78%] *:shrink-0 *:snap-start sm:mx-0 sm:grid ${sm} sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:*:w-auto ${lg}`
}

/**
 * A place as a card that is one link: its mark and name, one short line, and three distinct posters (never tinted).
 * A mood's card carries the mood's hue in its header; other families stay neutral and show their own mark.
 */
export function PlaceCard({
	place,
	to,
	titles,
	line,
}: {
	place: PlaceRef
	to: string
	titles: ShowTitle[]
	line?: string
}) {
	const hue = place.family === "mood" ? place.hue : undefined
	return (
		<Link
			to={to}
			prefetch="intent"
			className="group relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-amber-400 active:translate-y-0 active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
			style={{
				background: hue
					? `linear-gradient(180deg, ${wash(hue, 30)} 0%, ${wash(hue, 9)} 46%, #151b28 100%)`
					: "#151b28",
			}}
		>
			<span className="block px-4 pt-4">
				<span className="flex items-center gap-2">
					<PlaceMark place={place} size={16} />
					<span className="font-display text-xl font-bold tracking-tight text-white">
						{place.label}
					</span>
					<span
						aria-hidden
						className="ml-auto translate-x-0 text-lg text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
					>
						›
					</span>
				</span>
				{line && (
					<span className="mt-1 block text-sm leading-snug text-gray-300 sm:min-h-[2.5rem]">
						{line}
					</span>
				)}
			</span>
			<PosterTrio titles={titles.slice(0, 3)} className="mt-3 px-4 pb-4" />
		</Link>
	)
}

/**
 * A service's way to this week's arrivals, as a full-width row that teases them: the arrivals' posters fanned out on
 * the right, the way in on the left. Without known arrivals it shows the service's newest titles, or its logo.
 */
export function ArrivalsRow({
	href,
	name,
	logo,
	fresh,
	arrivals,
}: {
	href: string
	name: string
	logo?: string | null
	/** "week": this week's arrivals; "newest": no arrivals known, so the service's newest well-known titles. */
	fresh: "week" | "newest"
	arrivals: { key: string; title: string; poster_path: string | null }[]
}) {
	const shown = arrivals.filter((a) => a.poster_path).slice(0, 7)
	const lead = shown.slice(0, 3).map((a) => a.title)
	return (
		<Link
			to={href}
			prefetch="intent"
			className={`group relative flex min-h-[11rem] items-center overflow-hidden rounded-3xl bg-gradient-to-r from-[#1b2233] via-[#161c2a] to-[#121826] ring-1 ring-white/10 hover:ring-white/25 ${QUICK_T} ${FOCUS}`}
		>
			<span className="relative z-10 flex max-w-xl flex-col gap-2 px-6 py-6 sm:px-8">
				<span className="text-xs font-bold tracking-[0.14em] text-amber-300 uppercase">
					{fresh === "week" ? "New this week" : `Fresh on ${name}`}
				</span>
				<span className="font-display text-2xl leading-tight font-bold tracking-tight text-white sm:text-3xl">
					{fresh === "week" ? `What just landed on ${name}` : `What's new on ${name}`}
				</span>
				<span className="text-[15px] text-gray-300">
					{lead.length
						? `${fresh === "week" ? "" : "Lately: "}${lead.join(", ")}${arrivals.length > lead.length ? ", and more." : "."}`
						: "Every title that arrived this week, best first."}
				</span>
				<span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-amber-300 group-hover:text-amber-200">
					{`See what's new on ${name}`}
					<span aria-hidden className={`group-hover:translate-x-0.5 ${QUICK_T}`}>
						›
					</span>
				</span>
			</span>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] sm:block"
			>
				{shown.length > 0 ? (
					shown.map((a, i) => (
						<img
							key={a.key}
							src={poster(a.poster_path ?? "", "w185")}
							alt=""
							loading="lazy"
							decoding="async"
							className="absolute top-1/2 h-40 w-[6.75rem] rounded-lg object-cover shadow-2xl ring-1 shadow-black/60 ring-black/40 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
							style={{
								right: `${1.5 + i * 4.2}rem`,
								zIndex: 10 - i,
								transform: `translateY(-50%) rotate(${(i % 2 ? -1 : 1) * (2 + i)}deg)`,
							}}
						/>
					))
				) : logo ? (
					<img
						src={poster(logo, "w154")}
						alt=""
						className="absolute top-1/2 right-10 h-24 w-24 -translate-y-1/2 rounded-3xl opacity-80 ring-1 ring-white/10"
					/>
				) : null}
				<span className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#171d2b] to-transparent" />
			</span>
		</Link>
	)
}

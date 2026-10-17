// The taste groups (CONTEXT.md; in code still "sides"): the contradiction in the person's taste as the first line, the
// groups picked from poster chips, each as "Fits your taste" next to "Close to your taste" (a place right next to it
// they've barely tried, a step from it, or the way toward another group), then "More of this" on their services and a
// way into Watch next with the group's moods. Members never see a noun for a group, only its name.
// The route says which side opens first (the address's `?side=`).
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react"
import { MOOD_BY_KEY } from "~/domain/moods"
import type {
	PortraitTitle,
	Side,
	SidesView,
} from "~/server/taste-portrait/view"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { FormingNote } from "~/ui/prototype-forming-hint/Forming"
import { TASTE_GROUPS_NAME } from "../taste-groups-name"
import {
	RatedPoster,
	type ServicesFilter,
	ServicesSwitch,
	SuggestionCard,
	type Titles,
	backdropUrl,
	lowerFirst,
	posterUrl,
	titlesOf,
	useServicesFilter,
} from "./parts"

export function SidesOfYou({
	view,
	opening,
	onOpen,
}: {
	view: SidesView
	/** The side to open first; without it the view's own first. */
	opening?: string
	/** A side the person picked. */
	onOpen?: (id: string) => void
}) {
	const [openId, setOpenId] = useState(
		opening ?? view.openFirst ?? view.sides[0]?.id ?? "",
	)
	const open = (id: string) => {
		setOpenId(id)
		onOpen?.(id)
	}
	const side = view.sides.find((s) => s.id === openId) ?? view.sides[0]
	const services = useServicesFilter(view.hasServices)
	const reduceMotion = useReducedMotion()
	if (!side) return null
	// The headline names the two sides least alike, by id.
	const nameOf = (id: string) =>
		view.sides.find((s) => s.id === id)?.name.toLowerCase()
	const first = view.headline && nameOf(view.headline.first)
	const second = view.headline && nameOf(view.headline.second)

	return (
		<>
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
				{first && second && (
					<h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
						You love <span className="text-amber-300">{first}</span>, and just
						as much <span className="text-sky-300">{second}</span>.
					</h1>
				)}
				<p className="mt-3 max-w-2xl text-gray-400">
					What you rate highly, grouped by what it shares, and close to each,
					what you've barely tried.
				</p>
				<SidePicker
					sides={view.sides}
					titles={view.titles}
					openId={side.id}
					onOpen={open}
				/>
				{/* PROTOTYPE (#662): the "may be forming" note. */}
				<FormingNote />
			</section>

			<AnimatePresence mode="wait" initial={false}>
				<motion.section
					key={side.id}
					id={panelId(side.id)}
					role="tabpanel"
					aria-labelledby={tabId(side.id)}
					initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
					className="mx-auto mt-8 max-w-7xl px-4 md:px-8"
				>
					<div className="grid items-stretch gap-3 lg:grid-cols-[1fr_2.5rem_1fr]">
						<Here side={side} titles={view.titles} />
						<div
							className="flex items-center justify-center text-3xl text-gray-500"
							aria-hidden
						>
							<span className="rotate-90 lg:rotate-0">→</span>
						</div>
						{side.edges.length ? (
							<JustPastIt
								side={side}
								sides={view.sides}
								titles={view.titles}
								services={services}
							/>
						) : (
							<div className="flex items-center rounded-2xl border border-dashed border-gray-700 p-8 text-gray-400">
								Nothing you've barely tried is close to {lowerFirst(side.name)}{" "}
								yet.
							</div>
						)}
					</div>
					<SideChips side={side} className="mt-6" />
					{side.moods.length > 0 && (
						<InWatchNext side={side} className="mt-4" />
					)}
					<MoreOfThis
						side={side}
						view={view}
						services={services}
						className="mt-10"
					/>
				</motion.section>
			</AnimatePresence>
		</>
	)
}

const tabId = (sideId: string) => `taste-side-tab-${sideId}`
const panelId = (sideId: string) => `taste-side-panel-${sideId}`

/** The sides as poster chips: a tab list with arrow keys. */
function SidePicker({
	sides,
	titles,
	openId,
	onOpen,
}: {
	sides: Side[]
	titles: Titles
	openId: string
	onOpen: (id: string) => void
}) {
	const refs = useRef<(HTMLButtonElement | null)[]>([])
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
		const last = sides.length - 1
		const next =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? i === last
					? 0
					: i + 1
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? i === 0
						? last
						: i - 1
					: event.key === "Home"
						? 0
						: event.key === "End"
							? last
							: null
		if (next === null) return
		event.preventDefault()
		onOpen(sides[next].id)
		refs.current[next]?.focus()
	}
	return (
		<div
			role="tablist"
			aria-label={TASTE_GROUPS_NAME.title}
			className="-mx-4 mt-8 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
		>
			{sides.map((s, i) => {
				const on = s.id === openId
				const cover = titlesOf(titles, s.here)[0]
				return (
					<button
						key={s.id}
						ref={(el) => {
							refs.current[i] = el
						}}
						id={tabId(s.id)}
						type="button"
						role="tab"
						aria-selected={on}
						aria-controls={on ? panelId(s.id) : undefined}
						tabIndex={on ? 0 : -1}
						onClick={() => onOpen(s.id)}
						onKeyDown={(event) => onKeyDown(event, i)}
						className={`flex w-60 shrink-0 cursor-pointer items-center gap-3 rounded-xl border-2 p-2 pr-4 text-left transition md:w-auto md:flex-1 ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-900/40 hover:border-gray-500 hover:bg-gray-900"}`}
					>
						{cover?.poster && (
							<img
								src={posterUrl(cover, "w185")}
								alt=""
								className="w-10 shrink-0 rounded-md"
							/>
						)}
						<span className="min-w-0">
							<span className="block font-bold leading-tight">{s.name}</span>
						</span>
					</button>
				)
			})}
		</div>
	)
}

function Panel({
	image,
	tone,
	children,
}: {
	image: PortraitTitle | undefined
	tone: "amber" | "sky"
	children: ReactNode
}) {
	return (
		<div
			className={`relative isolate flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-2xl border-2 p-5 md:min-h-[30rem] md:p-7 ${tone === "amber" ? "border-amber-500/40" : "border-sky-400/40"}`}
		>
			{image?.backdrop && (
				<img
					src={backdropUrl(image)}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover"
				/>
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-b from-gray-950/90 via-gray-950/40 to-gray-950/95" />
			{children}
		</div>
	)
}

function Here({ side, titles }: { side: Side; titles: Titles }) {
	return (
		<Panel image={titlesOf(titles, [side.image])[0]} tone="amber">
			<div>
				<p className="text-sm font-semibold text-amber-300">Fits your taste</p>
				<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">
					{side.name}
				</h2>
			</div>
			<div className="mt-6 grid grid-cols-4 gap-2">
				{titlesOf(titles, side.here)
					.slice(0, 4)
					.map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" />
					))}
			</div>
		</Panel>
	)
}

/** An edge's suggestions: on the person's services first, then, if too few, from everywhere, so it never looks empty. */
function edgeSuggestions(
	titles: PortraitTitle[],
	services: ServicesFilter,
	n: number,
) {
	if (!services.onlyMine) return titles.slice(0, n)
	const mine = titles.filter(services.keep)
	const rest = titles.filter((t) => !mine.includes(t))
	return [...mine, ...rest].slice(0, n)
}

function JustPastIt({
	side,
	sides,
	titles,
	services,
}: {
	side: Side
	sides: Side[]
	titles: Titles
	services: ServicesFilter
}) {
	const edges = side.edges
	const [id, setId] = useState(edges[0].id)
	const edge = edges.find((e) => e.id === id) ?? edges[0]
	const picks = edgeSuggestions(titlesOf(titles, edge.suggestions), services, 4)
	const toward = sides.find((s) => s.id === edge.toward)
	return (
		<Panel image={titlesOf(titles, [edge.image])[0]} tone="sky">
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm font-semibold text-sky-300">
						Close to your taste
					</p>
					{edges.length > 1 &&
						edges.map((e) => (
							<button
								key={e.id}
								type="button"
								onClick={() => setId(e.id)}
								aria-pressed={e.id === edge.id}
								className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${e.id === edge.id ? "border-sky-400 bg-sky-900/50 text-sky-100" : "border-white/20 bg-black/30 text-gray-300 hover:border-sky-400/70"}`}
							>
								{e.name}
							</button>
						))}
				</div>
				<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">
					{toward ? (
						<>
							Between {lowerFirst(side.name)} and{" "}
							<span className="text-sky-200">{lowerFirst(toward.name)}</span>
						</>
					) : (
						<>
							{side.name}, <span className="text-sky-200">{edge.tail}</span>
						</>
					)}
				</h2>
				<p className="mt-2 text-gray-200">{edge.why}</p>
			</div>
			{picks.length ? (
				<div className="mt-6 grid grid-cols-4 gap-2">
					{picks.map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
					))}
				</div>
			) : (
				<p className="mt-6 text-sm text-gray-300">
					Nothing from here to suggest yet.
				</p>
			)}
		</Panel>
	)
}

/** The side's moods in Watch next: "Open Heavy + Mind-bending in Watch next". */
function InWatchNext({ side, className }: { side: Side; className: string }) {
	const names = side.moods.map((mood) => MOOD_BY_KEY[mood].name).join(" + ")
	return (
		<Link
			to={`/watch-next?moods=${side.moods.join(",")}`}
			prefetch="intent"
			className={`inline-flex min-h-11 items-center rounded-full border-2 border-amber-600/70 bg-amber-900/30 px-4 text-sm font-semibold text-amber-100 transition hover:border-amber-400 md:min-h-9 ${className}`}
		>
			Open {names} in Watch next
		</Link>
	)
}

/** The attributes that set the side apart. */
function SideChips({ side, className }: { side: Side; className: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-2 md:gap-3 ${className}`}>
			{side.attributes.map((a) => (
				<span
					key={a.key}
					className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-sm"
				>
					<span
						className="h-2.5 w-2.5 rounded-full"
						style={{
							background: getFingerprintMeta(a.key).color.replace(
								/[\d.]+\)$/,
								"1)",
							),
						}}
					/>
					{a.label}
				</span>
			))}
		</div>
	)
}

const MORE_OF_THIS = 6

function MoreOfThis({
	side,
	view,
	services,
	className,
}: {
	side: Side
	view: SidesView
	services: ServicesFilter
	className: string
}) {
	const shown = titlesOf(view.titles, side.moreOfThis)
		.filter(services.keep)
		.slice(0, MORE_OF_THIS)
	return (
		<div className={className}>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<h3 className="text-xl font-bold">More of this</h3>
				<ServicesSwitch filter={services} services={view.services} />
			</div>
			{shown.length ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
					{shown.map((t) => (
						<SuggestionCard key={t.key} t={t} />
					))}
				</div>
			) : (
				<p className="py-6 text-sm text-gray-400">
					{services.onlyMine
						? "Nothing on your services here yet. Switch to Everywhere."
						: "Nothing more to suggest here yet."}
				</p>
			)}
		</div>
	)
}

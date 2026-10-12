// PROTOTYPE - throwaway (#489, prototype C). Variation A, "Day by day": one list, grouped by the day a title was
// found, with a row per title that says its score, its length and its service. It bets on people who come back
// often and want what is new since they last looked. It is the variation the limit hurts most: a day is when
// GoodWatch found the title, so the page says "Found today", never "Arrived today", and only a wanted title says
// its day as a fact.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import {
	FreshNote,
	Logo,
	Nothing,
	type PageProps,
	Pickers,
	PosterImage,
	Score,
	TitleLink,
	VisitorPrompt,
	WantMark,
} from "./bits"
import {
	type Arrival,
	SERVICES,
	dayName,
	groupBy,
	isMember,
	plural,
	runtimeWords,
	wantedOf,
	wantedWords,
} from "./model"

/** How many rows of a day show before the rest folds away. */
const ROWS = 8

function Row({ arrival }: { arrival: Arrival }) {
	const wanted = arrival.want ? wantedWords(arrival) : null
	const facts = [
		arrival.type === "movie" ? "Movie" : "Show",
		String(arrival.year),
		runtimeWords(arrival),
	].filter(Boolean)
	return (
		<li>
			<TitleLink
				arrival={arrival}
				className={`group flex items-center gap-3 rounded-xl p-2 ring-1 hover:bg-white/[0.07] ${wanted ? "bg-amber-400/[0.07] ring-amber-400/30 hover:ring-amber-400/50" : "bg-white/[0.03] ring-white/5 hover:ring-white/20"}`}
			>
				<span className="relative shrink-0">
					<PosterImage
						arrival={arrival}
						size="w92"
						className="h-[66px] w-11 rounded"
					/>
					{wanted && (
						<WantMark className="absolute -left-1.5 -top-1.5 h-6 w-6" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm text-white">{arrival.title}</b>
					<span className="block truncate text-xs text-gray-400">
						{facts.join(" · ")}
					</span>
					{wanted ? (
						<span className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-sky-200">
							<span>
								{wanted.lead} · {wanted.landed}
							</span>
							{wanted.episode && (
								<span className="rounded bg-sky-400 px-1.5 py-px text-[11px] font-black text-black">
									{wanted.episode}
								</span>
							)}
						</span>
					) : (
						<span className="block truncate text-xs text-gray-500">
							On {arrival.services.map((s) => SERVICES[s].name).join(", ")}
						</span>
					)}
				</span>
				<span className="flex shrink-0 items-center gap-1">
					{arrival.services.map((service) => (
						<Logo key={service} service={service} size={24} />
					))}
				</span>
				<Score score={arrival.score} />
				<ChevronRightIcon
					className="hidden h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300 sm:block"
					aria-hidden
				/>
			</TitleLink>
		</li>
	)
}

function Day({ days, arrivals }: { days: number; arrivals: Arrival[] }) {
	const [open, setOpen] = useState(false)
	// A title the member waits for leads its day.
	const ordered = [...arrivals].sort(
		(a, b) => Number(Boolean(b.want)) - Number(Boolean(a.want)),
	)
	const rows = open ? ordered : ordered.slice(0, ROWS)
	const more = ordered.length - rows.length
	return (
		<section
			className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-6"
			data-day={days}
		>
			<div className="flex items-baseline gap-2 md:sticky md:top-20 md:flex-col md:items-start md:gap-0.5 md:self-start">
				<h2 className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
					Found {dayName(days).toLowerCase()}
				</h2>
				<span className="text-xs text-gray-400">
					{plural(arrivals.length, "title")}
				</span>
			</div>
			<div>
				<ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
					{rows.map((arrival) => (
						<Row key={arrival.key} arrival={arrival} />
					))}
				</ul>
				{more > 0 && (
					<button
						type="button"
						onClick={() => setOpen(true)}
						data-more
						className="mt-2 flex h-10 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white"
					>
						{more} more found {dayName(days).toLowerCase()}
					</button>
				)}
			</div>
		</section>
	)
}

export function VariantA(props: PageProps) {
	const { choice, arrivals, seo } = props
	const [only, setOnly] = useState(false)
	const wanted = wantedOf(arrivals)
	const shown = only ? wanted : arrivals
	return (
		<div className="pb-28" data-variant="A">
			<header className={`${WRAP} flex flex-col gap-3 pb-5 pt-6`}>
				<div>
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>
						{seo.heading}
					</h1>
					{!(isMember(choice.viewer) && choice.saved) && (
						<p className="mt-1 text-sm text-gray-400">{seo.line}</p>
					)}
				</div>
				<Pickers {...props} />
			</header>
			<div className={`${WRAP} flex flex-col gap-6`}>
				{wanted.length > 0 && (
					<div
						className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-sky-400/[0.07] px-4 py-3 ring-1 ring-sky-300/20"
						data-wanted-line
					>
						<span
							className="h-2 w-2 shrink-0 rounded-full bg-sky-400"
							aria-hidden
						/>
						<p className="min-w-0 flex-1 text-sm text-sky-100">
							<b className="font-bold text-white">
								{plural(wanted.length, "title")} you wait for landed.
							</b>{" "}
							{wanted
								.slice(0, 3)
								.map((a) => a.title)
								.join(", ")}
							{wanted.length > 3 && ` and ${wanted.length - 3} more`}
						</p>
						<button
							type="button"
							aria-pressed={only}
							onClick={() => setOnly(!only)}
							data-only-wanted
							className={`h-9 cursor-pointer rounded-xl px-3 text-sm font-bold ring-1 ${only ? "bg-white text-black ring-white" : "text-sky-100 ring-sky-300/40 hover:bg-white/10"}`}
						>
							Only these
						</button>
					</div>
				)}
				{arrivals.length === 0 ? (
					<Nothing {...props} />
				) : (
					<>
						{groupBy(shown, (a) => a.days).map(([days, list]) => (
							<Day key={`${days}:${only}`} days={days} arrivals={list} />
						))}
						<FreshNote wanted={wanted.length > 0} />
					</>
				)}
				{choice.viewer === "visitor" && <VisitorPrompt className="max-w-xl" />}
			</div>
		</div>
	)
}

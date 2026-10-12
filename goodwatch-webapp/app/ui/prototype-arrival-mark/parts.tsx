// PROTOTYPE - throwaway. What the four variations of /prototype/arrival-mark add to a page: the mark itself (a tag,
// a ringed logo, a line of words, a dot) and the piece that brings what landed to the top (a shelf, a chip, a sort,
// a row that opens to a dated list).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { Poster, tmdbImage } from "~/ui/my-pages/bits"
import {
	type Mark,
	type MemberKey,
	SERVICES,
	type ServiceKey,
	type VariantKey,
	ageWords,
	capital,
	dayMonth,
	lineOf,
	logoUrl,
	newOn,
	serviceNames,
} from "./model"

export type Sort = "match" | "arrived"

/** Everything a page of the prototype is told. */
export interface Ctx {
	variant: VariantKey
	member: MemberKey
	/** Days since the prototype's start day. */
	day: number
	/** The marks this variation shows today, by title, the latest landing first. */
	marks: Map<string, Mark>
	/** Opening a title. Nothing leaves the page; variation D takes the title's mark away. */
	open: (key: string) => void
	/** Variation B: the chip is on, and the page shows only what landed. */
	only: boolean
	setOnly: (only: boolean) => void
	/** Variation C: the sort of My movies. */
	sort: Sort
	setSort: (sort: Sort) => void
	/** The line the real pages say on the first visit after a landing (#456) is on screen too. */
	firstVisit: boolean
}

/** A click in the prototype opens nothing: it only tells the page which title was meant. */
export const opens = (ctx: Ctx, key: string) => ({
	onClickCapture: (event: { preventDefault: () => void }) => {
		event.preventDefault()
		ctx.open(key)
	},
})

export const Logos = ({
	on,
	className = "h-5 w-5",
	ring = "",
}: { on: ServiceKey[]; className?: string; ring?: string }) => (
	<span className="flex shrink-0 -space-x-1">
		{on.map((service) => (
			<img
				key={service}
				src={logoUrl(service)}
				alt={SERVICES[service].name}
				className={`rounded-md object-cover ${className} ${ring}`}
			/>
		))}
	</span>
)

// ---------------------------------------------------------------------------------------------------------
// The marks

/** A: a tag that names the service, in the outline of the page's tags. `short` says only "New" beside the logo. */
export const TagA = ({ mark, short }: { mark: Mark; short?: boolean }) => (
	<span
		data-mark="tag"
		title={`${newOn(mark)}, ${ageWords(mark.age)}`}
		className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-sky-200 ring-1 ring-inset ring-sky-300/50"
	>
		{short ? (
			<>
				<Logos on={mark.on} className="h-3.5 w-3.5" />
				New
			</>
		) : (
			<span className="truncate">{newOn(mark)}</span>
		)}
	</span>
)

/** B: the service's logo ringed in sky with a "New" tab. Several services are several logos. */
export const StickerB = ({
	mark,
	className = "",
	small,
}: { mark: Mark; className?: string; small?: boolean }) => (
	<span
		data-mark="sticker"
		title={`${newOn(mark)}, ${ageWords(mark.age)}`}
		className={`pointer-events-none flex flex-col items-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] ${className}`}
	>
		<Logos
			on={mark.on}
			className={small ? "h-5 w-5" : "h-8 w-8"}
			ring="ring-2 ring-sky-400"
		/>
		<span
			className={`-mt-1.5 rounded-full bg-sky-400 font-black uppercase leading-none text-black ${small ? "px-1 py-px text-[8px]" : "px-1.5 py-0.5 text-[9px]"}`}
		>
			New
		</span>
		<span className="sr-only">{newOn(mark)}</span>
	</span>
)

/** C: a line of words. Sky while the landing is fresh, grey once it is only a fact about the title. */
export const LineC = ({
	mark,
	className = "",
}: { mark: Mark; className?: string }) => (
	<span
		data-mark={mark.state === "quiet" ? "line-quiet" : "line"}
		className={`${mark.state === "quiet" ? "text-gray-400" : "font-semibold text-sky-200"} ${className}`}
	>
		{lineOf(mark)}
	</span>
)

/** D: the dot of the signal, on the title. */
export const DotD = ({
	mark,
	className = "",
}: { mark: Mark; className?: string }) => (
	<span
		data-mark="dot"
		title={`${newOn(mark)}, ${ageWords(mark.age)}`}
		className={`block h-3 w-3 shrink-0 rounded-full bg-sky-400 ring-2 ring-gray-950 ${className}`}
	>
		<span className="sr-only">{newOn(mark)}</span>
	</span>
)

// ---------------------------------------------------------------------------------------------------------
// A: the shelf

/** A row of what landed, above the list: the poster, the service, and the day. */
export function Shelf({
	ctx,
	kind,
	episodeOf,
}: {
	ctx: Ctx
	kind: "movie" | "show"
	/** A show's new episode, to say both things on its place in the shelf. */
	episodeOf?: (key: string) => string | null
}) {
	const marks = [...ctx.marks.values()].filter((m) => m.title.kind === kind)
	if (!marks.length) return null
	return (
		<section data-shelf aria-label="Recently arrived">
			<h2 className="flex flex-wrap items-baseline gap-x-2">
				<span className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
					Recently arrived
				</span>
				<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
					{marks.length}
				</span>
				<span className="text-xs text-gray-400">
					new on your services, latest first
				</span>
			</h2>
			<ol className="-mx-4 mt-2.5 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
				{marks.map((mark) => {
					const episode = episodeOf?.(mark.title.key)
					return (
						<li key={mark.title.key} className="w-[7.25rem] shrink-0 md:w-36">
							<a
								href="#title"
								{...opens(ctx, mark.title.key)}
								className="group block"
							>
								<span className="relative block">
									<img
										src={tmdbImage(mark.title.poster, "w342")}
										alt=""
										className="aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-sky-300/30 group-hover:ring-sky-300"
									/>
									{episode && (
										<span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-black">
											New episode
										</span>
									)}
								</span>
								<span className="mt-1.5 flex items-center gap-1.5">
									<Logos on={mark.on} className="h-4 w-4" />
									<span className="truncate text-xs font-bold text-sky-200">
										{serviceNames(mark.on)}
									</span>
								</span>
								<span className="block truncate text-sm font-bold text-white">
									{mark.title.title}
								</span>
								<span className="block truncate text-xs text-gray-400">
									{capital(ageWords(mark.age))}
									{episode ? ` · ${episode}` : ""}
								</span>
							</a>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: the chip

/** A chip that narrows the page to what landed. It is not there when nothing did. */
export function Chip({
	ctx,
	kind,
}: { ctx: Ctx; kind: "movie" | "show" | null }) {
	const marks = [...ctx.marks.values()].filter(
		(m) => !kind || m.title.kind === kind,
	)
	if (!marks.length) return null
	const services = [...new Set(marks.flatMap((mark) => mark.on))]
	return (
		<button
			type="button"
			data-chip
			aria-pressed={ctx.only}
			onClick={() => ctx.setOnly(!ctx.only)}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl pl-2 pr-3 text-sm font-bold ring-1 transition-colors ${ctx.only ? "bg-sky-400 text-black ring-sky-400" : "bg-sky-400/10 text-sky-100 ring-sky-300/40 hover:bg-sky-400/20"}`}
		>
			<Logos on={services.slice(0, 3)} className="h-5 w-5" />
			New on your services
			<span
				className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${ctx.only ? "bg-black/15" : "bg-sky-400/20"}`}
			>
				{marks.length}
			</span>
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: the sort

const SORTS: Record<Sort, string> = {
	match: "Best match",
	arrived: "Recently arrived",
}

/**
 * The sort of My movies with one more order (on the Want to See list its first order is "Last added"). A sky dot
 * says that the order has something to show.
 */
export function SortSelect({ ctx, library }: { ctx: Ctx; library?: boolean }) {
	const fresh = [...ctx.marks.values()].some(
		(mark) =>
			(library || mark.title.kind === "movie") && mark.state === "fresh",
	)
	return (
		<label
			data-sort
			className={`relative flex h-9 shrink-0 items-center rounded-xl pl-3 text-sm ring-1 ${ctx.sort === "arrived" ? "bg-sky-400/15 text-sky-100 ring-sky-300/50" : "bg-white/[0.06] text-gray-200 ring-white/10"}`}
		>
			<span className="mr-1.5 text-gray-400">Sort</span>
			<select
				value={ctx.sort}
				onChange={(event) => ctx.setSort(event.target.value as Sort)}
				className="h-full cursor-pointer appearance-none bg-transparent pr-7 font-bold outline-none"
			>
				{Object.entries(SORTS).map(([key, name]) => (
					<option key={key} value={key} className="bg-gray-900 text-gray-100">
						{library && key === "match" ? "Last added" : name}
					</option>
				))}
			</select>
			<ChevronRightIcon
				className="pointer-events-none absolute right-1.5 h-4 w-4 rotate-90 opacity-70"
				aria-hidden
			/>
			{fresh && ctx.sort !== "arrived" && (
				<span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-gray-950" />
			)}
		</label>
	)
}

// ---------------------------------------------------------------------------------------------------------
// D: the log

/**
 * One row that names the latest landing and counts the others, and opens to all of them with the day each landed,
 * after the row of the waiting shows on My shows. Opening a title takes it out of the log.
 */
export function LogRow({
	ctx,
	kind,
	open,
	note,
}: {
	ctx: Ctx
	/** Null lists movies and shows together, as on the Want to See list. */
	kind: "movie" | "show" | null
	open?: boolean
	note?: (key: string) => ReactNode
}) {
	const marks = [...ctx.marks.values()].filter(
		(mark) => !kind || mark.title.kind === kind,
	)
	if (!marks.length) return null
	const [first] = marks
	return (
		<details
			open={open}
			data-log
			className="group/log overflow-hidden rounded-2xl bg-sky-400/[0.07] ring-1 ring-sky-300/20 open:bg-white/[0.03] open:ring-white/10"
		>
			<summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] md:gap-4 md:px-5 [&::-webkit-details-marker]:hidden">
				<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
				<span className="min-w-0 flex-1 text-sm md:flex md:items-baseline md:gap-2">
					<span className="block truncate text-sky-100">
						<b className="font-bold text-white">{first.title.title} </b>
						is new on {serviceNames(first.on)}
					</span>
					{marks.length > 1 && (
						<span className="block truncate text-xs text-gray-400 md:text-sm">
							<span className="hidden md:inline" aria-hidden>
								·{" "}
							</span>
							and {marks.length - 1} more
						</span>
					)}
				</span>
				<span className="hidden shrink-0 text-xs font-black uppercase tracking-[0.18em] text-sky-300/80 lg:inline">
					New on your services
				</span>
				<span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
					{marks.length}
				</span>
				<ChevronRightIcon
					className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open/log:rotate-90"
					aria-hidden
				/>
			</summary>
			<ul className="border-t border-white/10">
				{marks.map((mark) => (
					<li
						key={mark.title.key}
						className="border-t border-white/5 first:border-t-0"
					>
						<a
							href="#title"
							{...opens(ctx, mark.title.key)}
							className="group flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05] md:px-5"
						>
							<Poster
								path={mark.title.poster}
								className="h-[54px] w-9 shrink-0 rounded"
							/>
							<span className="min-w-0 flex-1">
								<b className="block truncate text-sm text-white">
									{mark.title.title}
								</b>
								<span className="flex items-center gap-1.5 text-xs text-gray-400">
									<Logos on={mark.on} className="h-4 w-4" />
									<span className="truncate">
										{serviceNames(mark.on)}
										{note?.(mark.title.key)}
									</span>
								</span>
							</span>
							<span className="w-[92px] shrink-0 text-right md:w-36">
								<b className="block text-sm text-white">
									{mark.age < 7
										? capital(ageWords(mark.age))
										: dayMonth(mark.day)}
								</b>
								<span className="block text-xs text-gray-500">
									{mark.age < 7 ? dayMonth(mark.day) : ageWords(mark.age)}
								</span>
							</span>
							<ChevronRightIcon
								className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
								aria-hidden
							/>
						</a>
					</li>
				))}
			</ul>
		</details>
	)
}

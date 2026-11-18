// One trivia card: a question as the headline, the #1 answer big (the shared poster card or a figure, with its
// number), the runners-up 2 to 5 as a small ranked row that opens into a list, an optional switch between sides, and
// an optional reveal. Every look comes from existing parts: PANEL, Kicker, Pills, the poster card, PosterImg, the
// Stats tab's rank rows.
import { LinkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import type { StatsTitle } from "~/domain/stats/snapshot"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { Kicker } from "~/ui/info-page"
import { DISPLAY } from "~/ui/my-pages/style"
import { PosterImg } from "~/ui/profile/parts"
import { PANEL, Pills } from "~/ui/profile/taste/parts"
import type { SizeRule } from "~/utils/tmdb-image"
import { PrimaryButton } from "~/ui/button/PrimaryButton"

/** One ranked answer. `poster` draws the shared card for #1; without it, the answer is a figure. */
export interface Entry {
	key: string
	name: string
	/** Where the name links; a figure without a page has none. */
	href?: string
	poster?: StatsTitle
	/** The number, formatted. */
	value: string
	/** What the number counts: "IMDb votes". */
	unit?: string
	/** A short line under the name: the year, the show and episode. */
	sub?: string
	/** Extra pieces beside #1: source chips, a score tile. */
	extra?: ReactNode
}

export interface Side {
	key: string
	/** The switch label, when a card has more than one side. */
	label: string
	question: string
	entries: Entry[]
	/** One sentence that says the fact on its own. */
	fact: string
	/** Drawn in place of the runners-up. */
	below?: ReactNode
}

export interface Trivia {
	id: string
	category: string
	sides: Side[]
	/** The answer starts hidden behind a tap. */
	reveal?: boolean
}

const HERO_SIZES: SizeRule[] = [
	["(min-width: 640px)", "136px"],
	[null, "112px"],
]

export function TriviaCard({ t }: { t: Trivia }) {
	const [sideKey, setSide] = useState(t.sides[0].key)
	const [shown, setShown] = useState(false)
	const [open, setOpen] = useState(false)
	const side = t.sides.find((s) => s.key === sideKey) ?? t.sides[0]
	const covered = !!t.reveal && !shown
	const [top, ...rest] = side.entries
	const runners = rest.slice(0, 4)
	return (
		<article
			id={t.id}
			aria-labelledby={`${t.id}-q`}
			className={`${PANEL} relative mb-4 flex scroll-mt-24 break-inside-avoid flex-col gap-4 p-4 sm:p-5`}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Kicker>{t.category}</Kicker>
				<div className="flex items-center gap-2">
					{t.sides.length > 1 && (
						<Pills
							value={sideKey}
							onChange={(v) => {
								setSide(v)
								setOpen(false)
							}}
							options={t.sides.map((s) => ({ value: s.key, label: s.label }))}
							label="Which list"
						/>
					)}
					<a
						href={`#${t.id}`}
						className="flex size-8 items-center justify-center rounded-full text-gray-500 ring-1 ring-white/10 hover:text-white"
						title="Link to this question"
					>
						<LinkIcon className="size-4" aria-hidden />
						<span className="sr-only">Link to this question</span>
					</a>
				</div>
			</div>
			<h3
				id={`${t.id}-q`}
				data-side={side.key}
				className={`${DISPLAY} text-2xl leading-tight text-white sm:text-[1.7rem]`}
			>
				{side.question}
			</h3>
			<div data-answer className="relative">
				<div
					aria-hidden={covered}
					className={`flex flex-col gap-4 transition-opacity duration-300 motion-reduce:transition-none ${covered ? "pointer-events-none opacity-0" : "opacity-100"}`}
				>
					{top && <Answer e={top} />}
					<p className="text-sm text-gray-400">{side.fact}</p>
					{side.below}
					{runners.length > 0 && (
						<Runners entries={runners} open={open} onToggle={() => setOpen((o) => !o)} />
					)}
				</div>
				{covered && (
					<div className="absolute inset-0 flex items-start justify-center pt-10">
						<PrimaryButton
							type="button"
							data-reveal
							onClick={() => setShown(true)}
							className="inline-flex min-h-10 items-center gap-1.5 px-4 text-sm"
						>
							Show the answer
						</PrimaryButton>
					</div>
				)}
			</div>
		</article>
	)
}

/** The #1 answer: its poster big, the number beside it. */
function Answer({ e }: { e: Entry }) {
	return (
		<div className="flex items-start gap-4">
			{e.poster && (
				<div className="w-28 shrink-0 sm:w-[8.5rem]">
					<MovieTvCard
						details={{
							tmdb_id: e.poster.tmdbId,
							title: e.poster.title,
							release_year: e.poster.year,
							poster_path: e.poster.poster,
						}}
						mediaType={e.poster.type}
						posterSizes={HERO_SIZES}
						posterMaxWidth={136}
						href={e.href}
					/>
				</div>
			)}
			<div className="flex min-w-0 flex-col gap-1.5">
				<p className="flex flex-col">
					<span data-figure className="text-4xl font-black text-white tabular-nums sm:text-5xl">
						{e.value}
					</span>
					{e.unit && <span className="text-sm text-gray-400">{e.unit}</span>}
				</p>
				<NameLink e={e} className="text-base font-bold text-white hover:text-amber-300" />
				{e.sub && <span className="-mt-1 text-xs text-gray-500">{e.sub}</span>}
				{e.extra}
			</div>
		</div>
	)
}

function NameLink({ e, className }: { e: Entry; className: string }) {
	if (!e.href) return <span className={className}>{e.name}</span>
	return (
		<Link to={e.href} prefetch="intent" className={className}>
			{e.name}
		</Link>
	)
}

/** Ranks 2 to 5: a row of small posters (or chips), opening into the Stats tab's rank list with names and numbers. */
function Runners({
	entries,
	open,
	onToggle,
}: {
	entries: Entry[]
	open: boolean
	onToggle: () => void
}) {
	const posters = entries.every((e) => e.poster)
	return (
		<div className="border-t border-white/5 pt-3">
			<div className="mb-2 flex items-center justify-between">
				<p className="text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
					Ranks 2–{entries.length + 1}
				</p>
				<button
					type="button"
					aria-expanded={open}
					onClick={onToggle}
					className="text-xs font-semibold text-amber-500 hover:text-amber-400"
				>
					{open ? "Fewer details" : "More details"}
				</button>
			</div>
			{open ? (
				<ol className="flex flex-col divide-y divide-white/5">
					{entries.map((e, i) => (
						<li key={e.key} className="flex items-center gap-3 py-2">
							<span className="w-6 text-sm font-black text-gray-600 tabular-nums">
								{String(i + 2).padStart(2, "0")}
							</span>
							{posters && (
								<span className="block w-7 shrink-0">
									<PosterImg title={{ poster: e.poster?.poster ?? null }} className="rounded-sm" />
								</span>
							)}
							<span className="flex min-w-0 flex-1 flex-col">
								<NameLink
									e={e}
									className="truncate text-sm font-semibold text-gray-200 hover:text-white"
								/>
								{e.sub && <span className="truncate text-[11px] text-gray-500">{e.sub}</span>}
							</span>
							<span className="shrink-0 text-xs text-gray-400 tabular-nums">
								<b className="text-white">{e.value}</b>
							</span>
						</li>
					))}
				</ol>
			) : posters ? (
				<ol className="grid grid-cols-4 gap-2">
					{entries.map((e, i) => (
						<li key={e.key} className="min-w-0">
							<Link to={e.href ?? "#"} prefetch="intent" className="group block" title={e.name}>
								<span className="relative block">
									<PosterImg title={{ poster: e.poster?.poster ?? null }} className="rounded-sm" />
									<span className="absolute top-1 left-1 rounded bg-gray-950/80 px-1 text-[10px] font-black text-amber-300 tabular-nums">
										№ {i + 2}
									</span>
								</span>
								<span className="mt-1 block truncate text-[11px] font-bold text-gray-300 tabular-nums group-hover:text-white">
									{e.value}
								</span>
							</Link>
						</li>
					))}
				</ol>
			) : (
				<ol className="flex flex-wrap gap-1.5">
					{entries.map((e, i) => (
						<li
							key={e.key}
							className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-300 ring-1 ring-white/10"
						>
							<span className="text-gray-500 tabular-nums">{i + 2} </span>
							<NameLink e={e} className="hover:text-white" />{" "}
							<b className="text-white tabular-nums">{e.value}</b>
						</li>
					))}
				</ol>
			)}
		</div>
	)
}

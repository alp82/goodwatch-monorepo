// PROTOTYPE (start page lab, round 2): member c and d's deep dives: round 1 e's doors, each opening its section
// inline under the doors (one at a time) with its filters and "Open page"; Hot is a door only.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import type { LabCard } from "../../lab/types"
import { CHIP, chipTone } from "../hero/shared"
import { DISPLAY, HREF, type Member, PosterGrid, WRAP, interleave, posterSrc } from "../member/shared"

type Open = "continue" | "movies" | "forYou"

type Filter = { key: string; label: string; keep: (c: LabCard) => boolean }

type Dive = {
	key: Open
	label: string
	/** Fixed one-line count, so the doors never change height. */
	line: string
	cards: LabCard[]
	href: string
	page: string
	note: string
	/** Media type and length are filters inside a section, not the page's navigation. */
	filters?: Filter[]
}

const ALL: Filter = { key: "all", label: "All", keep: () => true }

function divesOf(m: Member): Dive[] {
	const forYou = interleave(m.forYou, m.forYouShows)
	return [
		{
			key: "continue",
			label: "Continue watching",
			line: `${m.continueShows.length} ${m.continueShows.length === 1 ? "show" : "shows"}`,
			cards: m.continueShows,
			href: HREF.shows,
			page: "Open My shows",
			note: "The next episode of each show you're watching",
		},
		{
			key: "movies",
			label: "Your movies",
			line: `${m.movies.length} ${m.movies.length === 1 ? "movie" : "movies"}`,
			cards: [...m.movies].sort((a, b) => (b.match ?? 0) - (a.match ?? 0)),
			href: HREF.movies,
			page: "Open My movies",
			note: "Your Wishlist, best taste match first",
			filters: [
				ALL,
				{ key: "short", label: "Under 2 hours", keep: (c) => !!c.runtime && c.runtime < 120 },
				{ key: "long", label: "2 hours or more", keep: (c) => !!c.runtime && c.runtime >= 120 },
			],
		},
		{
			key: "forYou",
			label: "For you",
			line: "Your taste",
			cards: forYou,
			href: HREF.forYou,
			page: "Open For you",
			note: "Movies and shows picked for your taste",
			filters: [
				ALL,
				{ key: "movie", label: "Movies", keep: (c) => c.media_type === "movie" },
				{ key: "show", label: "Shows", keep: (c) => c.media_type === "show" },
			],
		},
	]
}

export function Doors({ m, className = "" }: { m: Member; className?: string }) {
	const dives = divesOf(m)
	const [open, setOpen] = useState<Open | null>(null)
	const [filter, setFilter] = useState("all")
	const cur = dives.find((d) => d.key === open) ?? null
	const f = cur?.filters?.find((x) => x.key === filter) ?? ALL
	const shown = cur ? cur.cards.filter(f.keep) : []

	return (
		<section className={`${WRAP} ${className}`} aria-labelledby="cd-doors">
			<h2 id="cd-doors" className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
				Your lists
			</h2>
			<ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
				{dives.map((d) => (
					<li key={d.key} className="min-w-0">
						<button
							type="button"
							aria-expanded={open === d.key}
							aria-controls="cd-dive"
							onClick={() => {
								setOpen(open === d.key ? null : d.key)
								setFilter("all")
							}}
							className={`flex h-[6.5rem] w-full cursor-pointer flex-col justify-between gap-2 rounded-xl p-3 text-left ring-1 transition-colors sm:p-4 ${open === d.key ? "bg-amber-400/10 ring-amber-400/60" : "bg-white/[0.06] ring-white/5 hover:bg-white/10"}`}
						>
							<span className="flex w-full items-center justify-between gap-2 text-base font-bold text-white">
								<span className="truncate">{d.label}</span>
								<ChevronDownIcon
									aria-hidden
									className={`h-5 w-5 shrink-0 text-amber-400 transition-transform duration-200 ${open === d.key ? "rotate-180" : ""}`}
								/>
							</span>
							<span className="flex items-end justify-between gap-2">
								<span className="line-clamp-1 text-xs text-gray-400">{d.line}</span>
								<Few cards={d.cards} />
							</span>
						</button>
					</li>
				))}
				<li className="min-w-0">
					<Link
						to={HREF.hot}
						prefetch="intent"
						className="flex h-[6.5rem] flex-col justify-between gap-2 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/5 hover:bg-white/10 sm:p-4"
					>
						<span className="flex items-center justify-between gap-2 text-base font-bold text-white">
							<span className="truncate">Hot on socials</span>
							<span aria-hidden className="text-amber-400">
								→
							</span>
						</span>
						<span className="flex items-end justify-between gap-2">
							<span className="line-clamp-1 text-xs text-gray-400">This week</span>
							<Few cards={m.hot.length ? m.hot : m.popular} />
						</span>
					</Link>
				</li>
			</ul>

			<div id="cd-dive">
				<AnimatePresence mode="wait" initial={false}>
					{cur ? (
						<motion.div
							key={cur.key}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: EASE }}
							className="mt-6"
						>
							<div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
								<div className="min-w-0">
									<h3 className={`${DISPLAY} text-2xl leading-tight text-white sm:text-3xl`}>{cur.label}</h3>
									<p className="mt-0.5 text-sm text-gray-400">{cur.note}</p>
								</div>
								<Link
									to={cur.href}
									prefetch="intent"
									className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
								>
									{cur.page} →
								</Link>
							</div>
							{cur.filters ? (
								<div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="Filter">
									{cur.filters.map((x) => (
										<button
											key={x.key}
											type="button"
											aria-pressed={f.key === x.key}
											onClick={() => setFilter(x.key)}
											className={`${CHIP} ${chipTone(f.key === x.key)}`}
										>
											{x.label}
											<span className={`ml-1.5 tabular-nums ${f.key === x.key ? "text-gray-950/60" : "text-gray-500"}`}>
												{cur.cards.filter(x.keep).length}
											</span>
										</button>
									))}
								</div>
							) : null}
							<PosterGrid cards={shown} limit={12} />
							<Link
								to={cur.href}
								prefetch="intent"
								className="mt-6 flex h-12 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-semibold text-gray-200 hover:bg-white/10"
							>
								{cur.page}
							</Link>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</section>
	)
}

function Few({ cards }: { cards: LabCard[] }) {
	const few = cards.filter((c) => c.poster_path).slice(0, 3)
	return (
		<span className="flex shrink-0 -space-x-2">
			{few.map((c) => (
				<img key={c.key} src={posterSrc(c)} alt="" loading="lazy" className="aspect-[2/3] w-7 rounded object-cover ring-2 ring-gray-900 sm:w-8" />
			))}
		</span>
	)
}

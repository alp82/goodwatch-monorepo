// PROTOTYPE (start page lab, round 2): member a + b's deep dives: doors in round 1 e's style, each opening its section
// inline under the doors (one at a time, no navigation), with a Movies/Shows filter where both kinds mix and an
// "Open page" link.
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import type { LabCard } from "../../lab/types"
import { HREF, PosterRow, WRAP, posterSrc, useMember } from "../member/shared"
import { CHIP, chipLook } from "./ab-card"
import type { Candidate } from "./ab-rank"

type DoorKey = "continue" | "wishlist" | "forYou"
type Filter = "all" | "movie" | "show"

type DoorDef = { key: DoorKey; label: string; line: string; cards: LabCard[]; href: (f: Filter) => string; mixed: boolean }

export function DeepDives({ all }: { all: Candidate[] }) {
	const m = useMember()
	const [open, setOpen] = useState<DoorKey | null>(null)
	const [filter, setFilter] = useState<Filter>("all")
	const wishlist = all.filter((c) => c.source === "wishlist").map((c) => c.card)
	const forYou = all.filter((c) => c.source === "forYou").map((c) => c.card)
	const doors: DoorDef[] = [
		{
			key: "continue",
			label: "Continue watching",
			line: `${m.continueShows.length} ${m.continueShows.length === 1 ? "show" : "shows"} with a next episode`,
			cards: m.continueShows,
			href: () => HREF.shows,
			mixed: false,
		},
		{
			key: "wishlist",
			label: "Wishlist",
			line: `${wishlist.length} to start`,
			cards: wishlist,
			href: (f) => (f === "show" ? HREF.shows : HREF.movies),
			mixed: true,
		},
		{ key: "forYou", label: "For you", line: "Picked for your taste", cards: forYou, href: () => HREF.forYou, mixed: true },
	]
	const cur = doors.find((d) => d.key === open) ?? null
	const shown = cur ? (filter === "all" || !cur.mixed ? cur.cards : cur.cards.filter((c) => c.media_type === filter)) : []

	return (
		<nav aria-label="Your lists" className={`${WRAP} mt-8`}>
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Your lists</h2>
			<ul className="grid grid-cols-3 gap-2 sm:gap-3">
				{doors.map((d) => (
					<li key={d.key} className="min-w-0">
						<button
							type="button"
							aria-expanded={open === d.key}
							onClick={() => {
								setOpen(open === d.key ? null : d.key)
								setFilter("all")
							}}
							className={`flex h-full min-h-[6.5rem] w-full cursor-pointer flex-col justify-between gap-2 rounded-xl p-3 text-left ring-1 sm:min-h-[7rem] sm:p-4 ${open === d.key ? "bg-white/10 ring-amber-400/60" : "bg-white/[0.06] ring-white/5 hover:bg-white/10"}`}
						>
							<span className="flex items-start justify-between gap-1 text-sm font-bold leading-tight text-white sm:text-base">
								{d.label}
								<ChevronDownIcon
									aria-hidden
									className={`mt-0.5 h-4 w-4 shrink-0 text-amber-400 transition-transform duration-200 ${open === d.key ? "rotate-180" : ""}`}
								/>
							</span>
							<span className="flex gap-1">
								{d.cards
									.filter((c) => c.poster_path)
									.slice(0, 3)
									.map((c) => (
										<img key={c.key} src={posterSrc(c)} alt="" loading="lazy" className="aspect-[2/3] w-6 rounded object-cover sm:w-8" />
									))}
							</span>
							<span className="line-clamp-1 hidden text-xs text-gray-400 sm:block">{d.line}</span>
						</button>
					</li>
				))}
			</ul>

			<AnimatePresence mode="wait" initial={false}>
				{cur ? (
					<motion.section
						key={cur.key}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18, ease: EASE }}
						className="mt-5"
						aria-label={cur.label}
					>
						<div className="mb-3 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<h3 className="truncate text-lg font-bold text-white sm:text-xl">{cur.label}</h3>
								<p className="truncate text-sm text-gray-400">{cur.line}</p>
							</div>
							<Link to={cur.href(filter)} prefetch="intent" className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300">
								Open page →
							</Link>
						</div>
						{cur.mixed ? (
							<div className="mb-3 flex gap-2" role="group" aria-label="Show">
								{(["all", "movie", "show"] as Filter[]).map((f) => (
									<button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`${CHIP} h-8 ${chipLook(filter === f)}`}>
										{f === "all" ? "All" : f === "movie" ? "Movies" : "Shows"}
									</button>
								))}
							</div>
						) : null}
						<PosterRow cards={shown.slice(0, 20)} />
					</motion.section>
				) : null}
			</AnimatePresence>
		</nav>
	)
}

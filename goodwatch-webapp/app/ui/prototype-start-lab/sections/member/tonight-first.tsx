// PROTOTYPE (start page lab): member c, tonight first: one big pick for tonight (backdrop, title, why, where to
// watch) in the Watch next hero's look, a small room in its corner (the TV plays the intro), then one switch
// between Shows · Movies · For you · Hot, each a single tidy grid with its page's link.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import { titleHref, tmdbImage } from "../../lab/kit"
import { useLab } from "../../lab/types"
import { DISPLAY, HREF, type Member, PosterGrid, WRAP, WatchButton, facts, greeting, interleave, upNext, useMember } from "./shared"

type Tab = "shows" | "movies" | "forYou" | "hot"

function tabsOf(m: Member) {
	return [
		{ key: "shows" as Tab, label: "Shows", n: m.continueShows.length, cards: m.continueShows, href: HREF.shows, link: "All in My shows", note: "Next episodes of the shows you're watching" },
		{ key: "movies" as Tab, label: "Movies", n: m.movies.length, cards: m.movies, href: HREF.movies, link: "All in My movies", note: "Movies on your Wishlist" },
		{ key: "forYou" as Tab, label: "For you", n: 0, cards: interleave(m.forYou, m.forYouShows), href: HREF.forYou, link: "More in For you", note: "Picked for your taste" },
		{ key: "hot" as Tab, label: "Hot", n: 0, cards: m.hot.length ? m.hot : m.popular, href: HREF.hot, link: "Hot on socials", note: "What people talk about this week" },
	]
}

export function TonightFirst() {
	const { Room } = useLab()
	const m = useMember()
	const t = m.tonight
	const tabs = tabsOf(m)
	const [tab, setTab] = useState<Tab>(t?.card.media_type === "movie" ? "movies" : "shows")
	const cur = tabs.find((x) => x.key === tab) ?? tabs[0]

	return (
		<div className="pb-28">
			<section className="relative isolate overflow-hidden" aria-label="Tonight">
				{t?.card.backdrop_path ? (
					<img
						src={tmdbImage(t.card.backdrop_path, "w1280")}
						alt=""
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				) : null}
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-gray-950/10 md:bg-linear-to-r md:from-gray-950 md:via-gray-950/75 md:to-transparent" />
				<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-950 to-transparent" />

				<div className={`${WRAP} relative flex min-h-[30rem] flex-col justify-end pb-8 pt-28 md:min-h-[34rem] md:pt-10`}>
					<p className="text-sm font-semibold text-gray-300">{greeting(m.name)}</p>
					{t ? (
						<div className="max-w-2xl">
							<p className="mt-2 text-sm font-semibold text-amber-300">Tonight · {t.why}</p>
							<Link to={titleHref(t.card)} className="block">
								<h1 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${t.card.title.length > 22 ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl"}`}>
									{t.card.title}
								</h1>
							</Link>
							{t.episode ? <p className="mt-3 text-lg font-semibold text-white">{t.episode}</p> : null}
							{t.card.tagline ? <p className="mt-2 text-base text-gray-200">{t.card.tagline}</p> : null}
							<p className="mt-1 text-sm text-gray-400">{facts(t.card)}</p>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								<WatchButton tonight={t} />
								<Link
									to={HREF.watchNext}
									className="inline-flex h-12 items-center rounded-lg px-4 font-semibold text-gray-200 hover:bg-white/10"
								>
									Something else
								</Link>
							</div>
						</div>
					) : (
						<h1 className={`${DISPLAY} mt-2 text-5xl text-white`}>Nothing picked yet</h1>
					)}
				</div>

				{/* The room touch: a small window onto the room; its TV plays the intro. */}
				<div className="absolute right-4 top-4 h-20 w-32 overflow-hidden rounded-xl shadow-xl shadow-black/50 ring-1 ring-white/15 md:bottom-10 md:right-8 md:top-auto md:h-44 md:w-72">
					<Room className="h-full w-full" zoom={1.6} posters={upNext(m, 12)} portraitBelow={0} />
				</div>
			</section>

			<div className={`${WRAP} mt-4`}>
				<div role="tablist" aria-label="Your lists" className="grid grid-cols-4 rounded-xl bg-white/[0.06] p-1 sm:inline-grid sm:w-auto sm:grid-cols-[repeat(4,auto)]">
					{tabs.map((x) => (
						<button
							key={x.key}
							type="button"
							role="tab"
							aria-selected={tab === x.key}
							onClick={() => setTab(x.key)}
							className={`relative h-10 cursor-pointer rounded-lg px-2 text-sm font-semibold sm:px-5 ${tab === x.key ? "text-black" : "text-gray-300 hover:text-white"}`}
						>
							{tab === x.key ? (
								<motion.span layoutId="member-c-tab" className="absolute inset-0 rounded-lg bg-amber-400" transition={{ duration: 0.25, ease: EASE }} />
							) : null}
							<span className="relative">
								{x.label}
								{x.n ? <span className={`ml-1 tabular-nums ${tab === x.key ? "text-black/60" : "text-gray-500"}`}>{x.n}</span> : null}
							</span>
						</button>
					))}
				</div>

				<AnimatePresence mode="wait" initial={false}>
					<motion.section
						key={cur.key}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: EASE }}
						className="mt-5"
					>
						<div className="mb-4 flex items-baseline justify-between gap-4">
							<p className="text-sm text-gray-400">{cur.note}</p>
							<Link to={cur.href} prefetch="intent" className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300">
								{cur.link} →
							</Link>
						</div>
						<PosterGrid cards={cur.cards} limit={12} />
						<Link
							to={cur.href}
							className="mt-6 flex h-12 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-semibold text-gray-200 hover:bg-white/10"
						>
							{cur.link}
						</Link>
					</motion.section>
				</AnimatePresence>
			</div>
		</div>
	)
}

// PROTOTYPE (start page lab): member b, the room is the start page (bolder): a full room scene whose shelves hold
// what you watch next, tonight's pick sits beside the TV, and a switcher (Next up · For you · Hot) restocks the
// shelves. The same titles repeat as a row under the room, where they're big enough to read.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { titleHref } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import { EASE } from "~/ui/watch-next/style"
import {
	HREF,
	type Member,
	PosterRow,
	SectionHead,
	type Tonight,
	TvAnchor,
	WRAP,
	WatchButton,
	greeting,
	interleave,
	posterSrc,
	upNext,
	useMember,
} from "./shared"

type Tab = "next" | "forYou" | "hot"

const TABS: { key: Tab; label: string }[] = [
	{ key: "next", label: "Next up" },
	{ key: "forYou", label: "For you" },
	{ key: "hot", label: "Hot" },
]

function cardsFor(tab: Tab, m: Member): LabCard[] {
	if (tab === "next") return upNext(m, 12)
	if (tab === "forYou") return interleave(m.forYou, m.forYouShows).slice(0, 12)
	return (m.hot.length ? m.hot : m.popular).slice(0, 12)
}

/** Tonight's pick as a small card beside the TV (desktop) or under it (phone), kept inside the room. */
function PickByTv({ tonight }: { tonight: Tonight }) {
	return (
		<TvAnchor>
			{(tv, box) => {
				const wide = box.w >= 720
				const cw = wide ? 320 : Math.min(box.w - 32, 360)
				const ch = 132
				let left: number
				let top: number
				if (wide) {
					const right = box.w - (tv.left + tv.width)
					left = right >= tv.left ? tv.left + tv.width + 24 : tv.left - cw - 24
					top = tv.top + tv.height / 2 - ch / 2
				} else {
					left = (box.w - cw) / 2
					const below = tv.top + tv.height + 16
					top = below + ch < box.h - 72 ? below : tv.top - ch - 16
				}
				left = Math.max(16, Math.min(box.w - cw - 16, left))
				top = Math.max(16, Math.min(box.h - ch - 72, top))
				return (
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
						className="pointer-events-auto absolute flex gap-3 rounded-xl bg-gray-950/90 p-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/10"
						style={{ left, top, width: cw, height: ch }}
					>
						<Link to={titleHref(tonight.card)} className="block shrink-0">
							<img src={posterSrc(tonight.card)} alt="" className="h-full w-[74px] rounded-md object-cover" />
						</Link>
						<div className="flex min-w-0 flex-1 flex-col">
							<p className="text-xs font-semibold text-amber-300">Tonight · {tonight.why}</p>
							<Link to={titleHref(tonight.card)} className="mt-0.5 truncate text-base font-bold text-white hover:underline">
								{tonight.card.title}
							</Link>
							<p className="truncate text-xs text-gray-400">{tonight.episode ?? (tonight.card.match ? `${tonight.card.match}% taste match` : "")}</p>
							<div className="mt-auto">
								<WatchButton tonight={tonight} small />
							</div>
						</div>
					</motion.div>
				)
			}}
		</TvAnchor>
	)
}

export function RoomStart() {
	const { Room, setShelfTitles } = useLab()
	const m = useMember()
	const [tab, setTab] = useState<Tab>("next")
	const cards = cardsFor(tab, m)
	const sig = cards.map((c) => c.key).join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: restock the shelves when the list changes
	useEffect(() => {
		setShelfTitles(cards)
	}, [sig])

	const head =
		tab === "next"
			? { title: "Next up", note: "Shows you're watching and movies from your Wishlist", href: HREF.watchNext, link: "Watch next" }
			: tab === "forYou"
				? { title: "For you", note: "Picked for your taste", href: HREF.forYou, link: "For you" }
				: { title: "Hot right now", note: "What people talk about this week", href: HREF.hot, link: "Hot on socials" }

	return (
		<div className="pb-28">
			<Room className="h-[calc(100svh-4rem)] min-h-[520px] max-h-[900px] w-full">
				<div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-gray-950/80 to-transparent" />
				<p className={`${WRAP} pointer-events-none absolute inset-x-0 top-0 pt-4 text-sm font-semibold text-white/90`}>{greeting(m.name)}</p>
				{m.tonight ? <PickByTv tonight={m.tonight} /> : null}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-gray-950 to-transparent" />
				<div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
					<div role="tablist" aria-label="What's on the shelves" className="flex rounded-full bg-gray-950/90 p-1 shadow-xl ring-1 ring-white/10">
						{TABS.map((t) => (
							<button
								key={t.key}
								type="button"
								role="tab"
								aria-selected={tab === t.key}
								onClick={() => setTab(t.key)}
								className={`relative h-10 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors sm:px-5 ${tab === t.key ? "text-black" : "text-gray-300 hover:text-white"}`}
							>
								{tab === t.key ? (
									<motion.span layoutId="member-b-tab" className="absolute inset-0 rounded-full bg-amber-400" transition={{ duration: 0.25, ease: EASE }} />
								) : null}
								<span className="relative">{t.label}</span>
							</button>
						))}
					</div>
				</div>
			</Room>

			<div className={`${WRAP} mt-6`}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.section key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
						<SectionHead {...head} />
						<PosterRow cards={cards} />
						{tab === "next" ? (
							<p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
								<Link to={HREF.shows} className="font-semibold text-gray-300 hover:text-white">
									My shows · {m.continueShows.length} to continue
								</Link>
								<Link to={HREF.movies} className="font-semibold text-gray-300 hover:text-white">
									My movies · {m.movies.length} to watch
								</Link>
							</p>
						) : null}
					</motion.section>
				</AnimatePresence>
			</div>
		</div>
	)
}

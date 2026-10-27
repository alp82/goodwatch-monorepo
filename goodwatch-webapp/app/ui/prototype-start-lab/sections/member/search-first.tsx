// PROTOTYPE (start page lab): member d, search first for members too: Discover's search heading on top (answers
// from the fixtures), a slim Continue strip of next episodes and movies right under it, then For you. The room is
// only a thin band at the end, with the TV hint for the intro.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { fixtureSearch } from "../../lab/fixture-search"
import { titleHref } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import {
	HREF,
	PosterGrid,
	SectionHead,
	type ShowCard,
	WRAP,
	episodeCode,
	episodeName,
	interleave,
	posterSrc,
	useMember,
} from "./shared"

function chipsOf(reading: unknown): ReadingChip[] {
	const r = reading as { chips?: unknown; reading?: unknown } | null
	const list = Array.isArray(reading) ? reading : (r?.chips ?? r?.reading)
	return Array.isArray(list) ? (list.filter((c) => c && typeof c === "object" && "kind" in c && "text" in c) as ReadingChip[]) : []
}

/** One slim pill: poster, title, and the next episode (or "Movie"). */
function Pill({ card, line, tonight }: { card: LabCard; line: string; tonight?: boolean }) {
	return (
		<Link
			to={titleHref(card)}
			className={`flex h-16 w-60 shrink-0 snap-start items-center gap-3 rounded-lg p-1.5 pr-3 hover:bg-white/10 ${tonight ? "bg-amber-400/10 ring-1 ring-amber-400/40" : "bg-white/[0.06]"}`}
		>
			<img src={posterSrc(card)} alt="" className="h-full w-[2.25rem] shrink-0 rounded object-cover" />
			<span className="min-w-0">
				<span className="block truncate text-sm font-bold text-white">{card.title}</span>
				<span className={`block truncate text-xs ${tonight ? "text-amber-300" : "text-gray-400"}`}>{line}</span>
			</span>
		</Link>
	)
}

export function SearchFirst() {
	const { data, Room } = useLab()
	const m = useMember()
	const [q, setQ] = useState<string | null>(null)
	const answer = q ? fixtureSearch(data, q) : null
	const chips = answer ? chipsOf(answer.reading) : []

	const strip: { card: LabCard; line: string; tonight?: boolean }[] = []
	const keys = new Set<number>()
	const push = (card: LabCard, line: string, tonight?: boolean) => {
		if (keys.has(card.key)) return
		keys.add(card.key)
		strip.push({ card, line, tonight })
	}
	if (m.tonight) push(m.tonight.card, `Tonight · ${m.tonight.episode ?? m.tonight.why}`, true)
	for (let i = 0; i < 8; i++) {
		const s = m.continueShows[i] as ShowCard | undefined
		if (s) push(s, [episodeCode(s.next) ?? "Next episode", episodeName(s.next)].filter(Boolean).join(" · "))
		const mv = m.movies[i]
		if (mv) push(mv, ["Movie", mv.release_year].filter(Boolean).join(" · "))
	}

	return (
		<div className="pb-28">
			<div className={`${WRAP} pt-6`}>
				<DiscoverHeading
					q={q}
					onSearch={(text) => setQ(text || null)}
					onClear={() => setQ(null)}
					explanation={
						answer ? (
							chips.length ? (
								<div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
									Read as <ReadAsChips reading={chips} />
								</div>
							) : (
								<p className="text-xs text-gray-400">Read as “{answer.answeredAs}”</p>
							)
						) : (
							<p className="text-sm text-gray-400">Search by title, person, mood or anything, like “a cozy mystery for a rainy Sunday”.</p>
						)
					}
				/>
			</div>

			{answer ? (
				<section className={`${WRAP} mt-6`}>
					<SectionHead title="Best matches" href={`${HREF.discover}?q=${encodeURIComponent(answer.q)}`} />
					<PosterGrid cards={answer.titles} limit={12} />
				</section>
			) : null}

			<section className={`${WRAP} mt-8`} aria-labelledby="member-d-continue">
				<div className="mb-2 flex items-baseline justify-between gap-4">
					<h2 id="member-d-continue" className="text-sm font-semibold text-gray-300">
						Continue
					</h2>
					<span className="flex shrink-0 gap-3 text-sm font-semibold">
						<Link to={HREF.shows} className="text-amber-400 hover:text-amber-300">
							My shows
						</Link>
						<Link to={HREF.movies} className="text-amber-400 hover:text-amber-300">
							My movies
						</Link>
					</span>
				</div>
				<ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
					{strip.map((s) => (
						<li key={s.card.key}>
							<Pill {...s} />
						</li>
					))}
				</ul>
			</section>

			{answer ? null : (
				<section className={`${WRAP} mt-10`}>
					<SectionHead title="For you" note="Picked for your taste, movies and shows" href={HREF.forYou} />
					<PosterGrid cards={interleave(m.forYou, m.forYouShows)} limit={18} />
					<p className="mt-6 text-sm text-gray-400">
						Also:{" "}
						<Link to={HREF.hot} className="font-semibold text-amber-400 hover:text-amber-300">
							Hot on socials
						</Link>{" "}
						·{" "}
						<Link to={HREF.discover} className="font-semibold text-amber-400 hover:text-amber-300">
							Discover
						</Link>
					</p>
				</section>
			)}

			<div className="mt-12">
				<Room className="h-40 w-full sm:h-48" zoom={1.3} posters={m.hot.length ? m.hot : m.popular} portraitBelow={0}>
					<div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-gray-950 to-transparent" />
				</Room>
			</div>
		</div>
	)
}

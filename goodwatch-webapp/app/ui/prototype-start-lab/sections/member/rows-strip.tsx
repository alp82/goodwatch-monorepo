// PROTOTYPE (start page lab): member a, rows with a room strip: a short room band whose shelves hold your next
// titles (the TV hint plays the intro), then plain rows: Continue watching, Your movies, For you, Hot right now.
import { Link } from "@remix-run/react"
import { useLab } from "../../lab/types"
import { titleHref } from "../../lab/kit"
import { HREF, HotBoard, PosterRow, SectionHead, WRAP, episodeLine, greeting, interleave, upNext, useMember } from "./shared"

export function RowsStrip() {
	const { Room } = useLab()
	const m = useMember()
	const next = upNext(m, 12)
	const t = m.tonight
	return (
		<div className="pb-28">
			<div className="relative">
				<Room
					className="h-[34vh] min-h-[210px] max-h-[340px] w-full"
					posters={next}
					portraitBelow={0}
				>
					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-gray-950 via-gray-950/60 to-transparent" />
					<div className={`${WRAP} pointer-events-none absolute inset-x-0 bottom-0 pb-4`}>
						<p className="text-sm font-semibold text-amber-300">{greeting(m.name)}</p>
						{t ? (
							<Link to={titleHref(t.card)} className="pointer-events-auto mt-0.5 block max-w-xl">
								<span className="block truncate text-lg font-bold text-white sm:text-2xl">
									Tonight: {t.card.title}
								</span>
								<span className="block truncate text-sm text-gray-300">
									{[t.episode, t.service ? `on ${t.service.name}` : null].filter(Boolean).join(" · ")}
								</span>
							</Link>
						) : null}
					</div>
				</Room>
			</div>

			<div className={`${WRAP} mt-6 space-y-10`}>
				{/* The four places, named once at the top so a member never hunts for them. */}
				<nav aria-label="Your lists" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
					{[
						{ to: HREF.shows, label: "My shows", n: m.continueShows.length },
						{ to: HREF.movies, label: "My movies", n: m.movies.length },
						{ to: HREF.forYou, label: "For you" },
						{ to: HREF.hot, label: "Hot on socials" },
					].map((l) => (
						<Link
							key={l.to}
							to={l.to}
							prefetch="intent"
							className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white/[0.06] px-3.5 text-sm font-semibold text-gray-200 hover:bg-white/10 hover:text-white"
						>
							{l.label}
							{l.n ? <span className="tabular-nums text-gray-400">{l.n}</span> : null}
						</Link>
					))}
				</nav>

				<section>
					<SectionHead
						title="Continue watching"
						note={m.continueShows[0] ? `${m.continueShows[0].title}: ${episodeLine(m.continueShows[0].next) ?? "next episode"}` : undefined}
						href={HREF.shows}
						link="My shows"
					/>
					<PosterRow cards={m.continueShows.slice(0, 16)} />
				</section>

				<section>
					<SectionHead title="Your movies to watch" note="From your Wishlist" href={HREF.movies} link="My movies" />
					<PosterRow cards={m.movies.slice(0, 16)} />
				</section>

				<section>
					<SectionHead title="For you" note="Picked for your taste, movies and shows" href={HREF.forYou} link="For you" />
					<PosterRow cards={interleave(m.forYou, m.forYouShows).slice(0, 18)} />
				</section>
			</div>

			<div className="mt-10">
				{m.talked?.titles.length ? (
					<HotBoard row={m.talked} />
				) : (
					<div className={WRAP}>
						<SectionHead title="Popular right now" href={HREF.discover} link="Discover" />
						<PosterRow cards={m.popular.slice(0, 16)} />
					</div>
				)}
			</div>
		</div>
	)
}


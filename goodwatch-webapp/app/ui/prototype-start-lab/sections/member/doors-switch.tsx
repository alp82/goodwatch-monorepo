// PROTOTYPE (start page lab): member e · "Doors and a Movies | Shows switch": a slim room strip with tonight's pick,
// one Movies | Shows switch that drives Up next and For you, then doors with live previews into the real pages.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import { titleHref } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import { HREF, PosterRow, SectionHead, WRAP, WatchButton, greeting, posterSrc, upNext, useMember } from "./shared"

type Kind = "movie" | "show"

const KINDS: { key: Kind; label: string }[] = [
	{ key: "movie", label: "Movies" },
	{ key: "show", label: "Shows" },
]

export function DoorsSwitch() {
	const { Room } = useLab()
	const m = useMember()
	const t = m.tonight
	const [kind, setKind] = useState<Kind>(t?.card.media_type === "movie" ? "movie" : "show")

	const forYouMovies = m.forYou.filter((c) => c.media_type === "movie")
	const forYouShows = m.forYouShows.length ? m.forYouShows : m.forYou.filter((c) => c.media_type === "show")
	const view =
		kind === "show"
			? {
					upTitle: "Up next",
					upNote: m.continueShows.length ? "Next episodes of the shows you're watching" : undefined,
					up: m.continueShows,
					upHref: HREF.shows,
					upLink: "My shows",
					forYou: forYouShows,
				}
			: {
					upTitle: "Up next",
					upNote: m.movies.length ? "Movies on your Wishlist" : undefined,
					up: m.movies,
					upHref: HREF.movies,
					upLink: "My movies",
					forYou: forYouMovies,
				}

	return (
		<div className="pb-28">
			{/* The living room touch: a slim strip, its TV still plays the intro. */}
			<Room
				className="h-[15vh] min-h-[96px] max-h-[200px] w-full sm:h-[20vh] sm:max-h-[22vh]"
				posters={upNext(m, 12)}
				portraitBelow={0}
			>
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-gray-950 to-transparent" />
			</Room>

			<div className={`${WRAP} relative -mt-10 sm:-mt-14`}>
				<p className="text-sm font-semibold text-amber-300">{greeting(m.name)}</p>
				{t ? (
					<div className="mt-2 flex items-center gap-3 sm:gap-4">
						<Link to={titleHref(t.card)} className="shrink-0">
							<img src={posterSrc(t.card)} alt="" className="aspect-[2/3] w-14 rounded-md object-cover shadow-lg shadow-black/50 ring-1 ring-white/10 sm:w-20" />
						</Link>
						<div className="min-w-0 flex-1">
							<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tonight · {t.why}</p>
							<Link to={titleHref(t.card)} className="block truncate text-lg font-bold text-white sm:text-2xl">
								{t.card.title}
							</Link>
							{t.episode ? <p className="truncate text-sm text-gray-300">{t.episode}</p> : null}
						</div>
						<div className="hidden shrink-0 sm:block">
							<WatchButton tonight={t} small />
						</div>
					</div>
				) : null}
				{t ? (
					<div className="mt-3 sm:hidden">
						<WatchButton tonight={t} small />
					</div>
				) : null}

				<div role="tablist" aria-label="Movies or shows" className="mt-6 grid w-full grid-cols-2 rounded-xl bg-white/[0.06] p-1 sm:w-80">
					{KINDS.map((k) => (
						<button
							key={k.key}
							type="button"
							role="tab"
							aria-selected={kind === k.key}
							onClick={() => setKind(k.key)}
							className={`relative h-11 cursor-pointer rounded-lg text-base font-bold ${kind === k.key ? "text-black" : "text-gray-300 hover:text-white"}`}
						>
							{kind === k.key ? (
								<motion.span layoutId="member-e-kind" className="absolute inset-0 rounded-lg bg-amber-400" transition={{ duration: 0.25, ease: EASE }} />
							) : null}
							<span className="relative">{k.label}</span>
						</button>
					))}
				</div>

				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={kind}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2, ease: EASE }}
						className="mt-6 space-y-8"
					>
						<section>
							<SectionHead title={view.upTitle} note={view.upNote} href={view.upHref} link={view.upLink} />
							<PosterRow cards={view.up.slice(0, 16)} />
						</section>
						<section>
							<SectionHead title="For you" note="Picked for your taste" href={HREF.forYou} link="For you" />
							<PosterRow cards={view.forYou.slice(0, 16)} />
						</section>
					</motion.div>
				</AnimatePresence>

				<nav aria-label="Go to" className="mt-10">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Go to</h2>
					{/* A real build would add a "New on your services" door from tv-loader.server.ts's newOn; the fixtures don't have it. */}
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
						<Door to={HREF.watchNext} label="Tonight" line={t ? t.card.title : "Pick something"} />
						<Door
							to={kind === "show" ? HREF.shows : HREF.movies}
							label={kind === "show" ? "Continue" : "My movies"}
							line={
								kind === "show"
									? `${m.continueShows.length} ${m.continueShows.length === 1 ? "show" : "shows"} with a next episode`
									: `${m.movies.length} on your Wishlist`
							}
							posters={kind === "show" ? m.continueShows : m.movies}
						/>
						<Door to={HREF.forYou} label="For you" posters={view.forYou} line={view.forYou.length ? undefined : "Picked for your taste"} />
						<Door to={HREF.hot} label="Hot on socials" posters={m.hot} line={m.hot.length ? undefined : "What people talk about"} />
						<Door to={`${HREF.discover}?type=${kind}`} label="Discover" line="Search by mood or anything" />
					</ul>
				</nav>
			</div>
		</div>
	)
}

/** A door into a real page: its name and a one-line live preview (a count, or a few small posters). */
function Door({ to, label, line, posters }: { to: string; label: string; line?: string; posters?: LabCard[] }) {
	const few = posters?.filter((c) => c.poster_path).slice(0, 3) ?? []
	return (
		<li className="min-w-0">
			<Link
				to={to}
				prefetch="intent"
				className="flex h-full min-h-[5.5rem] flex-col justify-between gap-2 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/5 hover:bg-white/10 sm:p-4"
			>
				<span className="flex items-center justify-between gap-2 text-base font-bold text-white">
					{label}
					<span aria-hidden className="text-amber-400">
						→
					</span>
				</span>
				{line ? <span className="line-clamp-1 text-xs text-gray-400">{line}</span> : null}
				{!line && few.length ? (
					<span className="flex gap-1">
						{few.map((c) => (
							<img key={c.key} src={posterSrc(c)} alt="" loading="lazy" className="aspect-[2/3] w-7 rounded object-cover sm:w-8" />
						))}
					</span>
				) : null}
			</Link>
		</li>
	)
}

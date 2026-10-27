// PROTOTYPE (start page lab, round 2): browse2 a · Rails: a stack of sideways rails, one per hub (best movies, best shows, new, moods, services, genres), each with "See all".
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import type { BlockVariant } from "../../lab/types"
import { useLab } from "../../lab/types"
import {
	Fan,
	FanStyles,
	HUBS,
	PosterRail,
	Rail,
	SectionHead,
	Stack,
	type Kind,
	genreHref,
	lrbStyle,
	moodHref,
	moodsOf,
	serviceHref,
	serviceLogo,
} from "./kit-hubs"
import { Poster } from "./kit-hubs"

function Rails() {
	const { data } = useLab()
	const b = data.guest.browse
	const moods = moodsOf(data)
	const genres: { kind: Kind; name: string; titles: typeof b.best.movie }[] = [
		...b.genres.movie.map((g) => ({ kind: "movie" as const, ...g })),
		...b.genres.show.map((g) => ({ kind: "show" as const, ...g })),
	].filter((g) => g.titles.length >= 4)

	return (
		<section aria-labelledby="bw2a-h" className="lrb" style={lrbStyle}>
			<FanStyles />
			<div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 md:py-14">
				<p className="lrb-eye">Browse</p>
				<h2 id="bw2a-h" className="mb-8 mt-1 !text-2xl md:!text-3xl">
					Where to start
				</h2>

				<div className="flex flex-col gap-10 md:gap-12">
					{b.best.movie.length > 0 && (
						<div>
							<SectionHead title="Best movies" line="The highest scores, all time" href={HUBS.bestMovies} />
							<PosterRail cards={b.best.movie} label="Best movies" />
						</div>
					)}
					{b.best.show.length > 0 && (
						<div>
							<SectionHead title="Best shows" line="Series worth starting" href={HUBS.bestShows} />
							<PosterRail cards={b.best.show} label="Best shows" />
						</div>
					)}
					{b.newOn.length > 0 && (
						<div>
							<SectionHead title="New on streaming" line="Arrived on the big services this week" href={HUBS.newOn} />
							<PosterRail cards={b.newOn} label="New on streaming" />
						</div>
					)}

					{moods.length > 0 && (
						<div>
							<SectionHead title="By mood" line="Pick the kind of evening" href={HUBS.movieMoods} />
							<Rail label="Moods">
								{moods.map((m) => (
									<li key={m.key} className="w-[11.5rem] shrink-0 snap-start sm:w-[13.5rem]">
										<Link
											to={moodHref(m.key)}
											discover="none"
											className="bw2-tile group relative flex h-full flex-col overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 hover:ring-white/25"
											style={{ "--hue": m.hue } as CSSProperties}
										>
											<span
												aria-hidden
												className="absolute inset-x-0 top-0 h-32"
												style={{ background: `linear-gradient(180deg, ${m.hue}55, transparent)` }}
											/>
											<Fan cards={m.titles} className="mx-auto mt-4 h-[8.5rem] w-[78%] sm:h-[10rem]" />
											<span className="relative mt-3 flex items-center gap-2 px-3 font-bold text-white">
												<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.hue }} />
												{m.name}
											</span>
											<span className="relative line-clamp-2 px-3 pb-3 pt-0.5 text-xs leading-snug text-gray-400">{m.description}</span>
										</Link>
									</li>
								))}
							</Rail>
						</div>
					)}

					{b.services.length > 0 && (
						<div>
							<SectionHead title="Streaming services" line="The top of each service" href={HUBS.showStreaming} />
							<Rail label="Streaming services">
								{b.services.map((s) => (
									<li key={s.id} className="w-[15rem] shrink-0 snap-start sm:w-[17rem]">
										<Link
											to={serviceHref(s.id)}
											discover="none"
											className="bw2-tile flex h-full flex-col gap-3 rounded-xl bg-gray-900 p-3 ring-1 ring-white/10 hover:ring-white/25"
										>
											<span className="flex items-center gap-2.5">
												{s.logo_path ? (
													<img src={serviceLogo(s.logo_path)} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-lg" />
												) : (
													<span className="h-9 w-9 rounded-lg bg-gray-800" />
												)}
												<span className="font-bold text-white">{s.name}</span>
											</span>
											<Stack cards={s.titles} count={4} />
										</Link>
									</li>
								))}
							</Rail>
						</div>
					)}

					{genres.length > 0 && (
						<div>
							<div className="mb-3 flex items-end justify-between gap-4">
								<div className="min-w-0">
									<h3 className="text-lg font-bold leading-tight text-white md:text-xl">Genres</h3>
									<p className="mt-0.5 truncate text-sm text-gray-400">Movies first, then shows</p>
								</div>
								<span className="flex shrink-0 gap-3 text-sm font-semibold">
									<Link to={HUBS.movieGenres} discover="none" className="py-1 text-amber-400 hover:text-amber-300">
										Movies →
									</Link>
									<Link to={HUBS.showGenres} discover="none" className="py-1 text-amber-400 hover:text-amber-300">
										Shows →
									</Link>
								</span>
							</div>
							<Rail label="Genres">
								{genres.map((g) => (
									<li key={`${g.kind}-${g.name}`} className="w-[10rem] shrink-0 snap-start sm:w-[12rem]">
										<Link
											to={genreHref(g.kind, g.name)}
											discover="none"
											className="group relative block overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 hover:ring-white/25"
										>
											<span aria-hidden className="grid grid-cols-2 gap-0.5">
												{g.titles.slice(0, 4).map((t) => (
													<Poster key={t.key} card={t} className="!rounded-none !shadow-none !ring-0" />
												))}
											</span>
											<span aria-hidden className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
											<span className="absolute inset-x-0 bottom-0 p-3">
												<span className="block text-[11px] font-semibold uppercase tracking-widest text-amber-300/90">
													{g.kind === "movie" ? "Movies" : "Shows"}
												</span>
												<span className="block text-base font-bold leading-tight text-white">{g.name}</span>
											</span>
										</Link>
									</li>
								))}
							</Rail>
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

export const variant: BlockVariant = { key: "a", name: "Rails", C: Rails }

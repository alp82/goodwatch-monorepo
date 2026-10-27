// PROTOTYPE (start page lab, round 2): browse2 c · Editorial mix: a different format per section: ranked Top 10, mood mosaic, services with posters, genre cloud, Hot on socials, more links.
import { Link } from "@remix-run/react"
import { type CSSProperties, useState } from "react"
import StartRow from "~/ui/talked-about-now/start-row/StartRow"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { BlockVariant, LabCard } from "../../lab/types"
import { useLab } from "../../lab/types"
import {
	Fan,
	FanStyles,
	HUBS,
	type Kind,
	Poster,
	Rail,
	SectionHead,
	genreHref,
	lrbStyle,
	moodHref,
	moodsOf,
	serviceHref,
	serviceLogo,
} from "./kit-hubs"

/** The ten best, with big outlined rank numbers; Movies and Shows switch in place (same height). */
function TopTen({ movies, shows }: { movies: LabCard[]; shows: LabCard[] }) {
	const [kind, setKind] = useState<Kind>(movies.length ? "movie" : "show")
	const cards = (kind === "movie" ? movies : shows).slice(0, 10)
	const tab = (k: Kind, label: string) => (
		<button
			type="button"
			role="tab"
			aria-selected={kind === k}
			onClick={() => setKind(k)}
			className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${kind === k ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"}`}
		>
			{label}
		</button>
	)
	return (
		<div>
			<SectionHead as="h2" id="bw2c-top" title="Top 10 on GoodWatch" line="The highest scores of all time" href={kind === "movie" ? HUBS.bestMovies : HUBS.bestShows} />
			<div role="tablist" aria-label="Top 10" className="mb-3 inline-flex rounded-full bg-gray-800/80 p-1 ring-1 ring-white/10">
				{movies.length > 0 && tab("movie", "Movies")}
				{shows.length > 0 && tab("show", "Shows")}
			</div>
			<div key={kind} className="bw2c-fade">
				<Rail label={kind === "movie" ? "Top 10 movies" : "Top 10 shows"} gap="gap-1 sm:gap-2">
					{cards.map((card, i) => (
						<li key={card.key} className="flex shrink-0 snap-start items-end">
							<span
								aria-hidden
								className={`relative z-0 select-none font-black leading-[0.78] tabular-nums text-gray-950 ${i === 9 ? "-mr-6 tracking-[-0.12em]" : "-mr-4"} text-[6.5rem] sm:text-[8.5rem] lg:text-[10rem]`}
								style={{ WebkitTextStroke: "2px rgba(251,191,36,.75)" }}
							>
								{i + 1}
							</span>
							<div className="relative z-10 w-[6.75rem] sm:w-[8.5rem] lg:w-[9.5rem]">
								<TitlePosterCard card={card} actions={false} />
							</div>
						</li>
					))}
				</Rail>
			</div>
			{/* Both lists stay one link away for a crawler, whichever tab shows. */}
			<p className="mt-1 text-sm text-gray-400">
				All the best{" "}
				<Link to={HUBS.bestMovies} discover="none" className="font-semibold text-amber-400 hover:text-amber-300">
					movies
				</Link>{" "}
				and{" "}
				<Link to={HUBS.bestShows} discover="none" className="font-semibold text-amber-400 hover:text-amber-300">
					shows
				</Link>
			</p>
		</div>
	)
}

function Editorial() {
	const { data } = useLab()
	const b = data.guest.browse
	const moods = moodsOf(data)
	const genres = (["movie", "show"] as const).map((kind) => ({ kind, rows: b.genres[kind].filter((g) => g.titles.length >= 4) }))
	const SIZES = ["text-xl sm:text-2xl", "text-base sm:text-lg", "text-lg sm:text-xl", "text-base", "text-2xl sm:text-3xl", "text-lg", "text-base sm:text-lg", "text-xl"]

	return (
		<div className="lrb" style={lrbStyle}>
			<FanStyles />
			<style>{`
@keyframes bw2c-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bw2c-fade{animation:bw2c-fade .25s ease-out}
.bw2c-peek{opacity:0;transform:translate(-50%,8px) scale(.94);transition:opacity .2s ease,transform .25s cubic-bezier(.2,.8,.2,1);pointer-events:none}
@media (hover:hover){.bw2c-chip:hover .bw2c-peek,.bw2c-chip:focus-visible .bw2c-peek{opacity:1;transform:translate(-50%,0) scale(1)}}
.bw2c-mood img{transition:transform .5s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.bw2c-mood:hover img{transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){.bw2c-fade{animation:none}.bw2c-peek,.bw2c-mood img{transition:none}}
`}</style>
			<div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-10 sm:px-8 md:gap-16 md:py-14">
				{(b.best.movie.length > 0 || b.best.show.length > 0) && (
					<section aria-labelledby="bw2c-top">
						<TopTen movies={b.best.movie} shows={b.best.show} />
					</section>
				)}

				{moods.length > 0 && (
					<section aria-labelledby="bw2c-moods">
						<SectionHead as="h2" id="bw2c-moods" title="Pick a mood" line="Each one a different kind of evening" href={HUBS.movieMoods} more="All moods" />
						{/* Below lg a two-row mosaic that scrolls sideways; from lg the whole mosaic, the first mood large. */}
						<ul className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[9.5rem] grid-flow-col grid-rows-[8.5rem_8.5rem] gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-7 lg:grid-rows-[10rem_10rem] lg:overflow-visible lg:px-0 lg:pb-0">
							{moods.map((m, i) => {
								const big = i === 0
								return (
									<li key={m.key} className={`snap-start ${big ? "col-span-2 row-span-2" : ""}`}>
										<Link
											to={moodHref(m.key)}
											discover="none"
											className="bw2c-mood relative flex h-full flex-col justify-end overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 hover:ring-white/30"
										>
											<span aria-hidden className={`absolute inset-0 grid ${big ? "grid-cols-3" : "grid-cols-2"} gap-0.5`}>
												{m.titles.slice(0, big ? 3 : 2).map((t) => (
													<Poster key={t.key} card={t} className="!aspect-auto h-full w-full !rounded-none !shadow-none !ring-0" />
												))}
											</span>
											<span
												aria-hidden
												className="absolute inset-0"
												style={{ background: `linear-gradient(180deg, ${m.hue}26 0%, rgba(3,7,18,.55) 45%, rgba(3,7,18,.95) 100%)` }}
											/>
											<span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: m.hue }} />
											<span className="relative p-3">
												<span className={`block font-extrabold leading-tight text-white ${big ? "text-2xl lg:text-3xl" : "text-base"}`}>{m.name}</span>
												{big && <span className="mt-1 line-clamp-2 block text-sm text-gray-300">{m.description}</span>}
											</span>
										</Link>
									</li>
								)
							})}
						</ul>
					</section>
				)}

				{b.services.length > 0 && (
					<section aria-labelledby="bw2c-services">
						<SectionHead as="h2" id="bw2c-services" title="On your services" line="The top three on each" href={HUBS.showStreaming} more="All services" />
						<Rail label="Streaming services" className="lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0 lg:pb-0">
							{b.services.map((s) => (
								<li key={s.id} className="w-[13.5rem] shrink-0 snap-start lg:w-auto">
									<Link
										to={serviceHref(s.id)}
										discover="none"
										className="bw2-tile flex h-full flex-col gap-3 rounded-xl bg-gray-900 p-3 ring-1 ring-white/10 hover:ring-white/25"
									>
										<span className="flex items-center gap-2.5">
											{s.logo_path ? (
												<img src={serviceLogo(s.logo_path)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-lg" />
											) : (
												<span className="h-10 w-10 rounded-lg bg-gray-800" />
											)}
											<span className="min-w-0 truncate font-bold text-white">{s.name}</span>
										</span>
										<span aria-hidden className="grid grid-cols-3 gap-1.5">
											{s.titles.slice(0, 3).map((t, i) => (
												<span key={t.key} className="relative">
													<Poster card={t} />
													<span className="absolute left-1 top-1 rounded bg-gray-950/80 px-1 text-[10px] font-bold text-amber-300">{i + 1}</span>
												</span>
											))}
										</span>
									</Link>
								</li>
							))}
						</Rail>
					</section>
				)}

				{genres.some((g) => g.rows.length) && (
					<section aria-labelledby="bw2c-genres">
						<h2 id="bw2c-genres" className="mb-4 !text-2xl md:!text-3xl">
							Genres
						</h2>
						<div className="grid gap-8 md:grid-cols-2">
							{genres.map(({ kind, rows }) =>
								rows.length ? (
									<div key={kind}>
										<h3 className="mb-3 flex items-baseline justify-between text-sm font-semibold uppercase tracking-widest text-gray-400">
											{kind === "movie" ? "Movies" : "Shows"}
											<Link to={kind === "movie" ? HUBS.movieGenres : HUBS.showGenres} discover="none" className="normal-case tracking-normal text-amber-400 hover:text-amber-300">
												All genres →
											</Link>
										</h3>
										<ul className="flex flex-wrap items-center gap-2.5">
											{rows.map((g, i) => (
												<li key={g.name}>
													<Link
														to={genreHref(kind, g.name)}
														discover="none"
														className={`bw2c-chip bw2-tile relative flex items-center gap-2.5 rounded-full bg-gray-900 py-1.5 pl-1.5 pr-4 font-bold text-white ring-1 ring-white/10 hover:bg-gray-800 hover:ring-white/25 ${SIZES[i % SIZES.length]}`}
													>
														<span aria-hidden className="flex">
															{g.titles.slice(0, 2).map((t, j) => (
																<Poster key={t.key} card={t} className={`!w-7 !rounded-full !aspect-square ${j ? "-ml-3" : ""}`} />
															))}
														</span>
														{g.name}
														<span aria-hidden className="bw2c-peek absolute bottom-[calc(100%+6px)] left-1/2 z-20 hidden w-40 sm:block">
															<Fan cards={g.titles} className="h-36 w-full" />
														</span>
													</Link>
												</li>
											))}
										</ul>
									</div>
								) : null,
							)}
						</div>
					</section>
				)}

				{data.talked && <StartRow row={data.talked} />}

				<nav aria-labelledby="bw2c-more">
					<h2 id="bw2c-more" className="mb-3 !text-lg">
						Explore more
					</h2>
					<ul className="flex flex-wrap gap-2">
						{[
							{ href: HUBS.discover, label: "Discover" },
							{ href: HUBS.newOn, label: "New this week" },
							{ href: HUBS.explorer, label: "Explorer" },
							{ href: HUBS.people, label: "People" },
							{ href: HUBS.showMoods, label: "Shows by mood" },
							{ href: HUBS.movieStreaming, label: "Movies by service" },
						].map((l) => (
							<li key={l.href}>
								<Link
									to={l.href}
									discover="none"
									className="block rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 ring-1 ring-white/10 hover:bg-gray-700"
								>
									{l.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>
			</div>
		</div>
	)
}

export const variant: BlockVariant = { key: "c", name: "Editorial mix", C: Editorial }

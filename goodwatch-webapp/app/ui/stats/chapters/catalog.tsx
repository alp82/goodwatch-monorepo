// Chapter 1, the catalog: fact tiles beside the decade bars, the genre ribbon with original languages, then the
// most-credited faces.
import { useState } from "react"
import { genreColor } from "~/domain/genre-colors"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { pct } from "~/ui/profile/taste/model"
import { languageName } from "~/utils/display-names"
import { count } from "../format"
import { Chapter, FactTile, PANEL, Portraits } from "../parts"

export function Catalog({ s }: { s: StatsSnapshot }) {
	const c = s.catalog
	const decades = s.charts.moviesByDecade
	const busiest = decades.reduce((a, b) => (b.titles > a.titles ? b : a))
	const [picked, setPicked] = useState(busiest.decade)
	const current = decades.find((d) => d.decade === picked)
	const runtime = s.charts.runtimeByDecade.find((d) => d.decade === picked)
	return (
		<Chapter
			id="catalog"
			n={1}
			name="The catalog"
			lead="We track"
			accent={count(c.movies + c.shows)}
			tail="movies and shows."
			sub={`${count(c.movies)} movies and ${count(c.shows)} shows, with ${count(c.seasons)} seasons and ${count(c.episodes)} episodes between them.`}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
					<FactTile label="Episodes" value={count(c.episodes)} />
					<FactTile label="People" value={count(c.people)} />
					<FactTile label="Characters" value={count(c.characters)} />
					<FactTile
						label="Cast and crew credits"
						value={count(c.castCredits + c.crewCredits)}
					/>
					<FactTile label="Posters" value={count(c.posters)} />
					<FactTile label="Trailers" value={count(c.trailers)} />
				</div>
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<p className="mb-1 text-sm font-bold text-gray-200">
						Movies with 1,000 or more IMDb votes, by decade
					</p>
					<p className="mb-4 text-sm text-gray-400" aria-live="polite">
						<b className="text-amber-300 tabular-nums">
							{count(current?.titles ?? 0)}
						</b>{" "}
						from the {picked}s
						{runtime && (
							<>
								, running{" "}
								<b className="text-white tabular-nums">{runtime.minutes} min</b>{" "}
								on average
							</>
						)}
						.
					</p>
					<div
						className="flex h-52 items-stretch gap-1 sm:gap-1.5"
						// biome-ignore lint/a11y/useSemanticElements: buttons in a row, not a form's fieldset
						role="group"
						aria-label="Decades"
						data-decades
					>
						{decades.map((x) => {
							const on = x.decade === picked
							return (
								<button
									key={x.decade}
									type="button"
									onClick={() => setPicked(x.decade)}
									aria-pressed={on}
									aria-label={`${x.decade}s: ${x.titles} movies`}
									className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-amber-400"
								>
									<span
										className={`hidden text-[10px] font-bold tabular-nums sm:block ${on ? "text-amber-300" : "text-gray-400"}`}
									>
										{x.titles >= 1000
											? `${(x.titles / 1000).toFixed(1)}k`
											: x.titles}
									</span>
									<span
										data-bar
										className={`block w-full rounded-t-md transition-colors ${on ? "bg-amber-400" : "bg-gray-500/60 group-hover:bg-gray-400/70"}`}
										style={{
											height: `${Math.max(3, (x.titles / busiest.titles) * 80)}%`,
										}}
									/>
									<span
										className={`text-[10px] font-bold tabular-nums ${on ? "text-white" : "text-gray-500"}`}
									>
										’{String(x.decade).slice(2)}
									</span>
								</button>
							)
						})}
					</div>
				</div>
			</div>
			<GenreStrip s={s} />
			<Portraits
				effect="catalog-faces"
				heading="Most cast credits"
				people={s.people.mostCastCredits.map((p) => ({
					...p,
					line: `${count(p.credits)} credits`,
				}))}
			/>
		</Chapter>
	)
}

/** The Stats tab's genre ribbon, read only, for movies with 1,000+ IMDb votes, plus original languages as chips. */
function GenreStrip({ s }: { s: StatsSnapshot }) {
	const rows = s.charts.genres
	const total = rows.reduce((a, g) => a + g.titles, 0)
	return (
		<div className={`${PANEL} p-4 sm:p-5`}>
			<p className="mb-3 text-sm font-bold text-gray-200">
				Top genres{" "}
				<span className="font-normal text-gray-400">
					· a movie counts for each of its genres
				</span>
			</p>
			<div className="flex h-12 overflow-hidden rounded-lg">
				{rows.map((g) => (
					<span
						key={g.name}
						title={`${g.name}: ${count(g.titles)}`}
						className="flex min-w-0 items-center justify-center text-[11px] font-black text-gray-950 sm:text-xs"
						style={{
							width: `${(g.titles / total) * 100}%`,
							background: genreColor(g.name),
						}}
					>
						<span className="truncate px-1" aria-hidden>
							{g.titles / total > 0.09 ? pct(g.titles / total) : ""}
						</span>
					</span>
				))}
			</div>
			<ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 min-[420px]:grid-cols-2 lg:grid-cols-5">
				{rows.map((g) => (
					<li
						key={g.name}
						className="flex min-w-0 items-center gap-2 px-1 py-1 text-sm"
					>
						<span
							aria-hidden
							className="size-3 shrink-0 rounded-sm"
							style={{ background: genreColor(g.name) }}
						/>
						<span className="min-w-0 flex-1 truncate font-semibold text-gray-200">
							{g.name}
						</span>
						<span className="text-xs text-gray-500 tabular-nums">
							{count(g.titles)}
						</span>
					</li>
				))}
			</ul>
			<p className="mt-4 mb-2 text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
				Original languages, all movies
			</p>
			<ul className="flex flex-wrap gap-1.5">
				{s.charts.languages.map((l) => (
					<li
						key={l.code}
						className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-300 ring-1 ring-white/10"
					>
						{languageName(l.code)}{" "}
						<b className="text-white tabular-nums">{count(l.titles)}</b>
					</li>
				))}
			</ul>
		</div>
	)
}

// PROTOTYPE - throwaway. Chapter 10, "bring your ratings" (round 7, from round 6's imports-into). The owner: "bring
// your rating into the G. nicer use of space (start is good but end has nothing on the left side). we could
// incorporate the streaming of titles here as well. use the actual logos of the services to import from".
//
// The sources stay on the left (four by two), each sends its titles streaming into the G in the middle, and your
// picks come out on the right (three by two): the end frame is balanced. Real logos: the app's own for IMDb, Trakt
// and TMDB; the others are downloaded into public/images/prototype-intro/ for this prototype only (the app shows
// letter tiles for them because of their brand terms, see ui/imports/ImportSources.ts):
// - Letterboxd: https://commons.wikimedia.org/wiki/File:Letterboxd_2023_logo.png
// - Plex: https://commons.wikimedia.org/wiki/File:Plex_logo_2022.svg
// - Kodi: https://commons.wikimedia.org/wiki/File:Kodi-logo-Thumbnail-light-transparent.png
// - MyAnimeList: https://commons.wikimedia.org/wiki/File:MyAnimeList_Logo.png
// - MovieLens: https://movielens.org/images/movielens-logo.svg
import type { CSSProperties } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { ClipProps } from "../../clip"
import { A, DEAL, Headline, Poster, at } from "./kit"

/** The sources, with their real logo and the tile it sits on. */
const SOURCES = [
	{ id: "imdb", name: "IMDb", logo: "/images/import-sources/imdb.svg", bg: "#f5c518", pad: "10%" },
	{ id: "letterboxd", name: "Letterboxd", logo: "/images/prototype-intro/letterboxd.png", bg: "transparent", pad: "0" },
	{ id: "trakt", name: "Trakt", logo: "/images/import-sources/trakt.svg", bg: "#fff", pad: "14%" },
	{ id: "tmdb", name: "TMDB", logo: "/images/import-sources/tmdb.svg", bg: "#0d253f", pad: "14%" },
	{ id: "plex", name: "Plex", logo: "/images/prototype-intro/plex.svg", bg: "#1f1f1f", pad: "16%" },
	{ id: "kodi", name: "Kodi", logo: "/images/prototype-intro/kodi.png", bg: "#fff", pad: "4%" },
	{ id: "myanimelist", name: "MyAnimeList", logo: "/images/prototype-intro/myanimelist.png", bg: "#2e51a2", pad: "0" },
	{ id: "movielens", name: "MovieLens", logo: "/images/prototype-intro/movielens.svg", bg: "#fff", pad: "12%" },
]

/** Where things sit (centres, cqw / cqh). */
const G = { x: 53, y: 58 }
const src = (i: number) => ({ x: 7.5 + (i % 4) * 9.4, y: 47 + Math.floor(i / 4) * 23 })
const pick = (i: number) => ({ x: 72 + (i % 3) * 9.4, y: 47 + Math.floor(i / 3) * 23 })

/** Chapter 10: the sources stream their titles into the G; your picks come out the other side. */
export function ImportsFlow({ data }: ClipProps) {
	const pool = data.pool.slice(1).flatMap((c) => c.poster_path ?? [])
	const picks = pool.slice(0, 6)
	// The titles each source sends: famous ones, not the picks.
	const sent = pool.slice(6)
	return (
		<>
			<div className="lpc-r7track-glow" style={{ left: "18%" }} />
			<div className="lpc-r7track-imp-head">
				<div className="lpc-r7track-kicker lpc-r7track-a" style={at(["lpc-r7track-rise", 100, 700])}>
					Your history
				</div>
				<Headline text="Bring your *ratings* with you." delay={200} className="lpc-r7track-h-mid" />
				<p className="lpc-r7track-line lpc-r7track-a lpc-r7track-imp-line" style={at(["lpc-r7track-rise", 5900, 800])}>
					From IMDb, Letterboxd, Trakt, Plex and more. <b>Your taste is ready on day one.</b>
				</p>
			</div>
			{/* The sources: they stay, so the left keeps its weight to the end. */}
			{SOURCES.map((s, i) => {
				const p = src(i)
				return (
					<div key={s.id} className="lpc-r7track-imp-src lpc-r7track-a" style={{ left: `${p.x}cqw`, top: `${p.y}cqh`, ...at(["lpc-r7track-pop", 600 + i * 110, 650, DEAL]) }}>
						<span className="lpc-r7track-imp-tile" style={{ background: s.bg, padding: s.pad }}>
							<img src={s.logo} alt={s.name} draggable={false} />
						</span>
						<span className="lpc-r7track-imp-name">{s.name}</span>
					</div>
				)
			})}
			{/* Each source's titles stream into the G. */}
			{SOURCES.flatMap((s, i) =>
				[0, 1, 2].map((n) => {
					// From the tile's edge toward the G, so the titles leave the logo instead of covering it.
					const tile = src(i)
					const p = { x: tile.x + 4.6, y: tile.y - 1.5 + n * 1.5 }
					const go = 1900 + i * 160 + n * 420
					return (
						<div
							key={`${s.id}-${n}`}
							className="lpc-r7track-imp-dot lpc-r7track-a"
							style={{
								left: `${p.x}cqw`,
								top: `${p.y}cqh`,
								...at(["lpc-r7track-travel", go, 1200, "cubic-bezier(.45,0,.55,1)"]),
								"--tx": `${G.x - p.x}cqw`,
								"--ty": `${G.y - p.y}cqh`,
							} as CSSProperties}
						>
							<Poster path={sent[(i * 3 + n) % Math.max(1, sent.length)]} size="w92" />
						</div>
					)
				}),
			)}
			<div
				className={`lpc-r7track-g ${A(1, 1)}`}
				style={{ left: `${G.x}cqw`, top: `${G.y}cqh`, ...at(["lpc-r7track-pop", 1400, 800, DEAL], ["lpc-r7track-gulp", 3000, 650, "ease-in-out"], ["lpc-r7track-gulp", 4100, 650, "ease-in-out"]) }}
			>
				<GoodWatchG height="12cqw" />
			</div>
			{/* Your picks come out the other side. */}
			<div className="lpc-r7track-kicker lpc-r7track-imp-picks-label lpc-r7track-a" style={at(["lpc-r7track-rise", 4600, 700])}>
				Picked for you
			</div>
			{picks.map((p, i) => {
				const to = pick(i)
				return (
					<div
						key={p}
						className="lpc-r7track-imp-pick lpc-r7track-a"
						style={{
							left: `${to.x}cqw`,
							top: `${to.y}cqh`,
							...at(["lpc-r7track-from", 4500 + i * 150, 900, DEAL]),
							"--fx": `${G.x - to.x}cqw`,
							"--fy": `${G.y - to.y}cqh`,
							"--fs": "0.2",
						} as CSSProperties}
					>
						<Poster path={p} size="w185" />
					</div>
				)
			})}
		</>
	)
}

/** The clip's length at k = 1: the line lands at 5.9 s and stays readable. */
export const IMPORTS_MS = 8800

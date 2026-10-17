// PROTOTYPE - throwaway. The explainer film's scenes (variant I): a short spot on the TV, timed by CSS from `start`
// (ms after the first paint), so it plays before any script runs.
//
//   0.0 s  Endless scrolling: a streaming app's poster wall drifts, the minutes count up.
//   3.0 s  amber wipe
//   3.3 s  One score: IMDb, Rotten Tomatoes and Metacritic punch in, then merge into the GoodWatch ring.
//   6.3 s  amber wipe
//   6.6 s  How it feels: a real title's picture, its mood words slam in one after another.
//   9.6 s  amber wipe
//   9.9 s  Every service: service logos tile in, one lights up with the title on it.
//  12.9 s  amber wipe
//  13.2 s  Made for your taste: the Explorer's islands drift behind big words; the film fades to the taps under it.
//
// Every scene is in the HTML. Transform and opacity only. Reduced motion: no film (living-room taps show at once).
import { type CSSProperties, useMemo } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { LandingCard } from "~/server/prototype-landing.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { MapArt } from "~/ui/living-room/tv/screens/app-art"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./variants"
import "./film-scenes.css"

/** How long the scenes run, from their start to the end of their hand-over to the taps. */
export const FILM_MS = 16000

/** Scene windows in ms from the film's start: [in, out]. The wipes cover each switch. */
const SCENES = { scroll: [0, 3250], score: [3250, 6550], feel: [6550, 9850], service: [9850, 13150], taste: [13150, FILM_MS] }
const WIPES = [3000, 6300, 9600, 12900]
const MINUTES = [3, 9, 14, 22, 27, 35, 47]

/** An animation delay of `ms` after the film's start. */
const at = (ms: number) => ({ "--at": `${ms}ms` }) as CSSProperties
const scene = ([on, off]: number[]) => ({ "--on": `${on}ms`, "--off": `${off}ms` }) as CSSProperties

const readable = (word: string) => !word.includes("-") && word.split(" ").length <= 2

/** The cards each scene shows: real titles, chosen so each scene has what it needs. */
function useCast(data: VariantProps["data"]) {
	return useMemo(() => {
		const cards = data.landing
		const scored = (c: LandingCard) => c.goodwatch_overall_score_normalized_percent ?? 0
		const score = [...cards].filter((c) => c.poster_path).sort((a, b) => scored(b) - scored(a))[0]
		const feel =
			cards.find((c) => c !== score && c.backdrop_path && c.feels.filter(readable).length >= 3) ??
			cards.find((c) => c.backdrop_path && c.feels.length) ??
			cards[0]
		const streaming = cards.find((c) => c !== score && c !== feel && c.services?.some((s) => s.logo_path)) ?? cards.find((c) => c.services?.some((s) => s.logo_path))
		const lit = streaming?.services?.find((s) => s.logo_path) ?? null
		const logos = new Map<number, { id: number; name: string; logo: string }>()
		if (lit) logos.set(lit.id, { id: lit.id, name: lit.name, logo: lit.logo_path })
		for (const s of [...cards.flatMap((c) => c.services ?? []), ...data.services]) {
			if (s.logo_path && !logos.has(s.id)) logos.set(s.id, { id: s.id, name: s.name, logo: s.logo_path })
		}
		// The lit service sits in the middle of the grid.
		// One tile per brand: the add-on channels ("Prime Video Channels", "… Amazon Channel") and repeats go.
		const brand = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "").replace(/(plus|premium|amazonchannel|channels?|withads|standard)$/g, "")
		const seen = new Set<string>()
		const grid = [...logos.values()]
			.filter((s) => !/channel/i.test(s.name) || s.id === lit?.id)
			.filter((s) => {
				const b = brand(s.name)
				if (seen.has(b)) return false
				seen.add(b)
				return true
			})
			.slice(0, 6)
		if (grid.length > 2) {
			const mid = Math.min(3, grid.length - 1)
			;[grid[0], grid[mid]] = [grid[mid], grid[0]]
		}
		const posters = [...new Set([...data.startTitles.flatMap((t) => t.poster_path ?? []), ...cards.flatMap((c) => c.poster_path ?? [])])]
		const words = (feel?.feels.filter(readable).length ? feel.feels.filter(readable) : (feel?.feels ?? [])).slice(0, 3)
		return { score, feel, words, streaming, lit, grid, posters }
	}, [data])
}

export function FilmScenes({ data, start }: { data: VariantProps["data"]; start: number }) {
	const { score, feel, words, streaming, lit, grid, posters } = useCast(data)
	const rows = [0, 1, 2, 3]
	return (
		<div className="lpfs" style={{ "--s": `${start}ms`, "--end": `${FILM_MS - 700}ms` } as CSSProperties} aria-label="What GoodWatch does">
			{/* 1. Endless scrolling. */}
			<section className="lpfs-scene lpfs-scroll" style={scene(SCENES.scroll)}>
				<div className="lpfs-wall" aria-hidden="true">
					{rows.map((i) => {
						const strip = rotate(posters, i * 4)
						return (
							<div key={i} className={`lpfs-strip ${i % 2 ? "lpfs-back" : ""}`} style={{ animationDuration: `${9 + i * 2}s` }}>
								{[...strip, ...strip].map((p, j) => (
									<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" />
								))}
							</div>
						)
					})}
				</div>
				<div className="lpfs-dim" />
				<h2 className="lpfs-big lpfs-center">
					<span className="lpfs-word" style={at(250)}>
						Endless
					</span>{" "}
					<span className="lpfs-word" style={at(500)}>
						scrolling.
					</span>
				</h2>
				<div className="lpfs-counter" style={at(700)}>
					<span className="lpfs-count">
						<span className="lpfs-count-col" style={at(700)}>
							{MINUTES.map((m) => (
								<span key={m}>{m} min</span>
							))}
						</span>
					</span>{" "}
					and still nothing to watch
				</div>
			</section>

			{/* 2. One score. */}
			{score && (
				<section className="lpfs-scene lpfs-score" style={scene(SCENES.score)}>
					<h2 className="lpfs-big lpfs-top">
						<span className="lpfs-word" style={at(3350)}>
							One
						</span>{" "}
						<span className="lpfs-word lpfs-amber" style={at(3500)}>
							score.
						</span>
					</h2>
					<div className="lpfs-logos" aria-label="IMDb, Rotten Tomatoes and Metacritic">
						<img className="lpfs-src lpfs-src-1" src={imdbLogo} alt="IMDb" style={at(3650)} />
						<img className="lpfs-src lpfs-src-2" src={rottenLogo} alt="Rotten Tomatoes" style={at(3800)} />
						<img className="lpfs-src lpfs-src-3" src={metacriticLogo} alt="Metacritic" style={at(3950)} />
					</div>
					<div className="lpfs-ringrow" style={at(5000)}>
						<img className="lpfs-poster" src={tmdbImageUrl(score.poster_path as string, "w342")} alt="" />
						<div className="lpfs-ring">
							<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: score.goodwatch_overall_score_normalized_percent } } as never} size={150} label={false} />
						</div>
						<div className="lpfs-ringtext">
							<div className="lpfs-mid">{score.title}</div>
							<div className="lpfs-small">Critics and audiences, in one number.</div>
						</div>
					</div>
				</section>
			)}

			{/* 3. How it feels. */}
			{feel && (
				<section className="lpfs-scene lpfs-feel" style={scene(SCENES.feel)}>
					{feel.backdrop_path && <img className="lpfs-art" src={tmdbImageUrl(feel.backdrop_path, "w1280")} alt="" style={at(6550)} />}
					<div className="lpfs-shade" />
					<div className="lpfs-feel-text">
						<h2 className="lpfs-kicker" style={at(6700)}>
							How it feels
						</h2>
						{words.map((w, i) => (
							<div key={w} className={`lpfs-big lpfs-slam ${i === words.length - 1 ? "lpfs-amber" : ""}`} style={at(7000 + i * 600)}>
								{w}.
							</div>
						))}
						<div className="lpfs-small lpfs-caption" style={at(8500)}>
							{feel.title}, read from the story itself.
						</div>
					</div>
				</section>
			)}

			{/* 4. Every service. */}
			<section className="lpfs-scene lpfs-service" style={scene(SCENES.service)}>
				<h2 className="lpfs-big lpfs-top">
					<span className="lpfs-word" style={at(9950)}>
						Every
					</span>{" "}
					<span className="lpfs-word" style={at(10100)}>
						service.
					</span>
				</h2>
				<div className="lpfs-grid">
					{grid.map((s, i) => (
						<img
							key={s.id}
							className={`lpfs-tile ${lit && s.id === lit.id ? "lpfs-lit" : "lpfs-unlit"}`}
							src={tmdbImageUrl(s.logo, "w154")}
							alt={s.name}
							style={{ ...at(10250 + i * 90), "--lit": "11500ms" } as CSSProperties}
						/>
					))}
				</div>
				{streaming && lit && (
					<div className="lpfs-small lpfs-onit" style={at(11600)}>
						<b>{streaming.title}</b> is on {lit.name}, where you live.
					</div>
				)}
			</section>

			{/* 5. Made for your taste: hands over to the taps under the film. */}
			<section className="lpfs-scene lpfs-taste" style={scene(SCENES.taste)}>
				<div className="lpfs-map" style={at(13150)}>
					<MapArt className="h-full w-full" />
				</div>
				<div className="lpfs-shade lpfs-shade-even" />
				<h2 className="lpfs-big lpfs-center">
					<span className="lpfs-word" style={at(13300)}>
						Made
					</span>{" "}
					<span className="lpfs-word" style={at(13450)}>
						for
					</span>{" "}
					<span className="lpfs-word" style={at(13600)}>
						your
					</span>{" "}
					<span className="lpfs-word lpfs-amber" style={at(13750)}>
						taste.
					</span>
				</h2>
			</section>

			{/* The wipes between scenes: an amber panel sweeps across and covers each cut. */}
			{WIPES.map((ms) => (
				<i key={ms} className="lpfs-wipe" style={at(ms)} aria-hidden="true" />
			))}
		</div>
	)
}

const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

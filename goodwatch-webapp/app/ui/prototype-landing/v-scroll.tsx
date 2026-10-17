// PROTOTYPE - throwaway. Landing variant E, "Endless scroll, then one pick".
// Over the TV's picture, after the boot: rows of posters from several services drift sideways while a counter of
// minutes spent scrolling creeps up. Then the rows fall away and GoodWatch's one pick for tonight is there, like the
// TV's Tonight: its picture, its name, its GoodWatch score, how it feels, and where it streams.
//
// SEO: the pick and its lines are in the server HTML at full opacity from the first paint. The rows lie OVER them and
// fade out; nothing that carries the message fades in from 0. Reduced motion skips the rows.
import { Link } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Boot } from "./shared"
import type { Landing, VariantProps } from "./variants"
import "./v-scroll.css"

/** The rows a streaming app would show: several services, mixed. */
const ROWS = [
	{ name: "Trending now", service: null },
	{ name: "Popular on Netflix", service: "#e50914" },
	{ name: "New on Disney+", service: "#3b82f6" },
	{ name: "Because you watched something", service: null },
	{ name: "Top picks on Prime Video", service: "#38bdf8" },
]
const MINUTES = [3, 9, 14, 22, 27, 35, 41, 47]

export function useScroll({ data, tvOpen }: VariantProps): Landing {
	const [dismissed, setDismissed] = useState(false)
	const guest = !data.member
	const on = guest && !tvOpen && !dismissed

	useEffect(() => {
		if (!on) return
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") setDismissed(true)
		}
		addEventListener("keydown", key)
		return () => removeEventListener("keydown", key)
	}, [on])

	const posters = useMemo(() => {
		const all = [
			...data.startTitles.flatMap((t) => t.poster_path ?? []),
			...data.landing.flatMap((t) => t.poster_path ?? []),
		]
		return [...new Set(all)]
	}, [data])

	// The pick: the most popular start title with a picture that streams in the viewer's country; without one, the
	// most popular with a picture. Popular, so a visitor knows it at a glance; a great score first, so the pick
	// earns its place.
	const pick = useMemo(() => {
		const usable = data.landing.filter((c) => c.backdrop_path)
		const streaming = usable.filter((c) => c.services?.length)
		const great = (c: (typeof usable)[number]) => (c.goodwatch_overall_score_normalized_percent ?? 0) >= 78
		return streaming.find(great) ?? streaming[0] ?? usable.find(great) ?? usable[0]
	}, [data.landing])

	if (!on || !pick) return { screen: <Boot /> }
	const service = pick.services?.[0]
	const kind = pick.media_type === "movie" ? "Movie" : "TV show"

	return {
		screen: (
			<>
				<div className="lps">
					{/* The pick: under the rows, in the HTML from the start. */}
					<section className="lps-pick" aria-labelledby="lps-h">
						<img
							className="lps-pick-art"
							src={tmdbImageUrl(pick.backdrop_path as string, "w1280")}
							alt=""
							{...{ fetchpriority: "high" }}
						/>
						<div className="lps-pick-shade" />
						<div className="lps-pick-text">
							<h2 id="lps-h" className="lps-kicker">
								Tonight, this one.
							</h2>
							<div className="lps-title">{pick.title}</div>
							<div className="lps-facts">
								<span className="lps-ring">
									<ScoreRing
										media={{ details: { goodwatch_overall_score_normalized_percent: pick.goodwatch_overall_score_normalized_percent } } as never}
										size={48}
									/>
								</span>
								{pick.feels.length > 0 && <span className="lps-feels">{pick.feels.join(" · ")}</span>}
							</div>
							<p className="lps-line">
								{kind}
								{pick.release_year ? ` · ${pick.release_year}` : ""}
								{service ? (
									<>
										{" · "}on{" "}
										<img className="lps-logo" src={tmdbImageUrl(service.logo_path, "w92")} alt="" />
										{service.name}
									</>
								) : null}
							</p>
							<p className="lps-why">Picked from every service, by what critics, audiences and your taste agree on.</p>
							<div className="lps-actions">
								<Link to="/sign-up" className="lps-cta">
									Get picks for your taste
								</Link>
								<button type="button" className="tvc-btn lps-btn" onClick={() => setDismissed(true)}>
									Look around
								</button>
							</div>
						</div>
					</section>

					{/* The pain: endless rows, over the pick, fading away at the cut. */}
					<div className="lps-wall" aria-hidden="true">
						<div className="lps-rows">
							{ROWS.map((row, i) => {
								const strip = rotate(posters, i * 3)
								return (
									<div key={row.name} className="lps-row">
										<div className="lps-row-name">
											{row.service && <i style={{ background: row.service }} />}
											{row.name}
										</div>
										<div className={`lps-strip ${i % 2 ? "lps-strip-back" : ""}`} style={{ animationDuration: `${26 + i * 5}s` }}>
											{[...strip, ...strip].map((p, j) => (
												<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" decoding="async" />
											))}
										</div>
									</div>
								)
							})}
						</div>
						<div className="lps-thought">
							Still scrolling…{" "}
							<span className="lps-count">
								<span className="lps-count-col">
									{MINUTES.map((m) => (
										<span key={m}>{m} min</span>
									))}
								</span>
							</span>
						</div>
					</div>
				</div>
				<Boot />
			</>
		),
	}
}

const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

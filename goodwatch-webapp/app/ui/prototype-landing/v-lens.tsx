// PROTOTYPE - throwaway. Landing variant G, "One title, every answer": after the boot the TV shows one well-known
// title, and the four questions people ask before pressing play are answered beside it (is it good, how does it
// feel, where can I watch it, what's like it). The close implies the rest: every title works like this, and with
// an account GoodWatch learns what you'll love next.
//
// Everything is in the server HTML. The answers wait just outside the picture and slide in by transform, so the
// text is opaque from the first paint and the reveal costs no layout or paint.
import { Link } from "@remix-run/react"
import { type CSSProperties, useState } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { LandingCard } from "~/server/prototype-landing.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { goodwatchScoreDisplay, scoreLabels } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { BOOT_MS, Boot } from "./shared"
import type { Landing, VariantProps } from "./variants"
import "./v-lens.css"

/** When the answers come in, one after another, from the end of the boot. */
const at = (i: number) => ({ "--lpl-at": `${BOOT_MS - 300 + i * 520}ms` }) as CSSProperties

/** The best-known title with a picture: most votes, a streaming service if one is that well known. */
function pickTitle(cards: LandingCard[]) {
	const shown = cards.filter((c) => c.backdrop_path && c.goodwatch_overall_score_normalized_percent)
	const votes = (c: LandingCard) => c.goodwatch_overall_score_voting_count ?? 0
	const byVotes = [...shown].sort((a, b) => votes(b) - votes(a))
	const top = byVotes[0]
	if (!top) return null
	// A streaming title among the well known (within half the top's votes) shows the whole answer.
	return byVotes.find((c) => c.services?.length && votes(c) >= votes(top) / 2) ?? top
}

/** Titles like it: those sharing the most feels, then the rest. */
function alike(card: LandingCard, cards: LandingCard[]) {
	const share = (c: LandingCard) => c.feels.filter((f) => card.feels.includes(f)).length
	return cards
		.filter((c) => c.key !== card.key && c.poster_path)
		.sort((a, b) => share(b) - share(a))
		.slice(0, 3)
}

/** The feels without repeats of a kind: "awkwardly funny, situationally funny" keeps the first. */
const distinct = (feels: string[]) =>
	feels.filter((f, i) => !feels.slice(0, i).some((g) => g.split(" ").pop() === f.split(" ").pop()))

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hours = (min: number | null) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : null)

export function useLens({ data, tvOpen }: VariantProps): Landing {
	const [gone, setGone] = useState(false)
	const card = data.member || tvOpen || gone ? null : pickTitle(data.landing ?? [])
	if (!card) return { screen: <Boot /> }

	const percent = card.goodwatch_overall_score_normalized_percent ?? 0
	const score = goodwatchScoreDisplay(percent)
	const verdict = scoreLabels[Math.max(1, Math.round(score / 10))]
	const service = card.services?.[0] ?? null
	// Without the viewer's country (or a service carrying it there), the answer is about every service at once.
	const marks = data.services.flatMap((one) => one.logo_path ?? []).slice(0, 2)
	const feels = distinct(card.feels)
	const like = alike(card, data.landing)
	const meta = [card.media_type === "movie" ? "Movie" : "TV show", card.release_year, hours(card.runtime)]
		.filter(Boolean)
		.join(" · ")
	const href = `/${card.media_type}/${card.tmdb_id}`
	const close = {
		line: "Every movie and show, answered like this.",
		sub: "Tell GoodWatch what you love, and it finds what you'll love next.",
	}
	const keys = (
		<div className="lpl-keys">
			<Link to="/sign-up" className="lpl-key lpl-go">
				Sign up free
			</Link>
			<button type="button" className="lpl-key" onClick={() => setGone(true)}>
				Look around
			</button>
		</div>
	)

	return {
		screen: (
			<>
				<section className="lpl" aria-labelledby="lpl-h">
					<img
						className="lpl-pic"
						src={tmdbImageUrl(card.backdrop_path as string, "w1280")}
						alt=""
						{...{ fetchpriority: "high" }}
					/>
					<div className="lpl-shade" />
					<div className="lpl-left">
						<div className="lpl-kicker">Before you press play</div>
						<h2 id="lpl-h" className="lpl-h">
							Know if it's worth your evening.
						</h2>
					</div>
					<div className="lpl-title">
						<Link to={href} className="lpl-name block">
							{card.title}
						</Link>
						<div className="lpl-meta">{meta}</div>
					</div>
					<ul className="lpl-pins">
						<li className="lpl-pin" style={at(0)}>
							<span className="lpl-ring">
								<ScoreRing media={{ details: card } as never} size={52} label={false} />
							</span>
							<span>
								<span className="lpl-q">Is it good?</span>
								<span className="lpl-a">
									{verdict}
									<span className="lpl-marks" aria-hidden="true">
										<img src={imdbLogo} alt="" />
										<img src={rottenLogo} alt="" />
										<img src={metacriticLogo} alt="" />
									</span>
								</span>
								<span className="lpl-sub">Critics and audiences in one score</span>
							</span>
						</li>
						{feels.length > 0 && (
							<li className="lpl-pin" style={at(1)}>
								<span className="lpl-feel" aria-hidden="true">
									<Wave />
								</span>
								<span>
									<span className="lpl-q">How does it feel?</span>
									<span className="lpl-a">{cap(feels.join(", "))}</span>
									<span className="lpl-sub">Read from the story itself</span>
								</span>
							</li>
						)}
						<li className="lpl-pin" style={at(2)}>
							{service ? (
								<img className="lpl-logo" src={tmdbImageUrl(service.logo_path, "w92")} alt="" />
							) : marks.length === 0 ? (
								<span className="lpl-feel" aria-hidden="true">
									<Screen />
								</span>
							) : (
								<span className="lpl-logos" aria-hidden="true">
									{marks.map((m) => (
										<img key={m} className="lpl-logo" src={tmdbImageUrl(m, "w92")} alt="" />
									))}
								</span>
							)}
							<span>
								<span className="lpl-q">Can I watch it?</span>
								<span className="lpl-a">{service ? `Streaming on ${service.name}` : "Every service, checked"}</span>
								<span className="lpl-sub">
									{service ? "Where you live, on the services you have" : "Where you live, and the day it lands on yours"}
								</span>
							</span>
						</li>
						{like.length > 0 && (
							<li className="lpl-pin" style={at(3)}>
								<span className="lpl-posters">
									{like.map((c) => (
										<img key={c.key} src={tmdbImageUrl(c.poster_path as string, "w92")} alt={c.title} />
									))}
								</span>
								<span>
									<span className="lpl-q">What's like it?</span>
									<span className="lpl-a lpl-one">{like[0].title}</span>
									<span className="lpl-sub">Found by how it feels, not by genre</span>
								</span>
							</li>
						)}
					</ul>
					<div className="lpl-close" style={at(4.6)}>
						<p className="lpl-line">
							{close.line}
							<span>{close.sub}</span>
						</p>
						{keys}
					</div>
				</section>
				<Boot />
			</>
		),
		room: (
			<div className="lpl-sheet" style={at(4.6)}>
				<h2>{close.line}</h2>
				<p>{close.sub}</p>
				{keys}
			</div>
		),
	}
}

const Wave = () => (
	<svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
		<path d="M2 12c2.5-6 4.5-6 7 0s4.5 6 7 0 4.5-6 6-2" />
	</svg>
)
const Screen = () => (
	<svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
		<rect x="3" y="5" width="18" height="12" rx="2" />
		<path d="M10 9l4 2-4 2zM8 20h8" />
	</svg>
)

// PROTOTYPE - throwaway. The intro film's chapters as plain page content, right under the room, for guests on the
// film variant: what Google reads (one H1, one item per chapter with real facts and a link to the real page), and a
// way for a visitor to jump the TV's film to a chapter. Server-rendered, no animation, images lazy.
import { Link } from "@remix-run/react"
import disneyLogo from "~/img/disneyplus-logo.webp?no-inline"
import fingerprintIcon from "~/img/fingerprint.webp?no-inline"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-96.webp?no-inline"
import netflixLogo from "~/img/netflix-logo.svg?no-inline"
import primeLogo from "~/img/primevideo-logo.svg?no-inline"
import rottenLogo from "~/img/rotten-logo-96.webp?no-inline"
import tmdbLogo from "~/img/tmdb-logo.svg?no-inline"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { MapArt } from "~/ui/living-room/tv/screens/app-art"
import { ROOM_ID } from "~/ui/living-room/use-below-room"
import "./how-it-works.css"

/** Asks the TV's film to play from a chapter (v-film.tsx listens). */
export const FILM_CHAPTER_EVENT = "lp-film-chapter"

const poster = (path: string) => `https://image.tmdb.org/t/p/w154${path}`

type Visual =
	| { kind: "logos"; logos: { src: string; alt: string }[] }
	| { kind: "poster"; index: number }
	| { kind: "icon"; src: string; alt: string }
	| { kind: "map" }
	| { kind: "words"; words: string[] }

type Feature = {
	/** The film chapter (SECTIONS id in prototype-intro/clip.ts). */
	section: string
	title: string
	text: string
	link: { to: string; label: string }
	visual: Visual
}

// In the film's order (prototype-intro/cut.ts), without the boot and the quiz.
const FEATURES: Feature[] = [
	{
		section: "score",
		title: "One score you can trust",
		text: "IMDb, Rotten Tomatoes and Metacritic, critics and audiences alike, combined into one GoodWatch score for every movie and show.",
		link: { to: "/how-it-works", label: "How the score works" },
		visual: {
			kind: "logos",
			logos: [
				{ src: imdbLogo, alt: "IMDb" },
				{ src: rottenLogo, alt: "Rotten Tomatoes" },
				{ src: metacriticLogo, alt: "Metacritic" },
			],
		},
	},
	{
		section: "streaming",
		title: "Where it streams, where you live",
		text: "325 streaming services in 139 countries. See which of your services has a title tonight, and hear the day something you want lands on one.",
		link: { to: "/movies/streaming", label: "Movies by streaming service" },
		visual: {
			kind: "logos",
			logos: [
				{ src: netflixLogo, alt: "Netflix" },
				{ src: primeLogo, alt: "Prime Video" },
				{ src: disneyLogo, alt: "Disney+" },
			],
		},
	},
	{
		section: "recommendations",
		title: "Picked for you",
		text: "Rate a few titles you loved and GoodWatch picks what you'll love next, and tells you why.",
		link: { to: "/taste", label: "Find your taste" },
		visual: { kind: "poster", index: 0 },
	},
	{
		section: "fingerprint",
		title: "How it feels",
		text: "Every title is read for how it feels: spectacular, tense, heartwarming, funny. Pick by the evening you want, not by genre.",
		link: { to: "/how-it-works", label: "About title analysis" },
		visual: { kind: "icon", src: fingerprintIcon, alt: "A title's fingerprint" },
	},
	{
		section: "search",
		title: "Search by feeling",
		text: 'Type what you\'re in the mood for, like "a mind-blowing space adventure", and get the titles that fit it.',
		link: { to: "/search", label: "Search GoodWatch" },
		visual: { kind: "words", words: ["Wonder", "Spectacle", "Futuristic"] },
	},
	{
		section: "filters",
		title: "From everything to tonight",
		text: "Narrow 1.5 million titles to tonight's few: your services, not seen yet, the mood, an age limit and the score you want.",
		link: { to: "/discover", label: "Open Discover" },
		visual: { kind: "words", words: ["On my services", "Not seen yet", "Feel-good"] },
	},
	{
		section: "explorer",
		title: "A map of how movies feel",
		text: "Islands of titles that feel alike. Combine a mood, a theme and a style to see what they share.",
		link: { to: "/explorer", label: "Open the Explorer" },
		visual: { kind: "map" },
	},
	{
		section: "tracking",
		title: "It keeps track for you",
		text: "Your Wishlist and your shows in one place: the next episode, the show to pick up, and the day a wanted title arrives on your service.",
		link: { to: "/watch-next", label: "See Watch next" },
		visual: { kind: "poster", index: 1 },
	},
	{
		section: "imports",
		title: "Bring your ratings with you",
		text: "Import your history from IMDb, Letterboxd, Trakt, TMDB, Plex and more, and your taste is ready on day one.",
		link: { to: "/settings/imports", label: "Import your ratings" },
		visual: {
			kind: "logos",
			logos: [
				{ src: imdbLogo, alt: "IMDb" },
				{ src: tmdbLogo, alt: "TMDB" },
			],
		},
	},
]

function Picture({ visual, titles }: { visual: Visual; titles: StartTitle[] }) {
	if (visual.kind === "logos")
		return (
			<span className="lphw-logos">
				{visual.logos.map((l) => (
					<img key={l.alt} src={l.src} alt={l.alt} width={44} height={44} loading="lazy" decoding="async" />
				))}
			</span>
		)
	if (visual.kind === "icon") return <img src={visual.src} alt={visual.alt} width={64} height={64} loading="lazy" decoding="async" />
	if (visual.kind === "map") return <MapArt className="lphw-map" />
	if (visual.kind === "words")
		return (
			<span className="lphw-words">
				{visual.words.map((w) => (
					<span key={w}>{w}</span>
				))}
			</span>
		)
	const title = titles.filter((t) => t.poster_path)[visual.index]
	return title?.poster_path ? (
		<img src={poster(title.poster_path)} alt={`${title.title} poster`} width={60} height={90} loading="lazy" decoding="async" className="lphw-poster" />
	) : null
}

export function HowItWorks({ titles }: { titles: StartTitle[] }) {
	const watch = (section: string) => {
		document.getElementById(ROOM_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })
		window.dispatchEvent(new CustomEvent(FILM_CHAPTER_EVENT, { detail: section }))
	}
	return (
		<section className="lphw" aria-labelledby="lphw-h">
			<header className="lphw-head">
				<p className="lrb-eye">How GoodWatch works</p>
				<h1 id="lphw-h">GoodWatch finds your next movie or show</h1>
				<p className="lphw-lede">
					One trusted score, every streaming service where you live, and picks made for your taste. Free, no account
					needed to start.
				</p>
			</header>
			<ol className="lphw-list">
				{FEATURES.map((f, i) => (
					<li key={f.section} className="lphw-item">
						<div className="lphw-pic" aria-hidden={f.visual.kind === "words" || f.visual.kind === "map"}>
							<Picture visual={f.visual} titles={titles} />
						</div>
						<div className="lphw-body">
							<span className="lphw-n">{String(i + 1).padStart(2, "0")}</span>
							<h3>{f.title}</h3>
							<p>{f.text}</p>
							<div className="lphw-actions">
								<Link to={f.link.to} className="lphw-link">
									{f.link.label} →
								</Link>
								<button type="button" className="lphw-watch" onClick={() => watch(f.section)}>
									▶ Watch in the intro
								</button>
							</div>
						</div>
					</li>
				))}
			</ol>
		</section>
	)
}

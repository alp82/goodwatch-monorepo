// PROTOTYPE - throwaway. The intro film's chapters as plain page content, right under the room, for guests on the
// film variant: what Google reads (one H1, one item per chapter with real facts and a link to the real page), and a
// way for a visitor to jump the TV's film to a chapter. Server-rendered, no animation, images lazy.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import disneyLogo from "~/img/disneyplus-logo.webp?no-inline"
import fingerprintIcon from "~/img/fingerprint.webp?no-inline"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-96.webp?no-inline"
import netflixLogo from "~/img/netflix-logo.svg?no-inline"
import primeLogo from "~/img/primevideo-logo.svg?no-inline"
import rottenLogo from "~/img/rotten-logo-96.webp?no-inline"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { MapArt } from "~/ui/living-room/tv/screens/app-art"
import { ROOM_ID } from "~/ui/living-room/use-below-room"
import { assetUrl } from "~/utils/asset-url"
import "./how-it-works.css"

/** Asks the TV's film to play from a chapter (v-film.tsx listens). */
export const FILM_CHAPTER_EVENT = "lp-film-chapter"

const poster = (path: string) => `https://image.tmdb.org/t/p/w185${path}`

/** A small image in a visual tile: sized, lazy, decorative where the text says it already. */
const Img = ({ src, alt, w, h, className }: { src: string; alt: string; w: number; h: number; className?: string }) => (
	<img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" className={className} />
)

type Feature = {
	/** The film chapter (SECTIONS id in prototype-intro/clip.ts). */
	section: string
	title: string
	text: string
	link: { to: string; label: string }
	/** The tile's picture: static markup, no animation. */
	visual: (titles: StartTitle[]) => ReactNode
}

// In the film's order (prototype-intro/cut.ts), without the boot and the quiz. Every tile is a different kind of
// picture, so no two read alike: logos, a ring, posters, bars, a search field, switches, a map, a feed, sources.
const FEATURES: Feature[] = [
	{
		section: "score",
		title: "One score you can trust",
		text: "IMDb, Rotten Tomatoes and Metacritic, critics and audiences alike, in one GoodWatch score for every movie and show.",
		link: { to: "/how-it-works", label: "How the score works" },
		visual: () => (
			<div className="lphw-v-score">
				<div className="lphw-v-sources">
					<Img src={imdbLogo} alt="IMDb" w={56} h={28} />
					<Img src={rottenLogo} alt="Rotten Tomatoes" w={28} h={28} />
					<Img src={metacriticLogo} alt="Metacritic" w={28} h={28} />
				</div>
				<span className="lphw-v-arrow" aria-hidden="true">→</span>
				<span className="lphw-v-ring" aria-label="GoodWatch score 89">
					<b>89</b>
				</span>
			</div>
		),
	},
	{
		section: "streaming",
		title: "Where it streams",
		text: "325 streaming services in 139 countries. See which of yours has it tonight, and hear the day a title you want arrives.",
		link: { to: "/movies/streaming", label: "By streaming service" },
		visual: () => (
			<div className="lphw-v-services">
				<span className="lphw-v-tile lphw-v-lit"><Img src={netflixLogo} alt="Netflix" w={64} h={20} /></span>
				<span className="lphw-v-tile"><Img src={primeLogo} alt="Prime Video" w={64} h={20} /></span>
				<span className="lphw-v-tile"><Img src={disneyLogo} alt="Disney+" w={64} h={28} /></span>
				<span className="lphw-v-count"><b>325</b> services</span>
			</div>
		),
	},
	{
		section: "recommendations",
		title: "Picked for you",
		text: "Rate a few titles you loved and GoodWatch picks what you'll love next, and tells you why.",
		link: { to: "/taste", label: "Find your taste" },
		// The film's pick: Avatar, because you loved Interstellar and Inception (TMDB poster paths, fixed).
		visual: () => (
			<div className="lphw-v-pick">
				{[
					["/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", "Interstellar"],
					["/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg", "Avatar"],
					["/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "Inception"],
				].map(([path, title], i) => (
					<Img
						key={title}
						src={poster(path)}
						alt={i === 1 ? `${title} poster` : ""}
						w={92}
						h={138}
						className={`lphw-v-poster ${i === 1 ? "lphw-v-chosen" : ""}`}
					/>
				))}
				<span className="lphw-v-match">81% your taste</span>
			</div>
		),

	},
	{
		section: "fingerprint",
		title: "How it feels",
		text: "Every title is read for how it feels: spectacular, tense, heartwarming, funny. Pick by the evening you want, not by genre.",
		link: { to: "/how-it-works", label: "About title analysis" },
		visual: () => (
			<div className="lphw-v-feel">
				<Img src={fingerprintIcon} alt="" w={52} h={52} className="lphw-v-print" />
				<ul aria-hidden="true">
					{[
						["Spectacular", 92, "#a78bfa"],
						["Wondrous", 78, "#60a5fa"],
						["Tense", 61, "#f59e0b"],
					].map(([word, n, color]) => (
						<li key={word as string}>
							<span>{word}</span>
							<i style={{ width: `${n}%`, background: color as string }} />
						</li>
					))}
				</ul>
			</div>
		),
	},
	{
		section: "search",
		title: "Search by feeling",
		text: 'Type what you\'re in the mood for, like "a mind-blowing space adventure", and get the titles that fit it.',
		link: { to: "/search", label: "Search GoodWatch" },
		visual: () => (
			<div className="lphw-v-search" aria-hidden="true">
				<div className="lphw-v-field">
					<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
					<span>a mind-blowing space adventure</span>
					<i />
				</div>
				<div className="lphw-v-read">
					<span className="lphw-v-chip lphw-c-blue">Wonder</span>
					<span className="lphw-v-chip lphw-c-red">Spectacle</span>
					<span className="lphw-v-chip lphw-c-blue">Futuristic</span>
				</div>
			</div>
		),
	},
	{
		section: "filters",
		title: "From everything to tonight",
		text: "Narrow 1.5 million titles to tonight's few: your services, not seen yet, the mood, an age limit and the score you want.",
		link: { to: "/discover", label: "Open Discover" },
		visual: () => (
			<div className="lphw-v-filters" aria-hidden="true">
				<ul>
					<li className="lphw-s-green">On my services<i /></li>
					<li className="lphw-s-blue">Not seen yet<i /></li>
					<li className="lphw-s-orange">Feel-good<i /></li>
				</ul>
				<div className="lphw-v-number">
					<b>277</b>
					<span>for tonight</span>
				</div>
			</div>
		),
	},
	{
		section: "explorer",
		title: "A map of how movies feel",
		text: "Islands of titles that feel alike. Combine a mood, a theme and a style to see what they share.",
		link: { to: "/explorer", label: "Open the Explorer" },
		visual: () => <MapArt className="lphw-v-map" />,
	},
	{
		section: "tracking",
		title: "It keeps track for you",
		text: "Your Wishlist and your shows in one place: the next episode, the show to pick up, and the day a wanted title arrives on your service.",
		link: { to: "/watch-next", label: "See Watch next" },
		visual: () => (
			<ul className="lphw-v-feed" aria-hidden="true">
				<li className="lphw-f-amber"><b>Want to See</b>On your Wishlist</li>
				<li className="lphw-f-green"><b>Now on Netflix</b>From your Wishlist</li>
				<li className="lphw-f-red"><b>Continue</b>Next episode, out now</li>
			</ul>
		),
	},
	{
		section: "imports",
		title: "Bring your ratings with you",
		text: "Import your history from Letterboxd, Trakt, TMDB, Plex, IMDb and more, and your taste is ready on day one.",
		link: { to: "/settings/imports", label: "Import your ratings" },
		visual: () => (
			<div className="lphw-v-imports">
				<div className="lphw-v-marks">
					<span className="lphw-v-mark"><Img src={assetUrl("/images/prototype-intro/letterboxd.png")} alt="Letterboxd" w={36} h={36} /></span>
					<span className="lphw-v-mark"><Img src={assetUrl("/images/import-sources/trakt.svg")} alt="Trakt" w={36} h={36} /></span>
					<span className="lphw-v-mark lphw-v-light"><Img src={assetUrl("/images/prototype-intro/plex.svg")} alt="Plex" w={40} h={18} /></span>
					<span className="lphw-v-mark"><Img src={assetUrl("/images/import-sources/tmdb.svg")} alt="TMDB" w={40} h={18} /></span>
				</div>
				<span className="lphw-v-arrow" aria-hidden="true">→</span>
				<GoodWatchG height={44} />
			</div>
		),
	},
]

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
					One trusted score, every streaming service in your country, and picks made for your taste. Free, no account
					needed to start.
				</p>
			</header>
			<ol className="lphw-list">
				{FEATURES.map((f, i) => (
					<li key={f.section} className="lphw-item">
						<div className="lphw-pic">{f.visual(titles)}</div>
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

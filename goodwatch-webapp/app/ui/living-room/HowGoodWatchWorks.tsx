// "How GoodWatch works": the intro film's chapters as plain page content at the top of the section below the room.
// It is what a crawler reads of the start page (its one H1, one item per chapter with real facts and a link to the
// real page), and each item can start the TV's film at its chapter. Server-rendered, no animation, images lazy.
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
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { MapArt } from "~/ui/living-room/tv/screens/app-art"
import { ROOM_ID } from "~/ui/living-room/use-below-room"
import { FILM_CHAPTER_EVENT } from "./intro/events"
import type { ChapterId } from "./intro/scene"

const poster = (path: string) => `https://image.tmdb.org/t/p/w185${path}`

/** A small image in a visual tile: sized, lazy, decorative where the text says it already. */
const Img = ({
	src,
	alt,
	w,
	h,
	className,
}: { src: string; alt: string; w: number; h: number; className?: string }) => (
	<img
		src={src}
		alt={alt}
		width={w}
		height={h}
		loading="lazy"
		decoding="async"
		className={className}
	/>
)

type Feature = {
	/** The film's chapter (scene.ts). */
	section: ChapterId
	title: string
	text: string
	link: { to: string; label: string }
	/** The tile's picture: static markup, no animation. */
	visual: () => ReactNode
}

// In the film's order (film.ts), without the quiz. Every tile is a different kind of picture, so no two read alike:
// logos, a ring, posters, bars, a search field, switches, a map, a feed, import sources.
const FEATURES: Feature[] = [
	{
		section: "score",
		title: "One score you can trust",
		text: "IMDb, Rotten Tomatoes, Metacritic and TMDB, critics and audiences alike, in one GoodWatch score for every movie and show.",
		link: { to: "/how-it-works#score", label: "How the score works" },
		visual: () => (
			<div className="hgw-v-score">
				<div className="hgw-v-sources">
					<Img src={imdbLogo} alt="IMDb" w={56} h={28} />
					<Img src={rottenLogo} alt="Rotten Tomatoes" w={28} h={28} />
					<Img src={metacriticLogo} alt="Metacritic" w={28} h={28} />
				</div>
				<span className="hgw-v-arrow" aria-hidden="true">
					→
				</span>
				<span className="hgw-v-ring" aria-label="GoodWatch score 89">
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
			<div className="hgw-v-services">
				<span className="hgw-v-tile hgw-v-lit">
					<Img src={netflixLogo} alt="Netflix" w={64} h={20} />
				</span>
				<span className="hgw-v-tile">
					<Img src={primeLogo} alt="Prime Video" w={64} h={20} />
				</span>
				<span className="hgw-v-tile">
					<Img src={disneyLogo} alt="Disney+" w={64} h={28} />
				</span>
				<span className="hgw-v-count">
					<b>325</b> services
				</span>
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
			<div className="hgw-v-pick">
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
						className={`hgw-v-poster ${i === 1 ? "hgw-v-chosen" : ""}`}
					/>
				))}
				<span className="hgw-v-match">81% your taste</span>
			</div>
		),
	},
	{
		section: "fingerprint",
		title: "How it feels",
		text: "Every title is read for how it feels: spectacular, tense, heartwarming, funny. Pick by the evening you want, not by genre.",
		link: { to: "/how-it-works#title-analysis", label: "About title analysis" },
		visual: () => (
			<div className="hgw-v-feel">
				<Img
					src={fingerprintIcon}
					alt=""
					w={52}
					h={52}
					className="hgw-v-print"
				/>
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
			<div className="hgw-v-search" aria-hidden="true">
				<div className="hgw-v-field">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle
							cx="11"
							cy="11"
							r="6.5"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						/>
						<path
							d="M16 16l4.5 4.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
					<span>a mind-blowing space adventure</span>
					<i />
				</div>
				<div className="hgw-v-read">
					<span className="hgw-v-chip hgw-c-blue">Wonder</span>
					<span className="hgw-v-chip hgw-c-red">Spectacle</span>
					<span className="hgw-v-chip hgw-c-blue">Futuristic</span>
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
			<div className="hgw-v-filters" aria-hidden="true">
				<ul>
					<li className="hgw-s-green">
						On my services
						<i />
					</li>
					<li className="hgw-s-blue">
						Not seen yet
						<i />
					</li>
					<li className="hgw-s-orange">
						Feel-good
						<i />
					</li>
				</ul>
				<div className="hgw-v-number">
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
		visual: () => <MapArt className="hgw-v-map" />,
	},
	{
		section: "tracking",
		title: "It keeps track for you",
		text: "Your Wishlist and your shows in one place: the next episode, the show to pick up, and the day a wanted title arrives on your service.",
		link: { to: "/watch-next", label: "See Watch next" },
		visual: () => (
			<ul className="hgw-v-feed" aria-hidden="true">
				<li className="hgw-f-amber">
					<b>Want to See</b>On your Wishlist
				</li>
				<li className="hgw-f-green">
					<b>Now on Netflix</b>From your Wishlist
				</li>
				<li className="hgw-f-red">
					<b>Continue</b>Next episode, out now
				</li>
			</ul>
		),
	},
	{
		section: "imports",
		title: "Bring your ratings with you",
		text: "Import your history from Letterboxd, Trakt, TMDB, Plex, IMDb and more, and your taste is ready on day one.",
		link: { to: "/settings/imports", label: "Import your ratings" },
		visual: () => (
			<div className="hgw-v-imports">
				{/* The Imports page's own marks: official logos where it uses them, its letter tiles elsewhere. */}
				<div className="hgw-v-marks">
					{IMPORT_RATINGS_SOURCES.map((source) => (
						<SourceMark key={source.id} source={source} />
					))}
				</div>
				<span className="hgw-v-arrow" aria-hidden="true">
					→
				</span>
				<GoodWatchG height={44} />
			</div>
		),
	},
]

/** The import sources the ratings tile shows: not IMDb, which the score tile already shows. */
const IMPORT_RATINGS_SOURCES = ["letterboxd", "trakt", "plex", "tmdb"].flatMap(
	(id) => IMPORT_SOURCE_LIST.find((source) => source.id === id) ?? [],
)

export function HowGoodWatchWorks() {
	const watch = (section: ChapterId) => {
		document
			.getElementById(ROOM_ID)
			?.scrollIntoView({ behavior: "smooth", block: "start" })
		window.dispatchEvent(
			new CustomEvent(FILM_CHAPTER_EVENT, { detail: section }),
		)
	}
	return (
		<section className="hgw" aria-labelledby="hgw-h">
			<header className="hgw-head">
				<p className="lrb-eye">How GoodWatch works</p>
				<h1 id="hgw-h">GoodWatch finds your next movie or show</h1>
				<p className="hgw-lede">
					One trusted score, every streaming service in your country, and picks
					made for your taste. Free, no account needed to start.
				</p>
			</header>
			<ol className="hgw-list">
				{FEATURES.map((f, i) => (
					<li key={f.section} className="hgw-item">
						<div className="hgw-pic">{f.visual()}</div>
						<div className="hgw-body">
							<span className="hgw-n">{String(i + 1).padStart(2, "0")}</span>
							<h2>{f.title}</h2>
							<p>{f.text}</p>
							<div className="hgw-actions">
								<Link to={f.link.to} className="hgw-link">
									{f.link.label} →
								</Link>
								<button
									type="button"
									className="hgw-watch"
									onClick={() => watch(f.section)}
								>
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

// PROTOTYPE (README still "tracking"): the intro Tracking scene's first four alert cards (Want to See, now on a
// service, Continue, Pick up) in a 2x2 grid filling the picture, still, with the "Example of what members get" label.
// The cards are the intro's (same classes and data rules as scenes/tracking.tsx), only larger.
import type { CSSProperties, ReactNode } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import {
	Poster,
	img,
	knownService,
	picks,
} from "~/ui/living-room/intro/parts/feed-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"

type Kind = "wish" | "landed" | "next" | "pickup"
type Moment = {
	kind: Kind
	card: IntroCard
	title: string
	line: string
	service?: { name: string; logo_path: string }
}

const TONE: Record<Kind, { color: string; label: string }> = {
	wish: { color: "#fbbf24", label: "Want to See" },
	landed: { color: "#22c55e", label: "Now streaming" },
	next: { color: "#ef4444", label: "Continue" },
	pickup: { color: "#38bdf8", label: "Pick up" },
}

function Icon({ kind }: { kind: Kind }) {
	const p: Record<Kind, ReactNode> = {
		wish: <path d="M7 3h10v18l-5-4-5 4z" />,
		landed: (
			<>
				<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
				<path d="M10 21h4" />
			</>
		),
		next: <path d="M8 5l11 7-11 7z" />,
		pickup: (
			<>
				<path d="M4 12a8 8 0 1 0 3-6.2" />
				<path d="M4 4v5h5" />
			</>
		),
	}
	return (
		<svg
			viewBox="0 0 24 24"
			className="intro-feed-icon"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{p[kind]}
		</svg>
	)
}

function Card({ m }: { m: Moment }) {
	const tone = TONE[m.kind]
	const style = { "--tone": tone.color } as CSSProperties
	if (m.kind === "landed" && m.service)
		return (
			<div className="intro-feed-card intro-feed-card-landed" style={style}>
				<img
					src={img(m.service.logo_path, "w154")}
					alt=""
					className="intro-feed-card-logo"
				/>
				<div className="intro-feed-card-body">
					<div className="intro-feed-card-tag">
						<Icon kind={m.kind} />
						GoodWatch · now
					</div>
					<div className="intro-feed-card-title">{m.title}</div>
					<div className="intro-feed-card-line">{m.line}</div>
				</div>
				<Poster
					path={m.card.poster_path}
					className="intro-feed-card-poster"
					size="w342"
				/>
			</div>
		)
	if (m.kind === "next" || m.kind === "pickup")
		return (
			<div
				className={`intro-feed-card intro-feed-card-wide intro-feed-card-${m.kind}`}
				style={style}
			>
				<img
					src={img(m.card.backdrop_path, "w1280")}
					alt=""
					className="intro-feed-card-art"
				/>
				<div className="intro-feed-card-wide-shade" />
				<div className="intro-feed-card-body">
					<div className="intro-feed-card-tag">
						<Icon kind={m.kind} />
						{tone.label}
					</div>
					<div className="intro-feed-card-title">{m.title}</div>
					<div className="intro-feed-card-line">{m.line}</div>
				</div>
				<div className="intro-feed-card-progress">
					<i
						style={{ transform: `scaleX(${m.kind === "next" ? 0.92 : 0.38})` }}
					/>
				</div>
			</div>
		)
	return (
		<div className={`intro-feed-card intro-feed-card-${m.kind}`} style={style}>
			<Poster
				path={m.card.poster_path}
				className="intro-feed-card-poster"
				size="w342"
			/>
			<div className="intro-feed-card-body">
				<div className="intro-feed-card-tag">
					<Icon kind={m.kind} />
					{tone.label}
				</div>
				<div className="intro-feed-card-title">{m.title}</div>
				<span className="intro-feed-pill intro-feed-pill-off readme-tracking-pill">
					✓ On your Wishlist
				</span>
			</div>
		</div>
	)
}

/** As scenes/tracking.tsx: an intro movie on Netflix where the visitor is, else the best-known movie that streams. */
function netflixMovie(data: SceneProps["data"]) {
	const order = [
		"Inception",
		"The Dark Knight",
		"Interstellar",
		"The Matrix",
		"Inglourious Basterds",
		"Pulp Fiction",
		"Fight Club",
		"Forrest Gump",
	]
	const onNetflix = data.pool.filter(
		(c) =>
			c.media_type === "movie" &&
			c.poster_path &&
			c.services?.some((s) => s.logo_path && /^netflix$/i.test(s.name)),
	)
	const movie =
		order.flatMap((t) => onNetflix.find((c) => c.title === t) ?? [])[0] ??
		onNetflix[0]
	const service =
		movie?.services?.find((s) => /^netflix$/i.test(s.name)) ?? null
	return movie && service ? { movie, service } : null
}

function moments(data: SceneProps["data"]): Moment[] | null {
	const base = picks(data)
	const nf = netflixMovie(data)
	const movie = nf?.movie ?? base.movie
	const service = nf?.service ?? (base.movie ? knownService(base.movie) : null)
	const shows = base.shows
	if (!movie || !service || shows.length < 3) return null
	const [cont, , pickup] = shows
	return [
		{ kind: "wish", card: movie, title: movie.title, line: "" },
		{
			kind: "landed",
			card: movie,
			title: `Now on ${service.name}`,
			line: `${movie.title}, from your Wishlist`,
			service,
		},
		{
			kind: "next",
			card: cont,
			title: cont.title,
			line: "Next episode, out now",
		},
		{
			kind: "pickup",
			card: pickup,
			title: pickup.title,
			line: "Right where you left off",
		},
	]
}

/** The grid's box on the 1440x770 stage, px; the still is cropped to it. */
export const TRACKING_BOX = { x: 0, y: 0, w: 1440, h: 640 }

const css = `
.readme-tracking { position:absolute; left:0; top:0; width:1440px; height:${TRACKING_BOX.h}px; overflow:hidden;
	background: radial-gradient(70% 80% at 50% 50%, #17140b 0%, #05060a 75%); font-family:"Gabarito",ui-sans-serif,system-ui,sans-serif; color:#fff; }
.readme-tracking-grid { position:absolute; left:32px; right:32px; top:96px; bottom:44px;
	display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:28px; }
.readme-tracking .intro-feed-card { --ch: 100%; height:100%; gap: 24px; padding: 0 26px 0 22px;
	border-radius: 24px; border-left-width: 10px; }
.readme-tracking .intro-feed-card-wide { padding-left: 40px; }
.readme-tracking .intro-feed-card-tag { white-space: nowrap; font-size: 21px; gap: 10px; letter-spacing:.1em; }
.readme-tracking .intro-feed-card-title { font-size: 44px; margin-top: 8px; line-height:1.08; }
.readme-tracking .intro-feed-card-line { font-size: 26px; margin-top: 8px; }
.readme-tracking .intro-feed-card-poster { height: calc(100% - 36px); border-radius: 10px; }
.readme-tracking .intro-feed-card-logo { height: 92px; border-radius: 16px; }
.readme-tracking .intro-feed-card-progress { height: 8px; }
.readme-tracking .intro-feed-card-wish .intro-feed-card-title { -webkit-line-clamp: 1; }
.readme-tracking-pill { margin-top: 14px; font-size: 21px; padding: 10px 20px; }
.readme-tracking .intro-feed-example { position:absolute; left:50%; top:30px; right:auto; bottom:auto;
	transform:translateX(-50%); font-size: 17px; padding: 9px 22px; }
`

export function ReadmeTracking({ data }: SceneProps) {
	const ms = moments(data)
	if (!ms) return null
	return (
		<div className="readme-tracking">
			<style>{css}</style>
			<div className="intro-feed-example">Example of what members get</div>
			<div className="readme-tracking-grid">
				{ms.map((m) => (
					<Card key={m.kind} m={m} />
				))}
			</div>
		</div>
	)
}

// PROTOTYPE - throwaway. The "keeps track for you" clips: what GoodWatch tells a member, shown as examples with real
// titles. Each says it's an example ("What members get"): the alerts are illustrations, not real alerts. Where a line
// states a fact (a title streams on a service, a score), it's the title's real data.
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { LandingCard } from "~/server/prototype-landing.server"
import { goodwatchScoreDisplay } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps } from "../../clip"
import { DEAL, Example, Headline, Poster, at, at2, etData } from "./kit"

const logo = (path: string | null | undefined) => (path ? tmdbImageUrl(path, "w92") : "")
const streaming = (cards: LandingCard[]) => cards.filter((c) => c.services?.some((s) => s.logo_path) && c.poster_path)
const scoreOf = (c: LandingCard) => (c.goodwatch_overall_score_normalized_percent ? goodwatchScoreDisplay(c.goodwatch_overall_score_normalized_percent) : null)
const empty = <div className="lpc-et-sea" />

function Note({
	card,
	when,
	title,
	sub,
	service,
	style,
	className = "lpc-et-a",
}: {
	card: { poster_path: string | null }
	when: string
	title: string
	sub: string
	service?: string | null
	style: React.CSSProperties
	className?: string
}) {
	return (
		<div className={`lpc-et-note ${className}`} style={style}>
			<Poster path={card.poster_path} />
			<div className="lpc-et-note-body">
				<div className="lpc-et-note-from">
					<span>GoodWatch</span>
					<span>{when}</span>
				</div>
				<div className="lpc-et-note-title">{title}</div>
				<div className="lpc-et-note-sub">{sub}</div>
			</div>
			{service && <img src={logo(service)} alt="" className="lpc-et-logo" />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** A. The alerts: four moments a member would hear about, one at a time, unhurried. */
export function TrackingAlerts({ data }: ClipProps) {
	const cards = data.landing
	const on = streaming(cards)
	const lands = on.find((c) => c.media_type === "movie") ?? on[0]
	const show = cards.find((c) => c.media_type === "show" && c.poster_path && c !== lands)
	const best = [...cards].filter((c) => c.poster_path && c !== lands && c !== show).sort((a, b) => (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0))[0]
	const et = etData(data)
	const side = et?.bridge?.titles.find((t) => t.poster)
	const sideName = et?.islands.find((i) => i.id === et.bridge?.a)?.name.toLowerCase()
	if (!lands) return empty
	const svc = lands.services?.find((s) => s.logo_path)
	const notes = [
		{ card: lands, when: "now", title: `Now on ${svc?.name}`, sub: `${lands.title}, from your Wishlist`, service: svc?.logo_path },
		show && { card: show, when: "8:00 pm", title: "New episode tonight", sub: show.title },
		side && sideName && { card: { poster_path: side.poster }, when: "today", title: `New for your ${sideName} side`, sub: side.title },
		best && { card: best, when: "this week", title: `${best.title} scores ${scoreOf(best)}`, sub: "Critics and audiences agree" },
	].filter(Boolean) as { card: { poster_path: string | null }; when: string; title: string; sub: string; service?: string | null }[]
	return (
		<>
			<div className="lpc-et-sea" style={{ opacity: 0.55 }} />
			<Headline kicker="Keeps track" text="It keeps *watch* for you." delay={200} className="lpc-et-narrow" />
			<div className="absolute flex flex-col gap-[1.2cqw]" style={{ right: "5cqw", top: "9cqh" }}>
				{notes.map((n, i) => (
					<Note
						key={n.title}
						{...n}
						className="lpc-et-a"
						style={at("lpc-et-from", 1300 + i * 1000, 900, DEAL, { "--fx": "12cqw", "--fs": "0.96" } as React.CSSProperties)}
					/>
				))}
			</div>
			<div className="lpc-et-head" style={{ top: "auto", bottom: "12cqh", maxWidth: "38cqw" }}>
				<p className="lpc-et-line lpc-et-a" style={at("lpc-et-rise", 1000, 800)}>
					Across every service, for the shows you follow and the titles you want to see.
				</p>
			</div>
			<Example delay={600} />
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** B. Want to See, then the day it lands: one press, a wait, the service's mark slams onto the poster. */
export function TrackingLands({ data }: ClipProps) {
	const on = streaming(data.landing)
	const card = on.find((c) => c.media_type === "movie") ?? on[0]
	if (!card) return empty
	const svc = card.services!.find((s) => s.logo_path)!
	return (
		<>
			<div className="lpc-et-sea" style={{ opacity: 0.5 }} />
			<div className="absolute" style={{ left: "12cqw", top: "16cqh", width: "22cqw" }}>
				<div className="lpc-et-a" style={at("lpc-et-deal", 300, 900, DEAL)}>
					<div className="relative">
						<Poster path={card.poster_path} style={{ width: "22cqw" }} />
						<div className="lpc-et-badge lpc-et-a" style={at("lpc-et-slam", 3700, 700, DEAL)}>
							<img src={logo(svc.logo_path)} alt={svc.name} />
							<span className="lpc-et-badge-text">Now on {svc.name}</span>
						</div>
					</div>
				</div>
				<div className="lpc-et-want" style={{ marginTop: "2cqw" }}>
					<span className="lpc-et-pill lpc-et-a2" style={at2(["lpc-et-rise", 900, 700], ["lpc-et-out", 1900, 300])}>
						+ Want to See
					</span>
					<span className="lpc-et-pill lpc-et-off lpc-et-a" style={at("lpc-et-pop", 1950, 600, DEAL)}>
						✓ On your Wishlist
					</span>
				</div>
			</div>
			<div className="lpc-et-head" style={{ left: "42cqw", top: "20cqh", maxWidth: "52cqw" }}>
				<div className="lpc-et-kicker lpc-et-a" style={at("lpc-et-rise", 300, 700)}>
					Keeps track
				</div>
				<h2 className="lpc-et-h lpc-et-h-mid">
					<span className="block lpc-et-a" style={at("lpc-et-rise", 600, 800)}>
						Want it once.
					</span>
					<span className="block lpc-et-a" style={at("lpc-et-rise", 2600, 900)}>
						Hear the <span className="lpc-et-accent">day</span> it lands
					</span>
					<span className="block lpc-et-a" style={at("lpc-et-rise", 2800, 900)}>
						on your service.
					</span>
				</h2>
				<p className="lpc-et-line lpc-et-a" style={{ marginTop: "2cqw", ...at("lpc-et-rise", 4300, 800) }}>
					<b>{card.title}</b> streams on {svc.name} where you live.
				</p>
			</div>
			<Example delay={600} />
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** C. My shows: the shows a member follows, the one with a new episode rises to the top. */
export function TrackingShows({ data }: ClipProps) {
	const shows = data.landing.filter((c) => c.media_type === "show" && c.poster_path).slice(0, 3)
	if (shows.length < 2) return empty
	const lead = shows[0]
	return (
		<>
			{lead.backdrop_path && (
				<img
					src={tmdbImageUrl(lead.backdrop_path, "w1280")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover lpc-et-a"
					style={{ opacity: 0.35, ...at("lpc-et-fade", 0, 1400) }}
				/>
			)}
			<div className="lpc-et-scrim" style={{ background: "linear-gradient(90deg, rgba(5,6,10,.95) 0%, rgba(5,6,10,.7) 55%, rgba(5,6,10,.4) 100%)" }} />
			<Headline kicker="My shows" text="Always know *what's* *next.*" delay={200} />
			<div className="absolute z-[4] flex flex-col gap-[1cqw]" style={{ left: "6cqw", top: "39cqh", width: "52cqw" }}>
				{shows.map((s, i) => (
					<div key={s.key} className="lpc-et-show lpc-et-a" style={at("lpc-et-from", 1200 + i * 260, 900, DEAL, { "--fy": "30%" } as React.CSSProperties)}>
						<Poster path={s.poster_path} />
						<div className="min-w-0">
							<div className="lpc-et-note-title">{s.title}</div>
							<div className="lpc-et-note-sub">{i === 0 ? "Next episode, out tonight" : i === 1 ? "Continue where you left off" : "Waiting for episodes"}</div>
						</div>
						{i === 0 && (
							<span className="lpc-et-new lpc-et-a" style={at("lpc-et-pop", 2700, 600, DEAL)}>
								New
							</span>
						)}
					</div>
				))}
			</div>
			<Example delay={600} />
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** D. Bring your history: the import sources fly into GoodWatch and come out as a taste, ready on day one. */
export function TrackingImport({ data }: ClipProps) {
	const sources = IMPORT_SOURCE_LIST.filter((s) => s.id !== "csv").slice(0, 8)
	const posters = data.startTitles.flatMap((t) => t.poster_path ?? []).slice(0, 4)
	const g = { x: 55, y: 60 }
	return (
		<>
			<div className="lpc-et-sea" style={{ opacity: 0.6 }} />
			<Headline kicker="Your history" text="Bring your *ratings* with you." delay={200} />
			{sources.map((s, i) => {
				const x = 10 + (i % 4) * 10.5
				const y = 48 + Math.floor(i / 4) * 21
				return (
					<div
						key={s.id}
						className="lpc-et-src lpc-et-a2"
						style={{
							left: `${x}cqw`,
							top: `${y}cqh`,
							...at2(["lpc-et-pop", 900 + i * 110, 650, DEAL], ["lpc-et-away", 2500 + i * 90, 700, "cubic-bezier(.55,0,.75,.2)"]),
							"--tx": `${g.x - x}cqw`,
							"--ty": `${g.y - y}cqh`,
						} as React.CSSProperties}
						title={s.name}
					>
						{s.logo ? <img src={s.logo} alt={s.name} /> : s.tile}
					</div>
				)
			})}
			<div className="lpc-et-g lpc-et-a2" style={{ left: `${g.x}cqw`, top: `${g.y}cqh`, ...at2(["lpc-et-pop", 1600, 800, DEAL], ["lpc-et-gulp", 3200, 700, "ease-in-out"]) }}>
				<GoodWatchG height="9cqw" />
			</div>
			<div className="absolute flex" style={{ left: "67cqw", top: "44cqh", gap: "1cqw" }}>
				{posters.map((p, i) => (
					<div key={p} className="lpc-et-a" style={{ marginTop: `${(i % 2) * 6}cqh`, ...at("lpc-et-from", 3500 + i * 170, 800, DEAL, { "--fx": "-10cqw", "--fs": "0.6" } as React.CSSProperties) }}>
						<Poster path={p} style={{ width: "5.8cqw" }} />
					</div>
				))}
			</div>
			<div className="lpc-et-row lpc-et-line" style={{ top: "89cqh" }}>
				<span className="lpc-et-a" style={at("lpc-et-rise", 4300, 800)}>
					IMDb, Letterboxd, Trakt, Plex and more. <b>Your taste is ready on day one.</b>
				</span>
			</div>
		</>
	)
}


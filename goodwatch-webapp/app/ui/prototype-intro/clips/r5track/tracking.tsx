// PROTOTYPE - throwaway. Chapter 9, "keeps track for you" (round 5). The owner's direction: want it once, then what's
// next in My shows with its different groups (Continue, Waiting for episodes, Pick up, Start), then bring your
// tracking and ratings with you. Member moments are examples and say so; titles and services are real.
import type { CSSProperties } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import type { ClipProps } from "../../clip"
import { A, DEAL, Example, Headline, Poster, STATUSES, SWEEP, at, img, picks } from "./kit"

const SOURCES = IMPORT_SOURCE_LIST.filter((s) => s.id !== "csv").slice(0, 8)
const empty = <div className="absolute inset-0" />

function Source({ s, style, className }: { s: (typeof SOURCES)[number]; style: CSSProperties; className: string }) {
	return (
		<div className={`lpc-r5track-src ${className}`} style={style} title={s.name}>
			{s.logo ? <img src={s.logo} alt={s.name} /> : s.tile}
		</div>
	)
}

/** One My shows row: poster, name, what's next, and its group as a chip. */
function Row({ card, status, style, chipStyle, className }: { card: { poster_path: string | null; title: string }; status: (typeof STATUSES)[number]; style: CSSProperties; chipStyle: CSSProperties; className: string }) {
	return (
		<div className={`lpc-r5track-row ${className}`} style={style}>
			<Poster path={card.poster_path} />
			<div className="lpc-r5track-row-body">
				<div className="lpc-r5track-row-title">{card.title}</div>
				<div className="lpc-r5track-row-sub">{status.sub}</div>
			</div>
			<span className={`lpc-r5track-chip lpc-r5track-a ${status.hot ? "lpc-r5track-chip-hot" : ""}`} style={chipStyle}>
				{status.chip}
			</span>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** A. Three stages that slide on: want it once → what's next → bring your ratings. */
export function TrackingStages({ data }: ClipProps) {
	const { movie, service, shows, posters } = picks(data)
	if (!movie || !service || shows.length < 4) return empty
	const G = { x: 50, y: 58 }
	const ring = SOURCES.map((_, i) => {
		const a = (i / SOURCES.length) * Math.PI * 2 - Math.PI / 2
		return { x: G.x + Math.cos(a) * 30, y: G.y + Math.sin(a) * 20 }
	})
	const leave = (d: number): Parameters<typeof at>[0] => ["lpc-r5track-to", d, 800, SWEEP]
	return (
		<>
			<div className="lpc-r5track-glow" />
			<Example delay={500} />

			{/* 1. Want it once */}
			<div className={`absolute inset-0 ${A()}`} style={at(leave(4400), undefined, undefined, { "--tx": "-18cqw" } as CSSProperties)}>
				<div className="absolute" style={{ left: "6cqw", top: "12cqh", width: "50cqw" }}>
					<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", 200, 700])}>
						Keeps track
					</div>
					<Headline text="Want it *once.*" delay={350} className="mt-[1cqh]" />
					<div className="lpc-r5track-stack" style={{ marginTop: "4cqh" }}>
						<span className={`lpc-r5track-pill ${A(1, 1)}`} style={at(["lpc-r5track-rise", 1000, 700], ["lpc-r5track-press", 1500, 350], ["lpc-r5track-out", 1850, 200])}>
							+ Want to See
						</span>
						<span className="lpc-r5track-pill lpc-r5track-pill-off lpc-r5track-a" style={at(["lpc-r5track-pop", 1900, 600, DEAL])}>
							✓ On your Wishlist
						</span>
					</div>
					<p className="lpc-r5track-h lpc-r5track-h-mid lpc-r5track-a" style={{ marginTop: "4cqh", ...at(["lpc-r5track-rise", 2300, 850]) }}>
						We'll tell you the <span className="lpc-r5track-accent">day it lands.</span>
					</p>
				</div>
				<div className="absolute" style={{ left: "64cqw", top: "11cqh", width: "22cqw" }}>
					<div className="relative lpc-r5track-a" style={at(["lpc-r5track-deal", 450, 900, DEAL])}>
						<Poster path={movie.poster_path} style={{ width: "22cqw" }} />
						<div className="lpc-r5track-badge lpc-r5track-a" style={at(["lpc-r5track-slam", 3000, 700, DEAL])}>
							<img src={img(service.logo_path, "w92")} alt="" />
							Now on {service.name}
						</div>
					</div>
				</div>
			</div>

			{/* 2. What's next */}
			<div className={`absolute inset-0 ${A()}`} style={at(leave(9000), undefined, undefined, { "--ty": "-6cqh", "--ts": "0.94" } as CSSProperties)}>
				<div className="absolute" style={{ left: "6cqw", top: "9cqh", width: "60cqw" }}>
					<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", 4700, 700])}>
						My shows
					</div>
					<Headline text="Always know what's *next.*" delay={4850} className="mt-[1cqh] lpc-r5track-h-mid" />
				</div>
				<div className="lpc-r5track-rows lpc-r5track-stage-rows absolute" style={{ left: "6cqw", top: "27cqh", width: "58cqw" }}>
					{shows.map((s, i) => (
						<Row
							key={s.key}
							card={s}
							status={STATUSES[i]}
							className="lpc-r5track-a"
							style={at(["lpc-r5track-from", 5300 + i * 200, 900, DEAL], undefined, undefined, { "--fx": "24cqw" } as CSSProperties)}
							chipStyle={at(["lpc-r5track-pop", 6300 + i * 220, 600, DEAL])}
						/>
					))}
				</div>
				<div className="absolute lpc-r5track-a lpc-r5track-hide-phone" style={{ left: "70cqw", top: "16cqh", ...at(["lpc-r5track-deal", 5100, 900, DEAL]) }}>
					<Poster path={shows[0].poster_path} style={{ width: "22cqw" }} />
				</div>
			</div>

			{/* 3. Bring your ratings */}
			<div className="absolute" style={{ left: "6cqw", top: "9cqh", width: "88cqw" }}>
				<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", 9300, 700])}>
					Your history
				</div>
				<Headline text="Bring your *ratings* with you." delay={9450} className="mt-[1cqh] lpc-r5track-h-mid" />
			</div>
			{SOURCES.map((s, i) => (
				<Source
					key={s.id}
					s={s}
					className={A(1)}
					style={{
						left: `${ring[i].x}cqw`,
						top: `${ring[i].y}cqh`,
						...at(["lpc-r5track-pop", 9800 + i * 90, 650, DEAL], ["lpc-r5track-to", 11100 + i * 60, 750, "cubic-bezier(.55,0,.75,.2)"]),
						"--tx": `${G.x - ring[i].x}cqw`,
						"--ty": `${G.y - ring[i].y}cqh`,
						"--ts": "0.25",
					} as CSSProperties}
				/>
			))}
			<div className={`lpc-r5track-g ${A(1, 1)}`} style={{ left: `${G.x}cqw`, top: `${G.y}cqh`, ...at(["lpc-r5track-pop", 10300, 800, DEAL], ["lpc-r5track-gulp", 11700, 600, "ease-in-out"], ["lpc-r5track-out", 12200, 400]) }}>
				<GoodWatchG height="8cqw" />
			</div>
			<div className="absolute flex justify-center" style={{ left: 0, right: 0, top: "58cqh", gap: "1.2cqw", transform: "translateY(-50%)" }}>
				{posters.map((p, i) => {
					const offset = (i - (posters.length - 1) / 2) * 10.7
					return (
						<div key={p} className="lpc-r5track-a" style={at(["lpc-r5track-from", 12150 + i * 60, 850, DEAL], undefined, undefined, { "--fx": `${-offset}cqw`, "--fs": "0.3" } as CSSProperties)}>
							<Poster path={p} style={{ width: "9.5cqw" }} />
						</div>
					)
				})}
			</div>
			<p className="lpc-r5track-line absolute lpc-r5track-a" style={{ left: 0, right: 0, top: "79cqh", textAlign: "center", ...at(["lpc-r5track-rise", 12600, 800]) }}>
				IMDb, Letterboxd, Trakt, Plex and more. <b>Your taste is ready on day one.</b>
			</p>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** B. A feed that scrolls on: the words on the left change with it. */
export function TrackingFeed({ data }: ClipProps) {
	const { movie, service, shows } = picks(data)
	if (!movie || !service || shows.length < 4) return empty
	const says = [
		{ kicker: "Keeps track", h: "Want it *once.*", line: "We'll tell you the day it lands on your service.", at: 300, out: 4300 },
		{ kicker: "My shows", h: "Always know what's *next.*", line: "New episodes, shows to pick up, shows to start.", at: 5300, out: 9000 },
		{ kicker: "Your history", h: "Bring your *ratings* with you.", line: "From IMDb, Letterboxd, Trakt, Plex and more.", at: 9900, out: 0 },
	]
	return (
		<>
			<div className="lpc-r5track-glow" style={{ left: "-40%" }} />
			<Example delay={500} />
			<div className="lpc-r5track-says">
				{says.map((s) => (
					<div key={s.h} className={s.out ? A() : ""} style={s.out ? at(["lpc-r5track-to", s.out, 600, SWEEP], undefined, undefined, { "--ty": "-5cqh" } as CSSProperties) : undefined}>
						<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", s.at - 150, 700])}>
							{s.kicker}
						</div>
						<Headline text={s.h} delay={s.at} className="mt-[1cqh] lpc-r5track-h-mid" />
						<p className="lpc-r5track-line lpc-r5track-a" style={{ marginTop: "2.4cqh", ...at(["lpc-r5track-rise", s.at + 700, 800]) }}>
							{s.line}
						</p>
					</div>
				))}
			</div>
			<div className="lpc-r5track-feed-view">
				<div className="lpc-r5track-feed">
					{/* Panel 1: Want to See, then the day it lands */}
					<div className="lpc-r5track-panel">
						<div className="lpc-r5track-note lpc-r5track-a" style={at(["lpc-r5track-from", 500, 900, DEAL], undefined, undefined, { "--fy": "10cqh" } as CSSProperties)}>
							<Poster path={movie.poster_path} />
							<div className="min-w-0 flex-1">
								<div className="lpc-r5track-row-title">{movie.title}</div>
								<div className="lpc-r5track-stack" style={{ marginTop: "1.2cqh" }}>
									<span className={`lpc-r5track-pill ${A(1, 1)}`} style={at(["lpc-r5track-fade", 800, 400], ["lpc-r5track-press", 1400, 350], ["lpc-r5track-out", 1750, 200])}>
										+ Want to See
									</span>
									<span className="lpc-r5track-pill lpc-r5track-pill-off lpc-r5track-a" style={at(["lpc-r5track-pop", 1800, 600, DEAL])}>
										✓ On your Wishlist
									</span>
								</div>
							</div>
						</div>
						<div className="lpc-r5track-note lpc-r5track-a" style={at(["lpc-r5track-from", 2700, 900, DEAL], undefined, undefined, { "--fy": "8cqh", "--fs": "0.96" } as CSSProperties)}>
							<img src={img(service.logo_path, "w92")} alt="" className="lpc-r5track-logo" />
							<div className="min-w-0 flex-1">
								<div className="lpc-r5track-note-from">
									<span>GoodWatch</span>
									<span>now</span>
								</div>
								<div className="lpc-r5track-row-title">Now on {service.name}</div>
								<div className="lpc-r5track-row-sub">{movie.title}, from your Wishlist</div>
							</div>
						</div>
					</div>
					{/* Panel 2: My shows */}
					<div className="lpc-r5track-panel lpc-r5track-rows">
						{shows.map((s, i) => (
							<Row
								key={s.key}
								card={s}
								status={STATUSES[i]}
								className="lpc-r5track-a"
								style={at(["lpc-r5track-from", 5500 + i * 180, 800, DEAL], undefined, undefined, { "--fy": "6cqh" } as CSSProperties)}
								chipStyle={at(["lpc-r5track-pop", 6300 + i * 200, 600, DEAL])}
							/>
						))}
					</div>
					{/* Panel 3: your history comes along */}
					<div className="lpc-r5track-panel">
						<div className="lpc-r5track-tiles">
							{SOURCES.map((s, i) => (
								<div key={s.id} className="lpc-r5track-tile lpc-r5track-a" style={at(["lpc-r5track-pop", 9900 + i * 100, 650, DEAL])} title={s.name}>
									{s.logo ? <img src={s.logo} alt={s.name} /> : s.tile}
								</div>
							))}
						</div>
						<div className="lpc-r5track-note lpc-r5track-a" style={at(["lpc-r5track-from", 11300, 900, DEAL], undefined, undefined, { "--fy": "6cqh" } as CSSProperties)}>
							<GoodWatchG height="5cqw" />
							<div className="min-w-0 flex-1">
								<div className="lpc-r5track-row-title">Your ratings came with you</div>
								<div className="lpc-r5track-row-sub">Your picks are ready on day one.</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** C. Big words: want it once, then each My shows group as one huge word over its show, then the sources pour in. */
export function TrackingWords({ data }: ClipProps) {
	const { movie, service, shows } = picks(data)
	if (!movie || !service || shows.length < 4) return empty
	// The owner's words: now, pick up, start. "Now" is Continue's next episode, out now.
	const beats = [
		{ word: "Now.", show: shows[0], line: "The next episode is out." },
		{ word: "Pick up.", show: shows[2], line: "Right where you left off." },
		{ word: "Start.", show: shows[3], line: "Next on your Wishlist." },
	]
	const BEAT = 1750
	const first = 4100
	return (
		<>
			<Example delay={500} />
			{/* Want it once */}
			<div className={`absolute inset-0 ${A()}`} style={at(["lpc-r5track-to", 3700, 600, SWEEP], undefined, undefined, { "--ts": "1.06" } as CSSProperties)}>
				<div className="lpc-r5track-glow" />
				<div className="absolute" style={{ left: "6cqw", top: "18cqh", width: "52cqw" }}>
					<Headline text="Want it *once.*" delay={250} className="lpc-r5track-h-huge" />
					<p className="lpc-r5track-h lpc-r5track-h-mid lpc-r5track-a" style={{ marginTop: "3cqh", ...at(["lpc-r5track-rise", 1700, 850]) }}>
						Hear the day it lands.
					</p>
				</div>
				<div className="absolute" style={{ left: "66cqw", top: "12cqh" }}>
					<div className="relative lpc-r5track-a" style={at(["lpc-r5track-deal", 400, 900, DEAL])}>
						<Poster path={movie.poster_path} style={{ width: "21cqw" }} />
						<div className="lpc-r5track-badge lpc-r5track-a" style={at(["lpc-r5track-slam", 2300, 700, DEAL])}>
							<img src={img(service.logo_path, "w92")} alt="" />
							Now on {service.name}
						</div>
					</div>
				</div>
			</div>
			{/* The groups, one word each */}
			{beats.map((b, i) => {
				const t = first + i * BEAT
				return (
					<div key={b.word} className={`lpc-r5track-beat ${A(1)}`} style={at(["lpc-r5track-in", t, 500], ["lpc-r5track-out", t + BEAT - 300, 380])}>
						{b.show.backdrop_path && <img src={img(b.show.backdrop_path, "w1280")} alt="" className="lpc-r5track-art lpc-r5track-a" style={at(["lpc-r5track-from", t, BEAT + 600, "linear"], undefined, undefined, { "--fs": "1.08" } as CSSProperties)} />}
						<div className="lpc-r5track-shade" />
						<div className="lpc-r5track-beat-words">
							<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", t + 100, 600])}>
								My shows · {b.show.title}
							</div>
							<div className="lpc-r5track-h lpc-r5track-h-huge lpc-r5track-a" style={{ marginTop: "1cqh", ...at(["lpc-r5track-from", t + 150, 700, "cubic-bezier(.16,1,.3,1)"], undefined, undefined, { "--fx": "-6cqw" } as CSSProperties) }}>
								<span className={i === 0 ? "lpc-r5track-accent" : ""}>{b.word}</span>
							</div>
							<p className="lpc-r5track-line lpc-r5track-a" style={{ marginTop: "2cqh", ...at(["lpc-r5track-rise", t + 450, 600]) }}>
								{b.line}
							</p>
						</div>
					</div>
				)
			})}
			{/* The sources pour in and fold into GoodWatch */}
			<div className="absolute" style={{ left: "6cqw", top: "10cqh", width: "88cqw" }}>
				<Headline text="Bring your *ratings* along." delay={first + 3 * BEAT + 200} className="lpc-r5track-h-mid" />
			</div>
			{SOURCES.map((s, i) => {
				const x = 16 + i * 9.7
				const t = first + 3 * BEAT + 500 + i * 110
				return (
					<Source
						key={s.id}
						s={s}
						className={A(1)}
						style={{
							left: `${x}cqw`,
							top: "52cqh",
							...at(["lpc-r5track-from", t, 900, "cubic-bezier(.2,1.3,.4,1)"], ["lpc-r5track-to", first + 3 * BEAT + 2300 + i * 50, 700, "cubic-bezier(.55,0,.75,.2)"]),
							"--fy": "-60cqh",
							"--tx": `${50 - x}cqw`,
							"--ts": "0.2",
						} as CSSProperties}
					/>
				)
			})}
			<div className="lpc-r5track-g lpc-r5track-a" style={{ left: "50cqw", top: "52cqh", ...at(["lpc-r5track-pop", first + 3 * BEAT + 2800, 800, DEAL]) }}>
				<GoodWatchG height="9cqw" />
			</div>
			<p className="lpc-r5track-h lpc-r5track-h-mid absolute lpc-r5track-a" style={{ left: 0, right: 0, top: "72cqh", textAlign: "center", ...at(["lpc-r5track-rise", first + 3 * BEAT + 3200, 850]) }}>
				Ready on <span className="lpc-r5track-accent">day one.</span>
			</p>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** D. Exploration: a week with GoodWatch. Seven days, one moment each, from your ratings arriving to Sunday's start. */
export function TrackingWeek({ data }: ClipProps) {
	const { movie, service, shows } = picks(data)
	if (!movie || !service || shows.length < 4) return empty
	const imdb = SOURCES.find((s) => s.id === "imdb") ?? SOURCES[0]
	const days: { day: string; what: string; sub: string; poster?: string | null; tile?: boolean; hot?: boolean }[] = [
		{ day: "Mon", what: "Your IMDb ratings came along", sub: "Picks ready", tile: true },
		{ day: "Tue", what: "Want to See", sub: movie.title, poster: movie.poster_path },
		{ day: "Wed", what: `Now on ${service.name}`, sub: movie.title, poster: movie.poster_path, hot: true },
		{ day: "Thu", what: "Next episode, out now", sub: shows[0].title, poster: shows[0].poster_path },
		{ day: "Fri", what: "Waiting for episodes", sub: shows[1].title, poster: shows[1].poster_path },
		{ day: "Sat", what: "Pick up", sub: shows[2].title, poster: shows[2].poster_path },
		{ day: "Sun", what: "Start", sub: shows[3].title, poster: shows[3].poster_path },
	]
	return (
		<>
			<div className="lpc-r5track-glow" style={{ top: "-40%" }} />
			<Example delay={500} />
			<div className="absolute" style={{ left: "4cqw", top: "8cqh", width: "80cqw" }}>
				<div className="lpc-r5track-kicker lpc-r5track-a" style={at(["lpc-r5track-rise", 200, 700])}>
					Keeps track
				</div>
				<Headline text="A week with *GoodWatch.*" delay={350} className="mt-[1cqh] lpc-r5track-h-mid" />
			</div>
			<div className="lpc-r5track-week">
				{days.map((d, i) => {
					const t = 1200 + i * 850
					return (
						<div key={d.day} className="lpc-r5track-day lpc-r5track-a" style={at(["lpc-r5track-fade", 700 + i * 70, 600])}>
							{d.hot && <div className="absolute inset-0 rounded-[1.2cqw] lpc-r5track-day-hot lpc-r5track-a" style={at(["lpc-r5track-glow", t + 300, 700, DEAL])} />}
							<div className="lpc-r5track-day-name">{d.day}</div>
							<div className="lpc-r5track-day-card lpc-r5track-a" style={at(["lpc-r5track-from", t, 850, DEAL], undefined, undefined, { "--fy": "-14cqh", "--fs": "1.08" } as CSSProperties)}>
								{d.tile ? (
									<div className="lpc-r5track-tile" style={{ aspectRatio: "2 / 3", width: "100%" }}>
										{imdb.logo ? <img src={imdb.logo} alt={imdb.name} /> : imdb.tile}
									</div>
								) : (
									<Poster path={d.poster} />
								)}
								<div className="lpc-r5track-day-what">
									{d.what}
									<small>{d.sub}</small>
								</div>
							</div>
						</div>
					)
				})}
			</div>
			<p className="lpc-r5track-line absolute lpc-r5track-a" style={{ right: "4cqw", top: "24cqh", width: "50cqw", textAlign: "right", ...at(["lpc-r5track-rise", 7600, 800]) }}>
				Every service. Every show. <b className="lpc-r5track-accent">Handled.</b>
			</p>
		</>
	)
}

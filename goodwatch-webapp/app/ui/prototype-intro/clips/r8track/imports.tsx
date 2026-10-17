// PROTOTYPE - throwaway. Chapter 10, "bring your ratings" (round 8, from round 7's imports-flow-r7). The owner on
// round 7: "plex logo is broken - make the imported services smaller and less saturated one by one. the flying
// things inside can be also scores, bookmarks, and they should be bigger when starting to fly, then they can shrink
// while flying inside the G. same variations here".
//
// - Plex's logo (dark "plex" with the yellow chevron) sits on a light tile, so it reads.
// - The sources send their things one source after another: posters, rating chips and Wishlist bookmarks. Each
//   leaves its source big and shrinks on its way into the G.
// - Once a source has sent everything it shrinks a little and goes grey: a colour copy of the tile fades out over a
//   grey copy (a static filter), so only opacity and transform animate.
// - Two layouts: "flow" keeps round 7's (sources left, the G in the middle, picks right); "ring" puts the sources
//   in a ring around the G, then the G steps left and the picks fan out on the right.
//
// Logos: the app's own for IMDb, Trakt and TMDB; the others are prototype-only downloads (see
// r7track/imports.tsx for their sources; the app shows letter tiles for them because of their brand terms).
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { ClipProps } from "../../clip"
import { A, DEAL, Headline, Poster, at } from "../r7track/kit"

const SOURCES = [
	{ id: "imdb", name: "IMDb", logo: "/images/import-sources/imdb.svg", bg: "#f5c518", pad: "10%" },
	{ id: "letterboxd", name: "Letterboxd", logo: "/images/prototype-intro/letterboxd.png", bg: "#14181c", pad: "0" },
	{ id: "trakt", name: "Trakt", logo: "/images/import-sources/trakt.svg", bg: "#fff", pad: "14%" },
	{ id: "tmdb", name: "TMDB", logo: "/images/import-sources/tmdb.svg", bg: "#0d253f", pad: "14%" },
	// The Plex logo is dark type with a yellow chevron: it needs a light tile.
	{ id: "plex", name: "Plex", logo: "/images/prototype-intro/plex.svg", bg: "#f4f4f2", pad: "18%" },
	{ id: "kodi", name: "Kodi", logo: "/images/prototype-intro/kodi.png", bg: "#fff", pad: "4%" },
	{ id: "myanimelist", name: "MyAnimeList", logo: "/images/prototype-intro/myanimelist.png", bg: "#2e51a2", pad: "0" },
	{ id: "movielens", name: "MovieLens", logo: "/images/prototype-intro/movielens.svg", bg: "#fff", pad: "12%" },
]

type P = { x: number; y: number }
type Kind = "poster" | "score" | "bookmark"

/** What each source sends, in order: a mix of posters, rating chips and bookmarks, never the same pattern twice. */
const KINDS: Kind[][] = [
	["score", "poster", "bookmark"],
	["poster", "score", "poster"],
	["bookmark", "poster", "score"],
	["score", "bookmark", "poster"],
	["poster", "poster", "bookmark"],
	["score", "poster", "score"],
	["bookmark", "score", "poster"],
	["poster", "bookmark", "score"],
]
/** The rating chips' values: what people rated on those sites. */
const SCORES = ["9/10", "★ 4.5", "8/10", "♥ 10", "★ 5", "7/10", "9/10", "★ 4"]

// ---- Timing (ms at k = 1)
/** When the first source starts sending, the step between sources, and between one source's three things. */
const SEND = 1900
const STEP = 330
const EACH = 150
/** A thing's flight into the G. */
const FLY = 1050
const sendAt = (i: number, n: number) => SEND + i * STEP + n * EACH
/** When a source is done: its last thing has arrived. */
const doneAt = (i: number) => sendAt(i, 2) + FLY - 120
const LAST_DONE = doneAt(SOURCES.length - 1)

function Thing({ kind, poster, score }: { kind: Kind; poster?: string; score: string }) {
	if (kind === "poster") return <Poster path={poster} size="w154" className="lpc-r8track-thing-poster" />
	if (kind === "score")
		return (
			<span className="lpc-r8track-thing-score">
				<b>{score}</b>
			</span>
		)
	return (
		<span className="lpc-r8track-thing-bookmark" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 3h12v18l-6-4.6L6 21z" />
			</svg>
		</span>
	)
}

/** A source tile: the colour copy over a grey copy; once `done`, it shrinks a little and the colour fades out. */
function Source({ s, p, i }: { s: (typeof SOURCES)[number]; p: P; i: number }) {
	const done = doneAt(i)
	return (
		<div
			className={`lpc-r8track-src ${A(1)}`}
			style={{ left: `${p.x}cqw`, top: `${p.y}cqh`, ...at(["lpc-r7track-pop", 600 + i * 110, 650, DEAL], ["lpc-r8track-spent", done, 700]) }}
		>
			<span className="lpc-r8track-tile lpc-r8track-tile-grey" style={{ padding: s.pad }}>
				<img src={s.logo} alt="" draggable={false} />
			</span>
			<span className="lpc-r8track-tile lpc-r8track-tile-colour lpc-r7track-a" style={{ background: s.bg, padding: s.pad, ...at(["lpc-r7track-out", done, 700]) }}>
				<img src={s.logo} alt={s.name} draggable={false} />
			</span>
			<span className="lpc-r8track-name">{s.name}</span>
		</div>
	)
}

/** A source's three things, each flying from the tile's edge toward the G, big at first and small at the end. */
function Flights({ i, from, g, posters }: { i: number; from: P; g: P; posters: string[] }) {
	// Leave from the side of the tile that faces the G, so the things come out of the logo, not over it.
	const dx = g.x - from.x
	const dy = g.y - from.y
	const len = Math.hypot(dx, dy) || 1
	const edge = { x: from.x + (dx / len) * 5.2, y: from.y + (dy / len) * 8.5 }
	return (
		<>
			{KINDS[i].map((kind, n) => {
				const p = { x: edge.x + (n - 1) * 0.9, y: edge.y + (n - 1) * 1.4 }
				return (
					<div
						key={n}
						className="lpc-r8track-thing lpc-r7track-a"
						style={{
							left: `${p.x}cqw`,
							top: `${p.y}cqh`,
							...at(["lpc-r8track-fly", sendAt(i, n), FLY, "cubic-bezier(.4,0,.6,1)"]),
							"--tx": `${g.x - p.x}cqw`,
							"--ty": `${g.y - p.y}cqh`,
						} as CSSProperties}
					>
						<Thing kind={kind} poster={posters[(i * 3 + n) % Math.max(1, posters.length)]} score={SCORES[(i + n) % SCORES.length]} />
					</div>
				)
			})}
		</>
	)
}

/** The G, gulping as the things arrive. */
function TheG({ g, move }: { g: P; move?: { to: P; at: number } }) {
	const gulps = [0, 1, 2, 3].map((n) => SEND + FLY - 100 + n * Math.round((LAST_DONE - SEND - FLY) / 3))
	const inner = (
		<div
			className={`lpc-r7track-g ${A(1, 1)}`}
			style={{ left: `${g.x}cqw`, top: `${g.y}cqh`, ...at(["lpc-r7track-pop", 1300, 800, DEAL], ["lpc-r8track-gulps", gulps[0], gulps[3] - gulps[0] + 600, "linear"], ["lpc-r7track-gulp", LAST_DONE, 650, "ease-in-out"]) }}
		>
			<GoodWatchG height="12cqw" />
		</div>
	)
	if (!move) return inner
	return (
		<div
			className="lpc-r8track-gmove lpc-r7track-a"
			style={{ ...at(["lpc-r7track-to", move.at, 1000, "cubic-bezier(.65,0,.35,1)"]), "--tx": `${move.to.x - g.x}cqw`, "--ty": `${move.to.y - g.y}cqh`, "--to": 1 } as CSSProperties}
		>
			{inner}
		</div>
	)
}

function Head({ lineAt, children }: { lineAt: number; children?: ReactNode }) {
	return (
		<div className="lpc-r8track-head">
			<div className="lpc-r7track-kicker lpc-r7track-a" style={at(["lpc-r7track-rise", 100, 700])}>
				Your history
			</div>
			<Headline text="Bring your *ratings* with you." delay={200} className="lpc-r7track-h-mid" />
			<p className="lpc-r7track-line lpc-r7track-a lpc-r8track-line" style={at(["lpc-r7track-rise", lineAt, 800])}>
				From IMDb, Letterboxd, Trakt, Plex and more. <b>Your taste is ready on day one.</b>
			</p>
			{children}
		</div>
	)
}

/** The famous posters the sources send, and the six picks that come out (never the same ones). */
function posters(data: ClipProps["data"]) {
	const all = data.pool.slice(1).flatMap((c) => c.poster_path ?? [])
	return { picks: all.slice(0, 6), sent: all.slice(6) }
}

// ---- A. Flow: sources left (they stay, spent), the G in the middle, the picks right.
const FLOW_G = { x: 53, y: 58 }
const flowSrc = (i: number) => ({ x: 7.5 + (i % 4) * 9.4, y: 47 + Math.floor(i / 4) * 23 })
const flowPick = (i: number) => ({ x: 72 + (i % 3) * 9.4, y: 47 + Math.floor(i / 3) * 23 })
const PICKS_AT = LAST_DONE - 150

export function ImportsR8({ data }: ClipProps) {
	const { picks, sent } = posters(data)
	return (
		<>
			<div className="lpc-r7track-glow" style={{ left: "18%" }} />
			<Head lineAt={PICKS_AT + 900} />
			{SOURCES.map((s, i) => (
				<Source key={s.id} s={s} p={flowSrc(i)} i={i} />
			))}
			{SOURCES.map((s, i) => (
				<Flights key={s.id} i={i} from={flowSrc(i)} g={FLOW_G} posters={sent} />
			))}
			<TheG g={FLOW_G} />
			<div className="lpc-r7track-kicker lpc-r8track-picks-label lpc-r7track-a" style={{ left: "67.5cqw", top: "31cqh", ...at(["lpc-r7track-rise", PICKS_AT + 100, 700]) }}>
				Picked for you
			</div>
			{picks.map((p, i) => {
				const to = flowPick(i)
				return (
					<div
						key={p}
						className="lpc-r8track-pick lpc-r7track-a"
						style={{ left: `${to.x}cqw`, top: `${to.y}cqh`, ...at(["lpc-r7track-from", PICKS_AT + i * 140, 900, DEAL]), "--fx": `${FLOW_G.x - to.x}cqw`, "--fy": `${FLOW_G.y - to.y}cqh`, "--fs": "0.2" } as CSSProperties}
					>
						<Poster path={p} size="w185" />
					</div>
				)
			})}
		</>
	)
}
export const IMPORTS_R8_MS = PICKS_AT + 900 + 800 + 2400

// ---- B. Ring: the sources around the G; when all are spent they fade, the G steps left, the picks fan out right.
const RING_G = { x: 50, y: 58 }
const RING_G_END = { x: 31, y: 58 }
const ringSrc = (i: number) => {
	const a = ((-90 + i * 45) * Math.PI) / 180
	return { x: RING_G.x + Math.cos(a) * 29, y: RING_G.y + Math.sin(a) * 23.5 }
}
/** The fan: five picks, centred on the right, tilted like a hand of cards. */
const FAN = [-16, -8, 0, 8, 16]
const RING_MOVE = LAST_DONE + 350
const RING_PICKS = RING_MOVE + 650

export function ImportsR8Ring({ data }: ClipProps) {
	const { picks, sent } = posters(data)
	return (
		<>
			<div className="lpc-r7track-glow" style={{ left: "50%" }} />
			<Head lineAt={RING_PICKS + 900} />
			{/* The ring of sources: spent one by one, then the whole ring fades as the G steps aside. */}
			<div className="lpc-r7track-a" style={at(["lpc-r7track-out", RING_MOVE - 100, 700])}>
				{SOURCES.map((s, i) => (
					<Source key={s.id} s={s} p={ringSrc(i)} i={i} />
				))}
				{SOURCES.map((s, i) => (
					<Flights key={s.id} i={i} from={ringSrc(i)} g={RING_G} posters={sent} />
				))}
			</div>
			<TheG g={RING_G} move={{ to: RING_G_END, at: RING_MOVE }} />
			<div className="lpc-r7track-kicker lpc-r8track-picks-label lpc-r7track-a" style={{ left: "51cqw", top: "34cqh", ...at(["lpc-r7track-rise", RING_PICKS + 200, 700]) }}>
				Picked for you
			</div>
			{picks.slice(0, FAN.length).map((p, i) => {
				const to = { x: 57 + i * 6.8, y: 60 + Math.abs(FAN[i]) * 0.18 }
				return (
					<div
						key={p}
						className="lpc-r8track-pick lpc-r8track-fanpick lpc-r7track-a"
						style={{ left: `${to.x}cqw`, top: `${to.y}cqh`, zIndex: 2 + i, ...at(["lpc-r7track-from", RING_PICKS + i * 120, 900, DEAL]), "--fx": `${RING_G_END.x - to.x}cqw`, "--fy": `${RING_G_END.y - to.y}cqh`, "--fs": "0.2" } as CSSProperties}
					>
						<div style={{ transform: `rotate(${FAN[i]}deg)` }}>
							<Poster path={p} size="w185" />
						</div>
					</div>
				)
			})}
		</>
	)
}
export const IMPORTS_R8_RING_MS = RING_PICKS + 900 + 800 + 2400

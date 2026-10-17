// PROTOTYPE - throwaway. Round 10 of "bring your ratings" (chapter 10, from round 9's imports-r9). The owner on round 9:
// "your ratings - accelerating the stream inside. and before its done it should start spitting out the results one
// by one". The 24 things the sources send now leave faster and faster (each gap 0.88 of the one before, flights
// shortening too), so more of them are in the air toward the end; halfway through the stream the G starts sending
// out the picks one by one, so intake and output overlap; the stream ends while the last picks land, and the clip
// hands over to the quiz without a still moment.
//
// Earlier rounds: Plex on a light tile; each source shrinks and goes grey once spent; the things leave big and shrink
// into the G. Logos: the app's own for IMDb, Trakt and TMDB; the others are prototype-only downloads (see
// r7track/imports.tsx for their sources; the app shows letter tiles for them because of their brand terms).
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { ClipProps } from "../../clip"
import { A, DEAL, Headline, Poster, at } from "../r7track/kit"
import { Push } from "../r9c/kit"

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
/** The stream: 24 sends in source order; the first gap is 380 ms, each next 0.88 of the one before (at least 60 ms). */
const SEND = 1350
const FIRST_GAP = 380
const SENDS = (() => {
	const out: number[] = []
	let t = SEND
	let gap = FIRST_GAP
	for (let j = 0; j < 24; j++) {
		out.push(Math.round(t))
		t += gap
		gap = Math.max(60, gap * 0.88)
	}
	return out
})()
/** A thing's flight into the G: 1050 ms for the first, 650 ms for the last, so the stream speeds up in the air too. */
const flyOf = (j: number) => Math.round(1050 - (400 * j) / 23)
const sendAt = (i: number, n: number) => SENDS[i * 3 + n]
/** When a source is done: its last thing has arrived. */
const doneAt = (i: number) => sendAt(i, 2) + flyOf(i * 3 + 2) - 120
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
							...at(["lpc-r8track-fly", sendAt(i, n), flyOf(i * 3 + n), "cubic-bezier(.4,0,.6,1)"]),
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
	const first = SENDS[0] + flyOf(0) - 100
	const gulps = [0, 1, 2, 3].map((n) => first + n * Math.round((LAST_DONE - first) / 3))
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

// ---- Flow: sources left (they stay, spent), the G in the middle, the picks right.
const FLOW_G = { x: 53, y: 58 }
const flowSrc = (i: number) => ({ x: 7.5 + (i % 4) * 9.4, y: 47 + Math.floor(i / 4) * 23 })
const flowPick = (i: number) => ({ x: 72 + (i % 3) * 9.4, y: 47 + Math.floor(i / 3) * 23 })
/** The picks: the first leaves the G halfway through the stream; then one every 380 ms, each gap 0.85 of the last. */
const PICK_FROM = SENDS[12]
const PICK_TIMES = Array.from({ length: 6 }, (_, i) => Math.round(PICK_FROM + (380 * (1 - 0.85 ** i)) / 0.15))
const PICK_FLY = 850
/** The line rises with the third pick; the last pick lands at PICK_TIMES[5] + PICK_FLY. */
const LINE = PICK_TIMES[2]
const SETTLED = Math.max(PICK_TIMES[5] + PICK_FLY, LAST_DONE + 300)
/** The line lands at LINE + 800 and reads ~0.8 s before the 800 ms hand-over; never before everything has settled. */
export const IMPORTS_R10_MS = Math.max(LINE + 800 + 1600, SETTLED + 900)

export function ImportsR10({ data }: ClipProps) {
	const { picks, sent } = posters(data)
	return (
		<Push from={PICK_TIMES[3]} dur={IMPORTS_R10_MS - PICK_TIMES[3]} scale={1.03} origin="55% 55%">
			<div className="lpc-r7track-glow" style={{ left: "18%" }} />
			<Head lineAt={LINE} />
			{SOURCES.map((s, i) => (
				<Source key={s.id} s={s} p={flowSrc(i)} i={i} />
			))}
			{SOURCES.map((s, i) => (
				<Flights key={s.id} i={i} from={flowSrc(i)} g={FLOW_G} posters={sent} />
			))}
			<TheG g={FLOW_G} />
			<div className="lpc-r7track-kicker lpc-r8track-picks-label lpc-r7track-a" style={{ left: "67.5cqw", top: "31cqh", ...at(["lpc-r7track-rise", PICK_TIMES[0] - 150, 700]) }}>
				Picked for you
			</div>
			{picks.map((p, i) => {
				const to = flowPick(i)
				return (
					<div
						key={p}
						className="lpc-r8track-pick lpc-r7track-a"
						style={{ left: `${to.x}cqw`, top: `${to.y}cqh`, ...at(["lpc-r7track-from", PICK_TIMES[i], PICK_FLY, DEAL]), "--fx": `${FLOW_G.x - to.x}cqw`, "--fy": `${FLOW_G.y - to.y}cqh`, "--fs": "0.2" } as CSSProperties}
					>
						<Poster path={p} size="w185" />
					</div>
				)
			})}
		</Push>
	)
}

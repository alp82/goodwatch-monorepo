// PROTOTYPE (README clip "imports"): the intro's "Your ratings" picture as a calm loop, without its heading. The
// eight import sources sit in two rows on the left in full colour; their posters, rating chips and bookmarks slide
// out of the tiles into the channel between the rows and glide into the GoodWatch G, which gives a soft gulp on
// each arrival. The "Picked for you" posters on the right stay still. One period is IMPORTS_MS: a stream of
// sixteen sends, then a rest; nothing is in the air at the start or the end, so the clip loops without a seam.
import type { CSSProperties } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { Poster } from "~/ui/living-room/intro/parts/feed-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { assetUrl } from "~/utils/asset-url"
import "./imports.css"

/** Each source's tile: its brand colour behind the official mark (the intro dims these; here they stay bright). */
const LOOK: Record<string, { bg: string; pad: string }> = {
	imdb: { bg: "#f5c518", pad: "10%" },
	letterboxd: { bg: "#202830", pad: "9%" },
	trakt: { bg: "#fff", pad: "14%" },
	tmdb: { bg: "#0d253f", pad: "14%" },
	plex: { bg: "#282a2d", pad: "0" },
	kodi: { bg: "#fff", pad: "0" },
	myanimelist: { bg: "#2e51a2", pad: "12%" },
	movielens: { bg: "#fff", pad: "0" },
}
/** Shorter labels where the Imports page's name is long. */
const SHORT: Record<string, string> = { myanimelist: "MyAnimeList" }
const SOURCES = [
	"imdb",
	"letterboxd",
	"trakt",
	"tmdb",
	"plex",
	"kodi",
	"myanimelist",
	"movielens",
].flatMap((id) => {
	const s = IMPORT_SOURCE_LIST.find((x) => x.id === id)
	if (!s) return []
	return [{ id, name: SHORT[id] ?? s.name, logo: s.logo && assetUrl(s.logo), tile: s.tile, ...LOOK[id] }]
})

type P = { x: number; y: number }
type Kind = "poster" | "score" | "bookmark"

// ---- Layout (cqw across, cqh down). Top row: names above the tiles; bottom row: names below, so the channel
// between the rows stays clear for the things in flight.
const COLS = [7.5, 18.5, 29.5, 40.5]
const ROWS = [29, 71]
const G: P = { x: 56.5, y: 50 }
const src = (i: number): P => ({ x: COLS[i % 4], y: ROWS[Math.floor(i / 4)] })
const PICK_COLS = [72.5, 82.5, 92.5]
const PICK_ROWS = [36.3, 65.2]

// ---- Timing (ms at k = 1)
/** Which source sends, in order: every source twice, never two neighbours in a row. */
const ORDER = [0, 6, 3, 5, 1, 7, 2, 4, 6, 0, 5, 2, 7, 1, 4, 3]
const KINDS: Kind[] = ["poster", "score", "poster", "bookmark"]
const SCORES = ["9/10", "★ 4.5", "8/10", "★ 5", "10/10", "★ 4", "7/10", "♥"]
const FIRST = 400
const GAP = 400
/** A flight takes longer from farther away, so all things move at about the same speed. */
const flyOf = (p: P) => Math.round(1150 + Math.hypot(G.x - p.x, (G.y - p.y) * 0.53) * 14)
const SENDS = ORDER.map((i, j) => {
	const at = FIRST + j * GAP
	const fly = flyOf(src(i))
	return { i, j, at, fly, kind: KINDS[j % KINDS.length], arrive: at + fly }
})
const LAST_ARRIVAL = Math.max(...SENDS.map((s) => s.arrive))
/** The stream, then about 3.5 s of rest on the full picture. */
export const IMPORTS_MS = Math.ceil((LAST_ARRIVAL + 3500) / 100) * 100

const a = (name: string, d: number, du: number, ez?: string, extra?: Record<string, string | number>) =>
	({
		"--an": name,
		"--d": `${d}ms`,
		"--du": `${du}ms`,
		...(ez ? { "--ez": ez } : {}),
		...extra,
	}) as CSSProperties

function Thing({ kind, poster, score }: { kind: Kind; poster?: string; score: string }) {
	if (kind === "poster") return <Poster path={poster} size="w154" className="rm-imp-poster" />
	if (kind === "score")
		return (
			<span className="rm-imp-score">
				<b>{score}</b>
			</span>
		)
	return (
		<span className="rm-imp-bookmark" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M6 3h12v18l-6-4.6L6 21z" />
			</svg>
		</span>
	)
}

function Tile({ s, i }: { s: (typeof SOURCES)[number]; i: number }) {
	const p = src(i)
	const top = i < 4
	const sends = SENDS.filter((x) => x.i === i)
	// One soft nudge per send, nested so they add up without restarting each other.
	const tile = sends.reduceRight(
		(inner, x) => (
			<span key={x.j} className="rm-imp-a rm-imp-nudge" style={a("rm-imp-nudge", x.at, 520, "ease-in-out")}>
				{inner}
			</span>
		),
		<span className="rm-imp-tile" style={{ background: s.bg, padding: s.pad }}>
			{s.logo ? <img src={s.logo} alt="" draggable={false} /> : <b>{s.tile}</b>}
		</span>,
	)
	return (
		<div className={`rm-imp-src ${top ? "rm-imp-src-top" : ""}`} style={{ left: `${p.x}cqw`, top: `${p.y}cqh` }}>
			<span className="rm-imp-name">{s.name}</span>
			{tile}
		</div>
	)
}

/**
 * One thing's flight: it starts behind its tile, drops into the channel quickly (y eases out early) and glides
 * across to the G (x eases in and out), shrinking and fading as it goes in.
 */
function Flight({ send, poster }: { send: (typeof SENDS)[number]; poster?: string }) {
	const p = src(send.i)
	const score = SCORES[send.j % SCORES.length]
	return (
		<div className="rm-imp-thing" style={{ left: `${p.x}cqw`, top: `${p.y}cqh` }}>
			<div
				className="rm-imp-a"
				style={a("rm-imp-x", send.at, send.fly, "cubic-bezier(.45,0,.35,1)", { "--tx": `${G.x - p.x}cqw` })}
			>
				<div
					className="rm-imp-a"
					style={a("rm-imp-y", send.at, send.fly, "cubic-bezier(.25,.75,.35,1)", { "--ty": `${G.y - p.y}cqh` })}
				>
					<div className="rm-imp-a" style={a("rm-imp-life", send.at, send.fly, "linear")}>
						<Thing kind={send.kind} poster={poster} score={score} />
					</div>
				</div>
			</div>
		</div>
	)
}

function TheG() {
	const g = SENDS.reduceRight(
		(inner, x) => (
			<span key={x.j} className="rm-imp-a rm-imp-gulp" style={a("rm-imp-gulp", x.arrive - 120, 520, "ease-in-out")}>
				{inner}
			</span>
		),
		<span className="rm-imp-gbox">
			{/* The G's hole, filled with the glow's colour, so things vanish into the G instead of showing through. */}
			<span className="rm-imp-hole" />
			<GoodWatchG height="12cqw" style={{ position: "relative" }} />
		</span>,
	)
	return (
		<div className="rm-imp-g" style={{ left: `${G.x}cqw`, top: `${G.y}cqh` }}>
			{g}
		</div>
	)
}

export function ReadmeImports({ data }: SceneProps) {
	const all = data.pool.slice(1).flatMap((c) => c.poster_path ?? [])
	const picks = all.slice(0, 6)
	const sent = all.slice(6)
	return (
		<div
			className="rm-imp"
			role="img"
			aria-label="Ratings, posters and bookmarks flow from IMDb, Letterboxd, Trakt, TMDB, Plex, Kodi, MyAnimeList and MovieLens into GoodWatch, which shows six picks."
		>
			<div className="rm-imp-glow" />
			{SOURCES.map((s, i) => (
				<Tile key={s.id} s={s} i={i} />
			))}
			{SENDS.map((x) => (
				<Flight key={x.j} send={x} poster={sent[x.j % Math.max(1, sent.length)]} />
			))}
			<TheG />
			<div className="rm-imp-kicker" style={{ left: `${PICK_COLS[0] - 4.5}cqw`, top: "15cqh" }}>
				Picked for you
			</div>
			{picks.map((path, i) => (
				<div
					key={path}
					className="rm-imp-pick"
					style={{ left: `${PICK_COLS[i % 3]}cqw`, top: `${PICK_ROWS[Math.floor(i / 3)]}cqh` }}
				>
					<Poster path={path} size="w342" />
				</div>
			))}
		</div>
	)
}

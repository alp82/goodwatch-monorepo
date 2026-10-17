// "Your ratings": the import sources send their titles, ratings and bookmarks into the G, faster and faster, and the
// G sends picks out one by one while the stream still runs. The sources show as the Imports page shows them: official
// logos where it uses them, its letter tiles elsewhere.
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import {
	A,
	DEAL,
	Headline,
	Poster,
	at,
} from "~/ui/living-room/intro/parts/feed-kit"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { assetUrl } from "~/utils/asset-url"

/** The tile behind an official logo, as the Imports page draws it; letter tiles are the Imports page's grey. */
const LOOK: Record<string, { bg: string; pad: string }> = {
	imdb: { bg: "#f5c518", pad: "10%" },
	trakt: { bg: "#fff", pad: "14%" },
	tmdb: { bg: "#0d253f", pad: "14%" },
}
const LETTER_TILE = { bg: "#52525b", pad: "0" }
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
	const source = IMPORT_SOURCE_LIST.find((s) => s.id === id)
	if (!source) return []
	return [
		{
			id,
			name: source.name,
			logo: source.logo && assetUrl(source.logo),
			tile: source.tile,
			...(LOOK[id] ?? LETTER_TILE),
		},
	]
})

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

function Thing({
	kind,
	poster,
	score,
}: { kind: Kind; poster?: string; score: string }) {
	if (kind === "poster")
		return (
			<Poster path={poster} size="w154" className="intro-intake-thing-poster" />
		)
	if (kind === "score")
		return (
			<span className="intro-intake-thing-score">
				<b>{score}</b>
			</span>
		)
	return (
		<span className="intro-intake-thing-bookmark" aria-hidden="true">
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
			className={`intro-intake-src ${A(1)}`}
			style={{
				left: `${p.x}cqw`,
				top: `${p.y}cqh`,
				...at(
					["intro-feed-pop", 600 + i * 110, 650, DEAL],
					["intro-intake-spent", done, 700],
				),
			}}
		>
			<span
				className="intro-intake-tile intro-intake-tile-grey"
				style={{ padding: s.pad }}
			>
				{s.logo ? (
					<img src={s.logo} alt="" draggable={false} />
				) : (
					<b className="intro-intake-letter">{s.tile}</b>
				)}
			</span>
			<span
				className="intro-intake-tile intro-intake-tile-colour intro-feed-a"
				style={{
					background: s.bg,
					padding: s.pad,
					...at(["intro-feed-out", done, 700]),
				}}
			>
				{s.logo ? (
					<img src={s.logo} alt="" draggable={false} />
				) : (
					<b className="intro-intake-letter">{s.tile}</b>
				)}
			</span>
			<span className="intro-intake-name">{s.name}</span>
		</div>
	)
}

/** A source's three things, each flying from the tile's edge toward the G, big at first and small at the end. */
function Flights({
	i,
	from,
	g,
	posters,
}: { i: number; from: P; g: P; posters: string[] }) {
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
						className="intro-intake-thing intro-feed-a"
						style={
							{
								left: `${p.x}cqw`,
								top: `${p.y}cqh`,
								...at([
									"intro-intake-fly",
									sendAt(i, n),
									flyOf(i * 3 + n),
									"cubic-bezier(.4,0,.6,1)",
								]),
								"--tx": `${g.x - p.x}cqw`,
								"--ty": `${g.y - p.y}cqh`,
							} as CSSProperties
						}
					>
						<Thing
							kind={kind}
							poster={posters[(i * 3 + n) % Math.max(1, posters.length)]}
							score={SCORES[(i + n) % SCORES.length]}
						/>
					</div>
				)
			})}
		</>
	)
}

/** The G, gulping as the things arrive. */
function TheG({ g, move }: { g: P; move?: { to: P; at: number } }) {
	const first = SENDS[0] + flyOf(0) - 100
	const gulps = [0, 1, 2, 3].map(
		(n) => first + n * Math.round((LAST_DONE - first) / 3),
	)
	const inner = (
		<div
			className={`intro-feed-g ${A(1, 1)}`}
			style={{
				left: `${g.x}cqw`,
				top: `${g.y}cqh`,
				...at(
					["intro-feed-pop", 1300, 800, DEAL],
					["intro-intake-gulps", gulps[0], gulps[3] - gulps[0] + 600, "linear"],
					["intro-feed-gulp", LAST_DONE, 650, "ease-in-out"],
				),
			}}
		>
			<GoodWatchG height="12cqw" />
		</div>
	)
	if (!move) return inner
	return (
		<div
			className="intro-intake-gmove intro-feed-a"
			style={
				{
					...at(["intro-feed-to", move.at, 1000, "cubic-bezier(.65,0,.35,1)"]),
					"--tx": `${move.to.x - g.x}cqw`,
					"--ty": `${move.to.y - g.y}cqh`,
					"--to": 1,
				} as CSSProperties
			}
		>
			{inner}
		</div>
	)
}

function Head({ lineAt, children }: { lineAt: number; children?: ReactNode }) {
	return (
		<div className="intro-intake-head">
			<div
				className="intro-feed-kicker intro-feed-a"
				style={at(["intro-feed-rise", 100, 700])}
			>
				Your history
			</div>
			<Headline
				text="Bring your *ratings* with you."
				delay={200}
				className="intro-feed-h-mid"
			/>
			<p
				className="intro-feed-line intro-feed-a intro-intake-line"
				style={at(["intro-feed-rise", lineAt, 800])}
			>
				From IMDb, Letterboxd, Trakt, Plex and more.{" "}
				<b>Your taste is ready on day one.</b>
			</p>
			{children}
		</div>
	)
}

/** The famous posters the sources send, and the six picks that come out (never the same ones). */
function posters(data: SceneProps["data"]) {
	const all = data.pool.slice(1).flatMap((c) => c.poster_path ?? [])
	return { picks: all.slice(0, 6), sent: all.slice(6) }
}

// ---- Flow: sources left (they stay, spent), the G in the middle, the picks right.
const FLOW_G = { x: 53, y: 58 }
const flowSrc = (i: number) => ({
	x: 7.5 + (i % 4) * 9.4,
	y: 47 + Math.floor(i / 4) * 23,
})
const flowPick = (i: number) => ({
	x: 72 + (i % 3) * 9.4,
	y: 47 + Math.floor(i / 3) * 23,
})
/** The picks: the first leaves the G halfway through the stream; then one every 380 ms, each gap 0.85 of the last. */
const PICK_FROM = SENDS[12]
const PICK_TIMES = Array.from({ length: 6 }, (_, i) =>
	Math.round(PICK_FROM + (380 * (1 - 0.85 ** i)) / 0.15),
)
const PICK_FLY = 850
/** The line rises with the third pick; the last pick lands at PICK_TIMES[5] + PICK_FLY. */
const LINE = PICK_TIMES[2]
const SETTLED = Math.max(PICK_TIMES[5] + PICK_FLY, LAST_DONE + 300)
/** The line lands at LINE + 800 and reads ~0.8 s before the 800 ms hand-over; never before everything has settled. */
export const RATINGS_MS = Math.max(LINE + 800 + 1600, SETTLED + 900)

export function Ratings({ data }: SceneProps) {
	const { picks, sent } = posters(data)
	return (
		<Push
			from={PICK_TIMES[3]}
			dur={RATINGS_MS - PICK_TIMES[3]}
			scale={1.03}
			origin="55% 55%"
		>
			<div className="intro-feed-glow" style={{ left: "18%" }} />
			<Head lineAt={LINE} />
			{SOURCES.map((s, i) => (
				<Source key={s.id} s={s} p={flowSrc(i)} i={i} />
			))}
			{SOURCES.map((s, i) => (
				<Flights key={s.id} i={i} from={flowSrc(i)} g={FLOW_G} posters={sent} />
			))}
			<TheG g={FLOW_G} />
			<div
				className="intro-feed-kicker intro-intake-picks-label intro-feed-a"
				style={{
					left: "67.5cqw",
					top: "31cqh",
					...at(["intro-feed-rise", PICK_TIMES[0] - 150, 700]),
				}}
			>
				Picked for you
			</div>
			{picks.map((p, i) => {
				const to = flowPick(i)
				return (
					<div
						key={p}
						className="intro-intake-pick intro-feed-a"
						style={
							{
								left: `${to.x}cqw`,
								top: `${to.y}cqh`,
								...at(["intro-feed-from", PICK_TIMES[i], PICK_FLY, DEAL]),
								"--fx": `${FLOW_G.x - to.x}cqw`,
								"--fy": `${FLOW_G.y - to.y}cqh`,
								"--fs": "0.2",
							} as CSSProperties
						}
					>
						<Poster path={p} size="w185" />
					</div>
				)
			})}
		</Push>
	)
}

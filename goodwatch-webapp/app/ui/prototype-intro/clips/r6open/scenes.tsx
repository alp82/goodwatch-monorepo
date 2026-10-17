// PROTOTYPE - throwaway. Round 6 openers: a native-looking chat ("What are we watching tonight?") where every title
// is turned down, then the endless wall of posters, ending on "Deciding is hard." The evening passes quietly, never
// as a big clock: (A) the chat's own time separators jump, (B) a small status-bar clock ticks while the screen
// dims, (C) each message carries its own small time. All timing is CSS, scaled by the stage's --k (../../clip.ts).
import type { CSSProperties, ReactNode } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps, IntroData } from "../../clip"

/** An inline delay, in ms at k = 1. */
const delay = (ms: number): CSSProperties => ({ animationDelay: `calc(${ms}ms * var(--k))` })
const vars = (v: Record<string, string | number>) => v as CSSProperties

const posters = (data: IntroData) => [...new Set(data.pool.flatMap((c) => c.poster_path ?? []))]
const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

const Root = ({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) => (
	<div className={`lpc-r6open ${className}`} aria-label={label}>
		{children}
	</div>
)

/** Words that land one after another. */
function Words({ words, from, step = 240, amber = [] as number[] }: { words: string[]; from: number; step?: number; amber?: number[] }) {
	return (
		<>
			{words.map((w, i) => (
				<span key={`${w}-${i}`}>
					<span className={`lpc-r6open-word lpc-r6open-in ${amber.includes(i) ? "lpc-r6open-amber" : ""}`} style={delay(from + i * step)}>
						{w}
					</span>
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</>
	)
}

/** The closing line, the same in every variant; only the small line under it changes. */
function Tagline({ from, sub }: { from: number; sub: string }) {
	return (
		<div className="lpc-r6open-center">
			<h2 className="lpc-r6open-big">
				<Words words={["Deciding", "is", "hard."]} from={from} amber={[2]} />
			</h2>
			<p className="lpc-r6open-sub lpc-r6open-in" style={delay(from + 1000)}>
				{sub}
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The chat: a messaging app's thread. Suggestions come as link previews of real, famous titles; each is turned down.

const NO = ["Seen it twice.", "Eight seasons? Tonight?", "Too heavy for tonight."]

const meta = (c: LandingCard) => {
	const kind = c.media_type === "movie" ? "Movie" : "TV show"
	const time = c.media_type === "movie" && c.runtime ? ` · ${Math.floor(c.runtime / 60)}h ${String(c.runtime % 60).padStart(2, "0")}m` : ""
	return `${kind}${c.release_year ? ` · ${c.release_year}` : ""}${time}`
}

/** Three famous titles with a picture: the first a movie, then a show, then a movie, as people suggest them. */
function suggestions(data: IntroData) {
	const ok = data.pool.slice(1).filter((c) => c.backdrop_path && c.poster_path)
	const movies = ok.filter((c) => c.media_type === "movie")
	const shows = ok.filter((c) => c.media_type === "show")
	return [movies[0], shows[0], movies[1]].filter(Boolean) as LandingCard[]
}

type Row =
	| { kind: "sep"; text: string; at: number }
	| { kind: "them" | "me"; text: string; at: number; time?: string; typing?: boolean }
	| { kind: "card"; card: LandingCard; at: number; time?: string }
	| { kind: "read"; text: string; at: number }

/** The thread's rows, at their times. `times` gives each message's small time (variant C) or none. */
function chatRows(data: IntroData, { separators, times }: { separators: boolean; times: boolean }): Row[] {
	const [a, b, c] = suggestions(data)
	const t = (s: string) => (times ? s : undefined)
	const rows: Row[] = []
	if (separators) rows.push({ kind: "sep", text: "Today 8:02 PM", at: 150 })
	rows.push({ kind: "them", text: "What are we watching tonight?", at: 350, time: t("8:02 PM") })
	if (a) rows.push({ kind: "card", card: a, at: 1150, time: t("8:19 PM") })
	rows.push({ kind: "them", text: NO[0], at: 1900, typing: true, time: t("8:23 PM") })
	if (separators) rows.push({ kind: "sep", text: "9:14 PM", at: 2600 })
	if (b) rows.push({ kind: "card", card: b, at: 2800, time: t("9:14 PM") })
	rows.push({ kind: "them", text: NO[1], at: 3550, typing: true, time: t("9:31 PM") })
	if (separators) rows.push({ kind: "sep", text: "10:47 PM", at: 4250 })
	if (c) rows.push({ kind: "card", card: c, at: 4450, time: t("10:47 PM") })
	rows.push({ kind: "them", text: NO[2], at: 5200, typing: true, time: t("10:52 PM") })
	if (!times) rows.push({ kind: "read", text: "Read 10:52 PM", at: 5500 })
	return rows
}

/** The person on the other end. No real app's look, only the shape every messaging app shares. */
function ChatHeader({ status }: { status?: ReactNode }) {
	return (
		<div className={`lpc-r6open-head ${status ? "lpc-r6open-head-tall" : ""}`}>
			{status}
			<div className="lpc-r6open-who">
				<span className="lpc-r6open-avatar">S</span>
				<span className="lpc-r6open-name">Sam</span>
			</div>
		</div>
	)
}

function Bubble({ row }: { row: Extract<Row, { kind: "them" | "me" }> }) {
	return (
		<div className={`lpc-r6open-row lpc-r6open-row-${row.kind}`}>
			{row.typing && (
				<span className="lpc-r6open-typing" style={vars({ animationDelay: `calc(${row.at - 650}ms * var(--k))` })} aria-hidden="true">
					<i />
					<i />
					<i />
				</span>
			)}
			<div className={`lpc-r6open-bubble lpc-r6open-${row.kind} lpc-r6open-pop`} style={delay(row.at)}>
				{row.text}
			</div>
			{row.time && (
				<span className="lpc-r6open-time lpc-r6open-fadein" style={delay(row.at + 250)}>
					{row.time}
				</span>
			)}
		</div>
	)
}

/** A suggestion as a link preview: the picture, the name, what it is. Sent by "me", so on the right. */
function Card({ row }: { row: Extract<Row, { kind: "card" }> }) {
	const c = row.card
	return (
		<div className="lpc-r6open-row lpc-r6open-row-me">
			<div className="lpc-r6open-card lpc-r6open-pop" style={delay(row.at)}>
				<img src={tmdbImageUrl(c.backdrop_path ?? "", "w300")} alt="" />
				<span className="lpc-r6open-card-text">
					<b>{c.title}</b>
					<span>{meta(c)}</span>
				</span>
			</div>
			<div className="lpc-r6open-bubble lpc-r6open-me lpc-r6open-attached lpc-r6open-pop" style={delay(row.at + 120)}>
				This one?
			</div>
			{row.time && (
				<span className="lpc-r6open-time lpc-r6open-fadein" style={delay(row.at + 300)}>
					{row.time}
				</span>
			)}
		</div>
	)
}

/**
 * The thread: rows appear in place; `climbs` lift the whole thread at given times, as a real chat moves up when the
 * next message arrives (row heights are fixed in cqh, so the amounts are known).
 */
function Thread({ rows, climbs }: { rows: Row[]; climbs: { at: number; to: number }[] }) {
	// One keyframe animation per climb, layered: each moves the thread from the previous height to the next.
	return (
		<div className="lpc-r6open-view">
			{climbs.reduce<ReactNode>(
				(inner, c, i) => (
					<div
						className="lpc-r6open-climb"
						style={vars({ "--to": `calc(${-(c.to - (climbs[i - 1]?.to ?? 0))} * var(--u))`, animationDelay: `calc(${c.at}ms * var(--k))` })}
					>
						{inner}
					</div>
				),
				<div className="lpc-r6open-thread">
					{rows.map((r, i) =>
						r.kind === "sep" ? (
							<div key={i} className="lpc-r6open-sep lpc-r6open-fadein" style={delay(r.at)}>
								{r.text}
							</div>
						) : r.kind === "read" ? (
							<div key={i} className="lpc-r6open-read lpc-r6open-fadein" style={delay(r.at)}>
								{r.text}
							</div>
						) : r.kind === "card" ? (
							<Card key={i} row={r} />
						) : (
							<Bubble key={i} row={r} />
						),
					)}
				</div>,
			)}
		</div>
	)
}

/** The app's message field at the bottom of the window. */
const Compose = () => (
	<div className="lpc-r6open-compose" aria-hidden="true">
		<span>Message</span>
	</div>
)

// ---------------------------------------------------------------------------------------------------------------
// The wall: rows of posters drifting sideways, tilted (round 5's, unchanged in spirit).

function Wall({ data, rows = 4, className = "", style }: { data: IntroData; rows?: number; className?: string; style?: CSSProperties }) {
	const all = posters(data)
	return (
		<div className={`lpc-r6open-wall ${className}`} style={style} aria-hidden="true">
			<div className="lpc-r6open-tilt">
				{Array.from({ length: rows }, (_, i) => {
					const strip = rotate(all, i * 7)
					return (
						<div key={i} className={`lpc-r6open-strip ${i % 2 ? "lpc-r6open-rev" : ""}`}>
							{[...strip, ...strip].map((p, j) => (
								<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" />
							))}
						</div>
					)
				})}
			</div>
		</div>
	)
}

/** A small time that flips through `times` in equal steps over `d` ms from `at`; the last one stays. */
function Ticker({ times, at, d, className = "" }: { times: string[]; at: number; d: number; className?: string }) {
	const step = d / Math.max(1, times.length - 1)
	return (
		<span className={`lpc-r6open-ticker ${className}`}>
			<span className="lpc-r6open-ticker-size" aria-hidden="true">
				{times.reduce((a, b) => (b.length > a.length ? b : a), "")}
			</span>
			{times.map((t, i) => (
				<span
					key={t}
					className={i === 0 ? "lpc-r6open-flip-first" : i === times.length - 1 ? "lpc-r6open-flip-last" : "lpc-r6open-flip"}
					style={vars({ "--s": `${step}ms`, animationDelay: `calc(${at + i * step}ms * var(--k))` })}
				>
					{t}
				</span>
			))}
		</span>
	)
}

// The thread lifts just before a row would fall below the window (row heights in r6open.css, in --u; the view is
// about 41u tall, 39u with B's taller header). Each step is where the next row's bottom needs it.
// A climb comes before the typing dots of the answer it makes room for, so nothing appears below the window.
const CLIMBS_A = [
	{ at: 1150, to: 5 },
	{ at: 2550, to: 42 },
	{ at: 4150, to: 84 },
]
const CLIMBS_B = [
	{ at: 2700, to: 32 },
	{ at: 4350, to: 63 },
]
const CLIMBS_C = [
	{ at: 1150, to: 7 },
	{ at: 2700, to: 42 },
	{ at: 4350, to: 78 },
]

// ---------------------------------------------------------------------------------------------------------------
// A. The chat's own time separators jump (8:02 PM, 9:14 PM, 10:47 PM), then "Read". The chat steps back while the
// endless wall rises behind it.

export function OpenerThread({ data }: ClipProps) {
	return (
		<Root label="What are we watching tonight? Every title turned down, then endless scrolling. Deciding is hard.">
			<Wall data={data} className="lpc-r6open-wall-up" style={delay(6000)} />
			<div className="lpc-r6open-veil lpc-r6open-fadein" style={delay(6000)} />
			<div className="lpc-r6open-window lpc-r6open-step-back" style={delay(5950)}>
				<div className="lpc-r6open-window-in lpc-r6open-rise" style={delay(0)}>
					<ChatHeader />
					<Thread rows={chatRows(data, { separators: true, times: false })} climbs={CLIMBS_A} />
					<Compose />
				</div>
			</div>
			<Tagline from={7300} sub="Every night, the same scroll." />
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. A small status-bar clock ticks from 8:02 to 10:52 while the room's light slowly drops. Then the chat shrinks
// back into the wall: it was one screen among endless others.

export function OpenerDim({ data }: ClipProps) {
	return (
		<Root label="What are we watching tonight? The evening passes, the chat shrinks into an endless wall. Deciding is hard.">
			<Wall data={data} className="lpc-r6open-wall-out" style={delay(5900)} />
			<div className="lpc-r6open-veil lpc-r6open-fadein" style={delay(6300)} />
			<div className="lpc-r6open-window lpc-r6open-shrink" style={delay(5800)}>
				<div className="lpc-r6open-window-in lpc-r6open-rise" style={delay(0)}>
					<ChatHeader
						status={
							<div className="lpc-r6open-status" aria-hidden="true">
								<Ticker times={["8:02", "8:23", "8:51", "9:14", "9:31", "10:05", "10:47", "10:52"]} at={300} d={5000} />
								<span className="lpc-r6open-bars">
									<i />
									<i />
									<i />
									<b />
								</span>
							</div>
						}
					/>
					<Thread rows={chatRows(data, { separators: false, times: false }).filter((r) => r.kind !== "read")} climbs={CLIMBS_B} />
					<Compose />
				</div>
				{/* The evening getting late: the screen's light drops while they talk. */}
				<div className="lpc-r6open-dusk" />
			</div>
			<Tagline from={7300} sub="Another evening, lost to the menu." />
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. Each message carries its own small time, so the gaps tell the story. Then the thumb keeps scrolling: the chat
// goes up and out and the wall comes up from below in the same motion.

export function OpenerReceipts({ data }: ClipProps) {
	return (
		<Root label="What are we watching tonight? Hours between the messages, then endless scrolling. Deciding is hard.">
			<Wall data={data} className="lpc-r6open-scroll-on" style={delay(5800)} />
			<div className="lpc-r6open-veil lpc-r6open-fadein" style={delay(6400)} />
			<div className="lpc-r6open-window lpc-r6open-scroll-off" style={delay(5800)}>
				<div className="lpc-r6open-window-in lpc-r6open-rise" style={delay(0)}>
					<ChatHeader />
					<Thread rows={chatRows(data, { separators: false, times: true })} climbs={CLIMBS_C} />
					<Compose />
				</div>
			</div>
			<Tagline from={7300} sub="So much to watch. Nothing to pick." />
		</Root>
	)
}
